// Indexes a validated graph for the views and panels. Everything here is derived from the graph alone;
// file contents (sidecars) come from the project's file source.
import type { Diagnostic, Graph, GraphModule, GraphNode, Relationship, Reference } from '@billbliss/architecture-graph/core';
import { kindIndex } from './kinds';

export interface Project {
  graph: Graph;
  /** Project-relative path of the graph file. */
  graphPath: string;
  /** The same validation results as `ag validate`; empty when the graph validates. */
  diagnostics: Diagnostic[];
  /** Text of a project file that was loaded (configuration, graph, sidecars); undefined otherwise. */
  file(path: string): string | undefined;
  /** A link to a project file's source, when the project's origin is known. */
  sourceUrl(path: string): string | undefined;
}

export interface ModuleStats {
  kinds: Map<GraphNode['kind'], number>;
  open: number;
  nodes: number;
}

export interface ContractEnds {
  providers: GraphNode[];
  /** Consumers, each with the node they were derived through when not declared. */
  consumers: { node: GraphNode; via?: GraphNode }[];
  /** True when consumers are inferred through the provider rather than declared on the contract. */
  derived: boolean;
}

/** Relationship kinds that do not mean "uses": they do not decide which module sits above which. */
const NOT_USE = new Set<Relationship['kind']>(['affects']);

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class Model {
  readonly graph: Graph;
  readonly project: Project;
  readonly nodes = new Map<string, GraphNode>();
  readonly modules = new Map<string, GraphModule>();
  readonly relationships = new Map<string, Relationship>();
  readonly outgoing = new Map<string, Relationship[]>();
  readonly incoming = new Map<string, Relationship[]>();
  /** Relationships whose ends are in different modules, keyed "fromModule>toModule". */
  readonly crossings = new Map<string, Relationship[]>();
  readonly hasModules: boolean;
  private readonly endsCache = new Map<string, ContractEnds>();

  constructor(project: Project) {
    this.project = project;
    this.graph = project.graph;
    for (const node of this.graph.nodes) this.nodes.set(node.id, node);
    for (const module of this.graph.modules ?? []) this.modules.set(module.id, module);
    this.hasModules = this.modules.size > 0;
    for (const node of this.graph.nodes) {
      this.outgoing.set(node.id, []);
      this.incoming.set(node.id, []);
    }
    for (const rel of this.graph.relationships) {
      this.relationships.set(rel.id, rel);
      this.outgoing.get(rel.from)?.push(rel);
      this.incoming.get(rel.to)?.push(rel);
      const a = this.nodes.get(rel.from)?.module;
      const b = this.nodes.get(rel.to)?.module;
      if (a && b && a !== b && this.modules.has(a) && this.modules.has(b)) {
        const key = `${a}>${b}`;
        const list = this.crossings.get(key) ?? [];
        list.push(rel);
        this.crossings.set(key, list);
      }
    }
  }

  node(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  relationsOf(id: string): Relationship[] {
    return [...(this.outgoing.get(id) ?? []), ...(this.incoming.get(id) ?? [])];
  }

  /** Nodes of a module (or, for '', nodes without a declared module) in reading order. */
  nodesIn(moduleId: string): GraphNode[] {
    return this.graph.nodes
      .filter(node => (moduleId ? node.module === moduleId : !node.module || !this.modules.has(node.module)))
      .sort(byKindThenName);
  }

  moduleStats(moduleId: string): ModuleStats {
    const kinds = new Map<GraphNode['kind'], number>();
    let open = 0;
    const nodes = this.nodesIn(moduleId);
    for (const node of nodes) {
      kinds.set(node.kind, (kinds.get(node.kind) ?? 0) + 1);
      if (node.status === 'unresolved') open++;
    }
    return { kinds, open, nodes: nodes.length };
  }

  /** Relationships from module a to module b. */
  crossing(a: string, b: string): Relationship[] {
    return this.crossings.get(`${a}>${b}`) ?? [];
  }

  /** Module pairs with at least one crossing relationship, each with the weight of "uses" in each direction. */
  modulePairs(): { a: string; b: string; ab: number; ba: number }[] {
    const pairs = new Map<string, { a: string; b: string; ab: number; ba: number }>();
    for (const [key, rels] of this.crossings) {
      const [from, to] = key.split('>') as [string, string];
      const pk = pairKey(from, to);
      const [a, b] = pk.split('|') as [string, string];
      const entry = pairs.get(pk) ?? { a, b, ab: 0, ba: 0 };
      const uses = rels.filter(rel => !NOT_USE.has(rel.kind)).length;
      if (from === a) entry.ab += uses;
      else entry.ba += uses;
      pairs.set(pk, entry);
    }
    return [...pairs.values()].sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : 1));
  }

  /**
   * Provider and consumers of a contract (or any node). Consumers are declared when nodes have
   * `consumes` or `depends_on` relationships to it; otherwise they are derived through the provider:
   * nodes that depend on a capability the provider provides, or on the provider itself.
   */
  contractEnds(id: string): ContractEnds {
    const cached = this.endsCache.get(id);
    if (cached) return cached;
    const into = this.incoming.get(id) ?? [];
    const firstOf = (...kinds: Relationship['kind'][]): GraphNode[] => {
      for (const kind of kinds) {
        const found = unique(into.filter(rel => rel.kind === kind).map(rel => rel.from));
        if (found.length) return found.map(from => this.nodes.get(from)).filter(isNode);
      }
      return [];
    };
    const providers = firstOf('authority_for', 'produces', 'preserves');
    const declared = unique(into.filter(rel => rel.kind === 'consumes' || rel.kind === 'depends_on').map(rel => rel.from))
      .map(from => this.nodes.get(from)).filter(isNode);
    let ends: ContractEnds;
    if (declared.length) ends = { providers, consumers: declared.map(node => ({ node })), derived: false };
    else {
      const found = new Map<string, { node: GraphNode; via?: GraphNode }>();
      const providerIds = new Set(providers.map(node => node.id));
      for (const provider of providers) {
        const capabilities = (this.outgoing.get(provider.id) ?? []).filter(rel => rel.kind === 'provides').map(rel => rel.to);
        for (const target of [...capabilities, provider.id]) {
          for (const rel of this.incoming.get(target) ?? []) {
            if ((rel.kind === 'depends_on' || rel.kind === 'consumes') && !providerIds.has(rel.from) && !found.has(rel.from)) {
              const node = this.nodes.get(rel.from);
              if (node) found.set(rel.from, { node, via: this.nodes.get(target) });
            }
          }
        }
      }
      ends = { providers, consumers: [...found.values()], derived: found.size > 0 };
    }
    this.endsCache.set(id, ends);
    return ends;
  }

  sidecars(node: GraphNode): { schemas: Reference[]; examples: Reference[] } {
    return {
      schemas: node.references.filter(ref => ref.kind === 'schema'),
      examples: node.references.filter(ref => ref.kind === 'example'),
    };
  }

  openQuestions(): GraphNode[] {
    return this.graph.nodes.filter(node => node.status === 'unresolved');
  }
}

export const isNode = (node: GraphNode | undefined): node is GraphNode => node !== undefined;
const unique = <T,>(items: T[]): T[] => [...new Set(items)];

export function byKindThenName(a: GraphNode, b: GraphNode): number {
  return kindIndex(a.kind) - kindIndex(b.kind) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1);
}
