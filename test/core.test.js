// The browser-safe core: bundled for the browser platform, run without Node globals, and compared
// with the Node validation path on the bundled examples and deliberately broken fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build } from 'esbuild';
import { validateGraph, sidecarValidator, parseDeclarations } from '../lib/index.js';
import { normalizePosix } from '../lib/sidecars.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const bundle = (entry, format = 'esm') => build({
  entryPoints: [join(repo, entry)], bundle: true, platform: 'browser', format, globalName: 'AGCore',
  write: false, metafile: true, logLevel: 'silent',
});

// Load the browser bundle into a fresh realm that has browser globals but no process, require or Buffer.
const browserBundle = await bundle('lib/core.js', 'iife');
const realm = vm.createContext({ URL, TextEncoder, TextDecoder, console, setTimeout, queueMicrotask });
vm.runInContext(browserBundle.outputFiles[0].text, realm);
const core = realm.AGCore;
const into = value => vm.runInContext('JSON.parse', realm)(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));

test('the core entry point bundles for the browser without any Node built-in', async () => {
  const result = await bundle('lib/core.js');
  const modules = [...Object.keys(result.metafile.inputs), ...Object.values(result.metafile.outputs).flatMap(output => output.imports.map(item => item.path))];
  assert.deepEqual(modules.filter(path => path.startsWith('node:')), []);
  assert(Object.keys(result.metafile.inputs).some(path => path.includes('node_modules/ajv-formats/')), 'sidecar checking is part of the core');
  assert.equal(vm.runInContext('typeof process + typeof require + typeof Buffer', realm), 'undefinedundefinedundefined');
});
test('the bundle check detects Node built-ins (control: the Node entry point fails it)', async () => {
  await assert.rejects(bundle('lib/index.js'), error => error.errors.some(item => /node:/.test(item.text)));
});

function filesUnder(root, skip = ['node_modules', '.git']) {
  const files = {};
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files[relative(root, path).split('\\').join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(root);
  return files;
}
function loadGraph(root) {
  const config = JSON.parse(readFileSync(join(root, 'ag.config.json'), 'utf8'));
  return parseDeclarations(readFileSync(join(root, config.graph), 'utf8'), config.graph);
}
/** A source that answers every request asynchronously, as browser folder handles and fetch do. */
const delayed = source => ({
  stat: path => new Promise(done => setTimeout(() => done(source.stat(path)), 0)),
  read: path => new Promise((done, fail) => setTimeout(() => { try { done(source.read(path)); } catch (error) { fail(error); } }, 0)),
});
async function sameEverywhere(root, graph, files) {
  const expected = validateGraph(graph, root);
  const source = core.memoryFileSource(into(files));
  assert.deepEqual(plain(core.validateGraphSync(into(graph), source)), expected, 'sync core');
  assert.deepEqual(plain(await core.validateGraph(into(graph), source)), expected, 'async core, sync answers');
  assert.deepEqual(plain(await core.validateGraph(into(graph), delayed(source))), expected, 'async core, async answers');
  return expected;
}

for (const [label, root] of [['AG self-model', repo], ['task-manager', join(repo, 'examples/task-manager')], ['hello-world', join(repo, 'examples/hello-world')]]) {
  test(`core and Node validation agree on the bundled ${label} example`, async () => {
    assert.deepEqual(await sameEverywhere(root, loadGraph(root), filesUnder(root)), []);
  });
}

const node = (graph, id) => graph.nodes.find(item => item.id === id);
const broken = {
  'missing reference file': g => { node(g, 'contract:task').references.push({ kind: 'design', path: 'docs/absent.md' }); },
  'directory as reference': g => { node(g, 'contract:task').references.push({ kind: 'design', path: 'contracts' }); },
  'paths outside the project rules': g => { node(g, 'contract:task').references.push({ kind: 'design', path: '../requirements.md' }, { kind: 'design', path: 'contracts//task.schema.json' }, { kind: 'design', path: '/etc/hosts' }); },
  'example does not match its schema': (g, f) => { f['contracts/examples/task.json'] = JSON.stringify({ ...JSON.parse(f['contracts/examples/task.json']), title: '', extra: true }); },
  'cross-file $ref: nested example error': (g, f) => { const event = JSON.parse(f['contracts/examples/task-changed.json']); event.task.version = 'four'; f['contracts/examples/task-changed.json'] = JSON.stringify(event); },
  'cross-file $ref: referenced schema missing': (g, f) => { delete f['contracts/task.schema.json']; },
  'cross-file $ref: remote reference': (g, f) => { f['contracts/task-changed.schema.json'] = f['contracts/task-changed.schema.json'].replace('"task.schema.json"', '"https://example.com/task.schema.json"'); },
  'cross-file $ref: dialect mismatch': (g, f) => { f['contracts/task.schema.json'] = JSON.stringify({ ...JSON.parse(f['contracts/task.schema.json']), $schema: 'http://json-schema.org/draft-07/schema#' }); },
  'schema rejected by strict mode': (g, f) => { f['contracts/task.schema.json'] = JSON.stringify({ ...JSON.parse(f['contracts/task.schema.json']), madeUpKeyword: 1 }); },
  'schema is not JSON': (g, f) => { f['contracts/reminder-due.schema.json'] = '{ not json'; },
  'example is not parseable': (g, f) => { f['contracts/examples/task.json'] = '{ "id": '; },
  'directory named like a sidecar': (g, f) => { delete f['contracts/task.schema.json']; f['contracts/task.schema.json/README.md'] = 'not a schema'; },
  'sidecar on the wrong kind and on a relationship': g => {
    g.nodes.find(item => item.kind === 'component').references.push({ kind: 'schema', path: 'contracts/task.schema.json' });
    g.relationships[0].references.push({ kind: 'example', path: 'contracts/examples/task.json' });
  },
};
for (const [label, mutate] of Object.entries(broken)) {
  test(`core and Node validation agree on a broken fixture: ${label}`, async t => {
    const root = mkdtempSync(join(tmpdir(), 'ag-core-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const example = join(repo, 'examples/task-manager');
    const graph = loadGraph(example), files = filesUnder(example);
    mutate(graph, files);
    for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); }
    const errors = await sameEverywhere(root, graph, files);
    assert(errors.length, 'the fixture must actually be broken');
    for (const error of errors) assert(!error.message.includes(root) && !/ENOENT|EISDIR/.test(error.message), `portable message: ${error.message}`);
  });
}

test('a missing reference has a portable message', async t => {
  const root = mkdtempSync(join(tmpdir(), 'ag-core-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repo, 'examples/task-manager'), root, { recursive: true });
  const graph = loadGraph(root);
  node(graph, 'contract:task').references.push({ kind: 'design', path: 'docs/absent.md' });
  assert.deepEqual(validateGraph(graph, root), [{ code: 'reference', at: 'contract:task', message: 'docs/absent.md: file not found' }]);
});

test('sidecarValidator gives the same answers from the core and from Node', async () => {
  const root = join(repo, 'examples/task-manager');
  const source = core.memoryFileSource(into(filesUnder(root)));
  const event = JSON.parse(readFileSync(join(root, 'contracts/examples/task-changed.json'), 'utf8'));
  const bad = { ...event, task: { ...event.task, version: 'four' } };
  const checks = [sidecarValidator(root, 'contracts/task-changed.schema.json'), core.sidecarValidatorSync(source, 'contracts/task-changed.schema.json'), await core.sidecarValidator(source, 'contracts/task-changed.schema.json')];
  for (const check of checks) {
    assert.deepEqual(plain(check(into(event))), { valid: true, errors: [] });
    assert.deepEqual(plain(check(into(bad))), plain(checks[0](bad)));
  }
  await assert.rejects(core.sidecarValidator(core.memoryFileSource(into({})), 'contracts/absent.schema.json'), /contracts\/absent\.schema\.json: file not found/);
});

test('the core path normalizer matches Node posix.normalize', () => {
  const parts = ['', '.', '..', 'a', 'b.json', '%2e'];
  const samples = new Set(['', '/', '//', './', '../']);
  for (const a of parts) for (const b of parts) for (const c of parts) for (const lead of ['', '/']) samples.add(lead + [a, b, c].join('/')).add(lead + [a, b].join('/') + '/');
  for (const sample of samples) assert.equal(normalizePosix(sample), posix.normalize(sample), JSON.stringify(sample));
});
