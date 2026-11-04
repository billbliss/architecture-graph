// Builds the graph each view draws: which boxes, which edges, and in which column (partition). Sizes
// are fixed rather than measured so that layout depends on the graph alone and is deterministic.
import type { GraphNode } from '@billbliss/architecture-graph/core';
import { GROUP_ORDER, GROUP_TITLES, KINDS } from '../model/kinds';
import { byKindThenName, pairKey, type Model } from '../model/model';

export type ViewKind = 'map' | 'module' | 'neighborhood' | 'atlas';

export type Role = 'import' | 'inside' | 'user' | 'focus' | 'in' | 'out' | 'atlas';

export interface ViewNode {
  /** Canvas id: a module, node or contract-pill id. */
  id: string;
  type: 'module' | 'node' | 'contract';
  /** The graph record shown: module id, node id or contract id. */
  ref: string;
  width: number;
  height: number;
  role?: Role;
  /** Column, left to right, in views laid out across. */
  partition?: number;
}

export interface ViewEdge {
  id: string;
  source: string;
  target: string;
  type: 'pair' | 'relation' | 'contract';
  /** Relationship id, for relation edges. */
  rel?: string;
  /** Module pair key, for map edges. */
  pair?: string;
  /** Contract id, for contract edges. */
  contract?: string;
  /** Laid out by ELK; edges that do not decide placement are drawn between node sides instead. */
  routed: boolean;
  label?: { width: number; height: number };
}

export interface ViewGraph {
  kind: ViewKind;
  /** Module or node the view is about. */
  subject?: string;
  direction: 'DOWN' | 'RIGHT' | 'NONE';
  nodes: ViewNode[];
  edges: ViewEdge[];
  /** Atlas only: groups of node ids with a title, in column order. */
  groups?: { id: string; title: string; subtitle: string; nodes: string[] }[];
}

export const SIZES = {
  module: { width: 248, height: 140 },
  node: { width: 200, height: 46 },
  contract: { width: 172, height: 30 },
  atlas: { width: 208, height: 30 },
} as const;

export const pillId = (contract: string): string => `pill:${contract}`;

/** Width of a "↓12 ↑3" count label. */
function countLabel(ab: number, ba: number): { width: number; height: number } {
  const chars = (ab ? String(ab).length + 1 : 0) + (ba ? String(ba).length + 1 : 0) + (ab && ba ? 1 : 0);
  return { width: 16 + Math.max(2, chars) * 8, height: 22 };
}

/** Modules as boxes, one edge per pair of modules with crossing relationships. */
export function mapView(model: Model): ViewGraph {
  const nodes: ViewNode[] = [...model.modules.keys()].map(id => ({ id, type: 'module', ref: id, ...SIZES.module }));
  const edges: ViewEdge[] = model.modulePairs().map(({ a, b, ab, ba }) => {
    const all = model.crossing(a, b).length + model.crossing(b, a).length;
    // The module that uses the other more is drawn above it. Pairs joined only by relationships that
    // are not "uses" (decisions affecting a node) are drawn but do not decide placement.
    const [source, target] = ab >= ba ? [a, b] : [b, a];
    return {
      id: `pair:${pairKey(a, b)}`,
      source,
      target,
      type: 'pair',
      pair: pairKey(a, b),
      routed: ab + ba > 0,
      label: countLabel(all, all),
    };
  });
  return { kind: 'map', direction: 'DOWN', nodes, edges };
}

/**
 * A module's nodes in the middle, nodes it imports on the left, and nodes elsewhere that use it on the
 * right. Contracts whose consumers are outside the module become edges from provider to consumers,
 * labeled with the contract.
 */
export function moduleView(model: Model, moduleId: string): ViewGraph {
  const module = model.modules.get(moduleId);
  if (!module) throw new Error(`Unknown module ${moduleId}`);
  const inside = model.nodesIn(moduleId);
  const insideIds = new Set(inside.map(node => node.id));
  const edgeContracts: { contract: GraphNode; provider: GraphNode; consumers: GraphNode[] }[] = [];
  const boxes: GraphNode[] = [];
  for (const node of inside) {
    if (node.kind === 'contract') {
      const ends = model.contractEnds(node.id);
      const provider = ends.providers.find(item => insideIds.has(item.id));
      const outside = ends.consumers.map(item => item.node).filter(item => !insideIds.has(item.id));
      if (provider && outside.length) {
        edgeContracts.push({ contract: node, provider, consumers: outside });
        continue;
      }
    }
    boxes.push(node);
  }
  const pillOf = new Set(edgeContracts.map(item => item.contract.id));
  const placed = new Map<string, ViewNode>();
  const add = (node: GraphNode, role: Role, partition: number): void => {
    if (!placed.has(node.id)) placed.set(node.id, { id: node.id, type: 'node', ref: node.id, role, partition, ...SIZES.node });
  };
  for (const node of boxes) add(node, 'inside', 1);
  for (const id of module.imports) {
    const node = model.node(id);
    if (node) add(node, 'import', 0);
  }
  for (const { contract } of edgeContracts) {
    placed.set(pillId(contract.id), { id: pillId(contract.id), type: 'contract', ref: contract.id, partition: 2, ...SIZES.contract });
  }
  const users: GraphNode[] = [];
  for (const { consumers } of edgeContracts) users.push(...consumers);
  for (const node of inside) {
    for (const rel of model.incoming.get(node.id) ?? []) {
      const from = model.node(rel.from);
      if (from && !insideIds.has(from.id) && rel.kind !== 'affects') users.push(from);
    }
  }
  for (const node of [...new Set(users)].sort((a, b) => (a.module ?? '').localeCompare(b.module ?? '') || byKindThenName(a, b))) {
    add(node, 'user', 3);
  }

  const edges: ViewEdge[] = [];
  for (const rel of model.graph.relationships) {
    if (pillOf.has(rel.from) || pillOf.has(rel.to)) continue;
    const from = placed.get(rel.from);
    const to = placed.get(rel.to);
    if (!from || !to || (from.role !== 'inside' && to.role !== 'inside')) continue;
    edges.push({ id: rel.id, source: rel.from, target: rel.to, type: 'relation', rel: rel.id, routed: true });
  }
  for (const { contract, provider, consumers } of edgeContracts) {
    const pill = pillId(contract.id);
    edges.push({ id: `${pill}:from`, source: provider.id, target: pill, type: 'contract', contract: contract.id, routed: true });
    for (const consumer of consumers) {
      edges.push({ id: `${pill}:to:${consumer.id}`, source: pill, target: consumer.id, type: 'contract', contract: contract.id, routed: true });
    }
  }
  return { kind: 'module', subject: moduleId, direction: 'RIGHT', nodes: [...placed.values()], edges };
}

/** A node with what points at it on the left and what it points at on the right. */
export function neighborhoodView(model: Model, nodeId: string): ViewGraph {
  const focus = model.node(nodeId);
  if (!focus) throw new Error(`Unknown node ${nodeId}`);
  const placed = new Map<string, ViewNode>([[focus.id, { id: focus.id, type: 'node', ref: focus.id, role: 'focus', partition: 1, ...SIZES.node }]]);
  const outgoing = model.outgoing.get(nodeId) ?? [];
  const incoming = model.incoming.get(nodeId) ?? [];
  const targets = outgoing.map(rel => model.node(rel.to)).filter((node): node is GraphNode => !!node).sort(byKindThenName);
  const sources = incoming.map(rel => model.node(rel.from)).filter((node): node is GraphNode => !!node).sort(byKindThenName);
  for (const node of targets) if (!placed.has(node.id)) placed.set(node.id, { id: node.id, type: 'node', ref: node.id, role: 'out', partition: 2, ...SIZES.node });
  for (const node of sources) if (!placed.has(node.id)) placed.set(node.id, { id: node.id, type: 'node', ref: node.id, role: 'in', partition: 0, ...SIZES.node });
  const edges: ViewEdge[] = [...outgoing, ...incoming]
    .filter((rel, index, all) => all.indexOf(rel) === index && rel.from !== rel.to)
    .map(rel => ({ id: rel.id, source: rel.from, target: rel.to, type: 'relation', rel: rel.id, routed: true }));
  return { kind: 'neighborhood', subject: nodeId, direction: 'RIGHT', nodes: [...placed.values()], edges };
}

/** Every node, grouped by module (or by kind when the graph has no modules). Edges are drawn only for a selection. */
export function atlasView(model: Model): ViewGraph {
  const groups: NonNullable<ViewGraph['groups']> = [];
  const count = (n: number): string => `${n} node${n === 1 ? '' : 's'}`;
  if (model.hasModules) {
    for (const module of model.modules.values()) {
      const nodes = model.nodesIn(module.id).map(node => node.id);
      groups.push({ id: module.id, title: module.name, subtitle: count(nodes.length), nodes });
    }
    const loose = model.nodesIn('').map(node => node.id);
    if (loose.length) groups.push({ id: '', title: 'No module', subtitle: count(loose.length), nodes: loose });
  } else {
    for (const group of GROUP_ORDER) {
      const nodes = [...model.nodes.values()].filter(node => KINDS[node.kind].group === group).sort(byKindThenName).map(node => node.id);
      if (nodes.length) groups.push({ id: `kind:${group}`, title: GROUP_TITLES[group], subtitle: count(nodes.length), nodes });
    }
  }
  const nodes: ViewNode[] = groups.flatMap(group => group.nodes.map(id => ({ id, type: 'node' as const, ref: id, role: 'atlas' as const, ...SIZES.atlas })));
  return { kind: 'atlas', direction: 'NONE', nodes, edges: [], groups };
}
