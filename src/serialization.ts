import { createHash } from 'node:crypto';
import { parseDocument, stringify } from 'yaml';
import type { Config, Graph } from './schema.js';
import { byId } from './indexes.js';

export const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
export function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => [key, stable(child)]));
  }
  return value;
}
export const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
export function declarationDigest(graph: Graph, config: Config): string {
  return digest(JSON.stringify(stable({ config, graph: {
    ...graph, nodes: [...graph.nodes].sort(byId), relationships: [...graph.relationships].sort(byId),
    ...(graph.modules ? { modules: [...graph.modules].sort(byId) } : {}),
  } })));
}
export function parseDeclarations(source: string, path: string): unknown {
  if (path.endsWith('.json')) JSON.parse(source); // Preserve strict JSON grammar for legacy input.
  else if (!/\.ya?ml$/.test(path)) throw new Error('Graph must be a single .yaml, .yml or .json file');
  const document = parseDocument(source, { version: '1.2', uniqueKeys: true, stringKeys: true });
  if (document.errors.length || document.warnings.length) {
    throw new Error(`Invalid declarations in ${path}: ${[...document.errors, ...document.warnings].map(e => e.message).join('\n')}`);
  }
  return document.toJS({ maxAliasCount: 0 });
}
export const serializeGraph = (graph: Graph): string => stringify(graph, { lineWidth: 100, aliasDuplicateObjects: false });
