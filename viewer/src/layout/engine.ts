// ELK in a web worker, so laying out a large graph never blocks the page. Layouts are cached per view.
import ELK from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { useEffect, useState } from 'react';
import { layoutView, type Layout } from './layout';
import type { ViewGraph } from './views';

let engine: InstanceType<typeof ELK> | undefined;
const cache = new WeakMap<ViewGraph, Promise<Layout>>();

function elk(): InstanceType<typeof ELK> {
  engine ??= new ELK({ workerFactory: () => new Worker(elkWorkerUrl) });
  return engine;
}

export function layoutOf(view: ViewGraph): Promise<Layout> {
  let pending = cache.get(view);
  if (!pending) {
    pending = layoutView(view, elk());
    cache.set(view, pending);
  }
  return pending;
}

export type LayoutState = { view: ViewGraph; layout: Layout } | { view: ViewGraph; error: string } | undefined;

/** The layout of a view once the worker has computed it; the previous result until then. */
export function useLayout(view: ViewGraph): LayoutState {
  const [state, setState] = useState<LayoutState>();
  useEffect(() => {
    let current = true;
    layoutOf(view).then(
      layout => { if (current) setState({ view, layout }); },
      (error: unknown) => { if (current) setState({ view, error: error instanceof Error ? error.message : String(error) }); },
    );
    return () => { current = false; };
  }, [view]);
  return state;
}
