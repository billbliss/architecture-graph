import { readFileSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';

export const graphSchema = JSON.parse(readFileSync(new URL('../schema/graph.schema.json', import.meta.url)));
export const configSchema = JSON.parse(readFileSync(new URL('../schema/config.schema.json', import.meta.url)));

// Only the JSON Schema keywords used by our bundled schemas are needed here.
export function validateShape(value, schema, at = '$', errors = []) {
  const issue = message => errors.push({ code: 'schema', at, message });
  if (schema.const !== undefined && value !== schema.const) issue(`Expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) issue(`Expected one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const valid = schema.type === 'array' ? Array.isArray(value) : schema.type === 'object'
      ? value !== null && typeof value === 'object' && !Array.isArray(value) : typeof value === schema.type;
    if (!valid) { issue(`Expected ${schema.type}`); return errors; }
  }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) issue('Must not be empty');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) issue(`Must match ${schema.pattern}`);
  }
  if (schema.type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) issue(`Missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, key)) issue(`Unknown property ${key}`);
      else validateShape(child, schema.properties[key], `${at}.${key}`, errors);
    }
  }
  if (schema.type === 'array') value.forEach((child, i) => validateShape(child, schema.items, `${at}[${i}]`, errors));
  return errors;
}

// Paths are repository-relative, portable, and cannot traverse symlinks, even for writes.
export function localPath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\\x00-\x1f:]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error(`Expected normalized repository-relative path: ${path}`);
  }
  const base = realpathSync(root);
  let current = base;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${path}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const rel = relative(base, current);
  if (rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path escapes repository: ${path}`);
  return current;
}

export function validateGraph(graph, root) {
  const errors = validateShape(graph, graphSchema);
  if (errors.length) return errors;
  const add = (code, at, message) => errors.push({ code, at, message });
  const ids = new Set([graph.id]);
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const owners = new Map();
  const authorities = new Map();
  for (const item of [...graph.nodes, ...graph.relationships]) {
    if (ids.has(item.id)) add('duplicate-id', item.id, 'Identifier must be globally unique');
    ids.add(item.id);
    if (graph.nodes.includes(item) && !item.id.startsWith(`${item.kind}:`)) add('identifier-kind', item.id, 'Node identifier prefix must match kind');
    if (item.status === 'implemented' && !item.references.some(r => r.kind === 'implementation')) add('implemented-source', item.id, 'Implemented declaration needs an implementation reference');
    for (const ref of item.references) {
      try {
        const path = localPath(root, ref.path);
        if (!statSync(path).isFile()) throw new Error('Reference must name a file');
      } catch (e) { add('reference', item.id, `${ref.path}: ${e.message}`); }
    }
  }
  for (const edge of graph.relationships) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (!from || !to) { add('dangling-relationship', edge.id, `Unknown endpoint: ${!from ? edge.from : edge.to}`); continue; }
    const rules = {
      owns: [['actor','component'], null],
      provides: [['component','surface','transform'], ['capability']],
      governed_by: [null, ['policy']],
      authority_for: [['actor','component','contract'], ['capability','contract','artifact']],
      constrained_by: [null, ['boundary','contract','policy']],
      preserves: [null, ['contract','artifact']],
      affects: [['decision'], null],
    };
    const rule = rules[edge.kind];
    if (rule && ((rule[0] && !rule[0].includes(from.kind)) || (rule[1] && !rule[1].includes(to.kind)))) add('relationship-kind', edge.id, `Invalid ${from.kind} → ${to.kind} for ${edge.kind}`);
    if (edge.from === edge.to) add('self-relationship', edge.id, 'Self relationships are not supported');
    if (edge.status !== 'unresolved' && ['owns','authority_for'].includes(edge.kind)) {
      const map = edge.kind === 'owns' ? owners : authorities;
      if (map.has(edge.to)) add('conflicting-declaration', edge.id, `Multiple ${edge.kind} declarations for ${edge.to}; model alternatives as unresolved`);
      map.set(edge.to, edge.from);
    }
  }
  // An ownership cycle cannot form a meaningful containment hierarchy.
  for (const start of owners.keys()) {
    const seen = new Set(); let id = start;
    while (owners.has(id)) {
      if (seen.has(id)) { add('ownership-cycle', start, 'Ownership must be acyclic'); break; }
      seen.add(id); id = owners.get(id);
    }
  }
  return errors;
}
