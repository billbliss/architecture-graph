import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadProject, nodeFileSource, parseDeclarations, type Diagnostic, type Project } from '@billbliss/architecture-graph';
import { assertProjectPath } from '@billbliss/architecture-graph/core';
import type { z } from 'zod';
import { AuditConfigSchema, BaselineSchema, CheckFileSchema, type AuditConfig, type Baseline, type Check } from './formats.js';
import { globProblem, isSource, Repository } from './files.js';

export interface LoadedCheck { check: Check; file: string; guardrails: string[] }
export interface Audit {
  project: Project;
  root: string;
  config: AuditConfig;
  checks: LoadedCheck[];
  baseline: Baseline;
  repo: Repository;
}
/** Invalid input, configuration or audit files: the run cannot proceed (exit 1). */
export class AuditInputError extends Error {
  constructor(readonly diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => `${d.code} ${d.at}: ${d.message}`).join('\n'));
  }
}

const shape = (value: unknown, schema: z.ZodType, code: string, at: string): Diagnostic[] => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map(issue => ({ code, at: `${at}$.${issue.path.map(String).join('.')}`, message: issue.message }));
};

/** Parse a baseline file. Throws AuditInputError when it does not match the format or repeats a key. */
export function parseBaseline(text: string, at: string): Baseline {
  let value: unknown;
  try { value = parseDeclarations(text, /\.(ya?ml|json)$/.test(at) ? at : `${at}.yaml`); }
  catch (error) { throw new AuditInputError([{ code: 'baseline', at, message: (error as Error).message }]); }
  const problems = shape(value, BaselineSchema, 'baseline', at);
  if (problems.length) throw new AuditInputError(problems);
  const baseline = BaselineSchema.parse(value);
  const seen = new Set<string>();
  for (const entry of baseline.findings) {
    if (seen.has(entry.key)) problems.push({ code: 'baseline', at, message: `Duplicate baseline key ${entry.key}` });
    seen.add(entry.key);
  }
  if (problems.length) throw new AuditInputError(problems);
  return baseline;
}

/**
 * Load the project through core's public API, then the audit configuration, check files and baseline,
 * and validate them all. Every audit command starts here; any diagnostic stops the run.
 */
export function loadAudit(configPath: string, auditConfigPath?: string): Audit {
  const project = loadProject(configPath);
  const root = project.root;
  const files = nodeFileSource(root);
  const problems: Diagnostic[] = [];
  const add = (code: string, at: string, message: string): void => { problems.push({ code, at, message }); };
  const configFile = auditConfigPath ? resolve(auditConfigPath) : join(dirname(resolve(configPath)), 'ag.audit.json');
  if (!existsSync(configFile)) throw new AuditInputError([{ code: 'audit-config', at: configFile, message: 'Audit configuration not found; create ag.audit.json next to ag.config.json or pass --audit-config' }]);
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(configFile, 'utf8')); }
  catch (error) { throw new AuditInputError([{ code: 'audit-config', at: configFile, message: (error as Error).message }]); }
  const configProblems = shape(raw, AuditConfigSchema, 'audit-config', 'ag.audit.json');
  if (configProblems.length) throw new AuditInputError(configProblems);
  const config = AuditConfigSchema.parse(raw);
  const local = (path: string, code: string, at: string): boolean => {
    try { assertProjectPath(path); return true; } catch (error) { add(code, at, (error as Error).message); return false; }
  };
  const fileExists = (path: string, code: string, at: string, what: string, hint = ''): boolean => {
    if (!local(path, code, at)) return false;
    try { if (files.kind(path) === 'file') return true; add(code, at, `${what} not found: ${path}${hint}`); }
    catch (error) { add(code, at, (error as Error).message); }
    return false;
  };
  const glob = (pattern: string, at: string): void => {
    const problem = globProblem(pattern);
    if (problem) add('glob', at, `${pattern}: ${problem}`);
  };

  const graphModules = new Set((project.graph.modules ?? []).map(module => module.id));
  for (const [id, globs] of Object.entries(config.modules)) {
    if (!graphModules.has(id)) add('module', `ag.audit.json$.modules.${id}`, `${id} is not a module declared in the graph`);
    for (const pattern of globs) glob(pattern, `ag.audit.json$.modules.${id}`);
  }
  config.typescript.forEach((entry, i) => {
    for (const pattern of entry.paths) glob(pattern, `ag.audit.json$.typescript.${i}`);
    fileExists(entry.tsconfig, 'tsconfig', `ag.audit.json$.typescript.${i}`, 'TypeScript configuration');
  });

  let baseline: Baseline = { baselineVersion: '1', findings: [] };
  const empty = `; create it with no entries:\nbaselineVersion: "1"\nfindings: []`;
  if (fileExists(config.baseline, 'baseline', 'ag.audit.json$.baseline', 'Baseline', empty)) {
    try { baseline = parseBaseline(files.read(config.baseline), config.baseline); }
    catch (error) { if (error instanceof AuditInputError) problems.push(...error.diagnostics); else throw error; }
  }

  // Check files are whatever guardrails reference; core already confirmed they exist and sit on guardrails.
  const guardrailsByFile = new Map<string, string[]>();
  for (const node of project.graph.nodes) for (const ref of node.references) {
    if (ref.kind === 'check') guardrailsByFile.set(ref.path, [...(guardrailsByFile.get(ref.path) ?? []), node.id]);
  }
  const checks: LoadedCheck[] = [];
  const ids = new Map<string, string>();
  for (const [file, guardrails] of [...guardrailsByFile].sort(([a], [b]) => a < b ? -1 : 1)) {
    if (!/\.(ya?ml|json)$/.test(file)) { add('check-file', file, 'Check files must be .yaml, .yml or .json'); continue; }
    let value: unknown;
    try { value = parseDeclarations(files.read(file), file); }
    catch (error) { add('check-file', file, (error as Error).message); continue; }
    const fileProblems = shape(value, CheckFileSchema, 'check-file', file);
    if (fileProblems.length) { problems.push(...fileProblems); continue; }
    for (const check of CheckFileSchema.parse(value).checks) {
      if (ids.has(check.id)) add('check-id', file, `${check.id} is also declared in ${ids.get(check.id)}`);
      ids.set(check.id, file);
      checks.push({ check, file, guardrails: guardrails.sort() });
    }
  }
  for (const { check, file } of checks) {
    const at = `${file}#${check.id}`;
    const selectors = check.kind === 'forbidden_dependency' ? [...check.from, ...check.to] : check.forbidden;
    for (const selector of selectors) {
      if (selector.includes(':')) {
        if (!graphModules.has(selector)) add('module', at, `${selector} is not a module declared in the graph`);
        else if (!config.modules[selector]) add('module', at, `${selector} has no paths in the audit configuration's modules`);
      } else glob(selector, at);
    }
    if (check.kind === 'forbidden_reachability') {
      for (const entry of check.entries) {
        if (fileExists(entry, 'entry', at, 'Entry file') && !isSource(entry)) add('entry', at, `Entry ${entry} is not a TypeScript or JavaScript source file`);
      }
      for (const pattern of check.forbiddenPackages) {
        if (!/^(@[a-z0-9._*-]+\/)?[a-z0-9._*:-]+$/i.test(pattern)) add('package-pattern', at, `${pattern} is not a package name or pattern such as node:* or typescript`);
      }
    }
  }
  if (problems.length) throw new AuditInputError(problems);

  const repo = new Repository(root);
  const owner = new Map<string, string>();
  for (const [id, globs] of Object.entries(config.modules)) for (const path of repo.match(globs)) {
    const other = owner.get(path);
    if (other && other !== id) add('module-overlap', `ag.audit.json$.modules.${id}`, `${path} belongs to both ${other} and ${id}; a file may belong to at most one module`);
    else owner.set(path, id);
  }
  if (problems.length) throw new AuditInputError(problems);
  return { project, root, config, checks, baseline, repo };
}

/** Repository files a selector names: a module's configured paths, or a glob. */
export function expand(audit: Audit, selectors: readonly string[]): string[] {
  const globs = selectors.flatMap(selector => selector.includes(':') ? audit.config.modules[selector] ?? [] : [selector]);
  return audit.repo.match(globs);
}
