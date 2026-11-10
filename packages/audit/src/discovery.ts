import ts from 'typescript';
import { isBuiltin } from 'node:module';
import { dirname, join, posix, relative, sep } from 'node:path';
import { globPattern, type Repository, AuditConfigurationError } from './files.js';
import type { AuditConfig } from './formats.js';

/** An import written in a file: a literal specifier, or a dynamic one the audit cannot follow. */
export interface WrittenImport { specifier: string; line: number; literal: boolean }
export interface ScannedFile { imports: WrittenImport[]; syntaxError: { line: number; message: string } | null }

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS, '.mts': ts.ScriptKind.TS, '.cts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX,
  '.js': ts.ScriptKind.JS, '.mjs': ts.ScriptKind.JS, '.cjs': ts.ScriptKind.JS, '.jsx': ts.ScriptKind.JSX,
};
const isStringLiteral = (node: ts.Node | undefined): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));

/** Runtime imports of one file. Type-only imports and exports are not runtime edges and are left out. */
export function scanImports(path: string, text: string): ScannedFile {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, SCRIPT_KINDS[posix.extname(path)] ?? ts.ScriptKind.TS);
  const line = (node: ts.Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  // parseDiagnostics is not in TypeScript's public typings, but is the parser's own syntax error list.
  const diagnostic = (source as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics?.[0];
  const syntaxError = diagnostic ? {
    line: source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
  } : null;
  const imports: WrittenImport[] = [];
  const add = (node: ts.Expression, at: ts.Node): void => {
    imports.push(isStringLiteral(node) ? { specifier: node.text, line: line(at), literal: true }
      : { specifier: node.getText(source), line: line(at), literal: false });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : undefined;
      const typeOnly = !!clause && (clause.isTypeOnly
        || (!clause.name && !!named && named.elements.length > 0 && named.elements.every(element => element.isTypeOnly)));
      if (!typeOnly) add(node.moduleSpecifier, node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const typeOnly = node.isTypeOnly || (!!clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every(element => element.isTypeOnly));
      if (!typeOnly) add(node.moduleSpecifier, node);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (!node.isTypeOnly) add(node.moduleReference.expression, node);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      if (isImport || isRequire) {
        const argument = node.arguments[0];
        if (argument) add(argument, node);
        else imports.push({ specifier: callee.getText(source) + '()', line: line(node), literal: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, syntaxError };
}

export type Resolution =
  | { kind: 'file'; path: string }
  | { kind: 'external'; name: string }
  | { kind: 'unresolved'; reason: string };

export { AuditConfigurationError };

interface Aliases { tsconfig: string; base: string | null; paths: Array<[string, string[]]>; baseUrl: boolean }
const EMITTED: Record<string, string[]> = { '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Resolves specifiers to repository files using only the configured TypeScript settings; it never searches for others. */
export class Resolver {
  private readonly aliases = new Map<string, Aliases>();
  constructor(private readonly repo: Repository, private readonly config: AuditConfig) {}

  /** Repository-relative form of a path, or null when it leaves the repository. */
  private inside(path: string): string | null {
    const normal = posix.normalize(path);
    return normal === '..' || normal.startsWith('../') || normal.startsWith('/') ? null : normal.replace(/\/$/, '');
  }
  /** Candidates by the usual rules: exact file, emitted-extension counterpart, then directory index. */
  private candidates(base: string): string[] {
    if (this.repo.has(base)) return [base];
    const extension = posix.extname(base);
    const counterparts = EMITTED[extension]?.map(ext => base.slice(0, -extension.length) + ext) ?? EXTENSIONS.map(ext => base + ext);
    const emitted = counterparts.filter(path => this.repo.has(path));
    if (emitted.length) return emitted;
    return EXTENSIONS.map(ext => `${base}/index${ext}`).filter(path => this.repo.has(path));
  }
  /** The single candidate, an ambiguity, or null when nothing matches. */
  private pick(base: string): Resolution | null {
    const found = this.candidates(base);
    if (found.length > 1) return { kind: 'unresolved', reason: `ambiguous: ${found.join(', ')}` };
    return found.length ? { kind: 'file', path: found[0]! } : null;
  }
  /** The one typescript entry whose paths match a file; anything else is a configuration error. */
  aliasesFor(file: string): Aliases {
    const entries = this.config.typescript.filter(entry => entry.paths.some(glob => globPattern(glob).test(file)));
    if (entries.length !== 1) {
      throw new AuditConfigurationError(`${file} must match exactly one typescript entry in the audit configuration; it matches ${entries.length}`);
    }
    const tsconfig = entries[0]!.tsconfig;
    let aliases = this.aliases.get(tsconfig);
    if (!aliases) {
      const absolute = join(this.repo.root, tsconfig);
      const read = ts.readConfigFile(absolute, ts.sys.readFile);
      if (read.error) throw new AuditConfigurationError(`${tsconfig}: ${ts.flattenDiagnosticMessageText(read.error.messageText, ' ')}`);
      const { options } = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(absolute), undefined, absolute);
      const baseAbsolute = options.baseUrl ?? (options.pathsBasePath as string | undefined) ?? dirname(absolute);
      const base = this.inside(relative(this.repo.root, baseAbsolute).split(sep).join('/') || '.');
      aliases = { tsconfig, base, paths: Object.entries(options.paths ?? {}), baseUrl: options.baseUrl !== undefined };
      this.aliases.set(tsconfig, aliases);
    }
    return aliases;
  }
  resolve(from: string, specifier: string): Resolution {
    if (specifier.startsWith('./') || specifier.startsWith('../') || specifier === '.' || specifier === '..') {
      const target = this.inside(posix.join(posix.dirname(from), specifier));
      if (target === null) return { kind: 'unresolved', reason: 'resolves outside the repository' };
      return this.pick(target) ?? { kind: 'unresolved', reason: 'no file found for this relative import' };
    }
    if (specifier.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(specifier) && !specifier.startsWith('node:')) {
      return { kind: 'unresolved', reason: 'absolute paths and URLs are not supported' };
    }
    const aliases = this.aliasesFor(from);
    const match = matchAlias(aliases.paths, specifier);
    if (match) {
      if (aliases.base === null) return { kind: 'unresolved', reason: `alias ${match.pattern} in ${aliases.tsconfig} resolves outside the repository` };
      for (const target of match.targets) {
        const path = this.inside(posix.join(aliases.base, target));
        if (path === null) return { kind: 'unresolved', reason: `alias ${match.pattern} in ${aliases.tsconfig} resolves outside the repository` };
        const resolved = this.pick(path);
        if (resolved) return resolved;
      }
      return { kind: 'unresolved', reason: `alias ${match.pattern} in ${aliases.tsconfig} matched, but no file was found` };
    }
    if (aliases.baseUrl && aliases.base !== null) {
      const path = this.inside(posix.join(aliases.base, specifier));
      const resolved = path === null ? null : this.pick(path);
      if (resolved) return resolved;
    }
    return { kind: 'external', name: packageName(specifier) };
  }
}

/** TypeScript's paths rule: an exact pattern wins, then the wildcard pattern with the longest prefix. */
function matchAlias(paths: Array<[string, string[]]>, specifier: string): { pattern: string; targets: string[] } | null {
  let best: { pattern: string; targets: string[]; prefix: number } | null = null;
  for (const [pattern, targets] of paths) {
    const star = pattern.indexOf('*');
    if (star < 0) { if (pattern === specifier) return { pattern, targets }; continue; }
    const prefix = pattern.slice(0, star), suffix = pattern.slice(star + 1);
    if (specifier.length >= prefix.length + suffix.length && specifier.startsWith(prefix) && specifier.endsWith(suffix)
      && (!best || prefix.length > best.prefix)) {
      const middle = specifier.slice(prefix.length, specifier.length - suffix.length);
      best = { pattern, targets: targets.map(target => target.replace('*', middle)), prefix: prefix.length };
    }
  }
  return best && { pattern: best.pattern, targets: best.targets };
}
/** The package a bare specifier names; Node built-ins always carry the node: prefix. */
export function packageName(specifier: string): string {
  if (specifier.startsWith('node:')) return specifier.split('/')[0]!;
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
  return isBuiltin(name) ? `node:${name}` : name;
}
