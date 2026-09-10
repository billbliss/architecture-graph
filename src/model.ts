import type { Config, Graph, GraphModule, GraphNode, Relationship } from './schema.js';

export const VERSION = '0.3.1';
export const LIMIT = 'Structural validation only; declarations and file existence do not prove implementation conformance.';
export interface Locator { path: string; section: 'nodes' | 'relationships' | 'modules'; objectId: string }
export interface SourceContext { nodeIds: string[]; relationshipIds: string[] }
export interface Neighborhood { inbound: string[]; outbound: string[] }
export interface ModuleContext extends GraphModule { nodeIds: string[]; relationshipIds: string[] }
export interface CrossModuleDependency { edgeId: string; fromModule: string; toModule: string; targetId: string }
export interface GuardrailContext { nodeId: string; guardedNodeIds: string[]; relationshipIds: string[] }
export interface GraphIndex {
  nodes: Record<string, GraphNode>;
  relationships: Record<string, Relationship>;
  sources: Record<string, SourceContext>;
  neighborhoods: Record<string, Neighborhood>;
  modules: Record<string, ModuleContext>;
  crossModule: Record<string, CrossModuleDependency>;
  guardrails: Record<string, GuardrailContext>;
  locators: Record<string, Locator>;
}
export interface Project {
  root: string;
  config: Config;
  graph: Graph;
  index: GraphIndex;
  declarationDigest: string;
  readSource: 'compiled_artifact' | 'canonical_fallback';
  fallbackReason: string | null;
}
export interface ContextOptions {
  id?: string; file?: string; query?: string; module?: string; guardrail?: string;
  depth?: number; maxNodes?: number; maxRelationships?: number;
}
export interface ContextBundle {
  graphId: string;
  limitation: string;
  readSource: Project['readSource'];
  fallbackReason: string | null;
  seeds: string[];
  nodes: GraphNode[];
  relationships: Relationship[];
  modules: Array<{ id: string; name: string; description: string }>;
  crossModuleDependencies: CrossModuleDependency[];
  locators: Record<string, Locator>;
  truncated: boolean;
  warnings: string[];
  stats: { seedCandidates: number; nodesVisited: number; relationshipsExamined: number };
}
