// Public entry of src/render/geometry — owned by T12. Contract C06 §Geometry.
//
// LABEL RULE (FON notation): the cardinality label sits NEAR THE SOURCE END (the participant object), not mid-line.
//  1. Walk along the polyline from the source end. Distance d = 18% of the polyline length, but at least
//     estimateTextWidth(label)/2 + 10 px (so the text clears the source outline), and never more than 45% of it.
//  2. At that point P take the segment's unit normal n (left of travel direction), flipped when it would point
//     towards the source box center (so the text lies on the side facing away from the source).
//  3. The text box (width = estimated text width, height = EDGE_FONT_SIZE) is pushed along n so that its nearest
//     edge is LABEL_GAP (10 px) away from the line. If the normal is mostly horizontal the text is left/right of the
//     line and `anchor` is 'start' / 'end' with x at the text's near-line edge; otherwise anchor is 'middle' and x is
//     the text center. y is always the vertical center of the text (render with a central baseline).
import { NODE_SHAPE } from '../graph/types';
import type { DiagramEdge, DiagramNode, NodeShape, Point } from '../graph/types';
import { estimateTextWidth } from '../graph';
import { ARROW_LENGTH, ARROW_WIDTH, EDGE_FONT_SIZE } from '../style';

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

/** Indexed access that is known to be in range. */
const P = (pts: Point[], i: number): Point => pts[i] as Point;

const LABEL_GAP = 10;
const LOOP_MARGIN = 30;

export function boxOf(node: DiagramNode, position: Point): Box {
  return { x: position.x, y: position.y, width: node.width, height: node.height };
}

export function centerOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function outlineIntersection(shape: NodeShape, box: Box, toward: Point): Point {
  const c = centerOf(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const hw = box.width / 2;
  const hh = box.height / 2;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { x: c.x, y: box.y };
  const at = (t: number): Point => ({ x: c.x + dx * t, y: c.y + dy * t });
  const len = Math.hypot(dx, dy);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  switch (shape) {
    case 'diamond':
      return at(1 / (ax / hw + ay / hh));
    case 'circle': {
      const r = Math.min(hw, hh);
      return at(r / len);
    }
    case 'pill': {
      const r = Math.min(hw, hh);
      const flat = hw - r; // half-length of the straight part
      if (flat <= 0) return at(r / len);
      if (ay > 1e-12) {
        const t = hh / ay;
        if (Math.abs(dx * t) <= flat) return at(t);
      }
      // hit the end cap: circle of radius r centered at (±flat, 0)
      const cx = dx >= 0 ? flat : -flat;
      const a = dx * dx + dy * dy;
      const b = -2 * (dx * cx);
      const cc = cx * cx - r * r;
      const disc = Math.max(0, b * b - 4 * a * cc);
      return at((-b + Math.sqrt(disc)) / (2 * a));
    }
    default: {
      // rect, doubleRect, rectDiamond
      const tx = ax > 1e-12 ? hw / ax : Infinity;
      const ty = ay > 1e-12 ? hh / ay : Infinity;
      return at(Math.min(tx, ty));
    }
  }
}

function polylineLength(pts: Point[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(P(pts, i).x - P(pts, i - 1).x, P(pts, i).y - P(pts, i - 1).y);
  return l;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function pathOf(pts: Point[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
}

function routePoints(
  edge: DiagramEdge,
  source: { node: DiagramNode; box: Box },
  target: { node: DiagramNode; box: Box },
): Point[] {
  const sb = source.box;
  const tb = target.box;
  const sc = centerOf(sb);
  const tc = centerOf(tb);
  switch (edge.route) {
    case 'loopTop': {
      const y = Math.min(sb.y, tb.y) - LOOP_MARGIN;
      return [{ x: sc.x, y: sb.y }, { x: sc.x, y }, { x: tc.x, y }, { x: tc.x, y: tb.y }];
    }
    case 'loopBottom': {
      const y = Math.max(sb.y + sb.height, tb.y + tb.height) + LOOP_MARGIN;
      return [
        { x: sc.x, y: sb.y + sb.height },
        { x: sc.x, y },
        { x: tc.x, y },
        { x: tc.x, y: tb.y + tb.height },
      ];
    }
    case 'busDown': {
      const sBottom = sb.y + sb.height;
      const midY = (sBottom + tb.y) / 2;
      return [{ x: sc.x, y: sBottom }, { x: sc.x, y: midY }, { x: tc.x, y: midY }, { x: tc.x, y: tb.y }];
    }
    default:
      return [
        outlineIntersection(NODE_SHAPE_OF(source.node), sb, tc),
        outlineIntersection(NODE_SHAPE_OF(target.node), tb, sc),
      ];
  }
}

function NODE_SHAPE_OF(n: DiagramNode): NodeShape {
  return NODE_SHAPE[n.type];
}

function computeLabel(
  pts: Point[],
  label: string,
  sourceBox: Box,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const total = polylineLength(pts);
  const textW = estimateTextWidth(label, EDGE_FONT_SIZE);
  let d = Math.max(0.18 * total, textW / 2 + 10);
  d = Math.min(d, 0.45 * total);

  // locate point at distance d
  let seg = 0;
  let rem = d;
  for (; seg < pts.length - 2; seg++) {
    const sl = Math.hypot(P(pts, seg + 1).x - P(pts, seg).x, P(pts, seg + 1).y - P(pts, seg).y);
    if (rem <= sl) break;
    rem -= sl;
  }
  const a = P(pts, seg);
  const b = P(pts, seg + 1);
  const sl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / sl;
  const uy = (b.y - a.y) / sl;
  const p = { x: a.x + ux * rem, y: a.y + uy * rem };

  let nx = uy;
  let ny = -ux; // left of travel direction (screen coordinates)
  const sc = centerOf(sourceBox);
  if (nx * (p.x - sc.x) + ny * (p.y - sc.y) < -1e-9) {
    nx = -nx;
    ny = -ny;
  }
  const hw = textW / 2;
  const hh = EDGE_FONT_SIZE / 2;
  const off = LABEL_GAP + hw * Math.abs(nx) + hh * Math.abs(ny);
  const cx = p.x + nx * off;
  const cy = p.y + ny * off;
  if (Math.abs(nx) > 0.5) {
    return nx > 0 ? { x: cx - hw, y: cy, anchor: 'start' } : { x: cx + hw, y: cy, anchor: 'end' };
  }
  return { x: cx, y: cy, anchor: 'middle' };
}

export function computeEdgeGeometry(
  edge: DiagramEdge,
  source: { node: DiagramNode; box: Box },
  target: { node: DiagramNode; box: Box },
): EdgeGeometry {
  const points = routePoints(edge, source, target);

  let arrow: EdgeGeometry['arrow'] = null;
  let pathPts = points;
  if (edge.arrow && points.length >= 2) {
    const tip = P(points, points.length - 1);
    const prev = P(points, points.length - 2);
    const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const base = { x: tip.x - ux * ARROW_LENGTH, y: tip.y - uy * ARROW_LENGTH };
    const hw = ARROW_WIDTH / 2;
    const l = { x: base.x - uy * hw, y: base.y + ux * hw };
    const r = { x: base.x + uy * hw, y: base.y - ux * hw };
    const polygon = [tip, l, r].map((q) => `${round(q.x)},${round(q.y)}`).join(' ');
    arrow = { tip: { ...tip }, angle, polygon };
    pathPts = [...points.slice(0, -1), base];
  }

  const label = edge.label ? computeLabel(points, edge.label, source.box) : null;
  return { points, path: pathOf(pathPts), label, arrow };
}
