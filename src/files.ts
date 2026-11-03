// Browser-safe: this module and everything it imports must not use Node built-ins.

/** What a project path names: a regular file, something else (such as a directory), or nothing. */
export type FileKind = 'file' | 'other' | 'missing';

/**
 * Synchronous read access to one project's files. Paths are normalized, project-relative and
 * already checked by {@link assertProjectPath}. Throwing reports an access problem; its message
 * becomes diagnostic text, so it should not leak machine-specific detail the caller cares about.
 */
export interface FileSource {
  /** Kind of entry at the path; `missing` when nothing is there. */
  stat(path: string): FileKind;
  /** UTF-8 text of a regular file; throws when it cannot be read. */
  read(path: string): string;
}

/** Asynchronous file access, for browser folder handles or fetch. A {@link FileSource} also satisfies it. */
export interface AsyncFileSource {
  stat(path: string): FileKind | Promise<FileKind>;
  read(path: string): string | Promise<string>;
}

/** Lexical project-local path rule shared by every file source. Symlink checks belong to sources that can see links. */
export function assertProjectPath(path: string): void {
  if (!path || path.startsWith('/') || /[\\\x00-\x1f:]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Expected normalized repository-relative path: ${path}`);
  }
}

export const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** In-memory project files keyed by normalized project-relative path. Directories are implied by file paths. */
export function memoryFileSource(files: Record<string, string> | ReadonlyMap<string, string>): FileSource {
  const entries = new Map<string, string>(files instanceof Map ? files : Object.entries(files as Record<string, string>));
  const isDirectory = (path: string): boolean => [...entries.keys()].some(key => key.startsWith(path + '/'));
  return {
    stat: path => entries.has(path) ? 'file' : isDirectory(path) ? 'other' : 'missing',
    read: path => {
      const text = entries.get(path);
      if (text === undefined) throw new Error(isDirectory(path) ? 'not a file' : 'file not found');
      return text;
    },
  };
}

type FileRequest = { op: 'stat'; path: string } | { op: 'read'; path: string };

/**
 * Validation rules are written once as generators that yield file requests. {@link runSync} and
 * {@link runAsync} answer those requests, so sync and async callers run the same rules. A source
 * error is thrown back into the generator at the request.
 */
export type FileTask<T> = Generator<FileRequest, T, unknown>;
export function* statFile(path: string): FileTask<FileKind> { return (yield { op: 'stat', path }) as FileKind; }
export function* readFile(path: string): FileTask<string> { return (yield { op: 'read', path }) as string; }

export function runSync<T>(task: FileTask<T>, source: FileSource): T {
  let step = task.next();
  while (!step.done) {
    const request = step.value;
    let reply: unknown;
    try { reply = request.op === 'stat' ? source.stat(request.path) : source.read(request.path); }
    catch (error) { step = task.throw(error); continue; }
    step = task.next(reply);
  }
  return step.value;
}

export async function runAsync<T>(task: FileTask<T>, source: AsyncFileSource): Promise<T> {
  let step = task.next();
  while (!step.done) {
    const request = step.value;
    let reply: unknown;
    try { reply = await (request.op === 'stat' ? source.stat(request.path) : source.read(request.path)); }
    catch (error) { step = task.throw(error); continue; }
    step = task.next(reply);
  }
  return step.value;
}
