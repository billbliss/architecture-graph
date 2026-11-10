import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** A problem with the audit configuration or environment found while running; it makes the run invalid (exit 1), not a finding. */
export class AuditConfigurationError extends Error {}

/** Directories never included. Symlinks are never followed, so linked files are invisible to the audit. */
const SKIPPED = new Set(['node_modules', '.git']);

/** Whether the directory is inside something that looks like a git work tree: a `.git` directory or file here or above. */
function inGitWorkTree(root: string): boolean {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return true;
    if (dirname(dir) === dir) return false;
  }
}

/** Files git would consider under the root, relative to it: tracked plus untracked files that are not ignored. */
function gitFiles(root: string): string[] {
  let output: string;
  try {
    output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const detail = (error as { code?: string }).code === 'ENOENT' ? 'git is not installed or not on PATH'
      : String((error as { stderr?: string }).stderr ?? (error as Error).message).trim();
    throw new AuditConfigurationError(`${root} is inside a git work tree, but listing its files with git ls-files failed: ${detail}. The audit does not fall back to reading every file, so that what it sees never changes silently.`);
  }
  const found = new Set<string>();
  for (const path of output.split('\0')) {
    if (!path || path.split('/').some(part => SKIPPED.has(part))) continue;
    try { if (lstatSync(join(root, path)).isFile()) found.add(path); } // Regular files only; deleted-but-unstaged files are skipped.
    catch (error) { if ((error as { code?: string }).code !== 'ENOENT' && (error as { code?: string }).code !== 'ENOTDIR') throw error; }
  }
  return [...found];
}

/** Every regular file under the root, never entering skipped directories or following symlinks. */
function walkFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory() && !SKIPPED.has(entry.name)) walk(join(dir, entry.name), path + '/');
      else if (entry.isFile()) found.push(path);
    }
  };
  walk(root, '');
  return found;
}
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const isSource = (path: string): boolean => SOURCE_EXTENSIONS.some(ext => path.endsWith(ext)) && !/\.d\.[mc]?ts$/.test(path);

/**
 * The audit's whole view of the file system, as sorted repository-relative paths. Inside a git work tree it is the
 * files git would consider (tracked plus untracked-not-ignored), so a commit audits the same on any machine;
 * outside one it is every regular file.
 */
export class Repository {
  readonly files: ReadonlySet<string>;
  readonly sorted: readonly string[];
  constructor(readonly root: string) {
    const found = inGitWorkTree(root) ? gitFiles(root) : walkFiles(root);
    this.sorted = found.sort();
    this.files = new Set(found);
  }
  has(path: string): boolean { return this.files.has(path); }
  read(path: string): string { return readFileSync(join(this.root, path), 'utf8'); }
  match(globs: readonly string[]): string[] {
    const tests = globs.map(globPattern);
    return this.sorted.filter(path => tests.some(test => test.test(path)));
  }
}

/** Why a glob is not usable, or null. Globs are repository-relative and use only `**`, `*` and `?`. */
export function globProblem(glob: string): string | null {
  if (!glob || glob.startsWith('/') || glob.startsWith('./')) return 'must be repository-relative, without a leading / or ./';
  if (/[\\\x00-\x1f:]/.test(glob)) return 'must not contain backslashes, colons or control characters';
  if (/[[\]{}!()+@]/.test(glob)) return 'supports only **, * and ?';
  const parts = glob.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return 'must not contain empty, . or .. segments';
  if (parts.some(part => part.includes('**') && part !== '**')) return '** must be a whole path segment';
  return null;
}
const patterns = new Map<string, RegExp>();
export function globPattern(glob: string): RegExp {
  let pattern = patterns.get(glob);
  if (!pattern) {
    const parts = glob.split('/').map(part => part === '**' ? null
      : part.replace(/[.+^$|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]'));
    let source = '';
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      source += part === null ? (last ? '.*' : '(?:[^/]+/)*') : part + (last ? '' : '/');
    });
    pattern = new RegExp(`^${source}$`);
    patterns.set(glob, pattern);
  }
  return pattern;
}
