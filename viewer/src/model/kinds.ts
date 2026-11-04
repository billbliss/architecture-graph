// Node kinds as the viewer shows them: a role group (which sets the color) and a glyph that tells
// kinds apart within a group. The groups match the concepts page and palette.css.
import type { NodeKind } from '@billbliss/architecture-graph/core';

export type KindGroup = 'actor' | 'behavior' | 'responsibility' | 'crossing' | 'rule' | 'design';

export interface KindInfo {
  group: KindGroup;
  glyph: string;
  label: string;
}

export const KINDS: Record<NodeKind, KindInfo> = {
  actor: { group: 'actor', glyph: '◉', label: 'actor' },
  surface: { group: 'behavior', glyph: '▭', label: 'surface' },
  component: { group: 'behavior', glyph: '▣', label: 'component' },
  adapter: { group: 'behavior', glyph: '⇌', label: 'adapter' },
  transform: { group: 'behavior', glyph: '⇄', label: 'transform' },
  capability: { group: 'responsibility', glyph: '●', label: 'capability' },
  workflow: { group: 'responsibility', glyph: '↻', label: 'workflow' },
  contract: { group: 'crossing', glyph: '◆', label: 'contract' },
  artifact: { group: 'crossing', glyph: '▤', label: 'artifact' },
  data_object: { group: 'crossing', glyph: '◫', label: 'data object' },
  boundary: { group: 'rule', glyph: '⬡', label: 'boundary' },
  policy: { group: 'rule', glyph: '§', label: 'policy' },
  constraint: { group: 'rule', glyph: '⊘', label: 'constraint' },
  decision: { group: 'design', glyph: '◇', label: 'decision' },
  evidence_surface: { group: 'design', glyph: '◎', label: 'evidence surface' },
};

/** Reading order: who takes part, where behavior lives, what it does, what crosses, the rules, the design record. */
export const KIND_ORDER: NodeKind[] = [
  'actor', 'surface', 'component', 'adapter', 'transform', 'capability', 'workflow',
  'contract', 'artifact', 'data_object', 'boundary', 'policy', 'constraint', 'decision', 'evidence_surface',
];

export const GROUP_TITLES: Record<KindGroup, string> = {
  actor: 'Who takes part',
  behavior: 'Where behavior lives',
  responsibility: 'What the system does',
  crossing: 'What crosses boundaries',
  rule: 'The rules',
  design: 'Design record',
};

export const GROUP_ORDER: KindGroup[] = ['actor', 'behavior', 'responsibility', 'crossing', 'rule', 'design'];

export const kindIndex = (kind: NodeKind): number => KIND_ORDER.indexOf(kind);
export const kindColor = (kind: NodeKind): string => `var(--kind-${KINDS[kind].group})`;
