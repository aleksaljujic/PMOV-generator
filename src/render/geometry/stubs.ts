// Attribute stubs (T47, C06 §Additions for the grid layout): owner -> atribut edges whose pill sits beside the owner
// box are drawn as one horizontal segment.
import type { DiagramEdge, DiagramNode, Point } from '../graph/types';
import type { Box } from './base';

export const isRectNode = (n: DiagramNode): boolean => n.type === 'objekat' || n.type === 'slab' || n.type === 'agregacija';

export interface StubInfo {
  /** Stub polyline by edge id (two points, equal y). */
  points: Map<string, Point[]>;
  /** Per owner node id: absolute y of the stub rows on its left / right side. */
  rows: Map<string, { left: number[]; right: number[] }>;
}

export function findStubs(edges: DiagramEdge[], nodes: Map<string, DiagramNode>, boxes: Record<string, Box>): StubInfo {
  const points = new Map<string, Point[]>();
  const rows = new Map<string, { left: number[]; right: number[] }>();
  for (const e of edges) {
    const sn = nodes.get(e.source);
    const tn = nodes.get(e.target);
    const sb = boxes[e.source];
    const tb = boxes[e.target];
    if (!sn || !tn || !sb || !tb || e.source === e.target) continue;
    if (!(isRectNode(sn) && tn.type === 'atribut')) continue;
    const cy = tb.y + tb.height / 2;
    if (cy < sb.y || cy > sb.y + sb.height) continue;
    let side: 'left' | 'right';
    let owner: Point;
    let pill: Point;
    if (tb.x + tb.width <= sb.x) {
      side = 'left';
      owner = { x: sb.x, y: cy };
      pill = { x: tb.x + tb.width, y: cy };
    } else if (tb.x >= sb.x + sb.width) {
      side = 'right';
      owner = { x: sb.x + sb.width, y: cy };
      pill = { x: tb.x, y: cy };
    } else continue;
    points.set(e.id, [owner, pill]);
    const r = rows.get(e.source) ?? { left: [], right: [] };
    r[side].push(cy);
    rows.set(e.source, r);
  }
  for (const r of rows.values()) {
    r.left.sort((a, b) => a - b);
    r.right.sort((a, b) => a - b);
  }
  return { points, rows };
}
