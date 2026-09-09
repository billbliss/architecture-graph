import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { ConfigSchema, shapeErrors, type Diagnostic, type Graph, type Config } from './schema.js';
import type { Project } from './model.js';
import { validateGraph } from './validation.js';
import { localPath } from './paths.js';
import { declarationDigest, json, parseDeclarations, serializeGraph } from './serialization.js';
import { readCompiled } from './compiled.js';
import { buildIndex } from './indexes.js';

export class AGError extends Error {
  constructor(public readonly errors: Diagnostic[]) {
    super(errors.map(error => `${error.code} ${error.at}: ${error.message}`).join('\n'));
  }
}
export function ensure(errors: Diagnostic[]): void { if (errors.length) throw new AGError(errors); }
export function loadProject(configPath = 'ag.config.json', options: { forceCanonical?: boolean } = {}): Project {
  const absolute = resolve(configPath), root = realpathSync(dirname(absolute));
  const value: unknown = JSON.parse(readFileSync(localPath(root, basename(absolute)), 'utf8'));
  ensure(shapeErrors(value, ConfigSchema));
  const config = value as Config;
  const graphPath = localPath(root, config.graph);
  localPath(root, config.generated);
  if (config.graph === config.generated || config.graph.startsWith(config.generated + '/') || basename(absolute) === config.generated || absolute.startsWith(resolve(root, config.generated) + '/')) {
    throw new Error('Generated directory must not contain canonical graph or configuration');
  }
  const parsed = parseDeclarations(readFileSync(graphPath, 'utf8'), config.graph);
  ensure(validateGraph(parsed, root));
  const graph = parsed as Graph;
  for (const item of [...graph.nodes, ...graph.relationships]) for (const ref of item.references) {
    if (ref.path === config.generated || ref.path.startsWith(config.generated + '/')) {
      throw new Error(`Canonical reference cannot point into generated output: ${ref.path}`);
    }
  }
  const fingerprint = declarationDigest(graph, config);
  const compiled = options.forceCanonical ? { index: null, reason: 'Canonical lookup requested' }
    : readCompiled(root, config, graph.id, fingerprint);
  return {
    root, config, graph, declarationDigest: fingerprint,
    index: compiled.index ?? buildIndex(graph, config.graph),
    readSource: compiled.index ? 'compiled_artifact' : 'canonical_fallback', fallbackReason: compiled.reason,
  };
}
export function initProject(root = '.', { id = 'graph:project', title = 'Project architecture' }: { id?: string; title?: string } = {}): Project {
  mkdirSync(root, { recursive: true }); root = realpathSync(root);
  const config: Config = { configVersion: '1', graph: 'architecture/graph.yaml', generated: 'architecture/generated' };
  const graph: Graph = { schemaVersion: '1', id, title, description: 'Initial scope is not yet modeled. Read requirements before adding declarations.', nodes: [], relationships: [] };
  ensure(validateGraph(graph, root));
  const files = { 'ag.config.json': json(config), [config.graph]: serializeGraph(graph) };
  for (const path of Object.keys(files)) if (existsSync(localPath(root, path))) throw new Error(`Refusing to overwrite ${path}`);
  for (const [path, content] of Object.entries(files)) {
    const target = localPath(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content, { flag: 'wx' });
  }
  return loadProject(resolve(root, 'ag.config.json'));
}
