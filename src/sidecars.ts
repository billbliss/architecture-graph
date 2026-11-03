// Browser-safe: file access goes through a FileSource; no Node built-ins.
import { Ajv, type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { Diagnostic, Graph, NodeKind } from './schema.js';
import { assertProjectPath, messageOf, readFile, runAsync, runSync, kindOf, type AsyncFileSource, type FileKind, type FileSource, type FileTask } from './files.js';
import { parseDeclarations } from './serialization.js';

/** Node kinds that may carry schema and example sidecars. */
export const SIDECAR_KINDS: readonly NodeKind[] = ['contract', 'data_object', 'artifact'];

const BASE = 'https://ag.local/';
const DIALECTS: Record<string, 'draft-2020-12' | 'draft-07'> = {
  'https://json-schema.org/draft/2020-12/schema': 'draft-2020-12',
  'http://json-schema.org/draft-07/schema': 'draft-07',
  'https://json-schema.org/draft-07/schema': 'draft-07',
};
type Dialect = 'draft-2020-12' | 'draft-07';
const addFormats = addFormatsModule as unknown as (ajv: Ajv) => Ajv;

/**
 * Check sidecar placement, schemas and examples. Sidecars are checked against each other only;
 * nothing here reads implementation source or proves the code produces data of this shape.
 */
export function* sidecarRules(graph: Graph): FileTask<Diagnostic[]> {
  const errors: Diagnostic[] = [];
  const add = (code: string, at: string, message: string): void => { errors.push({ code, at, message }); };
  const checker = new SchemaChecker();
  for (const edge of graph.relationships) {
    for (const ref of edge.references) {
      if (ref.kind === 'schema' || ref.kind === 'example') add('sidecar-kind', edge.id, `${ref.kind} references are not allowed on relationships: ${ref.path}`);
    }
  }
  for (const node of graph.nodes) {
    const schemas = node.references.filter(ref => ref.kind === 'schema');
    const examples = node.references.filter(ref => ref.kind === 'example');
    if (!schemas.length && !examples.length) continue;
    if (!SIDECAR_KINDS.includes(node.kind)) {
      add('sidecar-kind', node.id, `schema and example references are only allowed on ${SIDECAR_KINDS.join(', ')} nodes`);
      continue;
    }
    if (schemas.length > 1) add('sidecar-schema-count', node.id, 'A node may have at most one schema reference');
    if (examples.length && !schemas.length) add('sidecar-example-without-schema', node.id, 'Example references require a schema reference');
    const schemaRef = schemas[0];
    let validate: ValidateFunction | null = null;
    if (schemaRef) {
      const result = yield* checker.compile(schemaRef.path);
      if (typeof result === 'string') add('sidecar-schema', node.id, `${schemaRef.path}: ${result}`);
      else validate = result;
    }
    for (const example of examples) {
      if (!/\.(json|ya?ml)$/.test(example.path)) {
        add('sidecar-example-parse', node.id, `${example.path}: examples must be .json, .yaml or .yml files`);
        continue;
      }
      if ((yield* fileKind(example.path)) !== 'file') continue; // The general reference check reports these.
      let value: unknown;
      try { value = parseDeclarations(yield* readFile(example.path), example.path); }
      catch (error) { add('sidecar-example-parse', node.id, `${example.path}: ${messageOf(error)}`); continue; }
      if (validate && !validate(value)) {
        add('sidecar-example', node.id, `${example.path} does not match ${schemaRef!.path}: ${describe(validate.errors)}`);
      }
    }
  }
  return errors;
}

/** Result of checking a value against a sidecar schema. */
export interface SidecarCheck { valid: boolean; errors: string[] }

/**
 * Compile a project's schema sidecar with the same rules and $ref resolution as validation, for use
 * in a project's own conformance tests. Throws when the schema itself is invalid.
 */
export function sidecarValidatorSync(source: FileSource, schemaPath: string): (value: unknown) => SidecarCheck {
  return checkWith(runSync(compileSidecar(schemaPath), source));
}
/** {@link sidecarValidatorSync} reading schema files from an asynchronous source. */
export async function sidecarValidatorAsync(source: AsyncFileSource, schemaPath: string): Promise<(value: unknown) => SidecarCheck> {
  return checkWith(await runAsync(compileSidecar(schemaPath), source));
}
function* compileSidecar(schemaPath: string): FileTask<ValidateFunction> {
  const validate = yield* new SchemaChecker().compile(schemaPath);
  if (typeof validate === 'string') throw new Error(`${schemaPath}: ${validate}`);
  return validate;
}
function checkWith(validate: ValidateFunction): (value: unknown) => SidecarCheck {
  return value => validate(value) ? { valid: true, errors: [] }
    : { valid: false, errors: (validate.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`) };
}

/** Loads schema files once per check, resolving relative $ref between project-local files. */
class SchemaChecker {
  private readonly compiled = new Map<string, ValidateFunction | string>();
  private readonly loaded = new Map<string, { schema: Record<string, unknown>; dialect: Dialect } | string>();
  private readonly engines = new Map<Dialect, Ajv>();

  *compile(path: string): FileTask<ValidateFunction | string> {
    const cached = this.compiled.get(path);
    if (cached) return cached;
    let result: ValidateFunction | string;
    try { result = yield* this.compileUncached(path); }
    catch (error) { result = messageOf(error); }
    this.compiled.set(path, result);
    return result;
  }

  private *compileUncached(path: string): FileTask<ValidateFunction | string> {
    if (!path.endsWith('.json')) return 'schemas must be .json files';
    const rootSchema = yield* this.load(path);
    if (typeof rootSchema === 'string') return rootSchema;
    // Load every file reachable through relative $ref before compiling.
    const pending = [path], seen = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const entry = yield* this.load(current);
      if (typeof entry === 'string') return current === path ? entry : `referenced schema ${current}: ${entry}`;
      if (entry.dialect !== rootSchema.dialect) return `referenced schema ${current} uses ${entry.dialect}, but ${path} uses ${rootSchema.dialect}`;
      for (const ref of refsOf(entry.schema)) {
        const target = resolveRef(current, ref);
        if (typeof target !== 'string') return `cannot resolve $ref "${ref}" in ${current}: ${target.error}`;
        if (target) pending.push(target);
      }
    }
    const ajv = this.engine(rootSchema.dialect);
    for (const file of seen) {
      if (!ajv.getSchema(BASE + file)) ajv.addSchema((this.loaded.get(file) as { schema: AnySchema }).schema, BASE + file);
    }
    const validate = ajv.getSchema(BASE + path);
    if (!validate) return 'schema could not be compiled';
    return validate;
  }

  private *load(path: string): FileTask<{ schema: Record<string, unknown>; dialect: Dialect } | string> {
    const cached = this.loaded.get(path);
    if (cached) return cached;
    let result: { schema: Record<string, unknown>; dialect: Dialect } | string;
    const kind = yield* fileKind(path);
    if (kind !== 'file') result = kind === 'missing' ? 'file not found' : 'not a file';
    else {
      try {
        const value: unknown = JSON.parse(yield* readFile(path));
        if (value === null || typeof value !== 'object' || Array.isArray(value)) result = 'a schema must be a JSON object';
        else {
          const declared = (value as Record<string, unknown>).$schema;
          const dialect = declared === undefined ? 'draft-2020-12' : typeof declared === 'string' ? DIALECTS[declared.replace(/#$/, '')] : undefined;
          // Each file is identified by its project path so relative $ref resolve between files.
          result = dialect ? { schema: { ...(value as Record<string, unknown>), $id: BASE + path }, dialect }
            : `unsupported $schema ${JSON.stringify(declared)}; use draft 2020-12 or draft-07`;
        }
      } catch (error) { result = messageOf(error); }
    }
    this.loaded.set(path, result);
    return result;
  }

  private engine(dialect: Dialect): Ajv {
    let ajv = this.engines.get(dialect);
    if (!ajv) {
      const options = { strict: true, strictTypes: false, strictTuples: false, allErrors: true, logger: false } as const;
      ajv = dialect === 'draft-07' ? new Ajv(options) : new Ajv2020(options);
      addFormats(ajv);
      this.engines.set(dialect, ajv);
    }
    return ajv;
  }
}

/** What is at the path; unreadable or rejected paths count as missing. */
function* fileKind(path: string): FileTask<FileKind> {
  try { assertProjectPath(path); return yield* kindOf(path); } catch { return 'missing'; }
}

/** Same result as Node's posix.normalize, which this module cannot import. */
export function normalizePosix(path: string): string {
  if (!path) return '.';
  const absolute = path.startsWith('/'), trailing = path.endsWith('/');
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.length && parts[parts.length - 1] !== '..') parts.pop();
    else if (!absolute) parts.push('..');
  }
  const joined = parts.join('/');
  if (absolute) return '/' + joined + (trailing && joined ? '/' : '');
  return (joined || '.') + (trailing ? '/' : '');
}

function refsOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) { for (const item of value) refsOf(item, found); return found; }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') found.push(child);
      else refsOf(child, found);
    }
  }
  return found;
}

/** Returns the project path of a file reference, '' for a same-file fragment, or an error. */
function resolveRef(from: string, ref: string): string | { error: string } {
  if (ref.startsWith('#')) return '';
  const url = new URL(ref, BASE + from);
  if (!url.href.startsWith(BASE)) return { error: 'only project-local relative references are supported; AG does not fetch schemas' };
  const target = decodeURIComponent(url.pathname.slice(1));
  if (target === from) return '';
  if (normalizePosix(target) !== target) return { error: 'reference is not a normalized project path' };
  return target;
}

function describe(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? []).slice(0, 5).map(error => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`).join('; ');
}
