// Loads a project through a file source: configuration, then graph, then the same validation as
// `ag validate`. Every input (bundled example, URL, folder) supplies a source; nothing else differs.
// Runs in browsers and in Node (the example bundler), so it imports only the browser-safe core and
// uses only erasable TypeScript syntax.
import {
  ConfigSchema,
  parseDeclarations,
  validateGraph,
  type AsyncFileSource,
  type Diagnostic,
  type Graph,
} from '@billbliss/architecture-graph/core';

export interface LoadedProject {
  /** Project-relative path of the graph file. */
  graphPath: string;
  graph: Graph;
  /** Validation results; empty when the graph validates. */
  diagnostics: Diagnostic[];
  problem?: undefined;
}

export interface LoadFailure {
  /** Why the project could not be opened at all. */
  problem: string;
  diagnostics: Diagnostic[];
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Joins and normalizes a path relative to the project root; null when it leaves the project. */
export function projectPath(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

export async function loadFromSource(source: AsyncFileSource, configPath: string): Promise<LoadedProject | LoadFailure> {
  let config;
  try {
    config = ConfigSchema.parse(JSON.parse(await source.read(configPath)));
  } catch (error) {
    return { problem: `Cannot read the configuration ${configPath}: ${messageOf(error)}`, diagnostics: [] };
  }
  const graphPath = projectPath(config.graph);
  if (!graphPath) return { problem: `The configuration's graph path leaves the project: ${config.graph}`, diagnostics: [] };
  let value: unknown;
  try {
    value = parseDeclarations(await source.read(graphPath), graphPath);
  } catch (error) {
    return { problem: `Cannot read the graph ${graphPath}: ${messageOf(error)}`, diagnostics: [] };
  }
  const diagnostics = await validateGraph(value, source);
  // A shape error means the records cannot be trusted to have the fields the views read.
  if (diagnostics.some(item => item.code === 'schema')) {
    return { problem: 'The graph does not have the shape of an Architecture Graph.', diagnostics };
  }
  return { graphPath, graph: value as Graph, diagnostics };
}
