import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export function localPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || /[\\\x00-\x1f:]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Expected normalized repository-relative path: ${path}`);
  }
  let current = realpathSync(root);
  for (const part of path.split('/')) {
    current = resolve(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${path}`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return current;
}
export const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
