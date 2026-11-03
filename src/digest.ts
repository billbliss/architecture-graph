import { createHash } from 'node:crypto';
import type { Config, Graph } from './schema.js';
import { byId } from './indexes.js';
import { stable } from './serialization.js';

export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
export function declarationDigest(graph: Graph, config: Config): string {
  return digest(JSON.stringify(stable({ config, graph: {
    ...graph, nodes: [...graph.nodes].sort(byId), relationships: [...graph.relationships].sort(byId),
    ...(graph.modules ? { modules: [...graph.modules].sort(byId) } : {}),
  } })));
}
