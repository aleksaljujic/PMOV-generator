// Public entry of src/render/geometry — owned by T12. Contract C06 §Geometry.
import type { DiagramEdge, DiagramNode, NodeShape, Point } from '../graph/types';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeGeometry {
  points: Point[];
  path: string;
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
  arrow: { tip: Point; angle: number; polygon: string } | null;
}

export function boxOf(_node: DiagramNode, _position: Point): Box {
  throw new Error('not implemented: T12');
}

export function centerOf(_box: Box): Point {
  throw new Error('not implemented: T12');
}

export function outlineIntersection(_shape: NodeShape, _box: Box, _toward: Point): Point {
  throw new Error('not implemented: T12');
}

export function computeEdgeGeometry(
  _edge: DiagramEdge,
  _source: { node: DiagramNode; box: Box },
  _target: { node: DiagramNode; box: Box },
): EdgeGeometry {
  throw new Error('not implemented: T12');
}
