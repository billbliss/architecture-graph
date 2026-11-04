// Build-time access to the repository the site lives in. The site reads docs/, examples/ and schema/
// directly so there is one copy of each; nothing here runs in the browser.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';

/** Absolute path of the repository root (the site is built from site/). */
export const REPO_ROOT = resolve(process.cwd(), '..');
export const GITHUB_REPO = 'https://github.com/billbliss/architecture-graph';

function currentCommit(): string {
  const fromPages = process.env.CF_PAGES_COMMIT_SHA;
  if (fromPages) return fromPages;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'main';
  }
}

/** The commit the site is built from; GitHub links point at it so they match the published pages. */
export const COMMIT = currentCommit();

/** Normalizes a repository-relative path and rejects anything outside the repository. */
export function repoPath(path: string): string {
  const normalized = posix.normalize(path).replace(/\/$/, '');
  if (normalized === '..' || normalized.startsWith('../') || posix.isAbsolute(normalized)) {
    throw new Error(`Path leaves the repository: ${path}`);
  }
  return normalized === '.' ? '' : normalized;
}

export const repoFile = (path: string): string => resolve(REPO_ROOT, repoPath(path));
export const repoExists = (path: string): boolean => existsSync(repoFile(path));
export const repoIsDirectory = (path: string): boolean => repoExists(path) && statSync(repoFile(path)).isDirectory();
export const readRepo = (path: string): string => readFileSync(repoFile(path), 'utf8');
export const readRepoJson = <T = unknown>(path: string): T => JSON.parse(readRepo(path)) as T;

/** A GitHub link to a repository file or folder at the commit the site was built from. */
export function githubUrl(path: string, hash = ''): string {
  const normalized = repoPath(path);
  const mode = repoIsDirectory(normalized) ? 'tree' : 'blob';
  return `${GITHUB_REPO}/${mode}/${COMMIT}/${normalized}${hash}`;
}
