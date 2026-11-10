import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { parseArgs } from 'node:util';
import { AuditConfigurationError } from './discovery.js';
import { Analyzer, runCheck, type RawFinding } from './checks.js';
import { AuditInputError, loadAudit, parseBaseline, type Audit, type LoadedCheck } from './load.js';
import type { Finding, FindingKind, Report } from './formats.js';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string };
export const VERSION = manifest.version;
/** Hand-off protocol numbers this audit accepts from core's `ag audit`. */
export const SUPPORTED_PROTOCOLS: readonly number[] = [1];
export const AUDIT_LIMIT = 'Advisory structural findings only: within the declared scopes and the supported import grammar. A clean audit does not show that the code behaves as the graph says, that allowed paths are correct, or that the checks cover everything important.';

const HELP = `Architecture Audit ${VERSION}
Usage:
  ag audit [--tripwires] [--check ID] [--audit-config FILE] [--json] [--output FILE] [--base-baseline FILE]
  ag audit validate [--audit-config FILE] [--json]
  ag audit baseline accept --finding KEY --reason TEXT [--audit-config FILE] [--json]
  ag audit baseline prune [--audit-config FILE] [--json]
Exit codes: 0 no new findings or resolved baseline entries; 1 invalid input or configuration; 3 new findings, resolved baseline entries to prune, or baseline growth.
${AUDIT_LIMIT}`;

export interface AuditContext { configPath: string; protocol: number }
const OPTIONS = {
  tripwires: { type: 'boolean' }, check: { type: 'string' }, 'audit-config': { type: 'string' }, json: { type: 'boolean' },
  output: { type: 'string' }, 'base-baseline': { type: 'string' }, config: { type: 'string' }, help: { type: 'boolean' },
  finding: { type: 'string' }, reason: { type: 'string' },
} as const;
const ALLOWED: Record<string, string[]> = {
  audit: ['tripwires', 'check', 'audit-config', 'json', 'output', 'base-baseline', 'config'],
  validate: ['audit-config', 'json', 'config'],
  'baseline accept': ['finding', 'reason', 'audit-config', 'json', 'config'],
  'baseline prune': ['audit-config', 'json', 'config'],
};

/**
 * The audit's one entry point, called by core's `ag audit` hand-off. Resolves to the process exit code.
 * `--config` is accepted and ignored: `context.configPath` is authoritative.
 */
export async function runAudit(args: string[], context: AuditContext): Promise<number> {
  let asJSON = args.includes('--json');
  try {
    if (!SUPPORTED_PROTOCOLS.includes(context.protocol)) {
      const newest = Math.max(...SUPPORTED_PROTOCOLS);
      throw new Error(context.protocol > newest
        ? `AG uses hand-off protocol ${context.protocol}, but ${manifest.name} ${VERSION} supports only ${SUPPORTED_PROTOCOLS.join(', ')}; update ${manifest.name}`
        : `AG uses hand-off protocol ${context.protocol}, but ${manifest.name} ${VERSION} needs protocol ${SUPPORTED_PROTOCOLS.join(' or ')}; update @billbliss/architecture-graph`);
    }
    const { values, positionals } = parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true });
    asJSON = values.json ?? false;
    if (values.help) { console.log(HELP); return 0; }
    const command = positionals.join(' ') || 'audit';
    const allowed = ALLOWED[command];
    if (!allowed) throw new Error(`Unknown audit command: ${command}; use ag audit --help`);
    for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`--${key} is not valid for ag audit ${command === 'audit' ? '' : command}`.trim());
    const audit = loadAudit(context.configPath, values['audit-config']);
    if (command === 'validate') {
      const files = new Set(audit.checks.map(check => check.file)).size;
      const message = `Valid audit files: ${audit.checks.length} check${audit.checks.length === 1 ? '' : 's'} in ${files} check file${files === 1 ? '' : 's'}.`;
      console.log(asJSON ? JSON.stringify({ valid: true, checks: audit.checks.length, checkFiles: files, limitation: AUDIT_LIMIT }) : `${message} ${AUDIT_LIMIT}`);
      return 0;
    }
    if (command === 'baseline accept') return accept(audit, values.finding, values.reason, context.protocol, asJSON);
    if (command === 'baseline prune') return prune(audit, context.protocol, asJSON);
    const selected = select(audit, values.tripwires ?? false, values.check);
    const report = runChecks(audit, selected, context.protocol, values['base-baseline']);
    if (values.output) writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n');
    console.log(asJSON ? JSON.stringify(report, null, 2) : formatReport(report));
    return report.summary.exitCode;
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const errors = error instanceof AuditInputError ? error.diagnostics
      : [{ code: error instanceof AuditConfigurationError ? 'audit-config' : 'input', at: '', message: error.message }];
    console.error(asJSON ? JSON.stringify({ errors }) : error.message);
    return 1;
  }
}

function select(audit: Audit, tripwires: boolean, id: string | undefined): LoadedCheck[] {
  let checks = audit.checks;
  if (tripwires) checks = checks.filter(loaded => loaded.check.mode === 'tripwire');
  if (id !== undefined) {
    checks = checks.filter(loaded => loaded.check.id === id);
    if (!checks.length) throw new Error(audit.checks.some(loaded => loaded.check.id === id) ? `${id} is not a tripwire` : `No check ${id} is declared in a guardrail's check files`);
  }
  return checks;
}

/** Rewrite the baseline file with these entries, keeping YAML comments and layout where the file is YAML. */
function writeBaseline(audit: Audit, findings: Audit['baseline']['findings']): void {
  const path = join(audit.root, audit.config.baseline);
  const baseline = { baselineVersion: '1' as const, findings };
  if (audit.config.baseline.endsWith('.json')) { writeFileSync(path, JSON.stringify(baseline, null, 2) + '\n'); return; }
  const document = parseDocument(readFileSync(path, 'utf8'));
  document.set('findings', document.createNode(findings));
  writeFileSync(path, document.toString({ lineWidth: 0 }));
}

/** Add one current, new finding to the baseline with a reason. There is deliberately no way to accept every finding. */
function accept(audit: Audit, key: string | undefined, reason: string | undefined, protocol: number, asJSON: boolean): number {
  if (!key) throw new Error('baseline accept needs --finding KEY: the key of one current finding');
  if (!reason?.trim()) throw new Error('baseline accept needs --reason TEXT: why this finding is acceptable for now and what removes it');
  const id = key.split('|')[0]!;
  const loaded = audit.checks.find(candidate => candidate.check.id === id);
  if (!loaded) throw new Error(`No check ${id} is declared in a guardrail's check files`);
  const finding = runChecks(audit, [loaded], protocol).findings.find(candidate => candidate.key === key);
  if (!finding || finding.classification === 'resolved') throw new Error(`${key} is not a current finding; run ag audit --check ${id} to see the current keys`);
  if (finding.classification === 'baselined') throw new Error(`${key} is already in the baseline`);
  const entry = { key, reason: reason.trim(), added: new Date().toISOString().slice(0, 10) };
  writeBaseline(audit, [...audit.baseline.findings, entry]);
  console.log(asJSON ? JSON.stringify({ accepted: entry }) : `Accepted ${key} into ${audit.config.baseline}. Review this addition like code.`);
  return 0;
}

/** Remove every resolved entry: those whose finding no longer occurs, or whose check no longer exists. */
function prune(audit: Audit, protocol: number, asJSON: boolean): number {
  const resolved = new Set(runChecks(audit, audit.checks, protocol).findings.filter(finding => finding.classification === 'resolved').map(finding => finding.key));
  if (resolved.size) writeBaseline(audit, audit.baseline.findings.filter(entry => !resolved.has(entry.key)));
  const keys = [...resolved].sort();
  console.log(asJSON ? JSON.stringify({ pruned: keys }) : keys.length ? keys.map(key => `PRUNED ${key}`).join('\n') : 'No resolved baseline entries to prune.');
  return 0;
}

const kindOfKey = (key: string): FindingKind => {
  const part = key.split('|')[1];
  return part === 'dep' ? 'forbidden_dependency' : part === 'reach' ? 'forbidden_reachability' : 'unresolved_import';
};

/** Run checks and classify each finding against the baseline: new, baselined, or a resolved entry that must be pruned. */
export function runChecks(audit: Audit, checks: LoadedCheck[], protocol: number, baseBaseline?: string): Report {
  const analyzer = new Analyzer(audit);
  const found = new Map<string, RawFinding>();
  for (const loaded of checks) for (const finding of runCheck(audit, analyzer, loaded)) if (!found.has(finding.key)) found.set(finding.key, finding);
  const entries = new Map(audit.baseline.findings.map(entry => [entry.key, entry]));
  const ran = new Set(checks.map(loaded => loaded.check.id));
  const declared = new Set(audit.checks.map(loaded => loaded.check.id));
  const findings: Finding[] = [...found.values()].map(finding => {
    const entry = entries.get(finding.key);
    return entry ? { ...finding, classification: 'baselined', reason: entry.reason } : { ...finding, classification: 'new' };
  });
  // An entry is resolved when its check ran without producing it, or when its check no longer exists.
  for (const entry of audit.baseline.findings) {
    const check = entry.key.split('|')[0]!;
    if (found.has(entry.key) || (ran.has(check) === false && declared.has(check))) continue;
    findings.push({
      key: entry.key, kind: kindOfKey(entry.key), check, classification: 'resolved', reason: entry.reason,
      message: `${entry.key} no longer occurs; remove it from the baseline in this change so the violation cannot return as baselined`,
    });
  }
  findings.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  let baselineGrowth: string[] = [];
  if (baseBaseline !== undefined) {
    let text: string;
    try { text = readFileSync(resolve(baseBaseline), 'utf8'); }
    catch (error) { throw new AuditInputError([{ code: 'base-baseline', at: baseBaseline, message: (error as Error).message }]); }
    const base = new Set(parseBaseline(text, baseBaseline).findings.map(entry => entry.key));
    baselineGrowth = audit.baseline.findings.map(entry => entry.key).filter(key => !base.has(key)).sort();
  }
  const count = (classification: Finding['classification']): number => findings.filter(finding => finding.classification === classification).length;
  const summary = { new: count('new'), baselined: count('baselined'), resolved: count('resolved'), baselineGrowth: baselineGrowth.length };
  return {
    reportVersion: '1', limitation: AUDIT_LIMIT,
    tool: { name: manifest.name, version: VERSION, protocol },
    checks: checks.map(({ check, file, guardrails }) => ({ id: check.id, kind: check.kind, mode: check.mode, file, guardrails })),
    findings, baselineGrowth,
    coverage: { filesParsed: analyzer.filesParsed, externalTerminals: [...analyzer.external].sort(), unresolvedImports: analyzer.unresolvedImports },
    summary: { ...summary, exitCode: summary.new || summary.resolved || summary.baselineGrowth ? 3 : 0 },
  };
}

export function formatReport(report: Report): string {
  const lines: string[] = [];
  for (const finding of report.findings) {
    lines.push(`${finding.classification.toUpperCase()} ${finding.key}`, `  ${finding.message}`);
    if (finding.reason) lines.push(`  Baseline reason: ${finding.reason}`);
  }
  for (const key of report.baselineGrowth) lines.push(`BASELINE GROWTH ${key}`, '  Added to the baseline compared with --base-baseline; approve additions deliberately');
  const { summary, coverage } = report;
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
  lines.push(`${plural(report.checks.length, 'check')} run, ${plural(coverage.filesParsed, 'file')} parsed, ${plural(coverage.unresolvedImports, 'import')} unresolved: ${summary.new} new, ${summary.baselined} baselined, ${summary.resolved} resolved, ${summary.baselineGrowth} added to the baseline.`);
  if (summary.new) lines.push('Treat a new finding as a design question, not an obstacle to route around.');
  lines.push(report.limitation);
  return lines.join('\n');
}
