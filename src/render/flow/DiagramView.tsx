// Owned by T05. Contract C08 §DiagramView.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { EdgeTypes, Node, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { layoutDiagram } from '../layout';
import type { DiagramGraph, Point, PositionMap } from '../graph/types';
import { FILL, STROKE } from '../style';
import { PmovEdge } from './PmovEdge';
import {
  AgregacijaNode,
  AtributNode,
  JunctionNode,
  ObjekatNode,
  SlabNode,
  SpecNode,
  VezaNode,
} from './nodes';
import { toReactFlow } from './toReactFlow';
import type { PmovNodeData } from './toReactFlow';

export interface DiagramViewHandle {
  fitView(): void;
  getPositions(): PositionMap;
}

export interface DiagramViewProps {
  graph: DiagramGraph | null;
  savedPositions: PositionMap;
  layoutNonce: number;
  errorElementIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onElementClick(elementId: string): void;
  onNodeMoved(nodeId: string, position: Point): void;
}

const nodeTypes: NodeTypes = {
  objekat: ObjekatNode,
  slab: SlabNode,
  veza: VezaNode,
  agregacija: AgregacijaNode,
  atribut: AtributNode,
  spec: SpecNode,
  junction: JunctionNode,
};
const edgeTypes: EdgeTypes = { pmov: PmovEdge };

/** Signature of everything that affects layout: node ids + sizes, edge ids + endpoints + route. */
export function structureSignature(graph: DiagramGraph | null): string {
  if (!graph) return '';
  return (
    graph.nodes.map((n) => `${n.id}:${n.type}:${n.width}x${n.height}`).join('|') +
    '#' +
    graph.edges.map((e) => `${e.id}:${e.source}>${e.target}:${e.route}`).join('|')
  );
}

const emptyStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#666',
  background: FILL,
} as const;

const DiagramViewInner = forwardRef<DiagramViewHandle, DiagramViewProps>(function DiagramViewInner(props, ref) {
  const { graph, savedPositions, layoutNonce, errorElementIds, selectedElementId, onElementClick, onNodeMoved } =
    props;
  const { fitView } = useReactFlow();
  const [positions, setPositions] = useState<PositionMap | null>(null);
  const positionsRef = useRef<PositionMap | null>(null);
  positionsRef.current = positions;
  const [fitTick, setFitTick] = useState(0);

  const graphRef = useRef(graph);
  graphRef.current = graph;
  const savedRef = useRef(savedPositions);
  savedRef.current = savedPositions;

  const signature = structureSignature(graph);
  const lastNonce = useRef<number | null>(null);
  const lastRunId = useRef(0);

  // Re-layout on structure change or nonce bump; ignore stale results.
  useEffect(() => {
    const g = graphRef.current;
    if (!g) {
      setPositions(null);
      return;
    }
    const nonceBumped = lastNonce.current !== null && lastNonce.current !== layoutNonce;
    const firstLayout = positionsRef.current === null;
    lastNonce.current = layoutNonce;

    // Keep on-screen positions of surviving nodes unless a fresh layout was requested.
    const saved: PositionMap = { ...savedRef.current };
    if (!nonceBumped && positionsRef.current) {
      for (const n of g.nodes) {
        const cur = positionsRef.current[n.id];
        if (cur && !saved[n.id]) saved[n.id] = cur;
      }
    }

    const runId = ++lastRunId.current;
    layoutDiagram(g, { saved })
      .then((result) => {
        if (runId !== lastRunId.current) return;
        setPositions(result);
        if (firstLayout || nonceBumped) setFitTick((t) => t + 1);
      })
      .catch((err: unknown) => {
        console.error('layoutDiagram failed', err);
      });
    return () => {
      // a newer run supersedes this one
    };
  }, [signature, layoutNonce]);

  // fitView after the freshly positioned nodes have been rendered/measured.
  useEffect(() => {
    if (fitTick === 0) return;
    const id = requestAnimationFrame(() => {
      void fitView({ padding: 0.15, duration: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [fitTick, fitView]);

  useImperativeHandle(
    ref,
    () => ({
      fitView: () => {
        void fitView({ padding: 0.15, duration: 200 });
      },
      getPositions: () => ({ ...(positionsRef.current ?? {}) }),
    }),
    [fitView],
  );

  // Label-only / error / selection changes only rebuild data (no re-layout).
  const { nodes, edges } = useMemo(
    () =>
      graph && positions
        ? toReactFlow(graph, positions, errorElementIds, selectedElementId)
        : { nodes: [], edges: [] },
    [graph, positions, errorElementIds, selectedElementId],
  );

  const onNodesChange = useCallback((changes: NodeChange<Node<PmovNodeData>>[]) => {
    const moves = changes.filter((c) => c.type === 'position' && c.position);
    if (moves.length === 0) return;
    setPositions((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const c of moves) {
        if (c.type === 'position' && c.position) next[c.id] = { x: c.position.x, y: c.position.y };
      }
      return next;
    });
  }, []);

  if (!graph) {
    return <div style={emptyStyle}>Nema dijagrama</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={(_e, node) => onNodeMoved(node.id, { x: node.position.x, y: node.position.y })}
      onNodeClick={(_e, node) => onElementClick((node.data as PmovNodeData).node.elementId)}
      nodesConnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      minZoom={0.1}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      style={{ background: FILL }}
    >
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={FILL} nodeStrokeColor={STROKE} />
    </ReactFlow>
  );
});

export const DiagramView = forwardRef<DiagramViewHandle, DiagramViewProps>(function DiagramView(props, ref) {
  return (
    <ReactFlowProvider>
      <DiagramViewInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
