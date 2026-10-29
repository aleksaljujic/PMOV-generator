// Owned by T05. Contract C08 §DiagramView — pure IR→React Flow mapping.
import type { Edge, Node } from '@xyflow/react';
import type { DiagramEdge, DiagramGraph, DiagramNode, PositionMap } from '../graph/types';

export interface PmovNodeData extends Record<string, unknown> {
  node: DiagramNode;
  hasError: boolean;
  selected: boolean;
}

export interface PmovEdgeData extends Record<string, unknown> {
  edge: DiagramEdge;
}

export function toReactFlow(
  graph: DiagramGraph,
  positions: PositionMap,
  errorElementIds: ReadonlySet<string>,
  selectedElementId: string | null,
): { nodes: Node<PmovNodeData>[]; edges: Edge<PmovEdgeData>[] } {
  const nodes: Node<PmovNodeData>[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: positions[node.id] ?? { x: 0, y: 0 },
    width: node.width,
    height: node.height,
    draggable: true,
    connectable: false,
    data: {
      node,
      hasError: errorElementIds.has(node.elementId),
      selected: selectedElementId !== null && node.elementId === selectedElementId,
    },
  }));
  const edges: Edge<PmovEdgeData>[] = graph.edges.map((edge) => ({
    id: edge.id,
    type: 'pmov',
    source: edge.source,
    target: edge.target,
    selectable: false,
    focusable: false,
    data: { edge },
  }));
  return { nodes, edges };
}
