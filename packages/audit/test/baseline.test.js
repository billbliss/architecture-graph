import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { project, platformCheck } from './helpers.js';

const C = 'check:platform-independent-of-features';
const violating = { 'src/features/compile.ts': '', 'src/platform/report.ts': "import '../features/compile.js';\n" };
const KEY = `${C}|dep|src/platform/report.ts->src/features/compile.ts`;
const REASON = 'The report still compiles features directly; removed when the registry lands.';
const baselineOf = p => parse(readFileSync(join(p.root, 'architecture/audit-baseline.yaml'), 'utf8'));

test('baseline accept adds one current new finding with its reason and today\'s date', async t => {
  const p = project(t, { checks: platformCheck(), files: violating });
  const path = join(p.root, 'architecture/audit-baseline.yaml');
  writeFileSync(path, '# Reviewed like code.\n' + readFileSync(path, 'utf8'));
  const result = await p.run(t, ['baseline', 'accept', '--finding', KEY, '--reason', `  ${REASON} `]);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(baselineOf(p).findings, [{ key: KEY, reason: REASON, added: new Date().toISOString().slice(0, 10) }]);
  assert.match(readFileSync(path, 'utf8'), /^# Reviewed like code\./, 'comments in the baseline survive');
  assert.equal((await p.run(t)).code, 0, 'the accepted finding is now baselined');
  assert.match((await p.run(t, ['baseline', 'accept', '--finding', KEY, '--reason', REASON])).stderr, /already in the baseline/);
});

test('baseline accept needs one key and a reason, and only accepts current findings', async t => {
  const p = project(t, { checks: platformCheck(), files: violating });
  const cases = [
    [['baseline', 'accept', '--reason', REASON], /needs --finding/],
    [['baseline', 'accept', '--finding', KEY], /needs --reason/],
    [['baseline', 'accept', '--finding', KEY, '--reason', '   '], /needs --reason/],
    [['baseline', 'accept', '--finding', `${C}|dep|src/platform/a.ts->src/features/b.ts`, '--reason', REASON], /not a current finding/],
    [['baseline', 'accept', '--finding', `check:absent|dep|a.ts->b.ts`, '--reason', REASON], /No check check:absent/],
    [['baseline', 'accept', '--finding', '*', '--reason', REASON], /No check \*/],
    [['baseline', 'accept', '--all', '--reason', REASON], /Unknown option/],
  ];
  for (const [args, message] of cases) {
    const result = await p.run(t, args);
    assert.equal(result.code, 1, args.join(' '));
    assert.match(result.stderr, message, args.join(' '));
  }
  assert.deepEqual(baselineOf(p).findings, [], 'nothing was written');
});

test('baseline prune removes resolved entries, including those of deleted checks, and keeps the rest', async t => {
  const still = { key: KEY, reason: REASON, added: '2026-11-05' };
  const gone = { key: `${C}|dep|src/platform/old.ts->src/features/compile.ts`, reason: 'Old.', added: '2026-11-01' };
  const deleted = { key: 'check:deleted|dep|a.ts->b.ts', reason: 'Deleted check.', added: '2026-11-01' };
  const p = project(t, { checks: platformCheck(), files: violating, baseline: [still, gone, deleted] });
  assert.equal((await p.run(t)).code, 3);
  const result = await p.run(t, ['baseline', 'prune', '--json']);
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout).pruned, [deleted.key, gone.key]);
  assert.deepEqual(baselineOf(p).findings, [still]);
  assert.equal((await p.run(t)).code, 0);
  assert.match((await p.run(t, ['baseline', 'prune'])).stdout, /No resolved baseline entries/);
});

test('a JSON baseline is rewritten as JSON', async t => {
  const p = project(t, { checks: platformCheck(), files: { ...violating, 'architecture/audit-baseline.json': JSON.stringify({ baselineVersion: '1', findings: [] }) },
    audit: { baseline: 'architecture/audit-baseline.json' } });
  assert.equal((await p.run(t, ['baseline', 'accept', '--finding', KEY, '--reason', REASON])).code, 0);
  assert.equal(JSON.parse(readFileSync(join(p.root, 'architecture/audit-baseline.json'), 'utf8')).findings[0].key, KEY);
});
