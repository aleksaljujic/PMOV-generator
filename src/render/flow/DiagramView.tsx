// Owned by T05. Contract C08 §DiagramView.
import { forwardRef } from 'react';
import type { DiagramGraph, Point, PositionMap } from '../graph/types';

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

export const DiagramView = forwardRef<DiagramViewHandle, DiagramViewProps>(function DiagramView() {
  return <div>not implemented: T05</div>;
});
