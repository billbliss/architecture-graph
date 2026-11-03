import { lstatSync, realpathSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertProjectPath, messageOf, type FileSource } from './files.js';

export { messageOf };
export function localPath(root: string, path: string): string {
  assertProjectPath(path);
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

/** Project files under a Node directory, with the symlink rule applied to every path. */
export function nodeFileSource(root: string): FileSource {
  return {
    stat(path) {
      const file = localPath(root, path);
      try { return statSync(file).isFile() ? 'file' : 'other'; }
      catch (error) {
        if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return 'missing';
        throw error;
      }
    },
    read: path => readFileSync(localPath(root, path), 'utf8'),
  };
}
