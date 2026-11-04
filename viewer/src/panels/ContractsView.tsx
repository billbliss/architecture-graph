// The Contracts view: every contract in one list, and the selected one as a readable page with its
// structure and example payload side by side. It answers "what crosses between parts of the system?"
// without reading the graph first.
import type { GraphNode } from '@billbliss/architecture-graph/core';
import { contractGroups, contractRecords, openDecisionCount } from '../model/contracts';
import { KINDS } from '../model/kinds';
import { CONFORMANCE_NOTE, Glyph, References, StatusBadge } from '../ui/common';
import { useViewer } from '../ui/context';
import { ContractSummary, Examples, Guarantees, Structure } from './ContractPanel';
import { NodeHeader, RelationshipList } from './Panels';

export const CONTRACTS_INTRO = 'What crosses between parts of the system: APIs, events, messages and file formats, with their structure, example payloads and guarantees.';

function Row({ node, selected }: { node: GraphNode; selected: boolean }) {
  const { model, actions } = useViewer();
  const ends = model.contractEnds(node.id);
  const open = openDecisionCount(model, node.id);
  const payload = node.references.some(ref => ref.kind === 'example');
  const consumers = ends.consumers.length;
  const provider = ends.providers.map(item => item.name).join(', ') || 'No provider';
  return (
    <li>
      <button
        type="button"
        className={`contract-row ${node.status}${selected ? ' selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => actions.showContract(node.id)}
      >
        <span className="row-name">
          <Glyph kind={node.kind} />
          <span>{node.name}</span>
          {payload && <span className="payload-mark" title="Has an example payload">{'{ }'}<span className="visually-hidden">, has an example payload</span></span>}
        </span>
        <span className="row-ends">{provider} → {consumers} consumer{consumers === 1 ? '' : 's'}{ends.derived ? ' (derived)' : ''}</span>
        <span className="row-badges">
          {node.kind !== 'contract' && <span className="badge">{KINDS[node.kind].label}</span>}
          {node.status !== 'proposed' && <StatusBadge status={node.status} />}
          {open > 0 && <span className="badge warn">{open} open</span>}
        </span>
      </button>
    </li>
  );
}

function Detail({ node }: { node: GraphNode }) {
  const { model, actions } = useViewer();
  const affects = (model.incoming.get(node.id) ?? []).filter(rel => rel.kind === 'affects');
  return (
    <article className="contract-detail" aria-label={`${node.name} contract`}>
      <NodeHeader id={node.id} />
      <ContractSummary node={node} />
      <p>{node.description}</p>
      <button type="button" className="action" onClick={() => actions.showInGraph(node.id)}>Show in the graph</button>
      <div className="side-by-side">
        <section aria-label="Structure">
          <h3>Structure</h3>
          <Structure node={node} />
        </section>
        <section aria-label="Example payload">
          <h3>Example payload</h3>
          <Examples node={node} />
        </section>
      </div>
      <section aria-label="Guarantees">
        <h3>Guarantees</h3>
        <Guarantees node={node} affects={affects} describe={false} />
      </section>
      <section aria-label="Sources">
        <h3>Sources</h3>
        <References references={node.references} />
        <RelationshipList id={node.id} />
      </section>
    </article>
  );
}

export function ContractsView() {
  const { model, route } = useViewer();
  const groups = contractGroups(model);
  const all = contractRecords(model);
  const selected = all.find(node => node.id === route.node) ?? all[0];
  return (
    <div className="contracts">
      <nav className="contract-list" aria-label="Contracts">
        <h2>Contracts <span className="muted">({all.length})</span></h2>
        <p className="muted intro">{CONTRACTS_INTRO}</p>
        {groups.map(group => (
          <div key={group.id || 'none'} className="contract-group">
            <div className="section">{group.title}</div>
            <ul>{group.records.map(node => <Row key={node.id} node={node} selected={node.id === selected?.id} />)}</ul>
          </div>
        ))}
        {!all.length && <p className="muted">This graph declares no contracts.</p>}
        <p className="note-box">{CONFORMANCE_NOTE}</p>
      </nav>
      <div className="contract-page">
        {selected ? <Detail node={selected} /> : <p className="muted">Nothing to show: this graph declares no contracts.</p>}
      </div>
    </div>
  );
}
