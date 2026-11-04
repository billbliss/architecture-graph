// Layout is deterministic and keeps boxes apart; the module view keeps its columns in order.
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, test } from 'vitest';
import { layoutView, type Layout } from '../src/layout/layout';
import { atlasView, mapView, moduleView, neighborhoodView, type ViewGraph } from '../src/layout/views';
import type { Model } from '../src/model/model';
import { example, exampleNames } from './helpers';

function views(model: Model): ViewGraph[] {
  return [
    mapView(model),
    atlasView(model),
    ...[...model.modules.keys()].map(id => moduleView(model, id)),
    ...model.graph.nodes.slice(0, 5).map(node => neighborhoodView(model, node.id)),
  ];
}

function overlaps(view: ViewGraph, layout: Layout): string[] {
  const boxes = view.nodes.map(node => ({ id: node.id, ...layout.positions[node.id]!, width: node.width, height: node.height }));
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) found.push(`${a.id} / ${b.id}`);
    }
  }
  return found;
}

describe.each(exampleNames)('%s', name => {
  test('every view lays out the same way twice, with every node placed and no boxes overlapping', async () => {
    const model = await example(name);
    for (const view of views(model)) {
      const first = await layoutView(view, new ELK());
      const second = await layoutView(view, new ELK());
      expect(second, `${view.kind} ${view.subject ?? ''}`).toEqual(first);
      expect(Object.keys(first.positions).sort()).toEqual(view.nodes.map(node => node.id).sort());
      expect(overlaps(view, first), `${view.kind} ${view.subject ?? ''}`).toEqual([]);
      for (const edge of view.edges.filter(item => item.routed)) {
        expect(first.routes[edge.id]?.points.length ?? 0, edge.id).toBeGreaterThan(1);
      }
    }
  });

  test('the module view keeps imports, module, contracts and users in columns left to right', async () => {
    const model = await example(name);
    for (const id of model.modules.keys()) {
      const view = moduleView(model, id);
      const layout = await layoutView(view, new ELK());
      const spans = new Map<number, { left: number; right: number }>();
      for (const node of view.nodes) {
        const x = layout.positions[node.id]!.x;
        const span = spans.get(node.partition!) ?? { left: Infinity, right: -Infinity };
        spans.set(node.partition!, { left: Math.min(span.left, x), right: Math.max(span.right, x + node.width) });
      }
      const ordered = [...spans].sort(([a], [b]) => a - b).map(([, span]) => span);
      for (let i = 1; i < ordered.length; i++) expect(ordered[i]!.left, id).toBeGreaterThan(ordered[i - 1]!.right);
    }
  });
});

test('the task-manager map puts modules that use others above the modules they use', async () => {
  const model = await example('task-manager');
  const layout = await layoutView(mapView(model), new ELK());
  const y = (id: string): number => layout.positions[id]!.y;
  expect(y('module:clients')).toBeLessThan(y('module:sync'));
  expect(y('module:sync')).toBeLessThan(y('module:tasks'));
  expect(y('module:search')).toBeLessThan(y('module:tasks'));
});
