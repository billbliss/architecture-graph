// Bundled examples open through the viewer's load path with the same results as the toolkit.
import { loadProject } from '@billbliss/architecture-graph';
import { memoryFileSource } from '@billbliss/architecture-graph/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadFromSource, projectPath } from '../src/load/project';
import { example, exampleNames } from './helpers';

const repo = resolve(import.meta.dirname, '../..');
const catalog: { name: string; config: string }[] = JSON.parse(readFileSync(resolve(repo, 'examples/catalog.json'), 'utf8'));

describe.each(exampleNames)('%s', name => {
  test('opens with no diagnostics and the counts the toolkit loads', async () => {
    const model = await example(name);
    const entry = catalog.find(item => item.name === name)!;
    const expected = loadProject(resolve(repo, entry.config), { forceCanonical: true }).graph;
    expect(model.project.diagnostics).toEqual([]);
    expect(model.graph.nodes.length).toBe(expected.nodes.length);
    expect(model.graph.relationships.length).toBe(expected.relationships.length);
    expect(model.modules.size).toBe(expected.modules?.length ?? 0);
  });
});

test('every catalog entry is bundled', () => {
  expect(exampleNames).toEqual(catalog.map(item => item.name));
});

describe('loading through a file source', () => {
  const config = JSON.stringify({ configVersion: '1', graph: 'architecture/graph.yaml', generated: 'architecture/generated' });
  const graph = (references: string) => `schemaVersion: "1"
id: graph:tiny
title: Tiny
description: A two-node graph.
nodes:
  - id: component:a
    kind: component
    name: A
    description: Does a thing.
    status: proposed
    references: ${references}
  - id: capability:b
    kind: capability
    name: B
    description: The thing.
    status: proposed
    references: []
relationships:
  - id: rel:a-provides-b
    kind: provides
    from: component:a
    to: capability:b
    description: A provides B.
    status: proposed
    references: []
`;

  test('reports the toolkit diagnostics for a missing reference', async () => {
    const source = memoryFileSource({ 'ag.config.json': config, 'architecture/graph.yaml': graph('[{ kind: design, path: missing.md }]') });
    const loaded = await loadFromSource(source, 'ag.config.json');
    expect(loaded.problem).toBeUndefined();
    expect(loaded.diagnostics.map(item => item.at)).toContain('component:a');
  });

  test('explains a graph whose shape cannot be read', async () => {
    const source = memoryFileSource({ 'ag.config.json': config, 'architecture/graph.yaml': 'schemaVersion: "1"\nnodes: 3\n' });
    const loaded = await loadFromSource(source, 'ag.config.json');
    expect(loaded.problem).toMatch(/shape/);
    expect(loaded.diagnostics.length).toBeGreaterThan(0);
  });

  test('explains a missing configuration', async () => {
    const loaded = await loadFromSource(memoryFileSource({}), 'ag.config.json');
    expect(loaded.problem).toMatch(/configuration/);
  });

  test('normalizes project paths and rejects ones that leave the project', () => {
    expect(projectPath('a/./b/../c.json')).toBe('a/c.json');
    expect(projectPath('../outside.json')).toBeNull();
  });
});
