// Positions a view. Layered views go through ELK (in a web worker in the browser; directly in tests);
// the Atlas is a plain grid. The same view always gets the same positions: ELK's layered algorithm is
// deterministic for a given input, and inputs are built in graph order.
import type { ELK, ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs/lib/elk-api';
import type { ViewGraph } from './views';

export interface Point { x: number; y: number }

export interface Layout {
  positions: Record<string, Point>;
  /** Routed edges: points from the edge's source to its target. */
  routes: Record<string, { points: Point[] }>;
  /** Atlas group headings and module-view column headings. */
  headings: { id: string; title: string; subtitle?: string; x: number; y: number; width: number }[];
  /** The module's frame in the module view. */
  frame?: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
}

export type LayoutEngine = Pick<ELK, 'layout'>;

const COMMON: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'false',
  'elk.padding': '[top=48,left=24,bottom=24,right=24]',
  // One component, so that partitions (columns) hold for nodes with no edges in the view.
  'elk.separateConnectedComponents': 'false',
};

const OPTIONS: Record<'DOWN' | 'RIGHT', LayoutOptions> = {
  DOWN: {
    ...COMMON,
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '48',
    'elk.layered.spacing.nodeNodeBetweenLayers': '84',
    'elk.spacing.edgeEdge': '16',
    'elk.spacing.edgeLabel': '6',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.layered.edgeLabels.centerLabelPlacementStrategy': 'MEDIAN_LAYER',
  },
  RIGHT: {
    ...COMMON,
    'elk.direction': 'RIGHT',
    'elk.partitioning.activate': 'true',
    'elk.spacing.nodeNode': '14',
    'elk.layered.spacing.nodeNodeBetweenLayers': '64',
    'elk.spacing.edgeEdge': '8',
    'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  },
};

const MODULE_COLUMNS = ['Imports', 'Module', 'Contracts', 'Used by'];
const NEIGHBORHOOD_COLUMNS = ['Points here', 'Selected', 'Points to'];

export async function layoutView(view: ViewGraph, engine: LayoutEngine): Promise<Layout> {
  if (view.direction === 'NONE') return gridLayout(view);
  const partition = new Map(view.nodes.map(node => [node.id, node.partition ?? 0]));
  // ELK wants edges to run with the partitions (left to right); edges that run against them are
  // reversed for layout and their routes reversed back afterward.
  const reversed = new Set<string>();
  const edges: ElkExtendedEdge[] = view.edges.filter(edge => edge.routed).map(edge => {
    const against = (partition.get(edge.source) ?? 0) > (partition.get(edge.target) ?? 0);
    if (against) reversed.add(edge.id);
    return {
      id: edge.id,
      sources: [against ? edge.target : edge.source],
      targets: [against ? edge.source : edge.target],
      // Labels reserve room between layers; the viewer centers them on the route itself.
      labels: edge.label ? [{ id: `${edge.id}:label`, text: ' ', ...edge.label }] : undefined,
    };
  });
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: OPTIONS[view.direction],
    children: view.nodes.map(node => ({
      id: node.id,
      width: node.width,
      height: node.height,
      layoutOptions: view.direction === 'RIGHT' ? { 'elk.partitioning.partition': String(node.partition ?? 0) } : undefined,
    })),
    edges,
  };
  const result = await engine.layout(graph);
  const positions: Layout['positions'] = {};
  for (const child of result.children ?? []) positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  const routes: Layout['routes'] = {};
  for (const edge of (result.edges ?? []) as ElkExtendedEdge[]) {
    const points = (edge.sections ?? []).flatMap((section, index) => [
      ...(index === 0 ? [section.startPoint] : []),
      ...(section.bendPoints ?? []),
      section.endPoint,
    ]).map(point => ({ x: point.x, y: point.y }));
    if (reversed.has(edge.id)) points.reverse();
    routes[edge.id] = { points };
  }
  const layout: Layout = { positions, routes, headings: [], width: result.width ?? 0, height: result.height ?? 0 };
  if (view.kind === 'module' || view.kind === 'neighborhood') addColumns(view, layout);
  return layout;
}

/** Column headings above each partition, and the module frame around the module's own nodes. */
function addColumns(view: ViewGraph, layout: Layout): void {
  const titles = view.kind === 'module' ? MODULE_COLUMNS : NEIGHBORHOOD_COLUMNS;
  const columns = new Map<number, { x0: number; x1: number; y0: number; y1: number }>();
  for (const node of view.nodes) {
    const at = layout.positions[node.id];
    if (!at) continue;
    const key = node.partition ?? 0;
    const box = columns.get(key) ?? { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    box.x0 = Math.min(box.x0, at.x);
    box.x1 = Math.max(box.x1, at.x + node.width);
    box.y0 = Math.min(box.y0, at.y);
    box.y1 = Math.max(box.y1, at.y + node.height);
    columns.set(key, box);
  }
  const top = Math.min(...[...columns.values()].map(box => box.y0));
  for (const [key, box] of [...columns].sort(([a], [b]) => a - b)) {
    if (view.kind === 'module' && key === 1) {
      layout.frame = { x: box.x0 - 16, y: top - 40, width: box.x1 - box.x0 + 32, height: box.y1 - top + 56 };
      continue;
    }
    layout.headings.push({ id: `column:${key}`, title: titles[key] ?? '', x: box.x0, y: top - 34, width: box.x1 - box.x0 });
  }
}

const ATLAS = { column: 224, gap: 8, header: 52, rowGap: 40, margin: 24 };

function gridLayout(view: ViewGraph): Layout {
  const groups = view.groups ?? [];
  const sizes = new Map(view.nodes.map(node => [node.id, node]));
  const perRow = groups.length <= 4 ? Math.max(1, groups.length) : Math.min(6, Math.ceil(Math.sqrt(groups.length * 1.6)));
  const positions: Layout['positions'] = {};
  const headings: Layout['headings'] = [];
  let y = ATLAS.margin;
  let width = 0;
  for (let start = 0; start < groups.length; start += perRow) {
    const row = groups.slice(start, start + perRow);
    let rowHeight = 0;
    row.forEach((group, column) => {
      const x = ATLAS.margin + column * ATLAS.column;
      headings.push({ id: `group:${group.id}`, title: group.title, subtitle: group.subtitle, x, y, width: ATLAS.column - 16 });
      let cy = y + ATLAS.header;
      for (const id of group.nodes) {
        positions[id] = { x, y: cy };
        cy += (sizes.get(id)?.height ?? 30) + ATLAS.gap;
      }
      rowHeight = Math.max(rowHeight, cy - y);
      width = Math.max(width, x + ATLAS.column);
    });
    y += rowHeight + ATLAS.rowGap;
  }
  return { positions, routes: {}, headings, width: width + ATLAS.margin, height: y };
}
