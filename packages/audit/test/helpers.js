import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { loadAudit, runChecks, runAudit } from '../lib/index.js';

export const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const bin = join(repoRoot, 'bin/ag.js');
/** Run the checkout's ag; the audit resolves from the project root, through the workspace's node_modules. */
export const ag = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

/**
 * A temporary project with one guardrail and its check file. `checks` are the check file's checks;
 * `files` are extra repository files (path → text); `audit` overrides ag.audit.json fields.
 */
export function project(t, { checks, files = {}, audit = {}, baseline = [], modules = ['module:platform', 'module:features'], tsconfig } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ag-audit-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const graph = {
    schemaVersion: '1', id: 'graph:fixture', title: 'Fixture', description: 'A temporary audit fixture',
    nodes: [{
      id: 'constraint:rule', kind: 'constraint', name: 'Rule', description: 'The rule under test', status: 'proposed',
      references: [{ kind: 'check', path: 'architecture/checks/rule.yaml' }],
    }],
    relationships: [],
    modules: modules.map(id => ({ id, name: id, description: `Module ${id}`, exports: [], imports: [] })),
  };
  const all = {
    'ag.config.json': JSON.stringify({ configVersion: '1', graph: 'architecture/graph.yaml', generated: 'architecture/generated' }),
    'architecture/graph.yaml': stringify(graph),
    'architecture/checks/rule.yaml': stringify({ checkVersion: '1', checks }),
    'architecture/audit-baseline.yaml': stringify({ baselineVersion: '1', findings: baseline }),
    'tsconfig.json': JSON.stringify(tsconfig ?? { compilerOptions: { module: 'nodenext' } }),
    'ag.audit.json': JSON.stringify({
      auditVersion: '1', baseline: 'architecture/audit-baseline.yaml',
      typescript: [{ paths: ['src/**'], tsconfig: 'tsconfig.json' }],
      modules: { 'module:platform': ['src/platform/**'], 'module:features': ['src/features/**'] },
      ...audit,
    }),
    ...files,
  };
  for (const [path, text] of Object.entries(all)) {
    if (text === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const config = join(root, 'ag.config.json');
  return {
    root, config,
    report: (selected) => { const audit = loadAudit(config); return runChecks(audit, selected ? audit.checks.filter(c => selected.includes(c.check.id)) : audit.checks, 1); },
    load: () => loadAudit(config),
    run: async (t2, args = []) => {
      const out = [], err = [];
      t2.mock.method(console, 'log', (...line) => out.push(line.join(' ')));
      t2.mock.method(console, 'error', (...line) => err.push(line.join(' ')));
      const code = await runAudit(args, { configPath: config, protocol: 1 });
      t2.mock.restoreAll();
      return { code, stdout: out.join('\n'), stderr: err.join('\n') };
    },
  };
}
/** The platform/feature dependency check used by most discovery tests. */
export const platformCheck = (extra = {}) => [{
  id: 'check:platform-independent-of-features', kind: 'forbidden_dependency', mode: 'tripwire',
  description: 'The generic platform must not import feature code.', from: ['module:platform'], to: ['module:features'], ...extra,
}];
export const keys = report => report.findings.map(finding => `${finding.classification} ${finding.key}`);
