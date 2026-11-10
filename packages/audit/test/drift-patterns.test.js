import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { ReportSchema, runAudit } from '../lib/index.js';
import { ag } from './helpers.js';

// One committed fixture per drift pattern with a version 1 response (docs/specs/architecture-audit.md,
// "How the drift patterns map"). Each passes core validation and fails the audit for the stated reason,
// through the real `ag audit` hand-off resolving this workspace's audit package.
const fixture = name => join(import.meta.dirname, 'fixtures', name, 'ag.config.json');
const patterns = [
  ['specifics-in-the-platform', 'check:platform-independent-of-features|dep|src/platform/assemble-report.ts->src/features/fine-grained/compile.ts'],
  ['blended-result', 'check:report-route-single-path|reach|src/routes/create-report.ts->src/alternates/estimated-totals.ts'],
  ['shadow-authority', 'check:production-avoids-harness|reach|src/server/main.ts->src/harness/trial-rules.ts'],
];
const BRIDGE = 'check:export-avoids-legacy|reach|src/routes/export.ts->src/legacy/exporter.ts';

for (const [name, key] of patterns) {
  test(`drift pattern ${name}: ag validate passes, ag audit fails with ${key.split('|')[1]}`, () => {
    const validated = ag('validate', '--config', fixture(name));
    assert.equal(validated.status, 0, validated.stderr);
    const audited = ag('audit', '--config', fixture(name), '--json');
    assert.equal(audited.status, 3, audited.stderr);
    const report = JSON.parse(audited.stdout);
    assert(ReportSchema.safeParse(report).success);
    assert.deepEqual(report.findings.map(f => [f.classification, f.key]), [['new', key]]);
    assert.equal(report.coverage.unresolvedImports, 0);
  });
}

/** A writable copy of a fixture, audited in-process because a temporary directory cannot resolve the workspace's audit package. */
function copy(t, name) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ag-drift-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(import.meta.dirname, 'fixtures', name), root, { recursive: true });
  const audit = async (...args) => {
    const out = [];
    t.mock.method(console, 'log', line => out.push(line));
    t.mock.method(console, 'error', line => out.push(line));
    const code = await runAudit(['--json', ...args], { configPath: join(root, 'ag.config.json'), protocol: 1 });
    t.mock.restoreAll();
    return { code, json: JSON.parse(out.join('\n')) };
  };
  return { root, audit, baseline: () => parse(readFileSync(join(root, 'architecture/audit-baseline.yaml'), 'utf8')).findings };
}

test('drift pattern permanent-bridge: baselined until the cutover, then resolved and pruned', async t => {
  const validated = ag('validate', '--config', fixture('permanent-bridge'));
  assert.equal(validated.status, 0, validated.stderr);
  const audited = ag('audit', '--config', fixture('permanent-bridge'), '--json');
  assert.equal(audited.status, 0, audited.stderr);
  assert.deepEqual(JSON.parse(audited.stdout).findings.map(f => [f.classification, f.key]), [['baselined', BRIDGE]]);

  const unaccepted = copy(t, 'permanent-bridge');
  writeFileSync(join(unaccepted.root, 'architecture/audit-baseline.yaml'), 'baselineVersion: "1"\nfindings: []\n');
  const failing = await unaccepted.audit();
  assert.equal(failing.code, 3, 'without the baseline entry the bridge is a new finding');
  assert.deepEqual(failing.json.findings.map(f => [f.classification, f.key]), [['new', BRIDGE]]);

  const cutover = copy(t, 'permanent-bridge');
  writeFileSync(join(cutover.root, 'src/routes/export.ts'), "import { exportRows } from '../export/exporter.js';\n\nexport const handleExport = (rows: string[]): string => exportRows(rows);\n");
  rmSync(join(cutover.root, 'src/export/bridge.ts'));
  const resolved = await cutover.audit();
  assert.equal(resolved.code, 3, 'the cutover must remove the baseline entry in the same change');
  assert.deepEqual(resolved.json.findings.map(f => [f.classification, f.key]), [['resolved', BRIDGE]]);
  assert.deepEqual((await cutover.audit('baseline', 'prune')).json.pruned, [BRIDGE]);
  assert.deepEqual(cutover.baseline(), []);
  assert.equal((await cutover.audit()).code, 0);
});
