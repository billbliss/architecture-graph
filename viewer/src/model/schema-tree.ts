// Turns a JSON Schema sidecar into a readable field tree for the Structure tab, resolving `$ref`
// within the file and to other project files. This is a reading aid, not a validator: validation is
// the toolkit's (Ajv), and anything this cannot describe is shown as the schema says it.
import { projectPath } from '../load/project';

export interface SchemaField {
  name: string;
  required: boolean;
  type: string;
  description?: string;
  /** Where a `$ref` led, for the label and source link. */
  ref?: { title: string; path: string };
  children?: SchemaField[];
}

export interface SchemaTree {
  path: string;
  title?: string;
  description?: string;
  type: string;
  fields: SchemaField[];
  /** Why the schema could not be read. */
  problem?: string;
}

type Json = Record<string, unknown>;
type ReadFile = (path: string) => string | undefined;

const MAX_DEPTH = 6;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

function parse(read: ReadFile, path: string): Json | undefined {
  const text = read(path);
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function pointer(root: Json, fragment: string): Json | undefined {
  if (!fragment || fragment === '/') return root;
  let current: unknown = root;
  for (const raw of fragment.replace(/^\//, '').split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    current = (current as Json)[key];
  }
  return isObject(current) ? current : undefined;
}

interface Resolved {
  schema: Json;
  /** File the schema came from, for resolving its own relative references. */
  path: string;
  key: string;
}

function resolveRef(read: ReadFile, ref: string, base: string): Resolved | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return undefined; // Remote references are not followed.
  const [file = '', fragment = ''] = ref.split('#');
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
  const path = file ? projectPath(dir ? `${dir}/${file}` : file) : base;
  if (!path) return undefined;
  const root = parse(read, path);
  if (!root) return undefined;
  const schema = pointer(root, fragment);
  return schema ? { schema, path, key: `${path}#${fragment}` } : undefined;
}

const typeName = (value: unknown): string =>
  Array.isArray(value) ? value.join(' | ') : typeof value === 'string' ? value : '';

function describe(read: ReadFile, schema: Json, base: string, seen: string[], depth: number): Omit<SchemaField, 'name' | 'required'> {
  const description = typeof schema.description === 'string' ? schema.description : undefined;
  if (typeof schema.$ref === 'string') {
    const target = resolveRef(read, schema.$ref, base);
    if (!target) return { type: `→ ${schema.$ref}`, description };
    const title = typeof target.schema.title === 'string' ? target.schema.title : undefined;
    const inner = seen.includes(target.key) || depth >= MAX_DEPTH
      ? undefined
      : fieldsOf(read, target.schema, target.path, [...seen, target.key], depth + 1);
    // An untitled target is described by its own type rather than by the reference text.
    const own = typeName(target.schema.type) || (inner?.length ? 'object' : 'any');
    return {
      type: title ? `→ ${title}` : own,
      description: description ?? (typeof target.schema.description === 'string' ? target.schema.description : undefined),
      ref: { title: title ?? schema.$ref, path: target.path },
      children: inner?.length ? inner : undefined,
    };
  }
  if (Array.isArray(schema.enum)) return { type: schema.enum.map(value => JSON.stringify(value)).join(' | '), description };
  if ('const' in schema) return { type: JSON.stringify(schema.const), description };
  for (const key of ['oneOf', 'anyOf'] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      const labels = options.filter(isObject).map(option => describe(read, option, base, seen, depth + 1).type);
      return { type: labels.join(' | ') || key, description };
    }
  }
  if (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'))) {
    const items = isObject(schema.items) ? describe(read, schema.items, base, seen, depth + 1) : { type: 'any' };
    const itemType = items.type.startsWith('→ ') ? items.type.slice(2) : items.type.includes(' | ') ? `(${items.type})` : items.type;
    return { type: `${itemType}[]`, description, ref: items.ref, children: items.children };
  }
  const nested = depth < MAX_DEPTH && isObject(schema.properties) ? fieldsOf(read, schema, base, seen, depth + 1) : [];
  const type = typeName(schema.type) || (nested.length ? 'object' : 'any');
  return {
    type: typeof schema.format === 'string' ? `${type} · ${schema.format}` : type,
    description,
    children: nested.length ? nested : undefined,
  };
}

function fieldsOf(read: ReadFile, schema: Json, base: string, seen: string[], depth: number): SchemaField[] {
  if (!isObject(schema.properties)) return [];
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter(item => typeof item === 'string') : []);
  return Object.entries(schema.properties).filter(([, value]) => isObject(value)).map(([name, value]) => ({
    name,
    required: required.has(name),
    ...describe(read, value as Json, base, seen, depth),
  }));
}

export function schemaTree(read: ReadFile, path: string): SchemaTree {
  const root = parse(read, path);
  if (!root) return { path, type: 'unknown', fields: [], problem: `${path} is not available or is not a JSON object.` };
  const top = describe(read, root, path, [`${path}#`], 0);
  return {
    path,
    title: typeof root.title === 'string' ? root.title : undefined,
    description: typeof root.description === 'string' ? root.description : undefined,
    type: top.type,
    fields: top.children ?? fieldsOf(read, root, path, [`${path}#`], 0),
  };
}
