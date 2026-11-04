import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from './canvas/Canvas';
import { useLayout } from './layout/engine';
import { atlasView, mapView, moduleView, neighborhoodView, pillId, type ViewGraph } from './layout/views';
import type { ExampleInfo } from './load/examples';
import type { Model } from './model/model';
import { Panel } from './panels/Panels';
import { useRoute, type Route } from './state/route';
import { Legend, TopBar } from './ui/Chrome';
import { ViewerContext, type Actions } from './ui/context';
import { Search } from './ui/Search';

/** The view the route asks for, falling back to the map (or the Atlas for graphs without modules). */
export function resolveView(model: Model, route: Route): { kind: ViewGraph['kind']; subject?: string } {
  if (route.view === 'atlas') return { kind: 'atlas' };
  if (route.view === 'module' && route.module && model.modules.has(route.module)) return { kind: 'module', subject: route.module };
  if (route.view === 'node' && route.focus && model.node(route.focus)) return { kind: 'neighborhood', subject: route.focus };
  return model.hasModules ? { kind: 'map' } : { kind: 'atlas' };
}

export function buildView(model: Model, kind: ViewGraph['kind'], subject?: string): ViewGraph {
  if (kind === 'module') return moduleView(model, subject!);
  if (kind === 'neighborhood') return neighborhoodView(model, subject!);
  if (kind === 'atlas') return atlasView(model);
  return mapView(model);
}

const VIEW_NAMES: Record<ViewGraph['kind'], string> = { map: 'Module map', module: 'Module', neighborhood: 'Neighborhood', atlas: 'Atlas' };

export function Viewer({ model, examples, example }: { model: Model; examples: ExampleInfo[]; example: string }) {
  const [route, navigate] = useRoute();
  const [searching, setSearching] = useState(false);
  const { kind, subject } = resolveView(model, route);
  // One view object per view, so a revisited view reuses its cached layout.
  const views = useRef(new Map<string, ViewGraph>());
  const view = useMemo(() => {
    const key = `${kind}:${subject ?? ''}`;
    let found = views.current.get(key);
    if (!found) {
      found = buildView(model, kind, subject);
      views.current.set(key, found);
    }
    return found;
  }, [model, kind, subject]);
  const layout = useLayout(view);

  const actions = useMemo<Actions>(() => {
    const here: Route = { view: route.view === 'map' && kind === 'atlas' ? 'atlas' : route.view, module: route.module, focus: route.focus };
    const shows = (id: string): boolean => view.nodes.some(item => item.id === id || item.id === pillId(id));
    const homeOf = (id: string): Route => {
      const node = model.node(id);
      if (node?.module && model.modules.has(node.module)) return { view: 'module', module: node.module };
      return { view: 'node', focus: id };
    };
    return {
      selectNode: id => {
        if (kind === 'atlas' || (kind !== 'map' && shows(id))) navigate({ ...here, node: id });
        else navigate({ ...homeOf(id), node: id });
      },
      selectRel: id => {
        const rel = model.relationships.get(id);
        if (!rel) return;
        if (kind === 'atlas' || (kind !== 'map' && shows(rel.from) && shows(rel.to))) navigate({ ...here, rel: id });
        else navigate({ ...homeOf(rel.from), rel: id });
      },
      selectPair: key => navigate({ view: 'map', pair: key }),
      openModule: id => navigate({ view: 'module', module: id }),
      openNeighborhood: id => navigate({ view: 'node', focus: id, node: id }),
      showMap: () => navigate({ view: 'map' }),
      showAtlas: () => navigate({ view: 'atlas', node: route.node, rel: route.rel }),
      setTab: tab => navigate({ ...route, tab }, { replace: true }),
      clearSelection: () => navigate(here),
    };
  }, [model, route, kind, view, navigate]);

  const onKey = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setSearching(true);
    } else if (event.key === 'Escape' && !searching && (route.node || route.rel || route.pair)) {
      actions.clearSelection();
    }
  }, [actions, route, searching]);
  useEffect(() => {
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    document.title = `${model.graph.title} · Architecture Graph viewer`;
  }, [model]);

  const context = useMemo(() => ({ model, route, actions }), [model, route, actions]);
  const ready = layout && layout.view === view ? layout : undefined;
  const label = `${VIEW_NAMES[kind]}${kind === 'module' && subject ? ` ${model.modules.get(subject)?.name}` : ''} of ${model.graph.title}`;
  return (
    <ViewerContext.Provider value={context}>
      <div className="app">
        <TopBar view={view} examples={examples} example={example} onSearch={() => setSearching(true)} />
        <main className="body">
          {ready && 'layout' in ready
            ? <Canvas view={view} layout={ready.layout} label={label} />
            : <section className="canvas" aria-label={label}><div className="status-line" role="status">{ready && 'error' in ready ? `Layout failed: ${ready.error}` : 'Laying out…'}</div></section>}
          <aside className="panel" aria-label="Details">
            <Panel view={view} />
          </aside>
        </main>
        <Legend />
      </div>
      <Search open={searching} onClose={() => setSearching(false)} />
    </ViewerContext.Provider>
  );
}
