import { statSync } from 'node:fs';
import { GraphSchema, shapeErrors, type Graph, type Diagnostic, type NodeKind, type RelationshipKind } from './schema.js';
import { localPath, messageOf } from './paths.js';

/** Validate declarations and real references; this does not inspect implementation behavior. */
export function validateGraph(value: unknown, root: string): Diagnostic[] {
  const errors = shapeErrors(value, GraphSchema);
  if (errors.length) return errors;
  const graph = value as Graph;
  const add = (code: string, at: string, message: string): void => { errors.push({ code, at, message }); };
  const ids = new Set([graph.id]);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const modules = new Map((graph.modules ?? []).map(module => [module.id, module]));
  const owners = new Map<string, string>();
  const authorities = new Map<string, string>();
  const checkedPaths = new Map<string, string | null>();
  const exports = new Map((graph.modules ?? []).map(module => [module.id, new Set(module.exports)]));
  const imports = new Map((graph.modules ?? []).map(module => [module.id, new Set(module.imports)]));
  for (const item of [...graph.nodes, ...graph.relationships, ...(graph.modules ?? [])]) {
    if (ids.has(item.id)) add('duplicate-id', item.id, 'Identifier must be globally unique');
    ids.add(item.id);
    if (!('references' in item)) continue;
    if (item.status === 'implemented' && !item.references.some(ref => ref.kind === 'implementation')) {
      add('implemented-source', item.id, 'Implemented declaration needs an implementation reference');
    }
    for (const ref of item.references) {
      if (!checkedPaths.has(ref.path)) {
        try {
          if (!statSync(localPath(root, ref.path)).isFile()) throw new Error('Reference must name a file');
          checkedPaths.set(ref.path, null);
        } catch (error) { checkedPaths.set(ref.path, messageOf(error)); }
      }
      const problem = checkedPaths.get(ref.path);
      if (problem) add('reference', item.id, `${ref.path}: ${problem}`);
    }
  }
  for (const node of graph.nodes) {
    if (![`${node.kind}:`, `${node.kind.replaceAll('_', '-')}:`].some(prefix => node.id.startsWith(prefix))) {
      add('identifier-kind', node.id, 'Node identifier prefix must match kind');
    }
    if (node.module && !modules.has(node.module)) add('module', node.id, `Unknown module ${node.module}`);
  }
  for (const module of graph.modules ?? []) {
    for (const field of ['exports', 'imports'] as const) {
      if (new Set(module[field]).size !== module[field].length) add('module', module.id, `Duplicate ${field}`);
      for (const id of module[field]) {
        const node = nodes.get(id);
        if (!node) { add('module', module.id, `Unknown ${field} node ${id}`); continue; }
        if (field === 'exports' && node.module !== module.id) add('module-export', module.id, `${id} is not owned by this module`);
        if (field === 'imports' && (!node.module || node.module === module.id || !exports.get(node.module)?.has(id))) {
          add('module-import', module.id, `${id} must be exported by another declared module`);
        }
      }
    }
  }
  const rules: Partial<Record<RelationshipKind, [NodeKind[] | null, NodeKind[] | null]>> = {
    owns: [['actor', 'component', 'capability'], null],
    provides: [['component', 'surface', 'transform', 'adapter'], ['capability']],
    governed_by: [null, ['policy', 'constraint']],
    authority_for: [['actor', 'component', 'contract'], ['capability', 'contract', 'artifact', 'data_object']],
    constrained_by: [null, ['boundary', 'contract', 'policy', 'constraint']],
    guarded_by: [null, ['boundary', 'policy', 'constraint']],
    preserves: [null, ['contract', 'artifact', 'data_object']],
    affects: [['decision'], null],
  };
  for (const edge of graph.relationships) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (!from || !to) { add('dangling-relationship', edge.id, `Unknown endpoint: ${!from ? edge.from : edge.to}`); continue; }
    const rule = rules[edge.kind];
    if (rule && ((rule[0] && !rule[0].includes(from.kind)) || (rule[1] && !rule[1].includes(to.kind)))) {
      add('relationship-kind', edge.id, `Invalid ${from.kind} → ${to.kind} for ${edge.kind}`);
    }
    if (edge.from === edge.to) add('self-relationship', edge.id, 'Self relationships are not supported');
    if (edge.status !== 'unresolved' && ['owns', 'authority_for'].includes(edge.kind)) {
      const map = edge.kind === 'owns' ? owners : authorities;
      if (map.has(edge.to)) add('conflicting-declaration', edge.id, `Multiple ${edge.kind} declarations for ${edge.to}; model alternatives as unresolved`);
      map.set(edge.to, edge.from);
    }
    if (from.module && to.module && from.module !== to.module) {
      if (!imports.get(from.module)?.has(to.id) || !exports.get(to.module)?.has(to.id)) {
        add('cross-module', edge.id, `${from.module} must import ${to.id}, exported by ${to.module}`);
      }
    }
  }
  // Each ownership link is visited once, including large chains.
  const finished = new Set<string>();
  for (const start of owners.keys()) {
    const active = new Set<string>(); let id: string | undefined = start;
    while (id !== undefined && owners.has(id) && !finished.has(id)) {
      if (active.has(id)) { add('ownership-cycle', start, 'Ownership must be acyclic'); break; }
      active.add(id); id = owners.get(id);
    }
    for (const id of active) finished.add(id);
  }
  return errors;
}
