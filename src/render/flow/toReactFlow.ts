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
  _graph: DiagramGraph,
  _positions: PositionMap,
  _errorElementIds: ReadonlySet<string>,
  _selectedElementId: string | null,
): { nodes: Node<PmovNodeData>[]; edges: Edge<PmovEdgeData>[] } {
  throw new Error('not implemented: T05');
}
