import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateShape, validateGraph, configSchema, localPath } from './validation.js';
export { validateGraph } from './validation.js';

export const VERSION = '0.1.0';
export const LIMIT = 'Structural validation only; declarations and file existence do not prove implementation conformance.';
const json = value => JSON.stringify(value, null, 2) + '\n';
export class AGError extends Error {
  constructor(errors) { super(errors.map(e => `${e.code} ${e.at}: ${e.message}`).join('\n')); this.errors = errors; }
}
function ensure(errors) { if (errors.length) throw new AGError(errors); }
function readJSON(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`Cannot read JSON ${file}: ${e.message}`); }
}
export function loadProject(configPath = 'ag.config.json') {
  const absolute = resolve(configPath);
  const root = realpathSync(dirname(absolute));
  const config = readJSON(localPath(root, absolute.split(/[\\/]/).at(-1)));
  ensure(validateShape(config, configSchema));
  const graphPath = localPath(root, config.graph);
  localPath(root, config.generated);
  if (config.graph === config.generated || config.graph.startsWith(config.generated + '/') || absolute.startsWith(resolve(root, config.generated) + '/')) throw new Error('Generated directory must not contain canonical graph or configuration');
  const graph = readJSON(graphPath);
  ensure(validateGraph(graph, root));
  for (const item of [...graph.nodes, ...graph.relationships]) for (const ref of item.references) {
    if (ref.path === config.generated || ref.path.startsWith(config.generated + '/')) throw new Error(`Canonical reference cannot point into generated output: ${ref.path}`);
  }
  return { root, config, graph };
}
export function initProject(root = '.', { id = 'graph:project', title = 'Project architecture' } = {}) {
  mkdirSync(root, { recursive: true });
  root = realpathSync(root);
  const config = { configVersion: '1', graph: 'architecture/graph.json', generated: 'architecture/generated' };
  const graph = { schemaVersion: '1', id, title, description: 'Initial scope is not yet modeled. Read requirements before adding declarations.', nodes: [], relationships: [] };
  ensure(validateGraph(graph, root));
  const files = { 'ag.config.json': json(config), [config.graph]: json(graph) };
  for (const path of Object.keys(files)) if (existsSync(localPath(root, path))) throw new Error(`Refusing to overwrite ${path}`);
  for (const [path, body] of Object.entries(files)) {
    const target = localPath(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, body, { flag: 'wx' });
  }
  return { root, config, graph };
}
export function getContext(project, { id, file, query, depth = 1 } = {}) {
  if ([id, file, query].filter(v => v !== undefined).length !== 1) throw new Error('Choose exactly one of id, file, query');
  if (!Number.isInteger(depth) || depth < 0 || depth > 3) throw new Error('Depth must be an integer from 0 through 3');
  const { graph } = project;
  if (file !== undefined) localPath(project.root, file);
  const selected = new Set();
  const matches = item => id !== undefined ? item.id === id : file !== undefined
    ? item.references.some(r => r.path === file)
    : `${item.id} ${item.name ?? ''} ${item.description}`.toLowerCase().includes(query.toLowerCase());
  for (const node of graph.nodes) if (matches(node)) selected.add(node.id);
  const matchedEdges = graph.relationships.filter(matches);
  for (const edge of matchedEdges) { selected.add(edge.from); selected.add(edge.to); }
  if (!selected.size) throw new Error('No architecture context matched; inspect scope or add a declaration');
  const seeds = [...selected].sort();
  for (let hop = 0; hop < depth; hop++) {
    const current = new Set(selected);
    for (const edge of graph.relationships) if (current.has(edge.from) || current.has(edge.to)) { selected.add(edge.from); selected.add(edge.to); }
  }
  return { graphId: graph.id, limitation: LIMIT, seeds,
    nodes: graph.nodes.filter(n => selected.has(n.id)).sort(byId),
    relationships: graph.relationships.filter(e => selected.has(e.from) && selected.has(e.to)).sort(byId) };
}
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function summarize(project) {
  const { graph } = project;
  return { graphId: graph.id, title: graph.title, scope: graph.description, limitation: LIMIT,
    nodes: graph.nodes.length, relationships: graph.relationships.length,
    statuses: Object.fromEntries(['proposed','implemented','unresolved'].map(s => [s, graph.nodes.filter(n => n.status === s).length])),
    unresolved: [...graph.nodes, ...graph.relationships].filter(n => n.status === 'unresolved').map(n => ({ id: n.id, description: n.description })).sort(byId) };
}
export function formatContext(context) {
  return [context.limitation, '', ...context.nodes.map(n => `${n.id} [${n.status}]: ${n.description}\n${n.references.map(r => `  ${r.kind}: ${r.path}`).join('\n')}`), ...context.relationships.map(e => `${e.from} --${e.kind}--> ${e.to} [${e.status}]: ${e.description}`)].join('\n') + '\n';
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export function renderArtifacts(project) {
  const graph = { ...project.graph, nodes: [...project.graph.nodes].sort(byId), relationships: [...project.graph.relationships].sort(byId) };
  const digest = createHash('sha256').update(JSON.stringify(stable({ config: project.config, graph }))).digest('hex');
  const header = `# ${graph.title}\n\nGenerated by AG ${VERSION}; edit canonical declarations in ${project.config.graph}.\nDeclaration digest: ${digest}\n\n${LIMIT}\n`;
  const context = formatContext({ limitation: `Scope: ${graph.description}`, nodes: graph.nodes, relationships: graph.relationships });
  const guidance = `${header}\nBefore architectural changes, use ag context --id <id> or --file <path>. Read referenced files and related contracts, owners, authorities, and unresolved decisions. Treat proposed and unresolved declarations as such. Update canonical declarations alongside code, run application tests, then ag validate, ag generate, and ag check. Never edit this derived file to resolve drift.\n\n${context}`;
  return { 'guidance.md': guidance, 'summary.json': json({ artifactVersion: '1', toolVersion: VERSION, declarationDigest: digest, ...summarize(project) }) };
}
export function syncArtifacts(project, { check = false } = {}) {
  const artifacts = renderArtifacts(project);
  const targets = Object.entries(artifacts).map(([name, body]) => [localPath(project.root, `${project.config.generated}/${name}`), body, name]);
  const drift = targets.filter(([path, body]) => !existsSync(path) || readFileSync(path, 'utf8') !== body).map(t => t[2]);
  if (!check) for (const [path, body] of targets) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, body); }
  return { drift, limitation: LIMIT };
}
