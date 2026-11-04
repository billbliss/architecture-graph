// Payload previews: in the node panel (what a node sends and receives) and on the canvas (a card shown
// while a contract edge, pill or payload-carrying box is hovered or focused).
import type { GraphNode } from '@billbliss/architecture-graph/core';
import { excerpt, examplesOf, payloadsOf, type Example, type PayloadFlow } from '../model/payloads';
import { Glyph, NodeLink } from './common';
import { useViewer } from './context';

export function PayloadPreview({ example, lines }: { example: Example; lines: number }) {
  if (example.text === undefined) return <div className="gap">{example.path} is not available.</div>;
  const { text, omitted } = excerpt(example, lines);
  return (
    <>
      <pre className="example payload">{text}</pre>
      {omitted > 0 && <div className="src">{omitted} more line{omitted === 1 ? '' : 's'} in {example.path}</div>}
    </>
  );
}

function FlowItem({ flow, direction }: { flow: PayloadFlow; direction: 'sends' | 'receives' }) {
  const [first, ...more] = flow.examples;
  const peers = flow.peers.map(node => node.name);
  const toward = direction === 'sends'
    ? (peers.length ? `to ${peers.length === 1 ? peers[0] : `${peers.length} consumers`}` : 'no consumers found')
    : (peers.length ? `from ${peers.join(', ')}` : 'no provider declared');
  return (
    <li className="wide flow">
      <span>
        <NodeLink id={flow.record.id} /> <span className="muted">{toward}</span>
        {flow.derived && <> <span className="badge derived">derived</span></>}
      </span>
      {first && <PayloadPreview example={first} lines={10} />}
      {more.length > 0 && <div className="src">{more.length} more example{more.length === 1 ? '' : 's'}; open the contract to see all.</div>}
    </li>
  );
}

/** What a node sends and receives, with each payload's example. Empty when it has none. */
export function PayloadSection({ id }: { id: string }) {
  const { model } = useViewer();
  const { sends, receives } = payloadsOf(model, id);
  if (!sends.length && !receives.length) return null;
  return (
    <>
      {sends.length > 0 && (
        <>
          <div className="section">Sends ({sends.length})</div>
          <ul className="list">{sends.map(flow => <FlowItem key={flow.record.id} flow={flow} direction="sends" />)}</ul>
        </>
      )}
      {receives.length > 0 && (
        <>
          <div className="section">Receives ({receives.length})</div>
          <ul className="list">{receives.map(flow => <FlowItem key={flow.record.id} flow={flow} direction="receives" />)}</ul>
        </>
      )}
    </>
  );
}

/** The hover card's contents for one payload-carrying record. */
export function PayloadCardBody({ record }: { record: GraphNode }) {
  const { model } = useViewer();
  const ends = model.contractEnds(record.id);
  const [first, ...more] = examplesOf(model, record);
  const consumers = ends.consumers.length;
  return (
    <>
      <div className="card-title"><Glyph kind={record.kind} /> {record.name}</div>
      <div className="card-ends">
        {ends.providers.map(node => node.name).join(', ') || 'No provider'} → {consumers} consumer{consumers === 1 ? '' : 's'}{ends.derived ? ' (derived)' : ''}
      </div>
      {first && <PayloadPreview example={first} lines={14} />}
      {more.length > 0 && <div className="src">{more.length} more example{more.length === 1 ? '' : 's'}</div>}
      <div className="src">Select for structure, guarantees and sources.</div>
    </>
  );
}
