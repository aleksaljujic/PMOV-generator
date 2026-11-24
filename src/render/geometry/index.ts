// Public entry of src/render/geometry — owned by T12 (single edge) and T40 (whole diagram). Contract C06 §Geometry.
//
// computeEdgeGeometry(edge, source, target): one edge, lines aim at the box centres.
// computeDiagramGeometry(graph, boxes): every edge at once. Lines ending on rectangle nodes are spread along the
// sides (ports, ports.ts) and cardinality labels avoid node boxes and earlier labels (labels in diagram.ts).
//
// LABEL RULE of both functions
// LABEL RULE (FON notation): the cardinality label sits NEAR THE SOURCE END (the participant object), not mid-line.
//  1. Walk along the polyline from the source end. Distance d = 18% of the polyline length, but at least
//     estimateTextWidth(label)/2 + 10 px (so the text clears the source outline), and never more than 45% of it.
//  2. At that point P take the segment's unit normal n (left of travel direction), flipped when it would point
//     towards the source box center (so the text lies on the side facing away from the source).
//  3. The text box (width = estimated text width, height = EDGE_FONT_SIZE) is pushed along n so that its nearest
//     edge is LABEL_GAP (10 px) away from the line. If the normal is mostly horizontal the text is left/right of the
//     line and `anchor` is 'start' / 'end' with x at the text's near-line edge; otherwise anchor is 'middle' and x is
//     the text center. y is always the vertical center of the text (render with a central baseline).
import type { DiagramEdge, DiagramNode } from '../graph/types';
import { boxOf, centerOf, finishGeometry, labelAt, outlineIntersection, routePoints } from './base';
import type { Box, EdgeGeometry } from './base';
import { computeDiagramGeometry } from './diagram';

export type { Box, EdgeGeometry };
export { boxOf, centerOf, outlineIntersection, computeDiagramGeometry };

export function computeEdgeGeometry(
  edge: DiagramEdge,
  source: { node: DiagramNode; box: Box },
  target: { node: DiagramNode; box: Box },
): EdgeGeometry {
  const points = routePoints(edge, source, target);
  const label = edge.label ? labelAt(points, edge.label, source.box, 0.18, false) : null;
  const { path, arrow } = finishGeometry(edge, points);
  return { points, path, label, arrow };
}
