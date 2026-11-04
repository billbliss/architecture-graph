// The contract panel: provider and consumers, then the contract's structure (from its schema
// sidecar), example payloads, guarantees and sources. Data objects and artifacts with sidecars use it too.
import type { GraphNode, Relationship } from '@billbliss/architecture-graph/core';
import { useId } from 'react';
import { pretty } from '../model/payloads';
import { schemaTree, type SchemaField } from '../model/schema-tree';
import type { Tab } from '../state/route';
import { NodeLink, References } from '../ui/common';
import { useViewer } from '../ui/context';
import { NodeHeader, RelationshipList } from './Panels';

export const hasSidecars = (node: GraphNode): boolean => node.references.some(ref => ref.kind === 'schema' || ref.kind === 'example');

const TABS: { id: Tab; label: string }[] = [
  { id: 'structure', label: 'Structure' },
  { id: 'example', label: 'Example' },
  { id: 'guarantees', label: 'Guarantees' },
  { id: 'sources', label: 'Sources' },
];

export function ContractPanel({ node }: { node: GraphNode }) {
  const { model, route, actions } = useViewer();
  const tab = route.tab ?? 'structure';
  const base = useId();
  const ends = model.contractEnds(node.id);
  const affects = (model.incoming.get(node.id) ?? []).filter(rel => rel.kind === 'affects');
  const openDecisions = affects.filter(rel => rel.status === 'unresolved' || model.node(rel.from)?.status === 'unresolved').length;
  const vias = [...new Map(ends.consumers.filter(item => item.via).map(item => [item.via!.id, item.via!])).values()];
  return (
    <div>
      <NodeHeader id={node.id} />
      {openDecisions > 0 && <div className="kicker"><span className="badge warn">{openDecisions} open decision{openDecisions > 1 ? 's' : ''} affect{openDecisions > 1 ? '' : 's'} it</span></div>}
      <div className="ends">
        <div className="side">
          <span className="id">provider</span>
          {ends.providers.length ? ends.providers.map(item => <span key={item.id} className="chip"><NodeLink id={item.id} /></span>) : <span className="muted">none declared</span>}
        </div>
        <div className="arrow" aria-hidden="true">⟶</div>
        <div className="side">
          <span className="id">consumers ({ends.consumers.length})</span>
          {ends.consumers.length ? ends.consumers.map(item => <span key={item.node.id} className="chip"><NodeLink id={item.node.id} /></span>) : <span className="muted">none found</span>}
        </div>
      </div>
      {ends.consumers.length > 0 && (ends.derived
        ? <p className="kicker"><span className="badge derived">derived</span><span className="muted">Consumers come from dependencies on {vias.map((via, index) => <span key={via.id}>{index > 0 && ', '}<NodeLink id={via.id} /></span>)}, not from a declared use of this contract.</span></p>
        : <p className="kicker"><span className="badge ok">declared</span><span className="muted">Each consumer has a <code>consumes</code> or <code>depends_on</code> relationship to this contract.</span></p>)}
      <p>{node.description}</p>
      <div className="tabs" role="tablist" aria-label="Contract details">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${base}-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${base}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => actions.setTab(item.id)}
            onKeyDown={event => {
              const index = TABS.findIndex(entry => entry.id === tab);
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = TABS[(index + step + TABS.length) % TABS.length]!;
              actions.setTab(next.id);
              document.getElementById(`${base}-${next.id}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`}>
        {tab === 'structure' && <Structure node={node} />}
        {tab === 'example' && <Examples node={node} />}
        {tab === 'guarantees' && <Guarantees node={node} affects={affects} />}
        {tab === 'sources' && (
          <>
            <div className="section">References</div>
            <References references={node.references} />
            <RelationshipList id={node.id} />
          </>
        )}
      </div>
    </div>
  );
}

function SourceLine({ path, what }: { path: string; what: string }) {
  const { model } = useViewer();
  const url = model.project.sourceUrl(path);
  return <div className="src">{what} {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mono">{path}</a> : <span className="mono">{path}</span>}</div>;
}

function Fields({ fields }: { fields: SchemaField[] }) {
  return (
    <ul>
      {fields.map(field => {
        const line = (
          <>
            <span>{field.name}</span>{!field.required && <span className="t">?</span>} <span className="t">{field.type}</span>
            {field.description && <> <span className="c">{field.description}</span></>}
          </>
        );
        if (!field.children?.length) return <li key={field.name}>{line}</li>;
        // Inline objects are open; referenced schemas start closed so a large schema stays readable.
        return (
          <li key={field.name}>
            <details open={!field.ref}>
              <summary>{line}</summary>
              <Fields fields={field.children} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function Structure({ node }: { node: GraphNode }) {
  const { model } = useViewer();
  const schemas = node.references.filter(ref => ref.kind === 'schema');
  if (!schemas.length) {
    return <div className="gap">No schema sidecar is declared for this {node.kind.replace('_', ' ')}. A <code>schema</code> reference to a JSON Schema file would show its structure here.</div>;
  }
  return (
    <>
      {schemas.map(ref => {
        const tree = schemaTree(path => model.project.file(path), ref.path);
        if (tree.problem) return <div key={ref.path} className="gap">{tree.problem}</div>;
        return (
          <div key={ref.path} data-testid="structure">
            {tree.description && <p>{tree.description}</p>}
            <div className="tree">
              <div><span>{tree.title ?? ref.path}</span> <span className="t">{tree.type}</span> <span className="c">? marks an optional field</span></div>
              {tree.fields.length > 0 && <Fields fields={tree.fields} />}
            </div>
            <SourceLine path={ref.path} what="Read from" />
          </div>
        );
      })}
    </>
  );
}

function Examples({ node }: { node: GraphNode }) {
  const { model } = useViewer();
  const examples = node.references.filter(ref => ref.kind === 'example');
  if (!examples.length) return <div className="gap">No example payload is declared for this {node.kind.replace('_', ' ')}.</div>;
  return (
    <>
      {examples.map(ref => {
        const text = model.project.file(ref.path);
        return (
          <div key={ref.path}>
            {ref.description && <p>{ref.description}</p>}
            {text === undefined ? <div className="gap">{ref.path} is not available.</div> : <pre className="example" tabIndex={0}>{pretty(ref.path, text)}</pre>}
            <SourceLine path={ref.path} what="Read from" />
          </div>
        );
      })}
      <p className="note-box">Validation checks that each example matches the schema. That shows the files agree with each other, not that the code sends this data.</p>
    </>
  );
}

function Guarantees({ node, affects }: { node: GraphNode; affects: Relationship[] }) {
  const { model } = useViewer();
  const preserved = (model.incoming.get(node.id) ?? []).filter(rel => rel.kind === 'preserves');
  const rules = (model.outgoing.get(node.id) ?? []).filter(rel => rel.kind === 'constrained_by' || rel.kind === 'governed_by' || rel.kind === 'guarded_by');
  const group = (title: string, rels: Relationship[], end: 'from' | 'to') => rels.length > 0 && (
    <>
      <div className="section">{title}</div>
      <ul className="list">
        {rels.map(rel => (
          <li key={rel.id} className="wide">
            <span><NodeLink id={rel[end]} />{rel.status === 'unresolved' && <> <span className="badge warn">open</span></>}<span className="note">{rel.description}</span></span>
          </li>
        ))}
      </ul>
    </>
  );
  return (
    <>
      <p>{node.description}</p>
      {group('Preserved by', preserved, 'from')}
      {group('Decisions and records that affect it', affects, 'from')}
      {group('Rules it follows', rules, 'to')}
      {!preserved.length && !affects.length && !rules.length && <p className="muted">No preserves, affects or rule relationships are declared.</p>}
    </>
  );
}
