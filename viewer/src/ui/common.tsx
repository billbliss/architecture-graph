// Small pieces shared by panels and the search: kind marks, status badges, links to records.
import type { GraphNode, Reference } from '@billbliss/architecture-graph/core';
import { KINDS } from '../model/kinds';
import { useViewer } from './context';

export function Glyph({ kind }: { kind: GraphNode['kind'] }) {
  return <span className={`glyph kind-${kind}`} aria-hidden="true">{KINDS[kind].glyph}</span>;
}

export function KindBadge({ kind }: { kind: GraphNode['kind'] }) {
  return <span className={`badge kind kind-${kind}`}><Glyph kind={kind} />{KINDS[kind].label}</span>;
}

export function StatusBadge({ status }: { status: GraphNode['status'] }) {
  const tone = status === 'unresolved' ? 'warn' : status === 'implemented' ? 'ok' : '';
  return <span className={`badge ${tone}`}>{status}</span>;
}

/** A node named in a panel; activating it selects the node. */
export function NodeLink({ id }: { id: string }) {
  const { model, actions } = useViewer();
  const node = model.node(id);
  if (!node) return <span className="mono">{id}</span>;
  return (
    <button type="button" className="link" onClick={() => actions.selectNode(id)} aria-label={`${node.name}, ${KINDS[node.kind].label}${node.status === 'unresolved' ? ', unresolved' : ''}`}>
      <Glyph kind={node.kind} />{node.name}
    </button>
  );
}

export function ModuleLink({ id }: { id: string }) {
  const { model, actions } = useViewer();
  const module = model.modules.get(id);
  if (!module) return <span className="mono">{id}</span>;
  return <button type="button" className="link" onClick={() => actions.openModule(id)}>{module.name}</button>;
}

export function RelLink({ id, children }: { id: string; children: React.ReactNode }) {
  const { actions } = useViewer();
  return <button type="button" className="link" onClick={() => actions.selectRel(id)}>{children}</button>;
}

export function References({ references }: { references: Reference[] }) {
  const { model } = useViewer();
  if (!references.length) return <p className="muted">None.</p>;
  return (
    <ul className="list">
      {references.map((ref, index) => {
        const url = model.project.sourceUrl(ref.path);
        return (
          <li key={`${ref.kind}:${ref.path}:${index}`}>
            <span className="k">{ref.kind}</span>
            <span>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mono">{ref.path}</a> : <span className="mono">{ref.path}</span>}
              {ref.description && <span className="note">{ref.description}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const CONFORMANCE_NOTE = 'Structural validation only: it checks the declarations and that referenced files exist and agree with each other. It does not prove the code conforms to the graph.';
