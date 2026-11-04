import { createContext, useContext } from 'react';
import type { Model } from '../model/model';
import type { Route, Tab } from '../state/route';

export interface Actions {
  /** Select a node, moving to a view that shows it when the current one does not. */
  selectNode(id: string): void;
  selectRel(id: string): void;
  selectPair(key: string): void;
  openModule(id: string): void;
  openNeighborhood(id: string): void;
  showMap(): void;
  showAtlas(): void;
  setTab(tab: Tab): void;
  clearSelection(): void;
}

export interface ViewerContextValue {
  model: Model;
  route: Route;
  actions: Actions;
}

export const ViewerContext = createContext<ViewerContextValue | null>(null);

export function useViewer(): ViewerContextValue {
  const value = useContext(ViewerContext);
  if (!value) throw new Error('useViewer outside the viewer');
  return value;
}
