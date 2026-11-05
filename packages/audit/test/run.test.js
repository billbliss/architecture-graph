import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { runAudit, ReportSchema, AuditInputError, SUPPORTED_PROTOCOLS } from '../lib/index.js';
import { project, platformCheck } from './helpers.js';

const C = 'check:platform-independent-of-features';
const violating = { 'src/features/compile.ts': '', 'src/platform/report.ts': "import '../features/compile.js';\n" };
const KEY = `${C}|dep|src/platform/report.ts->src/features/compile.ts`;
const entry = (key, reason = 'Known; removed when the shared path lands.') => ({ key, reason, added: '2026-11-05' });
const codes = (p) => { try { p.load(); return []; } catch (error) { assert(error instanceof AuditInputError, error.message); return error.diagnostics.map(d => d.code); } };

test('a new finding exits 3 and the JSON report matches the published report format', async t => {
  const p = project(t, { checks: platformCheck(), files: violating });
  const result = await p.run(t, ['--json']);
  assert.equal(result.code, 3);
  const report = JSON.parse(result.stdout);
  assert(ReportSchema.safeParse(report).success);
  assert.deepEqual(report.findings.map(f => [f.classification, f.key]), [['new', KEY]]);
  assert.match(report.limitation, /does not show that the code behaves as the graph says/);
  assert.deepEqual(report.checks, [{ id: C, kind: 'forbidden_dependency', mode: 'tripwire', file: 'architecture/checks/rule.yaml', guardrails: ['constraint:rule'] }]);
  const text = await p.run(t);
  assert.match(text.stdout, new RegExp(`NEW ${KEY.replaceAll('|', '\\|')}`));
  assert.match(text.stdout, /design question/);
});

test('baselined findings pass; a resolved entry must be pruned; a clean run exits 0', async t => {
  const baselined = project(t, { checks: platformCheck(), files: violating, baseline: [entry(KEY)] });
  const result = await baselined.run(t, ['--json']);
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout).findings.map(f => [f.classification, f.reason]), [['baselined', 'Known; removed when the shared path lands.']]);
  const fixed = project(t, { checks: platformCheck(), files: { 'src/features/compile.ts': '', 'src/platform/report.ts': '' }, baseline: [entry(KEY)] });
  const resolved = await fixed.run(t, ['--json']);
  assert.equal(resolved.code, 3);
  assert.deepEqual(JSON.parse(resolved.stdout).findings.map(f => [f.classification, f.kind]), [['resolved', 'forbidden_dependency']]);
  const clean = project(t, { checks: platformCheck(), files: { 'src/platform/report.ts': '' } });
  assert.equal((await clean.run(t)).code, 0);
});

test('--base-baseline rejects baseline growth; --output writes the report where the user says', async t => {
  const p = project(t, { checks: platformCheck(), files: violating, baseline: [entry(KEY)] });
  const base = join(p.root, 'base.yaml');
  writeFileSync(base, stringify({ baselineVersion: '1', findings: [] }));
  const output = join(p.root, 'out/report.json');
  assert.equal((await p.run(t, ['--base-baseline', base, '--output', join(p.root, 'report.json')])).code, 3);
  assert.deepEqual(JSON.parse(readFileSync(join(p.root, 'report.json'), 'utf8')).baselineGrowth, [KEY]);
  writeFileSync(base, stringify({ baselineVersion: '1', findings: [entry(KEY)] }));
  assert.equal((await p.run(t, ['--base-baseline', base])).code, 0);
  assert.equal((await p.run(t, ['--base-baseline', join(p.root, 'absent.yaml')])).code, 1);
  assert.equal((await p.run(t, ['--output', output])).code, 1, 'a missing output directory is an error, not created silently');
  assert(!existsSync(output));
});

test('--tripwires and --check select checks; baseline entries of checks that did not run stay untouched', async t => {
  const audited = { id: 'check:audited-rule', kind: 'forbidden_dependency', mode: 'audited', description: 'Features do not import the platform.', from: ['module:features'], to: ['module:platform'] };
  const files = { ...violating, 'src/features/uses-platform.ts': "import '../platform/report.js';\n" };
  const p = project(t, { checks: [...platformCheck(), audited], files, baseline: [entry(`${C}|dep|src/platform/old.ts->src/features/compile.ts`)] });
  const run = async args => JSON.parse((await p.run(t, ['--json', ...args])).stdout);
  assert.deepEqual((await run([])).findings.map(f => f.classification).sort(), ['new', 'new', 'resolved']);
  assert.deepEqual((await run(['--tripwires'])).checks.map(c => c.id), [C]);
  const one = await run(['--check', 'check:audited-rule']);
  assert.deepEqual(one.findings.map(f => [f.classification, f.check]), [['new', 'check:audited-rule']]);
  assert.equal((await p.run(t, ['--check', 'check:absent'])).code, 1);
  assert.equal((await p.run(t, ['--tripwires', '--check', 'check:audited-rule'])).code, 1);
});

test('baseline entries for a check that no longer exists are resolved', async t => {
  const p = project(t, { checks: platformCheck(), files: { 'src/platform/report.ts': '' }, baseline: [entry('check:deleted|dep|a.ts->b.ts')] });
  const report = JSON.parse((await p.run(t, ['--json', '--tripwires'])).stdout);
  assert.deepEqual(report.findings.map(f => [f.classification, f.check]), [['resolved', 'check:deleted']]);
});

test('ag audit validate checks the audit files, and every run validates first', async t => {
  const ok = project(t, { checks: platformCheck(), files: violating });
  const valid = await ok.run(t, ['validate']);
  assert.equal(valid.code, 0);
  assert.match(valid.stdout, /Valid audit files: 1 check in 1 check file\./);
  const reach = (extra) => [{ id: 'check:reach', kind: 'forbidden_reachability', mode: 'tripwire', description: 'Entry must not reach features.', entries: ['src/entry.ts'], forbidden: ['module:features'], ...extra }];
  const cases = [
    ['check-id', { checks: [...platformCheck(), ...platformCheck()] }],
    ['module', { checks: platformCheck({ to: ['module:unknown'] }) }],
    ['module', { checks: platformCheck(), audit: { modules: { 'module:platform': ['src/platform/**'], 'module:features': ['src/features/**'], 'module:stray': ['x/**'] } } }],
    ['module', { checks: platformCheck(), audit: { modules: { 'module:platform': ['src/platform/**'] } } }],
    ['glob', { checks: platformCheck({ from: ['../src/**'] }) }],
    ['glob', { checks: platformCheck({ from: ['src/{a,b}/**'] }) }],
    ['module-overlap', { checks: platformCheck(), audit: { modules: { 'module:platform': ['src/**'], 'module:features': ['src/features/**'] } } }],
    ['baseline', { checks: platformCheck(), files: { 'architecture/audit-baseline.yaml': null } }],
    ['baseline', { checks: platformCheck(), baseline: [entry(KEY), entry(KEY)] }],
    ['tsconfig', { checks: platformCheck(), audit: { typescript: [{ paths: ['src/**'], tsconfig: 'missing/tsconfig.json' }] } }],
    ['entry', { checks: reach() }],
    ['package-pattern', { checks: reach({ forbiddenPackages: ['not a package'] }), files: { 'src/entry.ts': '' } }],
    ['check-file', { checks: [{ id: 'check:x', kind: 'forbidden_import', mode: 'tripwire', description: 'Unknown kind' }] }],
    ['audit-config', { checks: platformCheck(), audit: { auditVersion: '2' } }],
  ];
  for (const [code, options] of cases) {
    const p = project(t, { files: violating, ...options, files: { ...violating, ...options.files } });
    assert(codes(p).includes(code), `${code}: ${JSON.stringify(codes(p))}`);
    const run = await p.run(t, ['--json']);
    assert.equal(run.code, 1, code);
    assert(JSON.parse(run.stderr).errors.some(e => e.code === code), code);
  }
});

test('an analyzed file must match exactly one typescript entry', async t => {
  const none = project(t, { checks: platformCheck(), files: violating, audit: { typescript: [{ paths: ['lib/**'], tsconfig: 'tsconfig.json' }] } });
  const result = await none.run(t);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /src\/platform\/report\.ts must match exactly one typescript entry.*matches 0/);
  const two = project(t, { checks: platformCheck(), files: violating, audit: { typescript: [{ paths: ['src/**'], tsconfig: 'tsconfig.json' }, { paths: ['src/platform/**'], tsconfig: 'tsconfig.json' }] } });
  assert.match((await two.run(t)).stderr, /matches 2/);
});

test('protocol, arguments and the ignored --config follow the hand-off contract', async t => {
  assert.deepEqual(SUPPORTED_PROTOCOLS, [1]);
  const p = project(t, { checks: platformCheck(), files: violating });
  const newer = await runAudit([], { configPath: p.config, protocol: 2 }).catch(() => 'threw');
  assert.equal(newer, 1);
  for (const args of [['--unknown'], ['nonsense'], ['validate', '--tripwires'], ['baseline', 'explode']]) {
    assert.equal((await p.run(t, args)).code, 1, args.join(' '));
  }
  const ignored = await p.run(t, ['--config', '/nowhere/ag.config.json', '--json']);
  assert.equal(ignored.code, 3);
  assert.match((await p.run(t, ['--help'])).stdout, /ag audit \[--tripwires\]/);
});

test('missing audit configuration is invalid input', async t => {
  const p = project(t, { checks: platformCheck(), files: violating });
  rmSync(join(p.root, 'ag.audit.json'));
  const result = await p.run(t);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Audit configuration not found/);
  writeFileSync(join(p.root, 'elsewhere.json'), JSON.stringify({ auditVersion: '1', baseline: 'architecture/audit-baseline.yaml', typescript: [{ paths: ['src/**'], tsconfig: 'tsconfig.json' }], modules: { 'module:platform': ['src/platform/**'], 'module:features': ['src/features/**'] } }));
  assert.equal((await p.run(t, ['--audit-config', join(p.root, 'elsewhere.json')])).code, 3);
});
