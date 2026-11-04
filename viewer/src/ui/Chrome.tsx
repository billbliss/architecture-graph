// The frame around the canvas: top bar (brand, example, breadcrumbs, view switch, search, theme) and legend.
import { KINDS, KIND_ORDER } from '../model/kinds';
import type { ViewGraph } from '../layout/views';
import type { ExampleInfo } from '../load/examples';
import { CONTRACTS_INTRO } from '../panels/ContractsView';
import { Glyph } from './common';
import { useViewer } from './context';

// Where the logo leads. The viewer assumes no host: by default it is its own start page. A host that
// serves it inside a site sets VITE_HOME_URL when building (architecturegraph.dev uses its root).
const HOME_URL: string = import.meta.env.VITE_HOME_URL || './';

export function Brand() {
  return (
    <a className="brand" href={HOME_URL}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><circle cx="5" cy="6" r="3" fill="var(--kind-behavior)" /><circle cx="19" cy="6" r="3" fill="var(--kind-responsibility)" /><rect x="9" y="15" width="6" height="6" rx="1.5" fill="var(--kind-crossing)" /><path d="M7 8l4 7M17 8l-4 7" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
      Architecture Graph
    </a>
  );
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Switch theme"
      title="Switch theme"
      onClick={() => {
        const root = document.documentElement;
        const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        const next = current === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
      }}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.5 5.5 0 0 1 13.36 3.1 9.2 9.2 0 0 0 12 3Z" /></svg>
    </button>
  );
}

export function TopBar({ view, examples, example, onSearch }: { view: ViewGraph; examples: ExampleInfo[]; example: string; onSearch: () => void }) {
  const { model, route, actions } = useViewer();
  const contracts = route.view === 'contracts';
  const selected = route.node ? model.node(route.node) : undefined;
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="top">
      <Brand />
      <select
        className="example-select"
        aria-label="Example graph"
        value={example}
        onChange={event => { location.href = `?example=${encodeURIComponent(event.target.value)}`; }}
      >
        {examples.map(item => <option key={item.name} value={item.name}>{item.title}</option>)}
      </select>
      <nav className="crumbs" aria-label="Breadcrumbs">
        <button type="button" onClick={() => (model.hasModules ? actions.showMap() : actions.showAtlas())}>{model.graph.title}</button>
        {contracts && <><span className="sep" aria-hidden="true">›</span><span className="here">Contracts</span></>}
        {!contracts && view.kind === 'atlas' && <><span className="sep" aria-hidden="true">›</span><span className="here">Atlas</span></>}
        {!contracts && view.kind === 'module' && view.subject && (
          <><span className="sep" aria-hidden="true">›</span><button type="button" onClick={() => actions.openModule(view.subject!)}>{model.modules.get(view.subject)?.name}</button></>
        )}
        {!contracts && view.kind === 'neighborhood' && view.subject && (
          <><span className="sep" aria-hidden="true">›</span><span className="here">Around {model.node(view.subject)?.name}</span></>
        )}
        {selected && (view.kind !== 'neighborhood' || selected.id !== view.subject) && (
          <><span className="sep" aria-hidden="true">›</span><span className="here" aria-current="true"><Glyph kind={selected.kind} /> {selected.name}</span></>
        )}
      </nav>
      <div className="seg" role="group" aria-label="View">
        {model.hasModules && <button type="button" aria-pressed={!contracts && view.kind !== 'atlas'} onClick={actions.showMap}>Map</button>}
        <button type="button" aria-pressed={contracts} onClick={() => actions.showContract()} title={CONTRACTS_INTRO}>Contracts</button>
        <button type="button" aria-pressed={!contracts && view.kind === 'atlas'} onClick={actions.showAtlas}>Atlas</button>
      </div>
      <button type="button" className="search-button" onClick={onSearch} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
        <span aria-hidden="true">⌕</span> Jump to… <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <ThemeToggle />
    </header>
  );
}

export function Legend() {
  const { model } = useViewer();
  const used = new Set(model.graph.nodes.map(node => node.kind));
  return (
    <footer className="legend" aria-label="Legend">
      {KIND_ORDER.filter(kind => used.has(kind)).map(kind => <span key={kind}><Glyph kind={kind} />{KINDS[kind].label}</span>)}
      <span><i className="sample" aria-hidden="true" />implemented</span>
      <span><i className="sample proposed" aria-hidden="true" />proposed</span>
      <span><i className="sample unresolved" aria-hidden="true" />unresolved</span>
    </footer>
  );
}
