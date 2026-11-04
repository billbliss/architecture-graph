// One edge renderer for every view: a route computed by ELK when there is one, otherwise a curve
// between node sides. Map edges carry a count label, which is a button that selects the module pair.
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { Point } from '../layout/layout';
import { useViewer } from '../ui/context';

export interface RouteEdgeData extends Record<string, unknown> {
  points?: Point[];
  classes: string;
  /** Map count label: top-left corner, text and the pair it selects. */
  label?: { x: number; y: number; text: string; pair: string; back: boolean; selected: boolean; name: string };
  title?: string;
  /** Contract an edge carries, for its payload card and selection. */
  contract?: string;
}

/** A polyline through the points with rounded corners. */
export function roundedPath(points: Point[], radius = 10): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < rest.length; i++) {
    const at = rest[i]!;
    const prev = points[i]!;
    const next = rest[i + 1];
    if (!next) {
      d += ` L${at.x},${at.y}`;
      break;
    }
    const before = Math.hypot(at.x - prev.x, at.y - prev.y);
    const after = Math.hypot(next.x - at.x, next.y - at.y);
    const r = Math.min(radius, before / 2, after / 2);
    if (!before || !after || r <= 0) {
      d += ` L${at.x},${at.y}`;
      continue;
    }
    const a = { x: at.x + ((prev.x - at.x) * r) / before, y: at.y + ((prev.y - at.y) * r) / before };
    const b = { x: at.x + ((next.x - at.x) * r) / after, y: at.y + ((next.y - at.y) * r) / after };
    d += ` L${a.x},${a.y} Q${at.x},${at.y} ${b.x},${b.y}`;
  }
  return d;
}

export function RouteEdge(props: EdgeProps<Edge<RouteEdgeData>>) {
  const { data, markerEnd, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const { actions } = useViewer();
  const path = data?.points && data.points.length > 1
    ? roundedPath(data.points)
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0];
  const label = data?.label;
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} className={`edge-path ${data?.classes ?? ''}`} />
      {label && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`count${label.back ? ' back' : ''}${label.selected ? ' selected' : ''}`}
            style={{ transform: `translate(${label.x}px, ${label.y}px)` }}
            onClick={() => (label.selected ? actions.clearSelection() : actions.selectPair(label.pair))}
            aria-label={label.name}
            aria-pressed={label.selected}
          >
            {label.text}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { route: RouteEdge };
