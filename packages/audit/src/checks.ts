import { isSource } from './files.js';
import { Resolver, scanImports, type Resolution } from './discovery.js';
import { expand, type Audit, type LoadedCheck } from './load.js';
import type { Finding } from './formats.js';

export interface Edge { specifier: string; line: number; resolution: Resolution }
export interface AnalyzedFile { edges: Edge[]; unresolved: Array<{ specifier: string; line: number; reason: string }> }
export type RawFinding = Omit<Finding, 'classification' | 'reason'>;

/** Specifier recorded for a file the audit could not parse; it is reported like an unresolved import. */
export const SYNTAX_SPECIFIER = '<syntax>';

/** Parses files on demand, once per run, and records what the run covered. */
export class Analyzer {
  private readonly cache = new Map<string, AnalyzedFile>();
  readonly external = new Set<string>();
  private readonly resolver: Resolver;
  constructor(private readonly audit: Audit) { this.resolver = new Resolver(audit.repo, audit.config); }
  get filesParsed(): number { return this.cache.size; }
  get unresolvedImports(): number { return [...this.cache.values()].reduce((sum, file) => sum + file.unresolved.length, 0); }
  analyze(path: string): AnalyzedFile {
    let result = this.cache.get(path);
    if (result) return result;
    this.resolver.aliasesFor(path); // Every analyzed file must match exactly one typescript entry.
    const scanned = scanImports(path, this.audit.repo.read(path));
    result = { edges: [], unresolved: [] };
    if (scanned.syntaxError) {
      result.unresolved.push({ specifier: SYNTAX_SPECIFIER, line: scanned.syntaxError.line, reason: `unsupported or invalid syntax: ${scanned.syntaxError.message}` });
    }
    for (const written of scanned.imports) {
      if (!written.literal) { result.unresolved.push({ specifier: written.specifier, line: written.line, reason: 'the specifier is not a string literal' }); continue; }
      const resolution = this.resolver.resolve(path, written.specifier);
      if (resolution.kind === 'unresolved') result.unresolved.push({ specifier: written.specifier, line: written.line, reason: resolution.reason });
      else {
        if (resolution.kind === 'external') this.external.add(resolution.name);
        result.edges.push({ ...written, resolution });
      }
    }
    this.cache.set(path, result);
    return result;
  }
}

const unresolvedFindings = (id: string, file: string, analyzed: AnalyzedFile): RawFinding[] => analyzed.unresolved.map(item => ({
  key: `${id}|unresolved|${file}|${item.specifier}`, kind: 'unresolved_import', check: id,
  message: `${file}:${item.line} cannot be analyzed (${item.reason}); the audit does not pass code it could not see`,
  evidence: { file, line: item.line, specifier: item.specifier, reason: item.reason },
}));

/** Any runtime import from a file matched by `from` to a file matched by `to`. Every `from` file is parsed. */
function forbiddenDependency(audit: Audit, analyzer: Analyzer, { check }: LoadedCheck): RawFinding[] {
  if (check.kind !== 'forbidden_dependency') return [];
  const targets = new Set(expand(audit, check.to));
  const findings: RawFinding[] = [];
  for (const file of expand(audit, check.from).filter(isSource)) {
    const analyzed = analyzer.analyze(file);
    for (const edge of analyzed.edges) {
      if (edge.resolution.kind !== 'file' || !targets.has(edge.resolution.path)) continue;
      const target = edge.resolution.path;
      findings.push({
        key: `${check.id}|dep|${file}->${target}`, kind: 'forbidden_dependency', check: check.id,
        message: `${file}:${edge.line} imports ${target} ("${edge.specifier}"), which ${check.id} forbids`,
        evidence: { file, line: edge.line, specifier: edge.specifier },
      });
    }
    findings.push(...unresolvedFindings(check.id, file, analyzed));
  }
  return findings;
}

export function runCheck(audit: Audit, analyzer: Analyzer, loaded: LoadedCheck): RawFinding[] {
  switch (loaded.check.kind) {
    case 'forbidden_dependency': return forbiddenDependency(audit, analyzer, loaded);
    case 'forbidden_reachability': throw new Error(`${loaded.check.id}: forbidden_reachability is not available in this build yet`);
  }
}
