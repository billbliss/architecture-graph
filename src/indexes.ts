import type { Graph } from './schema.js';
import type { GraphIndex } from './model.js';

const dictionary = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;
export function buildIndex(graph: Graph, path: string): GraphIndex {
  const index: GraphIndex = {
    nodes: dictionary(), relationships: dictionary(), sources: dictionary(),
    neighborhoods: dictionary(), modules: dictionary(), crossModule: dictionary(),
    guardrails: dictionary(), locators: dictionary(),
  };
  for (const module of graph.modules ?? []) {
    index.modules[module.id] = { ...module, nodeIds: [], relationshipIds: [] };
    index.locators[module.id] = { path, section: 'modules', objectId: module.id };
  }
  for (const node of [...graph.nodes].sort(byId)) {
    index.nodes[node.id] = node;
    index.neighborhoods[node.id] = { inbound: [], outbound: [] };
    index.locators[node.id] = { path, section: 'nodes', objectId: node.id };
    if (node.module) index.modules[node.module]!.nodeIds.push(node.id);
    for (const ref of node.references) {
      const entry = index.sources[ref.path] ??= { nodeIds: [], relationshipIds: [] };
      entry.nodeIds.push(node.id);
    }
    if (['policy', 'constraint', 'boundary'].includes(node.kind) || node.classification === 'guardrail') {
      index.guardrails[node.id] = { nodeId: node.id, guardedNodeIds: [], relationshipIds: [] };
    }
  }
  for (const edge of [...graph.relationships].sort(byId)) {
    index.relationships[edge.id] = edge;
    index.neighborhoods[edge.from]!.outbound.push(edge.id);
    index.neighborhoods[edge.to]!.inbound.push(edge.id);
    index.locators[edge.id] = { path, section: 'relationships', objectId: edge.id };
    const from = index.nodes[edge.from]!, to = index.nodes[edge.to]!;
    if (from.module) index.modules[from.module]!.relationshipIds.push(edge.id);
    if (from.module && to.module && from.module !== to.module) {
      index.crossModule[edge.id] = { edgeId: edge.id, fromModule: from.module, toModule: to.module, targetId: to.id };
    }
    const guard = index.guardrails[edge.to];
    if (guard && ['guarded_by', 'governed_by', 'constrained_by'].includes(edge.kind)) {
      guard.guardedNodeIds.push(edge.from); guard.relationshipIds.push(edge.id);
    }
    for (const ref of edge.references) {
      const entry = index.sources[ref.path] ??= { nodeIds: [], relationshipIds: [] };
      entry.relationshipIds.push(edge.id);
    }
  }
  for (const source of Object.values(index.sources)) {
    source.nodeIds = [...new Set(source.nodeIds)].sort();
    source.relationshipIds = [...new Set(source.relationshipIds)].sort();
  }
  for (const guard of Object.values(index.guardrails)) guard.guardedNodeIds = [...new Set(guard.guardedNodeIds)].sort();
  return index;
}
export const byId = (a: { id: string }, b: { id: string }): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
