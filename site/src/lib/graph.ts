// Build-time graph access through the toolkit itself: loadProject runs the same validation as
// `ag validate`, so an invalid bundled example fails the site build instead of being published.
import { loadProject, validateGraph, type Graph, type GraphNode, type Relationship } from '@billbliss/architecture-graph';
import { posix } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import { REPO_ROOT, readRepoJson, repoFile, repoPath } from './repo';
import { EXAMPLES } from './site-map';

export interface LoadedExample {
  name: string;
  graph: Graph;
  /** Repository-relative folder containing the example's configuration (its project root). */
  root: string;
}

const loaded = new Map<string, LoadedExample>();

export function example(name: string): LoadedExample {
  const cached = loaded.get(name);
  if (cached) return cached;
  const info = EXAMPLES.find(item => item.name === name);
  if (!info) throw new Error(`Unknown example: ${name}`);
  const project = loadProject(repoFile(info.config), { forceCanonical: true });
  const result = { name, graph: project.graph, root: repoPath(posix.dirname(info.config)) };
  loaded.set(name, result);
  return result;
}

export function node(graph: Graph, id: string): GraphNode {
  const found = graph.nodes.find(item => item.id === id);
  if (!found) throw new Error(`${graph.id} has no node ${id}`);
  return found;
}

export function relationship(graph: Graph, id: string): Relationship {
  const found = graph.relationships.find(item => item.id === id);
  if (!found) throw new Error(`${graph.id} has no relationship ${id}`);
  return found;
}

const yamlOptions = { lineWidth: 100, aliasDuplicateObjects: false } as const;

/** Authored-format YAML for records taken verbatim from a bundled example graph. */
export function excerpt(exampleName: string, ids: { nodes?: string[]; relationships?: string[]; modules?: string[] }): string {
  const { graph } = example(exampleName);
  const parts: Record<string, unknown> = {};
  if (ids.nodes?.length) parts.nodes = ids.nodes.map(id => node(graph, id));
  if (ids.relationships?.length) parts.relationships = ids.relationships.map(id => relationship(graph, id));
  if (ids.modules?.length) {
    parts.modules = ids.modules.map(id => {
      const found = graph.modules?.find(item => item.id === id);
      if (!found) throw new Error(`${graph.id} has no module ${id}`);
      return found;
    });
  }
  return stringify(parts, yamlOptions);
}

/**
 * Parses and validates a complete graph written for a site page. References resolve against the given
 * repository folder. Throws with the toolkit's diagnostics when the graph does not validate.
 */
export function validatedSnippet(yamlText: string, root: string): string {
  const value = parseYaml(yamlText);
  const errors = validateGraph(value, posix.join(REPO_ROOT, repoPath(root)));
  if (errors.length) {
    throw new Error(`Site graph example does not validate:\n${errors.map(error => `${error.code} ${error.at}: ${error.message}`).join('\n')}`);
  }
  return yamlText;
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface JsonSchema {
  title?: string;
  description?: string;
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  $ref?: string;
  items?: JsonSchema;
  required?: string[];
  properties?: Record<string, JsonSchema>;
}

function typeLabel(schema: JsonSchema, base: string): string {
  if (schema.$ref) {
    const target = readRepoJson<JsonSchema>(posix.join(posix.dirname(base), schema.$ref.split('#')[0]));
    return target.title ?? schema.$ref;
  }
  if (schema.enum) return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  if (schema.type === 'array' && schema.items) return `${typeLabel(schema.items, base)}[]`;
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type ?? 'any';
  return schema.format ? `${type} (${schema.format})` : type;
}

export interface ContractView {
  node: GraphNode;
  provider: { node: GraphNode; description: string };
  consumers: { node: GraphNode; description: string }[];
  schemaTitle: string;
  fields: SchemaField[];
  example: string;
  schemaPath: string;
  examplePath: string;
}

/** Everything the home-page contract graphic shows, read from the real graph and sidecars. */
export function contractView(exampleName: string, contractId: string): ContractView {
  const { graph, root } = example(exampleName);
  const contract = node(graph, contractId);
  const authority = graph.relationships.find(item => item.kind === 'authority_for' && item.to === contractId);
  if (!authority) throw new Error(`${contractId} has no authority_for relationship`);
  const consumers = graph.relationships
    .filter(item => (item.kind === 'consumes' || item.kind === 'depends_on') && item.to === contractId)
    .map(item => ({ node: node(graph, item.from), description: item.description }));
  const schemaRef = contract.references.find(ref => ref.kind === 'schema');
  const exampleRef = contract.references.find(ref => ref.kind === 'example');
  if (!schemaRef || !exampleRef) throw new Error(`${contractId} needs schema and example sidecars`);
  const schemaPath = repoPath(posix.join(root, schemaRef.path));
  const examplePath = repoPath(posix.join(root, exampleRef.path));
  const schema = readRepoJson<JsonSchema>(schemaPath);
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: typeLabel(property, schemaPath),
    required: required.has(name),
    description: property.description,
  }));
  return {
    node: contract,
    provider: { node: node(graph, authority.from), description: authority.description },
    consumers,
    schemaTitle: schema.title ?? contract.name,
    fields,
    example: JSON.stringify(readRepoJson(examplePath), null, 2),
    schemaPath,
    examplePath,
  };
}
