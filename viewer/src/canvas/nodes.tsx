// Canvas boxes. Each is a button, so every node is reachable by keyboard and has an accessible name;
// React Flow's own node focus is off. Handles are invisible anchors for edges drawn between sides.
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { isContractRecord } from '../model/contracts';
import { KINDS, KIND_ORDER } from '../model/kinds';
import type { Role } from '../layout/views';
import { Glyph } from '../ui/common';
import { useViewer } from '../ui/context';
import { useHoverHandlers } from './hover';

const carriesPayload = (references: { kind: string }[]): boolean => references.some(ref => ref.kind === 'example');

/** Marks a box or pill whose record has an example payload. */
function PayloadMark() {
  return <span className="payload-mark" aria-hidden="true" title="Has an example payload">{'{ }'}</span>;
}

const SIDES = [['t', Position.Top], ['r', Position.Right], ['b', Position.Bottom], ['l', Position.Left]] as const;

function Anchors() {
  return (
    <>
      {SIDES.map(([side, position]) => (
        <span key={side}>
          <Handle type="source" id={`s-${side}`} position={position} isConnectable={false} />
          <Handle type="target" id={`t-${side}`} position={position} isConnectable={false} />
        </span>
      ))}
    </>
  );
}

export type Look = { selected?: boolean; dim?: boolean };

export type ModuleNodeData = Look & { module: string };
export type BoxNodeData = Look & { node: string; role?: Role };
export type PillNodeData = Look & { contract: string };
export type HeadingNodeData = { title: string; subtitle?: string; group?: boolean };
export type FrameNodeData = { title: string };

export function ModuleNode({ data }: NodeProps<Node<ModuleNodeData>>) {
  const { model, actions } = useViewer();
  const module = model.modules.get(data.module);
  if (!module) return null;
  const stats = model.moduleStats(module.id);
  const kinds = KIND_ORDER.filter(kind => stats.kinds.get(kind));
  const contracts = model.nodesIn(module.id).filter(isContractRecord);
  const label = `Module ${module.name}: ${stats.nodes} nodes, exports ${module.exports.length}, imports ${module.imports.length}${contracts.length ? `, contracts ${contracts.map(node => node.name).join(', ')}` : ''}${stats.open ? `, ${stats.open} open` : ''}. Open module.`;
  return (
    <>
      <Anchors />
      <button type="button" className={`box module-box${data.selected ? ' selected' : ''}${data.dim ? ' dim' : ''}`} onClick={() => actions.openModule(module.id)} aria-label={label}>
        <div className="title">{module.name}</div>
        <div className="id">{module.id}</div>
        <div className="counts" aria-hidden="true">
          {kinds.map(kind => <span key={kind} title={`${stats.kinds.get(kind)} ${KINDS[kind].label}`}><Glyph kind={kind} /> {stats.kinds.get(kind)}</span>)}
        </div>
        <div className="io" aria-hidden="true">exports {module.exports.length} · imports {module.imports.length}</div>
        {contracts.length > 0 && <div className="contract-names" aria-hidden="true"><Glyph kind="contract" /> {contracts.map(node => node.name).join(' · ')}</div>}
        {stats.open > 0 && <span className="badge warn open" aria-hidden="true">{stats.open} open</span>}
      </button>
    </>
  );
}

export function BoxNode({ data }: NodeProps<Node<BoxNodeData>>) {
  const { model, actions } = useViewer();
  const node = model.node(data.node);
  if (!node) return null;
  const ghost = data.role === 'import' || data.role === 'user' || data.role === 'in' || data.role === 'out';
  const moduleName = node.module ? model.modules.get(node.module)?.name : undefined;
  const sub = data.role === 'atlas' ? undefined
    : ghost && moduleName ? moduleName
    : `${KINDS[node.kind].label}${node.status === 'unresolved' ? ' · open' : ''}`;
  const payload = carriesPayload(node.references);
  const hover = useHoverHandlers(node.id, payload);
  const label = `${node.name}, ${KINDS[node.kind].label}, ${node.status}${moduleName ? `, in ${moduleName}` : ''}${payload ? ', has an example payload' : ''}`;
  const classes = ['box', data.role === 'atlas' ? 'atlas' : '', ghost ? 'ghost' : '', node.status, data.selected ? 'selected' : '', data.dim ? 'dim' : ''];
  return (
    <>
      <Anchors />
      <button
        type="button"
        className={classes.filter(Boolean).join(' ')}
        onClick={() => (data.selected ? actions.clearSelection() : actions.selectNode(node.id))}
        aria-label={label}
        aria-pressed={!!data.selected}
        title={node.name}
        {...hover}
      >
        <span className="name"><Glyph kind={node.kind} /><span>{node.name}</span>{payload && <PayloadMark />}</span>
        {sub && <span className="sub">{sub}</span>}
      </button>
    </>
  );
}

export function PillNode({ data }: NodeProps<Node<PillNodeData>>) {
  const { model, actions } = useViewer();
  const contract = model.node(data.contract);
  if (!contract) return null;
  const ends = model.contractEnds(contract.id);
  const payload = carriesPayload(contract.references);
  const hover = useHoverHandlers(contract.id, payload);
  const label = `Contract ${contract.name}, from ${ends.providers.map(node => node.name).join(', ')} to ${ends.consumers.length} consumers${payload ? ', has an example payload' : ''}`;
  return (
    <>
      <Anchors />
      <button
        type="button"
        className={`pill ${contract.status}${data.selected ? ' selected' : ''}${data.dim ? ' dim' : ''}`}
        onClick={() => (data.selected ? actions.clearSelection() : actions.selectNode(contract.id))}
        aria-label={label}
        aria-pressed={!!data.selected}
        title={contract.name}
        {...hover}
      >
        <Glyph kind={contract.kind} /><span>{contract.name}</span>{payload && <PayloadMark />}
      </button>
    </>
  );
}

export function HeadingNode({ data }: NodeProps<Node<HeadingNodeData>>) {
  return (
    <div className={`heading${data.group ? ' group' : ''}`}>
      {data.title}
      {data.subtitle && <small>{data.subtitle}</small>}
    </div>
  );
}

export function FrameNode({ data }: NodeProps<Node<FrameNodeData>>) {
  return <div className="frame">{data.title}</div>;
}

export const nodeTypes = { module: ModuleNode, box: BoxNode, pill: PillNode, heading: HeadingNode, frame: FrameNode };
