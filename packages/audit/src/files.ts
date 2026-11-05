import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Directories never walked. Symlinks are never followed, so linked files are invisible to the audit. */
const SKIPPED = new Set(['node_modules', '.git']);
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const isSource = (path: string): boolean => SOURCE_EXTENSIONS.some(ext => path.endsWith(ext)) && !/\.d\.[mc]?ts$/.test(path);

/** Every regular file in the repository, as sorted repository-relative paths. This is the audit's whole view of the file system. */
export class Repository {
  readonly files: ReadonlySet<string>;
  readonly sorted: readonly string[];
  constructor(readonly root: string) {
    const found: string[] = [];
    const walk = (dir: string, prefix: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = prefix + entry.name;
        if (entry.isDirectory() && !SKIPPED.has(entry.name)) walk(join(dir, entry.name), path + '/');
        else if (entry.isFile()) found.push(path);
      }
    };
    walk(root, '');
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
