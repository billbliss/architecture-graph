import { LIMIT, type ContextBundle, type ContextOptions, type Project, type Locator } from './model.js';
import { localPath } from './paths.js';
import { byId } from './indexes.js';

/** Indexed traversal; caps bound output and relationships examined, even for high-fanout nodes. */
export function getContext(project: Project, options: ContextOptions = {}): ContextBundle {
  const { id, file, query, module, guardrail, depth = 1, maxNodes = 60, maxRelationships = 120 } = options;
  if ([id, file, query, module, guardrail].filter(value => value !== undefined).length !== 1) {
    throw new Error('Choose exactly one of id, file, query, module, guardrail');
  }
  if (!Number.isInteger(depth) || depth < 0 || depth > 3) throw new Error('Depth must be an integer from 0 through 3');
  if (!Number.isInteger(maxNodes) || maxNodes < 2 || maxNodes > 1000) throw new Error('maxNodes must be an integer from 2 through 1000');
  if (!Number.isInteger(maxRelationships) || maxRelationships < 1 || maxRelationships > 4000) throw new Error('maxRelationships must be an integer from 1 through 4000');
  const index = project.index;
  const selected = new Set<string>();
  let truncated = false, seedCandidates = 0;
  const seed = (nodeId: string): void => {
    seedCandidates++;
    if (selected.size >= maxNodes && !selected.has(nodeId)) { truncated = true; return; }
    if (index.nodes[nodeId]) selected.add(nodeId);
  };
  const seedEdge = (edgeId: string): void => {
    const edge = index.relationships[edgeId];
    if (edge) { seed(edge.from); seed(edge.to); }
  };
  if (file !== undefined) {
    localPath(project.root, file);
    const source = index.sources[file];
    for (const node of source?.nodeIds ?? []) seed(node);
    for (const edge of source?.relationshipIds ?? []) seedEdge(edge);
  } else if (id !== undefined) {
    if (index.nodes[id]) seed(id); else seedEdge(id);
  } else if (module !== undefined) {
    for (const node of index.modules[module]?.nodeIds ?? []) seed(node);
  } else if (guardrail !== undefined) {
    const guard = index.guardrails[guardrail];
    if (guard) { seed(guard.nodeId); for (const node of guard.guardedNodeIds) seed(node); }
  } else if (query !== undefined) {
    if (!query.trim()) throw new Error('Query must not be empty');
    const search = query.toLowerCase();
    for (const node of Object.values(index.nodes)) {
      if (`${node.id} ${node.name} ${node.description}`.toLowerCase().includes(search)) seed(node.id);
    }
    for (const edge of Object.values(index.relationships)) {
      if (`${edge.id} ${edge.description}`.toLowerCase().includes(search)) seedEdge(edge.id);
    }
  }
  if (!selected.size) throw new Error('No architecture context matched; inspect scope or add a declaration');
  const seeds = [...selected].sort();
  const examined = new Set<string>();
  let frontier = [...selected];
  traversal: for (let hop = 0; hop <= depth; hop++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const neighborhood = index.neighborhoods[nodeId];
      if (!neighborhood) continue;
      // Inbound ownership, authorities and constraints are considered as well as outgoing edges.
      for (const edges of [neighborhood.inbound, neighborhood.outbound]) for (const edgeId of edges) {
        if (examined.has(edgeId)) continue;
        if (examined.size >= maxRelationships) { truncated = true; break traversal; }
        examined.add(edgeId);
        const edge = index.relationships[edgeId]!;
        if (hop < depth) for (const other of [edge.from, edge.to]) {
          if (selected.has(other)) continue;
          if (selected.size >= maxNodes) { truncated = true; continue; }
          selected.add(other); next.push(other);
        }
      }
    }
    frontier = next;
  }
  const nodes = [...selected].map(id => index.nodes[id]!).sort(byId);
  const relationships = [...examined].map(id => index.relationships[id]!)
    .filter(edge => selected.has(edge.from) && selected.has(edge.to)).sort(byId);
  const moduleIds = [...new Set(nodes.flatMap(node => node.module ? [node.module] : []))].sort();
  const locators: Record<string, Locator> = Object.create(null) as Record<string, Locator>;
  for (const item of [...nodes, ...relationships]) if (index.locators[item.id]) locators[item.id] = index.locators[item.id]!;
  return {
    graphId: project.graph.id, limitation: LIMIT, readSource: project.readSource, fallbackReason: project.fallbackReason,
    seeds, nodes, relationships,
    modules: moduleIds.map(id => { const module = index.modules[id]!; return { id, name: module.name, description: module.description }; }),
    crossModuleDependencies: relationships.flatMap(edge => index.crossModule[edge.id] ? [index.crossModule[edge.id]!] : []),
    locators, truncated,
    warnings: truncated ? ['Context is incomplete because a size or traversal limit was reached. Narrow the lookup or raise the explicit limits.'] : [],
    stats: { seedCandidates, nodesVisited: selected.size, relationshipsExamined: examined.size },
  };
}
export function formatContext(context: ContextBundle): string {
  return [context.limitation, `Read source: ${context.readSource}`, ...context.warnings, '',
    ...context.nodes.map(node => `${node.id} [${node.status}]: ${node.description}\n${node.references.map(ref => `  ${ref.kind}: ${ref.path}`).join('\n')}`),
    ...context.relationships.map(edge => `${edge.from} --${edge.kind}--> ${edge.to} [${edge.status}]: ${edge.description}`),
    ...context.modules.map(module => `Module ${module.id}: ${module.description}`),
  ].join('\n') + '\n';
}
