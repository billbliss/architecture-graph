// Turns a laid-out view and the current selection into React Flow nodes and edges. Selection changes
// only classes and visibility here; positions come from the layout and never move.
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Layout, Point } from '../layout/layout';
import { pillId, type ViewGraph, type ViewNode } from '../layout/views';
import { KINDS } from '../model/kinds';
import type { Model } from '../model/model';
import type { Route } from '../state/route';
import type { RouteEdgeData } from './edges';

export interface Flow {
  nodes: Node[];
  edges: Edge<RouteEdgeData>[];
  /** Text alternative for the canvas: the selection and its relationships. */
  summary: string;
}

type Rect = { x: number; y: number; width: number; height: number };
type Side = 't' | 'r' | 'b' | 'l';

const arrow = (color: string) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color });

/** Sides to join two boxes that have no routed edge between them. */
function sides(a: Rect, b: Rect, vertical: boolean): [Side, Side] {
  if (vertical) {
    if (a.y + a.height <= b.y) return ['b', 't'];
    if (b.y + b.height <= a.y) return ['t', 'b'];
  }
  if (a.x === b.x) return ['r', 'r'];
  return a.x < b.x ? ['r', 'l'] : ['l', 'r'];
}

/** The point halfway along a polyline, where a count label sits on its edge. */
export function halfway(points: Point[]): Point {
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!;
    if (remaining <= length && length > 0) {
      const a = points[index]!;
      const b = points[index + 1]!;
      return { x: a.x + ((b.x - a.x) * remaining) / length, y: a.y + ((b.y - a.y) * remaining) / length };
    }
    remaining -= length;
  }
  return points[points.length - 1]!;
}

const NODE_TYPE: Record<ViewNode['type'], string> = { module: 'module', node: 'box', contract: 'pill' };

export function buildFlow(model: Model, view: ViewGraph, layout: Layout, route: Route): Flow {
  const rects = new Map<string, Rect>();
  for (const item of view.nodes) {
    const at = layout.positions[item.id];
    if (at) rects.set(item.id, { ...at, width: item.width, height: item.height });
  }
  const selected = route.node && model.node(route.node) ? route.node : undefined;
  const rel = route.rel ? model.relationships.get(route.rel) : undefined;
  const pill = selected && rects.has(pillId(selected)) ? selected : undefined;
  const pair = view.kind === 'map' ? route.pair : undefined;

  let related: Set<string> | undefined;
  if (pill) related = new Set([pillId(pill), ...view.edges.filter(edge => edge.contract === pill).flatMap(edge => [edge.source, edge.target])]);
  else if (selected) {
    related = new Set([selected, ...model.relationsOf(selected).flatMap(item => [item.from, item.to])]);
    for (const edge of view.edges) if (edge.type === 'contract' && (edge.source === selected || edge.target === selected)) related.add(pillId(edge.contract!));
  } else if (rel) related = new Set([rel.from, rel.to]);

  const nodes: Node[] = [];
  if (layout.frame && view.subject) {
    const module = model.modules.get(view.subject);
    nodes.push({
      id: 'frame', type: 'frame', position: { x: layout.frame.x, y: layout.frame.y }, data: { title: module?.name ?? '' },
      width: layout.frame.width, height: layout.frame.height, zIndex: -1, selectable: false, focusable: false, draggable: false,
    });
  }
  for (const heading of layout.headings) {
    nodes.push({
      id: heading.id, type: 'heading', position: { x: heading.x, y: heading.y },
      data: { title: heading.title, subtitle: heading.subtitle, group: view.kind === 'atlas' },
      width: heading.width, height: view.kind === 'atlas' ? 40 : 18, selectable: false, focusable: false, draggable: false,
    });
  }
  const pairModules = pair ? new Set(pair.split('|')) : undefined;
  for (const item of view.nodes) {
    const rect = rects.get(item.id);
    if (!rect) continue;
    const isSelected = pairModules ? pairModules.has(item.ref) : item.type === 'contract' ? pill === item.ref : selected === item.ref || false;
    const data = item.type === 'module' ? { module: item.ref, selected: isSelected }
      : item.type === 'contract' ? { contract: item.ref, selected: isSelected, dim: related ? !related.has(item.id) : false }
      : { node: item.ref, role: item.role, selected: isSelected, dim: related ? !related.has(item.id) : false };
    nodes.push({
      id: item.id, type: NODE_TYPE[item.type], position: { x: rect.x, y: rect.y }, data,
      width: item.width, height: item.height, selectable: false, focusable: false, draggable: false,
      // React Flow turns pointer events off for nodes that are neither selectable nor draggable;
      // these boxes are buttons that handle their own clicks.
      style: { pointerEvents: 'all' },
      ariaRole: 'group',
    });
  }

  const edges: Edge<RouteEdgeData>[] = [];
  const vertical = view.direction === 'DOWN';
  const handles = (source: string, target: string): { sourceHandle: string; targetHandle: string } => {
    const a = rects.get(source);
    const b = rects.get(target);
    const [from, to] = a && b ? sides(a, b, vertical) : (['r', 'l'] as const);
    return { sourceHandle: `s-${from}`, targetHandle: `t-${to}` };
  };

  if (view.kind === 'map') {
    for (const edge of view.edges) {
      const [a, b] = edge.pair!.split('|') as [string, string];
      const ra = rects.get(a);
      const rb = rects.get(b);
      if (!ra || !rb) continue;
      // Upper module first; for modules side by side, the left one.
      const aFirst = ra.y + ra.height / 2 < rb.y + rb.height / 2 || (ra.y === rb.y && ra.x <= rb.x);
      const [upper, lower] = aFirst ? [a, b] : [b, a];
      const down = model.crossing(upper, lower).length;
      const up = model.crossing(lower, upper).length;
      const level = ra.y === rb.y;
      const text = level ? [down && `→${down}`, up && `←${up}`].filter(Boolean).join(' ') : [down && `↓${down}`, up && `↑${up}`].filter(Boolean).join(' ');
      const back = up > 0;
      const route = layout.routes[edge.id];
      const labelSize = edge.label ?? { width: 40, height: 22 };
      const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      const mid = { x: (center(ra).x + center(rb).x) / 2 - labelSize.width / 2, y: (center(ra).y + center(rb).y) / 2 - labelSize.height / 2 };
      const along = route?.points && route.points.length > 1 ? halfway(route.points) : undefined;
      const labelAt = along ? { x: along.x - labelSize.width / 2, y: along.y - labelSize.height / 2 } : mid;
      const nameOf = (id: string): string => model.modules.get(id)?.name ?? id;
      const isSelected = pair === edge.pair;
      edges.push({
        id: edge.id, type: 'route', source: edge.source, target: edge.target, ...handles(edge.source, edge.target),
        data: {
          points: route?.points,
          classes: ['pair', back ? 'back' : '', isSelected ? 'selected' : ''].join(' '),
          label: {
            x: labelAt.x, y: labelAt.y, text, pair: edge.pair!, back, selected: isSelected,
            name: `${nameOf(upper)} and ${nameOf(lower)}: ${down} relationships from ${nameOf(upper)} to ${nameOf(lower)}, ${up} from ${nameOf(lower)} to ${nameOf(upper)}${back ? '; dependency points up' : ''}`,
          },
        },
      });
    }
  } else if (view.kind === 'atlas') {
    const shown = selected ? model.relationsOf(selected) : rel ? [rel] : [];
    for (const item of shown) {
      if (!rects.has(item.from) || !rects.has(item.to) || item.from === item.to) continue;
      edges.push({
        id: item.id, type: 'route', source: item.from, target: item.to, ...handles(item.from, item.to),
        markerEnd: arrow('var(--link)'),
        data: { classes: `hi${item.status === 'unresolved' ? ' unresolved' : ''}` },
      });
    }
  } else {
    for (const edge of view.edges) {
      const route = layout.routes[edge.id];
      const touches = selected !== undefined && (edge.source === selected || edge.target === selected);
      let state: 'normal' | 'hi' | 'dim' | 'hidden' = 'normal';
      if (edge.type === 'contract') {
        if (pill) state = edge.contract === pill ? 'hi' : 'dim';
        else if (selected) state = touches ? 'hi' : 'dim';
        else if (rel) state = 'dim';
      } else {
        if (pill) state = 'hidden';
        else if (selected) state = touches ? 'hi' : 'hidden';
        else if (rel) state = edge.rel === rel.id ? 'hi' : 'dim';
      }
      const relationship = edge.rel ? model.relationships.get(edge.rel) : undefined;
      const classes = [
        edge.type === 'contract' ? 'contract' : '',
        state === 'hi' ? 'hi' : '',
        relationship?.status === 'unresolved' ? 'unresolved' : '',
      ];
      edges.push({
        id: edge.id, type: 'route', source: edge.source, target: edge.target, ...handles(edge.source, edge.target),
        hidden: state === 'hidden',
        className: state === 'dim' ? 'edge-dim' : undefined,
        markerEnd: edge.type === 'relation' ? arrow(state === 'hi' ? 'var(--link)' : 'var(--text-muted)') : undefined,
        data: { points: route?.points, classes: classes.filter(Boolean).join(' ') },
      });
    }
  }

  return { nodes, edges, summary: summarize(model, view, route) };
}

function summarize(model: Model, view: ViewGraph, route: Route): string {
  const name = (id: string): string => model.node(id)?.name ?? id;
  if (route.node && model.node(route.node)) {
    const node = model.node(route.node)!;
    const rels = model.relationsOf(node.id).map(rel => rel.from === node.id ? `${rel.kind} ${name(rel.to)}` : `${name(rel.from)} ${rel.kind} this`);
    return `Selected ${KINDS[node.kind].label} ${node.name}, ${node.status}. ${rels.length} relationships${rels.length ? `: ${rels.join('; ')}` : ''}.`;
  }
  if (route.rel) {
    const rel = model.relationships.get(route.rel);
    if (rel) return `Selected relationship: ${name(rel.from)} ${rel.kind} ${name(rel.to)}.`;
  }
  if (view.kind === 'map' && route.pair) {
    const [a, b] = route.pair.split('|') as [string, string];
    return `Selected the boundary between ${model.modules.get(a)?.name} and ${model.modules.get(b)?.name}: ${model.crossing(a, b).length + model.crossing(b, a).length} crossing relationships.`;
  }
  const count = view.nodes.length;
  if (view.kind === 'map') return `Module map with ${count} modules. Nothing is selected.`;
  if (view.kind === 'atlas') return `Atlas of ${count} nodes. Nothing is selected.`;
  if (view.kind === 'module') return `Module ${model.modules.get(view.subject!)?.name}: ${count} nodes and contracts shown. Nothing is selected.`;
  return `Neighborhood of ${name(view.subject!)}: ${count - 1} related nodes.`;
}
