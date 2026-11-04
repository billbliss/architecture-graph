// The payload card: while a contract edge, contract pill or payload-carrying box is hovered or
// focused, its example payload is shown next to it on the canvas, in screen space so it stays
// readable at any zoom.
import { useReactFlow, useStore, useViewport } from '@xyflow/react';
import { createContext, useContext } from 'react';
import { pillId } from '../layout/views';
import { useViewer } from '../ui/context';
import { PayloadCardBody } from '../ui/Payload';

export interface HoverState {
  /** The record whose payload is shown. */
  hover?: string;
  setHover(id: string | undefined): void;
}

export const HoverContext = createContext<HoverState>({ setHover: () => {} });
export const useHover = (): HoverState => useContext(HoverContext);

/** Handlers that show a record's payload card on hover and focus; none when it has no example. */
export function useHoverHandlers(id: string, hasPayload: boolean) {
  const { setHover } = useHover();
  if (!hasPayload) return {};
  const show = (): void => setHover(id);
  const hide = (): void => setHover(undefined);
  return { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide };
}

const WIDTH = 340;
const GAP = 10;

export function PayloadCard() {
  const { model } = useViewer();
  const { hover } = useHover();
  const flow = useReactFlow();
  const { x, y, zoom } = useViewport();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const record = hover ? model.node(hover) : undefined;
  if (!record || !record.references.some(ref => ref.kind === 'example')) return null;
  const node = flow.getNode(pillId(record.id)) ?? flow.getNode(record.id);
  if (!node) return null;
  const left = node.position.x * zoom + x;
  const top = node.position.y * zoom + y;
  const nodeWidth = (node.width ?? 0) * zoom;
  const nodeHeight = (node.height ?? 0) * zoom;
  const cardLeft = Math.max(GAP, Math.min(width - WIDTH - GAP, left + nodeWidth / 2 - WIDTH / 2));
  // Below the box when it sits in the top half of the canvas, otherwise above it.
  const place = top + nodeHeight / 2 < height / 2
    ? { top: top + nodeHeight + GAP, maxHeight: height - (top + nodeHeight + GAP) - GAP }
    : { bottom: height - top + GAP, maxHeight: top - 2 * GAP };
  return (
    <div className="payload-card" role="tooltip" style={{ left: cardLeft, width: WIDTH, ...place }}>
      <PayloadCardBody record={record} />
    </div>
  );
}
