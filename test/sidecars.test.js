import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { validateGraph, loadProject, summarize, renderArtifacts, getContext, sidecarValidator } from '../lib/index.js';

const fixture = JSON.parse(readFileSync(new URL('../examples/hello-world/stages/proposed.json', import.meta.url)));
const greetingSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object', required: ['text', 'tone'], additionalProperties: false,
  properties: { text: { type: 'string', minLength: 1 }, tone: { enum: ['friendly', 'formal'] }, at: { type: 'string', format: 'date-time' } },
};
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'ag-sidecar-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
  };
  write('requirements.md', 'Actual requirements');
  write('contracts/greeting.schema.json', greetingSchema);
  write('contracts/examples/greeting.json', { text: 'Hello, Ada!', tone: 'friendly' });
  const graph = structuredClone(fixture);
  const contract = graph.nodes.find(node => node.kind === 'contract');
  contract.references.push({ kind: 'schema', path: 'contracts/greeting.schema.json' }, { kind: 'example', path: 'contracts/examples/greeting.json' });
  const codes = () => validateGraph(graph, root).map(error => error.code);
  return { root, graph, contract, write, codes };
}

test('a contract with a matching schema and example is valid', t => {
  const p = setup(t);
  assert.deepEqual(validateGraph(p.graph, p.root), []);
});
test('an example that does not match its schema is reported with the failing location', t => {
  const p = setup(t);
  p.write('contracts/examples/greeting.json', { text: '', tone: 'shouty', extra: 1 });
  const errors = validateGraph(p.graph, p.root).filter(error => error.code === 'sidecar-example');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /contracts\/examples\/greeting\.json does not match/);
  assert.match(errors[0].message, /\/text/);
});
test('formats are checked, not ignored', t => {
  const p = setup(t);
  p.write('contracts/examples/greeting.json', { text: 'Hi', tone: 'formal', at: 'yesterday' });
  assert(p.codes().includes('sidecar-example'));
});
test('sidecars are only allowed on contract, data_object and artifact nodes, never on relationships', t => {
  const p = setup(t);
  const component = p.graph.nodes.find(node => node.kind === 'component');
  component.references.push({ kind: 'schema', path: 'contracts/greeting.schema.json' });
  p.graph.relationships[0].references = [{ kind: 'example', path: 'contracts/examples/greeting.json' }];
  assert.equal(p.codes().filter(code => code === 'sidecar-kind').length, 2);
});
test('at most one schema, and examples need a schema', t => {
  const p = setup(t);
  p.contract.references.push({ kind: 'schema', path: 'contracts/greeting.schema.json' });
  assert(p.codes().includes('sidecar-schema-count'));
  p.contract.references = p.contract.references.filter(ref => ref.kind !== 'schema');
  assert(p.codes().includes('sidecar-example-without-schema'));
});
test('invalid schemas are rejected: unknown keywords, unknown formats, unsupported dialects, non-JSON files', t => {
  const p = setup(t);
  for (const schema of [
    { ...greetingSchema, requird: ['text'] },
    { ...greetingSchema, properties: { text: { type: 'string', format: 'not-a-format' } } },
    { ...greetingSchema, $schema: 'http://json-schema.org/draft-04/schema#' },
    { ...greetingSchema, type: 'not-a-type' },
  ]) {
    p.write('contracts/greeting.schema.json', schema);
    assert(p.codes().includes('sidecar-schema'), JSON.stringify(schema).slice(0, 80));
  }
  p.write('contracts/greeting.schema.json', '{ not json');
  assert(p.codes().includes('sidecar-schema'));
  p.write('contracts/greeting.yaml', 'type: object');
  p.contract.references = p.contract.references.map(ref => ref.kind === 'schema' ? { ...ref, path: 'contracts/greeting.yaml' } : ref);
  assert(p.codes().includes('sidecar-schema'));
});
test('draft-07 schemas are supported', t => {
  const p = setup(t);
  p.write('contracts/greeting.schema.json', { ...greetingSchema, $schema: 'http://json-schema.org/draft-07/schema#' });
  assert.deepEqual(validateGraph(p.graph, p.root), []);
});
test('relative $ref between project files resolves; network and escaping references do not', t => {
  const p = setup(t);
  p.write('contracts/shared/tone.schema.json', { $schema: greetingSchema.$schema, enum: ['friendly', 'formal'] });
  p.write('contracts/greeting.schema.json', { ...greetingSchema, properties: { ...greetingSchema.properties, tone: { $ref: 'shared/tone.schema.json' } } });
  assert.deepEqual(validateGraph(p.graph, p.root), []);
  p.write('contracts/examples/greeting.json', { text: 'Hi', tone: 'grumpy' });
  assert(p.codes().includes('sidecar-example'), 'referenced schema is enforced');
  for (const ref of ['https://example.com/tone.json', '../../outside.json', 'shared/missing.schema.json']) {
    p.write('contracts/greeting.schema.json', { ...greetingSchema, properties: { ...greetingSchema.properties, tone: { $ref: ref } } });
    assert(p.codes().includes('sidecar-schema'), ref);
  }
});
test('YAML examples are parsed with the authored-graph rules', t => {
  const p = setup(t);
  p.write('contracts/examples/greeting.yaml', 'text: Hello\ntone: formal\n');
  p.contract.references = p.contract.references.map(ref => ref.kind === 'example' ? { ...ref, path: 'contracts/examples/greeting.yaml' } : ref);
  assert.deepEqual(validateGraph(p.graph, p.root), []);
  p.write('contracts/examples/greeting.yaml', 'a: &x 1\nb: *x\n');
  assert(p.codes().includes('sidecar-example-parse'));
  p.write('contracts/examples/greeting.txt', 'hello');
  p.contract.references = p.contract.references.map(ref => ref.kind === 'example' ? { ...ref, path: 'contracts/examples/greeting.txt' } : ref);
  assert(p.codes().includes('sidecar-example-parse'));
});
test('a sidecar reference does not satisfy the implemented-status rule', t => {
  const p = setup(t);
  p.contract.status = 'implemented';
  assert(p.codes().includes('implemented-source'));
});
test('graphs without sidecars are unaffected, and summary reports coverage for backfill', t => {
  const p = setup(t);
  const plain = structuredClone(fixture);
  assert.deepEqual(validateGraph(plain, p.root), []);
  p.write('ag.config.json', { configVersion: '1', graph: 'architecture/graph.json', generated: 'architecture/generated' });
  p.graph.nodes.push({ id: 'contract:farewell', kind: 'contract', name: 'Farewell', description: 'Says goodbye.', status: 'proposed', references: [] });
  p.write('architecture/graph.json', p.graph);
  const project = loadProject(join(p.root, 'ag.config.json'));
  assert.deepEqual(summarize(project).sidecars, { eligible: 2, withSchema: 1, withExamples: 1, withoutSchema: ['contract:farewell'] });
  assert.match(renderArtifacts(project)['guidance.md'], /1 of 2 contracts, data objects and artifacts have a schema sidecar/);
  const context = getContext(project, { file: 'contracts/greeting.schema.json' });
  assert.deepEqual(context.seeds, [p.contract.id]);
});
test("AG's real context output matches the bounded-context sidecar schema", () => {
  const root = new URL('..', import.meta.url).pathname;
  const project = loadProject(join(root, 'ag.config.json'));
  const node = project.graph.nodes.find(item => item.id === 'contract:bounded-context');
  const schemaPath = node.references.find(ref => ref.kind === 'schema').path;
  const check = sidecarValidator(project.root, schemaPath);
  for (const options of [{ id: 'contract:bounded-context' }, { module: 'module:context', depth: 2 }, { query: 'context', maxNodes: 3 }]) {
    const result = check(JSON.parse(JSON.stringify(getContext(project, options))));
    assert(result.valid, `${JSON.stringify(options)}: ${result.errors.join('; ')}`);
  }
  assert.equal(check({ ...getContext(project, { id: 'contract:bounded-context' }), truncated: 'no' }).valid, false, 'the schema is not vacuous');
  assert.throws(() => sidecarValidator(project.root, 'docs/reference.md'), /schemas must be \.json files/);
});
