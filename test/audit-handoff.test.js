import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initProject } from '../lib/index.js';

// The checkout's bin stands in for a globally installed ag: it is not installed in any test project.
const bin = fileURLToPath(new URL('../bin/ag.js', import.meta.url));
const ag = (cwd, ...args) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

function project(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ag-audit-handoff-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  initProject(root);
  return root;
}
/** A stub audit package that records what core handed it and checks the protocol as a real audit must. */
function installStub(root, { protocols = [1], exitCode = 0 } = {}) {
  const dir = join(root, 'node_modules/@billbliss/architecture-graph-audit');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@billbliss/architecture-graph-audit', version: '0.0.0', type: 'module', exports: { '.': { default: './index.js' } } }));
  writeFileSync(join(dir, 'index.js'), `export const protocols = ${JSON.stringify(protocols)};
export async function runAudit(args, { configPath, protocol }) {
  console.log(JSON.stringify({ args, configPath, protocol }));
  if (!protocols.includes(protocol)) { console.error('This audit needs AG 0.6 or later.'); return 1; }
  return ${String(exitCode)};
}
`);
}
const handed = result => JSON.parse(result.stdout.trim().split('\n').at(-1));

test('help lists audit whether or not the audit package is installed', t => {
  const root = project(t);
  const result = ag(root, '--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /ag audit \[--config FILE\]/);
});

test('a missing audit package prints how to install it and exits 1', t => {
  const root = project(t);
  const result = ag(root, 'audit', '--tripwires');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm install --save-dev @billbliss\/architecture-graph-audit/);
  const json = ag(root, 'audit', '--json');
  assert.equal(json.status, 1);
  const reported = JSON.parse(json.stderr);
  assert.match(reported.errors[0].message, /not installed/);
  assert(!('valid' in reported), 'audit hand-off errors are not validation results');
});

test('core passes protocol 1, and the audit reports a protocol mismatch with exit 1', t => {
  const root = project(t);
  installStub(root, { protocols: [2] });
  const result = ag(root, 'audit');
  assert.equal(result.status, 1);
  assert.equal(handed(result).protocol, 1);
  assert.match(result.stderr, /needs AG 0\.6 or later/);
});

test('a global-style ag resolves the audit from the project root, not from cwd or its own install', t => {
  const withAudit = project(t), withoutAudit = project(t);
  installStub(withAudit);
  const elsewhere = project(t);
  const found = ag(elsewhere, 'audit', '--config', join(withAudit, 'ag.config.json'));
  assert.equal(found.status, 0, found.stderr);
  assert.equal(handed(found).configPath, join(withAudit, 'ag.config.json'));
  const before = ag(elsewhere, '--config', join(withAudit, 'ag.config.json'), 'audit');
  assert.equal(before.status, 0, before.stderr);
  assert.deepEqual(handed(before).args, []);
  // Run from the project that has the audit, but configured for one that does not.
  const missing = ag(withAudit, 'audit', '--config', join(withoutAudit, 'ag.config.json'));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /not installed/);
});

test('arguments after audit pass through unparsed, and the audit decides the exit code', t => {
  const root = project(t);
  installStub(root, { exitCode: 3 });
  const args = ['baseline', 'accept', '--finding', 'check:x|dep|a.ts->b.ts', '--reason', 'Known; removed by the cutover', '--depth', 'not-a-number', '--unknown', '-x', '--', 'tail'];
  const result = ag(root, 'audit', ...args);
  assert.equal(result.status, 3, result.stderr);
  assert.deepEqual(handed(result), { args, configPath: join(root, 'ag.config.json'), protocol: 1 });
});

test('an audit that returns no integer exit code fails closed with exit 1', t => {
  for (const exitCode of ['undefined', '"0"', '1.5', '-1', '256']) {
    const root = project(t);
    installStub(root, { exitCode });
    const result = ag(root, 'audit');
    assert.equal(result.status, 1, exitCode);
    assert.match(result.stderr, /audit returned no exit code/, exitCode);
  }
});
