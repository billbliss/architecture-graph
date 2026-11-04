import { Controls, ReactFlow, ReactFlowProvider, useReactFlow, type Node } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Layout } from '../layout/layout';
import type { ViewGraph } from '../layout/views';
import { pillId } from '../layout/views';
import { useViewer } from '../ui/context';
import { edgeTypes } from './edges';
import { buildFlow } from './flow';
import { HoverContext, PayloadCard } from './hover';
import { nodeTypes } from './nodes';

const HINTS: Record<ViewGraph['kind'], string> = {
  map: 'Select a module to open it · select a count to see what crosses that boundary',
  module: 'Thick amber edges are contracts, drawn from provider to consumers · hover one to see its payload',
  neighborhood: 'What points at the selected node on the left, what it points at on the right',
  atlas: 'Every node in one place · select one to draw its relationships',
};

/** Brings the selected node into view when it is off screen, without changing the zoom. */
function FollowSelection({ id, container }: { id?: string; container: React.RefObject<HTMLDivElement | null> }) {
  const flow = useReactFlow();
  useEffect(() => {
    if (!id || !container.current) return;
    const node: Node | undefined = flow.getNode(id) ?? flow.getNode(pillId(id));
    if (!node) return;
    const { x, y, zoom } = flow.getViewport();
    const width = node.width ?? 0;
    const height = node.height ?? 0;
    const left = node.position.x * zoom + x;
    const top = node.position.y * zoom + y;
    const box = container.current.getBoundingClientRect();
    if (left < 0 || top < 0 || left + width * zoom > box.width || top + height * zoom > box.height) {
      void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom, duration: 200 });
    }
  }, [id, flow, container]);
  return null;
}

export function Canvas({ view, layout, label }: { view: ViewGraph; layout: Layout; label: string }) {
  const { model, route, actions } = useViewer();
  const flow = useMemo(() => buildFlow(model, view, layout, route), [model, view, layout, route]);
  const container = useRef<HTMLDivElement>(null);
  const viewKey = `${view.kind}:${view.subject ?? ''}`;
  const [hover, setHover] = useState<string>();
  const hoverState = useMemo(() => ({ hover, setHover }), [hover]);
  useEffect(() => setHover(undefined), [viewKey]);
  return (
    <HoverContext.Provider value={hoverState}>
      <section className="canvas" ref={container} aria-label={label} aria-describedby="canvas-summary">
        <p id="canvas-summary" className="visually-hidden" aria-live="polite">{flow.summary}</p>
        <ReactFlowProvider key={viewKey}>
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
            minZoom={0.08}
            maxZoom={2.5}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            onlyRenderVisibleElements={view.nodes.length > 300}
            zoomOnDoubleClick={false}
            onPaneClick={() => { if (route.node || route.rel || route.pair) actions.clearSelection(); }}
            onEdgeClick={(_, edge) => { const contract = edge.data?.contract; if (typeof contract === 'string') actions.selectNode(contract); }}
            onEdgeMouseEnter={(_, edge) => { const contract = edge.data?.contract; if (typeof contract === 'string') setHover(contract); }}
            onEdgeMouseLeave={() => setHover(undefined)}
            colorMode="system"
            attributionPosition="top-right"
          >
            <Controls showInteractive={false} position="bottom-right" />
            <FollowSelection id={route.node} container={container} />
            <PayloadCard />
          </ReactFlow>
        </ReactFlowProvider>
        <div className="hint">{HINTS[view.kind]}</div>
      </section>
    </HoverContext.Provider>
  );
}
