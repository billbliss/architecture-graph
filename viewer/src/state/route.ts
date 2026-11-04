// The current view and selection live in the URL hash, so any view can be linked and back/forward
// move between views: #module=module:tasks&node=contract:task-changed&tab=example, or
// #view=contracts&node=contract:task-changed for the Contracts view.
import { useCallback, useEffect, useState } from 'react';

export type ViewName = 'map' | 'module' | 'node' | 'atlas' | 'contracts';
export type Tab = 'structure' | 'example' | 'guarantees' | 'sources';
const TABS: Tab[] = ['structure', 'example', 'guarantees', 'sources'];

export interface Route {
  view: ViewName;
  /** Module shown in the module view. */
  module?: string;
  /** Node whose neighborhood is shown. */
  focus?: string;
  /** Selection: a node, a relationship, or a module pair ("a|b"). */
  node?: string;
  rel?: string;
  pair?: string;
  tab?: Tab;
}

export function parseHash(hash: string): Route {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const get = (key: string): string | undefined => params.get(key) || undefined;
  const module = get('module');
  const focus = get('focus');
  const named = get('view');
  const view: ViewName = named === 'atlas' || named === 'contracts' ? named : module ? 'module' : focus ? 'node' : 'map';
  const tab = get('tab') as Tab | undefined;
  const pair = get('pair')?.split(',');
  return {
    view,
    module: view === 'module' ? module : undefined,
    focus: view === 'node' ? focus : undefined,
    node: get('node'),
    rel: get('rel'),
    pair: pair?.length === 2 ? pair.join('|') : undefined,
    tab: tab && TABS.includes(tab) ? tab : undefined,
  };
}

/** Readable hash: IDs keep their colons. */
export function formatHash(route: Route): string {
  const parts: [string, string | undefined][] = [
    ['view', route.view === 'atlas' || route.view === 'contracts' ? route.view : undefined],
    ['module', route.view === 'module' ? route.module : undefined],
    ['focus', route.view === 'node' ? route.focus : undefined],
    ['node', route.node],
    ['rel', route.rel],
    ['pair', route.pair?.replace('|', ',')],
    ['tab', route.tab],
  ];
  const text = parts
    .filter((part): part is [string, string] => !!part[1])
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2C/gi, ',')}`)
    .join('&');
  return text ? `#${text}` : '';
}

/** The route from the location, kept in step with back and forward. */
export function useRoute(): [Route, (next: Route, options?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const sync = (): void => setRoute(parseHash(location.hash));
    addEventListener('popstate', sync);
    addEventListener('hashchange', sync);
    return () => {
      removeEventListener('popstate', sync);
      removeEventListener('hashchange', sync);
    };
  }, []);
  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const url = `${location.pathname}${location.search}${formatHash(next)}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) {
      if (options?.replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }
    setRoute(parseHash(formatHash(next)));
  }, []);
  return [route, navigate];
}
