// Payloads are the example sidecars on contracts (and data objects and artifacts). A node sends a
// payload when it is the provider of a record with examples, and receives it when it is a consumer,
// declared or derived. Relationships that do not go through such a record carry no payload: the graph
// does not declare one, and the viewer does not invent one.
import type { GraphNode } from '@billbliss/architecture-graph/core';
import type { Model } from './model';

export interface Example {
  path: string;
  description?: string;
  /** File text, or undefined when the file was not loaded. */
  text?: string;
}

export interface PayloadFlow {
  /** The contract (or data object or artifact) whose examples are the payload. */
  record: GraphNode;
  examples: Example[];
  /** The other end: consumers for a payload sent, providers for one received. */
  peers: GraphNode[];
  /** True when the receiving end is inferred through the provider rather than declared. */
  derived: boolean;
}

export function examplesOf(model: Model, node: GraphNode): Example[] {
  return node.references
    .filter(ref => ref.kind === 'example')
    .map(ref => ({ path: ref.path, description: ref.description, text: model.project.file(ref.path) }));
}

/** Records with example payloads, in graph order. */
export function payloadRecords(model: Model): GraphNode[] {
  return model.graph.nodes.filter(node => node.references.some(ref => ref.kind === 'example'));
}

export function payloadsOf(model: Model, nodeId: string): { sends: PayloadFlow[]; receives: PayloadFlow[] } {
  const sends: PayloadFlow[] = [];
  const receives: PayloadFlow[] = [];
  for (const record of payloadRecords(model)) {
    if (record.id === nodeId) continue;
    const ends = model.contractEnds(record.id);
    const examples = examplesOf(model, record);
    if (ends.providers.some(node => node.id === nodeId)) {
      sends.push({ record, examples, peers: ends.consumers.map(item => item.node), derived: ends.derived });
    }
    if (ends.consumers.some(item => item.node.id === nodeId)) {
      receives.push({ record, examples, peers: ends.providers, derived: ends.derived });
    }
  }
  return { sends, receives };
}

/** Pretty-printed example text; JSON is reformatted, anything else is shown as written. */
export function pretty(path: string, text: string): string {
  if (!path.endsWith('.json')) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** The first lines of an example, with a count of what was left out. */
export function excerpt(example: Example, lines: number): { text: string; omitted: number } {
  if (example.text === undefined) return { text: '', omitted: 0 };
  const all = pretty(example.path, example.text).split('\n');
  return { text: all.slice(0, lines).join('\n'), omitted: Math.max(0, all.length - lines) };
}
