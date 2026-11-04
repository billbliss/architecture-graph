// The bundled examples. Each bundle records the files the load path read when the viewer was built
// (scripts/bundle-examples.mjs), and is opened through the same load path as any other project.
import type { FileKind, FileSource } from '@billbliss/architecture-graph/core';
import catalog from '../generated/examples/index.json';
import type { Project } from '../model/model';
import { loadFromSource, type LoadFailure } from './project';

export interface ExampleInfo { name: string; title: string; summary: string }

export interface ExampleBundle extends ExampleInfo {
  config: string;
  files: Record<string, string>;
  kinds: Record<string, FileKind>;
  /** Link prefix for project files, ending in a slash. */
  sourceBase: string;
}

export const EXAMPLES: ExampleInfo[] = catalog;

const bundles = import.meta.glob<ExampleBundle>(['../generated/examples/*.json', '!../generated/examples/index.json'], { import: 'default' });

export function bundleSource(bundle: ExampleBundle): FileSource {
  return {
    kind: path => (path in bundle.files ? 'file' : bundle.kinds[path] ?? 'missing'),
    read: path => {
      const text = bundle.files[path];
      if (text === undefined) throw new Error('file not found');
      return text;
    },
  };
}

export async function openBundle(bundle: ExampleBundle): Promise<Project | LoadFailure> {
  const loaded = await loadFromSource(bundleSource(bundle), bundle.config);
  if (loaded.problem !== undefined) return loaded;
  return {
    graph: loaded.graph,
    graphPath: loaded.graphPath,
    diagnostics: loaded.diagnostics,
    file: path => bundle.files[path],
    sourceUrl: path => bundle.sourceBase + path.split('/').map(encodeURIComponent).join('/'),
  };
}

export async function loadExample(name: string): Promise<Project | LoadFailure | undefined> {
  const load = bundles[`../generated/examples/${name}.json`];
  if (!load || !EXAMPLES.some(example => example.name === name)) return undefined;
  return openBundle(await load());
}
