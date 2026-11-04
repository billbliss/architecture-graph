import type { Relationship } from '@billbliss/architecture-graph/core';
import type { ViewGraph } from '../layout/views';
import { KINDS } from '../model/kinds';
import { CONFORMANCE_NOTE, Glyph, KindBadge, ModuleLink, NodeLink, References, RelLink, StatusBadge } from '../ui/common';
import { useViewer } from '../ui/context';
import { contractRecords } from '../model/contracts';
import { PayloadSection } from '../ui/Payload';
import { ContractPanel, hasSidecars } from './ContractPanel';

export function Panel({ view }: { view: ViewGraph }) {
  const { model, route } = useViewer();
  const node = route.node ? model.node(route.node) : undefined;
  if (node) return node.kind === 'contract' || hasSidecars(node) ? <ContractPanel node={node} /> : <NodePanel id={node.id} view={view} />;
  const rel = route.rel ? model.relationships.get(route.rel) : undefined;
  if (rel) return <RelationshipPanel rel={rel} />;
  if (view.kind === 'map' && route.pair) return <PairPanel pair={route.pair} />;
  if (view.kind === 'module' && view.subject) return <ModulePanel id={view.subject} />;
  return <GraphPanel view={view} />;
}

const READING: Record<ViewGraph['kind'], string> = {
  map: 'Modules are layered automatically by dependency direction: modules that use others sit above the modules they use. Each count shows how many relationships cross that boundary in each direction; dashed amber edges point upward or both ways. Select a count to list what crosses; select a module to open it.',
  module: '',
  neighborhood: 'The selected node is in the middle, with what points at it on the left and what it points at on the right.',
  atlas: 'Every node, grouped by module (or by kind when the graph has no modules). Select a node to draw its relationships.',
};

function GraphPanel({ view }: { view: ViewGraph }) {
  const { model } = useViewer();
  const { graph } = model;
  const statuses = (['implemented', 'proposed', 'unresolved'] as const)
    .map(status => [status, graph.nodes.filter(node => node.status === status).length] as const)
    .filter(([, count]) => count);
  const open = model.openQuestions();
  const errors = model.project.diagnostics.length;
  return (
    <div>
      <div className="kicker">
        <span className="badge">graph</span>
        {statuses.map(([status, count]) => <span key={status} className={`badge ${status === 'unresolved' ? 'warn' : status === 'implemented' ? 'ok' : ''}`}>{count} {status}</span>)}
      </div>
      <h2>{graph.title}</h2>
      <div className="id">{graph.id}</div>
      <p>{graph.description}</p>
      <div className="stats">
        <div><b>{graph.nodes.length}</b><span>nodes</span></div>
        <div><b>{graph.relationships.length}</b><span>relationships</span></div>
        <div><b>{model.modules.size}</b><span>modules</span></div>
      </div>
      <div className="section">Open questions ({open.length})</div>
      {open.length ? <ul className="list">{open.map(node => <li key={node.id} className="wide"><NodeLink id={node.id} /></li>)}</ul> : <p className="muted">None recorded.</p>}
      <ContractList />
      {READING[view.kind] && (
        <>
          <div className="section">Reading this view</div>
          <p>{READING[view.kind]}</p>
        </>
      )}
      <div className="section">Validation</div>
      <p>{errors ? `${errors} problems found by the same validation as ag validate.` : 'Passes the same validation as ag validate.'}</p>
      <p className="note-box">{CONFORMANCE_NOTE}</p>
    </div>
  );
}

const CONTRACT_PREVIEW = 8;

/** The graph's contracts, each opening in the Contracts view. */
function ContractList() {
  const { actions, model } = useViewer();
  const records = contractRecords(model);
  if (!records.length) return null;
  const shown = records.slice(0, CONTRACT_PREVIEW);
  return (
    <>
      <div className="section">Contracts ({records.length})</div>
      <ul className="list">
        {shown.map(node => (
          <li key={node.id} className="wide">
            <span>
              <button type="button" className="link" onClick={() => actions.showContract(node.id)}>
                <Glyph kind={node.kind} />{node.name}
              </button>
              {node.references.some(ref => ref.kind === 'example') && <span className="payload-mark inline" title="Has an example payload">{'{ }'}</span>}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="action" onClick={() => actions.showContract()}>
        {records.length > shown.length ? `See all ${records.length} contracts` : 'Open the Contracts view'}
      </button>
    </>
  );
}

function ModulePanel({ id }: { id: string }) {
  const { model } = useViewer();
  const module = model.modules.get(id);
  if (!module) return null;
  const stats = model.moduleStats(id);
  const open = model.nodesIn(id).filter(node => node.status === 'unresolved');
  const kindOf = (nodeId: string): string => { const node = model.node(nodeId); return node ? KINDS[node.kind].label : ''; };
  return (
    <div>
      <div className="kicker"><span className="badge">module</span>{stats.open > 0 && <span className="badge warn">{stats.open} open</span>}</div>
      <h2>{module.name}</h2>
      <div className="id">{module.id}</div>
      <p>{module.description}</p>
      <div className="section">Exports ({module.exports.length})</div>
      <ul className="list">{module.exports.map(item => <li key={item}><span className="k">{kindOf(item)}</span><NodeLink id={item} /></li>)}</ul>
      <div className="section">Imports ({module.imports.length})</div>
      <ul className="list">{module.imports.map(item => <li key={item}><span className="k">{kindOf(item)}</span><NodeLink id={item} /></li>)}</ul>
      {open.length > 0 && (
        <>
          <div className="section">Open questions ({open.length})</div>
          <ul className="list">{open.map(node => <li key={node.id} className="wide"><NodeLink id={node.id} /></li>)}</ul>
        </>
      )}
      <p className="note-box">Selecting a node draws only its relationships. Contracts used outside the module are drawn as amber edges from provider to consumers.</p>
    </div>
  );
}

function CrossingList({ rels }: { rels: Relationship[] }) {
  if (!rels.length) return <p className="muted">Nothing.</p>;
  return (
    <ul className="list">
      {rels.map(rel => (
        <li key={rel.id}>
          <span className="k"><RelLink id={rel.id}>{rel.kind}</RelLink></span>
          <span><NodeLink id={rel.from} /> → <NodeLink id={rel.to} />{rel.status === 'unresolved' && <> <span className="badge warn">open</span></>}</span>
        </li>
      ))}
    </ul>
  );
}

function PairPanel({ pair }: { pair: string }) {
  const { model } = useViewer();
  const [a, b] = pair.split('|') as [string, string];
  const ab = model.crossing(a, b);
  const ba = model.crossing(b, a);
  const name = (id: string): string => model.modules.get(id)?.name ?? id;
  return (
    <div>
      <div className="kicker"><span className="badge">module boundary</span>{ab.length > 0 && ba.length > 0 && <span className="badge warn">two-way dependency</span>}</div>
      <h2><ModuleLink id={a} /> ⇄ <ModuleLink id={b} /></h2>
      <div className="section">{name(a)} → {name(b)} ({ab.length})</div>
      <CrossingList rels={ab} />
      <div className="section">{name(b)} → {name(a)} ({ba.length})</div>
      <CrossingList rels={ba} />
      <p className="note-box">Every relationship that crosses this boundary. AG requires each one to be declared in the modules' imports and exports.</p>
    </div>
  );
}

export function RelationshipList({ id }: { id: string }) {
  const { model } = useViewer();
  const out = model.outgoing.get(id) ?? [];
  const into = model.incoming.get(id) ?? [];
  return (
    <>
      {out.length > 0 && (
        <>
          <div className="section">Outgoing ({out.length})</div>
          <ul className="list">
            {out.map(rel => (
              <li key={rel.id}><span className="k"><RelLink id={rel.id}>{rel.kind} →</RelLink></span><span><NodeLink id={rel.to} />{rel.status === 'unresolved' && <> <span className="badge warn">open</span></>}</span></li>
            ))}
          </ul>
        </>
      )}
      {into.length > 0 && (
        <>
          <div className="section">Incoming ({into.length})</div>
          <ul className="list">
            {into.map(rel => (
              <li key={rel.id}><span className="k"><RelLink id={rel.id}>← {rel.kind}</RelLink></span><span><NodeLink id={rel.from} />{rel.status === 'unresolved' && <> <span className="badge warn">open</span></>}</span></li>
            ))}
          </ul>
        </>
      )}
      {!out.length && !into.length && <p className="muted">No relationships.</p>}
    </>
  );
}

export function NodeHeader({ id }: { id: string }) {
  const { model } = useViewer();
  const node = model.node(id)!;
  return (
    <>
      <div className="kicker">
        <KindBadge kind={node.kind} />
        <StatusBadge status={node.status} />
        {node.module && model.modules.has(node.module) && <span className="badge"><ModuleLink id={node.module} /></span>}
        {node.classification && <span className="badge">{node.classification.replace(/_/g, ' ')}</span>}
      </div>
      <h2>{node.name}</h2>
      <div className="id">{node.id}</div>
    </>
  );
}

function NodePanel({ id, view }: { id: string; view: ViewGraph }) {
  const { model, actions } = useViewer();
  const node = model.node(id)!;
  const centered = view.kind === 'neighborhood' && view.subject === id;
  return (
    <div>
      <NodeHeader id={id} />
      <p>{node.description}</p>
      <PayloadSection id={id} />
      <RelationshipList id={id} />
      <div className="section">References</div>
      <References references={node.references} />
      {!centered && <button type="button" className="action" onClick={() => actions.openNeighborhood(id)}>Show neighborhood</button>}
    </div>
  );
}

function RelationshipPanel({ rel }: { rel: Relationship }) {
  return (
    <div>
      <div className="kicker"><span className="badge">relationship</span><span className="badge mono">{rel.kind}</span><StatusBadge status={rel.status} /></div>
      <h2><NodeLink id={rel.from} /> <span className="muted">{rel.kind.replace(/_/g, ' ')}</span> <NodeLink id={rel.to} /></h2>
      <div className="id">{rel.id}</div>
      <p>{rel.description}</p>
      <div className="section">References</div>
      <References references={rel.references} />
    </div>
  );
}
