// Owned by T05. Contract C08 §DiagramView.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { EdgeTypes, Node, NodeChange, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Locale } from '../../lang';
import { layoutDiagram } from '../layout';
import type { DiagramGraph, Point, PositionMap } from '../graph/types';
import { FILL, STROKE } from '../style';
import { applyLockedDrag, nudgeToFree } from './drag';
import { EdgeGeometryProvider } from './edgeGeometry';
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
import { INTERACTION_KEYS, InteractionContext } from './interaction';
import type { InteractionProps } from './interaction';
import { toReactFlow } from './toReactFlow';
import type { PmovNodeData } from './toReactFlow';

export interface DiagramViewHandle {
  fitView(): void;
  getPositions(): PositionMap;
  /** C09 (additive): pan so that the element's main node is centred, keeping the zoom. */
  centerOnElement(elementId: string): void;
}

interface DiagramViewBaseProps {
  graph: DiagramGraph | null;
  savedPositions: PositionMap;
  layoutNonce: number;
  errorElementIds: ReadonlySet<string>;
  selectedElementId: string | null;
  onElementClick(elementId: string): void;
  onNodeMoved(nodeId: string, position: Point): void;
  /** T19 (additive): UI language of the empty state; default 'sr'. */
  locale?: Locale;
  /** T48 (additive): layout algorithm passed to `layoutDiagram`; default 'grid'. A change re-lays out and fits. */
  layoutAlgorithm?: 'grid' | 'free';
  /** T48 (additive): dragging an object moves its pills too; default true. */
  lockAttributes?: boolean;
  /** T48 (additive): snap drags to a 10 px grid and show a dot background; default true. */
  snapToGrid?: boolean;
  /** T48 (additive): drag stop; every node whose position changed. Preferred over `onNodeMoved`. */
  onNodesMoved?(moves: Record<string, Point>): void;
}

/** C09 additive props (all optional): see ./interaction. */
export interface DiagramViewProps extends DiagramViewBaseProps, InteractionProps {}

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
  const { layoutAlgorithm, lockAttributes = true, snapToGrid = true, onNodesMoved } = props;
  const { fitView, setCenter, getZoom } = useReactFlow();
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
  const lastAlgorithm = useRef(layoutAlgorithm);
  const lastRunId = useRef(0);
  const altRef = useRef(false);
  const dragStartRef = useRef<PositionMap | null>(null);
  const lockRef = useRef(lockAttributes);
  lockRef.current = lockAttributes;

  // Re-layout on structure change or nonce bump; ignore stale results.
  useEffect(() => {
    const g = graphRef.current;
    if (!g) {
      setPositions(null);
      return;
    }
    const algoChanged = lastAlgorithm.current !== layoutAlgorithm;
    lastAlgorithm.current = layoutAlgorithm;
    const nonceBumped = (lastNonce.current !== null && lastNonce.current !== layoutNonce) || algoChanged;
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
    layoutDiagram(g, { saved, algorithm: layoutAlgorithm ?? 'grid' })
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
  }, [signature, layoutNonce, layoutAlgorithm]);

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
      centerOnElement: (elementId: string) => {
        const node = graphRef.current?.nodes.find((n) => n.elementId === elementId && n.type !== 'atribut');
        const pos = node ? positionsRef.current?.[node.id] : undefined;
        if (!node || !pos) return;
        void setCenter(pos.x + node.width / 2, pos.y + node.height / 2, { zoom: getZoom(), duration: 250 });
      },
    }),
    [fitView, setCenter, getZoom],
  );

  // Label-only / error / selection changes only rebuild data (no re-layout).
  const nodes = useMemo(
    () => (graph && positions ? toReactFlow(graph, positions, errorElementIds, selectedElementId).nodes : []),
    [graph, positions, errorElementIds, selectedElementId],
  );
  // Edges depend only on the graph, so they stay referentially stable across drags/selection/errors.
  const edges = useMemo(() => (graph && positions ? toReactFlow(graph, {}, new Set(), null).edges : []), [graph, positions === null]);

  const onNodesChange = useCallback((changes: NodeChange<Node<PmovNodeData>>[]) => {
    const moves = changes.filter((c) => c.type === 'position' && c.position);
    if (moves.length === 0) return;
    setPositions((prev) => {
      const g = graphRef.current;
      if (!prev) return prev;
      const next = { ...prev };
      for (const c of moves) {
        if (c.type !== 'position' || !c.position) continue;
        const to = { x: c.position.x, y: c.position.y };
        if (!g) {
          next[c.id] = to;
          continue;
        }
        Object.assign(next, applyLockedDrag(g, next, c.id, to, { lock: lockRef.current, alt: altRef.current }));
      }
      return next;
    });
  }, []);

  const onNodeDragStart = useCallback((e: { altKey?: boolean }) => {
    altRef.current = e.altKey === true;
    dragStartRef.current = positionsRef.current ? { ...positionsRef.current } : null;
  }, []);

  const onNodeDragStop = useCallback(
    (node: Node) => {
      const g = graphRef.current;
      let cur = positionsRef.current;
      if (!g || !cur) return;
      const dragged = g.nodes.find((n) => n.id === node.id);
      if (dragged && lockRef.current && !(altRef.current && dragged.type === 'atribut')) {
        const ownerId = dragged.type === 'atribut' && dragged.ownerNodeId ? dragged.ownerNodeId : dragged.id;
        const delta = nudgeToFree(g, cur, ownerId);
        if (delta) {
          const shifted = { ...cur };
          for (const n of g.nodes) {
            const owner = n.type === 'atribut' && n.ownerNodeId ? n.ownerNodeId : n.id;
            const p = cur[n.id];
            if (owner === ownerId && p) shifted[n.id] = { x: p.x + delta.x, y: p.y + delta.y };
          }
          cur = shifted;
          positionsRef.current = shifted;
          setPositions(shifted);
        }
      }
      const start = dragStartRef.current ?? {};
      const moved: Record<string, Point> = {};
      for (const [id, p] of Object.entries(cur)) {
        const s = start[id];
        if (!s || s.x !== p.x || s.y !== p.y) moved[id] = { x: p.x, y: p.y };
      }
      if (!(node.id in moved)) moved[node.id] = { x: node.position.x, y: node.position.y };
      altRef.current = false;
      dragStartRef.current = null;
      if (onNodesMoved) onNodesMoved(moved);
      else for (const [id, p] of Object.entries(moved)) onNodeMoved(id, p);
    },
    [onNodesMoved, onNodeMoved],
  );

  // Stable while the interactive props are referentially stable; null when none is passed.
  const interaction = useMemo<InteractionProps | null>(() => {
    const picked: Record<string, unknown> = {};
    let any = false;
    for (const k of INTERACTION_KEYS) {
      if (props[k] !== undefined) {
        picked[k] = props[k];
        any = true;
      }
    }
    return any ? (picked as InteractionProps) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, INTERACTION_KEYS.map((k) => props[k]));

  if (!graph) {
    return <div style={emptyStyle}>{props.locale === 'en' ? 'No diagram' : 'Nema dijagrama'}</div>;
  }

  const { onNodeDoubleClick, onCanvasClick } = props;

  return (
    <InteractionContext.Provider value={interaction}>
    <EdgeGeometryProvider graph={graph}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStart={(e) => onNodeDragStart(e)}
      onNodeDragStop={(_e, node) => onNodeDragStop(node)}
      snapToGrid={snapToGrid}
      snapGrid={[10, 10]}
      onNodeClick={(_e, node) => onElementClick((node.data as PmovNodeData).node.elementId)}
      {...(onNodeDoubleClick
        ? { onNodeDoubleClick: (_e: unknown, node: Node) => onNodeDoubleClick((node.data as PmovNodeData).node), zoomOnDoubleClick: false }
        : {})}
      {...(onCanvasClick ? { onPaneClick: () => onCanvasClick() } : {})}
      nodesConnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      minZoom={0.1}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      style={{ background: FILL }}
    >
      {snapToGrid ? <Background variant={BackgroundVariant.Dots} gap={20} /> : null}
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={FILL} nodeStrokeColor={STROKE} />
    </ReactFlow>
    </EdgeGeometryProvider>
    </InteractionContext.Provider>
  );
});

export const DiagramView = forwardRef<DiagramViewHandle, DiagramViewProps>(function DiagramView(props, ref) {
  return (
    <ReactFlowProvider>
      <DiagramViewInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
