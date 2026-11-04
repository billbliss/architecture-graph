// Panels and views read the right things from the graph and its sidecars.
import { memoryFileSource } from '@billbliss/architecture-graph/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { buildFlow } from '../src/canvas/flow';
import { layoutView } from '../src/layout/layout';
import { moduleView, pillId } from '../src/layout/views';
import { loadFromSource } from '../src/load/project';
import { Model, type Project } from '../src/model/model';
import { contractGroups, contractRecords } from '../src/model/contracts';
import { payloadsOf } from '../src/model/payloads';
import { ContractsView } from '../src/panels/ContractsView';
import { schemaTree } from '../src/model/schema-tree';
import { ContractPanel, Structure } from '../src/panels/ContractPanel';
import { Panel } from '../src/panels/Panels';
import { formatHash, parseHash, type Route } from '../src/state/route';
import { ViewerContext, type Actions } from '../src/ui/context';
import { search } from '../src/ui/Search';
import { buildView, resolveView } from '../src/Viewer';
import { elk, example, exampleNames } from './helpers';

const noop = (): void => {};
const actions: Actions = {
  selectNode: noop, selectRel: noop, selectPair: noop, openModule: noop, openNeighborhood: noop,
  showMap: noop, showAtlas: noop, showContract: noop, showInGraph: noop, setTab: noop, clearSelection: noop,
};

function render(model: Model, route: Route, element: React.ReactElement): string {
  return renderToStaticMarkup(<ViewerContext.Provider value={{ model, route, actions }}>{element}</ViewerContext.Provider>);
}

describe.each(exampleNames)('%s', name => {
  test('every node with a schema sidecar renders a Structure tab with its fields', async () => {
    const model = await example(name);
    const withSchema = model.graph.nodes.filter(node => node.references.some(ref => ref.kind === 'schema'));
    for (const node of withSchema) {
      const html = render(model, { view: 'map', node: node.id }, <ContractPanel node={node} />);
      expect(html, node.id).toContain('role="tab"');
      expect(html, node.id).toContain('data-testid="structure"');
      const schemaPath = node.references.find(ref => ref.kind === 'schema')!.path;
      const properties = Object.keys(JSON.parse(model.project.file(schemaPath)!).properties ?? {});
      for (const property of properties) expect(html, `${node.id} ${property}`).toContain(`<span>${property}</span>`);
    }
  });

  test('every route the viewer can show renders a panel', async () => {
    const model = await example(name);
    const routes: Route[] = [
      { view: 'map' },
      { view: 'atlas' },
      ...[...model.modules.keys()].map(module => ({ view: 'module' as const, module })),
      ...model.graph.nodes.map(node => ({ view: 'atlas' as const, node: node.id })),
      ...model.graph.relationships.slice(0, 10).map(rel => ({ view: 'atlas' as const, rel: rel.id })),
      ...model.modulePairs().map(pair => ({ view: 'map' as const, pair: `${pair.a}|${pair.b}` })),
    ];
    for (const route of routes) {
      const { kind, subject } = resolveView(model, route);
      const html = render(model, route, <Panel view={buildView(model, kind, subject)} />);
      expect(html.length, JSON.stringify(route)).toBeGreaterThan(50);
    }
  });
});

test('task-changed is drawn as an edge from the task service to its four declared consumers', async () => {
  const model = await example('task-manager');
  const ends = model.contractEnds('contract:task-changed');
  expect(ends.derived).toBe(false);
  expect(ends.providers.map(node => node.id)).toEqual(['component:task-service']);
  expect(ends.consumers.map(item => item.node.id).sort()).toEqual([
    'component:notifier', 'component:reminder-scheduler', 'component:search-indexer', 'component:sync-engine',
  ]);
  const view = moduleView(model, 'module:tasks');
  const pill = pillId('contract:task-changed');
  expect(view.nodes.some(node => node.id === pill)).toBe(true);
  expect(view.edges.filter(edge => edge.source === pill).map(edge => edge.target).sort()).toEqual(ends.consumers.map(item => item.node.id).sort());
});

test('selecting a contract highlights its provider and consumers and fades the rest', async () => {
  const model = await example('task-manager');
  const view = moduleView(model, 'module:tasks');
  const layout = await layoutView(view, elk);
  const flow = buildFlow(model, view, layout, { view: 'module', module: 'module:tasks', node: 'contract:task-changed' });
  const dim = (id: string): boolean => (flow.nodes.find(node => node.id === id)!.data as { dim?: boolean }).dim === true;
  expect(dim('component:task-service')).toBe(false);
  expect(dim('component:sync-engine')).toBe(false);
  expect(dim('surface:web-app')).toBe(true);
  expect(flow.edges.filter(edge => edge.type === 'route' && !edge.hidden && edge.data?.classes.includes('hi')).length).toBe(5);
  expect(flow.summary).toContain('Task changed');
  // Boxes are buttons; React Flow would otherwise turn pointer events off for unselectable nodes.
  for (const node of flow.nodes.filter(item => item.type === 'box' || item.type === 'pill')) expect(node.style?.pointerEvents).toBe('all');
});

test('consumers are derived through the provider when a contract declares none', async () => {
  const model = await example('architecture-graph');
  const ends = model.contractEnds('contract:bounded-context');
  expect(ends.derived).toBe(true);
  expect(ends.consumers.length).toBeGreaterThan(0);
  expect(ends.consumers.every(item => item.via)).toBe(true);
});

test('the Structure tab resolves $ref across sidecar files', async () => {
  const model = await example('task-manager');
  const tree = schemaTree(path => model.project.file(path), 'contracts/task-changed.schema.json');
  const task = tree.fields.find(field => field.name === 'task')!;
  expect(task.type).toBe('→ Task');
  expect(task.ref?.path).toBe('contracts/task.schema.json');
  expect(task.children?.map(field => field.name)).toContain('title');
  const html = render(model, { view: 'map' }, <Structure node={model.node('contract:task-changed')!} />);
  expect(html).toContain('→ Task');
});

test('a graph without modules opens on the Atlas grouped by kind and uses neighborhoods', async () => {
  const files = {
    'ag.config.json': JSON.stringify({ configVersion: '1', graph: 'graph.yaml', generated: 'generated' }),
    'graph.yaml': `schemaVersion: "1"
id: graph:flat
title: Flat
description: No modules.
nodes:
  - { id: component:a, kind: component, name: A, description: A., status: proposed, references: [] }
  - { id: capability:b, kind: capability, name: B, description: B., status: proposed, references: [] }
relationships:
  - { id: rel:ab, kind: provides, from: component:a, to: capability:b, description: A provides B., status: proposed, references: [] }
`,
  };
  const loaded = await loadFromSource(memoryFileSource(files), 'ag.config.json');
  if (loaded.problem !== undefined) throw new Error(loaded.problem);
  const project: Project = { ...loaded, file: path => files[path as keyof typeof files], sourceUrl: () => undefined };
  const model = new Model(project);
  expect(resolveView(model, parseHash(''))).toEqual({ kind: 'atlas' });
  const atlas = buildView(model, 'atlas');
  expect(atlas.groups?.map(group => group.title)).toEqual(['Where behavior lives', 'What the system does']);
  const around = buildView(model, 'neighborhood', 'component:a');
  const layout = await layoutView(around, elk);
  expect(layout.positions['component:a']!.x).toBeLessThan(layout.positions['capability:b']!.x);
});

test('the URL hash round-trips the view and selection, keeping IDs readable', () => {
  const route: Route = { view: 'module', module: 'module:tasks', node: 'contract:task-changed', tab: 'example' };
  const hash = formatHash(route);
  expect(hash).toBe('#module=module:tasks&node=contract:task-changed&tab=example');
  expect(parseHash(hash)).toEqual({ ...route, focus: undefined, rel: undefined, pair: undefined });
  expect(parseHash('#pair=module:a,module:b').pair).toBe('module:a|module:b');
  expect(parseHash('#view=atlas&tab=bogus')).toMatchObject({ view: 'atlas', tab: undefined });
  expect(formatHash({ view: 'map' })).toBe('');
});

test('search finds nodes, relationships and modules by name or ID', async () => {
  const model = await example('task-manager');
  expect(search(model, 'task changed')[0]).toMatchObject({ type: 'node', id: 'contract:task-changed' });
  expect(search(model, 'module:sync')[0]).toMatchObject({ type: 'module', id: 'module:sync' });
  expect(search(model, 'consumes').some(hit => hit.type === 'relationship')).toBe(true);
  expect(search(model, '   ')).toEqual([]);
});

test('a component panel lists the payloads it sends and receives, with their examples', async () => {
  const model = await example('task-manager');
  const { sends, receives } = payloadsOf(model, 'component:task-service');
  expect(sends.map(flow => flow.record.id).sort()).toEqual(['contract:task', 'contract:task-changed']);
  const engine = payloadsOf(model, 'component:sync-engine');
  expect(engine.receives.map(flow => flow.record.id)).toContain('contract:task-changed');
  expect(receives.every(flow => flow.examples.length > 0)).toBe(true);
  const html = render(model, { view: 'map', node: 'component:sync-engine' }, <Panel view={buildView(model, 'map')} />);
  expect(html).toContain('Receives');
  expect(html).toContain('&quot;eventId&quot;');
  // Plain component dependencies carry no payload: hello-world declares none.
  const hello = await example('hello-world');
  expect(payloadsOf(hello, 'component:greeter')).toEqual({ sends: [], receives: [] });
});

test('contract edges carry their contract, so hovering or selecting one shows its payload', async () => {
  const model = await example('task-manager');
  const view = moduleView(model, 'module:tasks');
  const flow = buildFlow(model, view, await layoutView(view, elk), { view: 'module', module: 'module:tasks' });
  const contractEdges = flow.edges.filter(edge => edge.className?.includes('contract-edge'));
  expect(contractEdges.length).toBeGreaterThan(0);
  expect(new Set(contractEdges.map(edge => edge.data?.contract))).toEqual(new Set(['contract:task', 'contract:task-changed']));
  expect(flow.edges.filter(edge => !edge.data?.contract).every(edge => !edge.className?.includes('contract-edge'))).toBe(true);
});

describe.each(exampleNames)('%s Contracts view', name => {
  test('lists every contract once, grouped by module, and opens the first by default', async () => {
    const model = await example(name);
    const records = contractRecords(model);
    const contracts = model.graph.nodes.filter(node => node.kind === 'contract');
    for (const node of contracts) expect(records).toContain(node);
    expect(new Set(records.map(node => node.id)).size).toBe(records.length);
    for (const group of contractGroups(model)) expect(group.records.every(node => (node.module ?? '') === group.id)).toBe(true);
    const html = render(model, { view: 'contracts' }, <ContractsView />);
    for (const node of records) expect(html).toContain(node.name.replace(/'/g, '&#x27;'));
    if (records[0]) expect(html).toContain(`aria-label="${records[0].name.replace(/'/g, '&#x27;')} contract"`);
  });
});

test('the Contracts view shows structure and example payload together for the selected contract', async () => {
  const model = await example('task-manager');
  const html = render(model, { view: 'contracts', node: 'contract:task-changed' }, <ContractsView />);
  expect(html).toContain('aria-label="Task changed contract"');
  expect(html).toContain('data-testid="structure"');
  expect(html).toContain('&quot;eventId&quot;');
  expect(html).toContain('aria-current="true"');
  expect(html).toContain('Show in the graph');
});

test('the Contracts view round-trips in the URL hash', () => {
  const route: Route = { view: 'contracts', node: 'contract:task' };
  expect(formatHash(route)).toBe('#view=contracts&node=contract:task');
  expect(parseHash('#view=contracts&node=contract:task')).toMatchObject(route);
});

test('a schema with alternatives lists each named shape with its fields', async () => {
  const model = await example('architecture-graph');
  const tree = schemaTree(path => model.project.file(path), 'examples/architecture-graph/contracts/compiled-indexes.schema.json');
  expect(tree.type).toBe('one of');
  expect(tree.fields.map(field => field.name)).toContain('graph-index.json');
  const map = tree.fields.find(field => field.name === 'graph-source-map.json')!;
  expect(map.children?.map(field => field.name)).toEqual(['locators']);
});

test('a contract without sidecars gets a quiet note, not a warning', async () => {
  const model = await example('hello-world');
  const node = model.node('contract:greeting')!;
  const html = render(model, { view: 'contracts', node: node.id }, <ContractsView />);
  expect(html).toContain('No data format is described');
  expect(html).not.toContain('class="gap"');
});
