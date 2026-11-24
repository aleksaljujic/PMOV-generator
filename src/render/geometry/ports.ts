// Ports (T40, C06 §Additions for busy nodes): endpoints of straight edges are spread along the sides of
// rectangle-outlined nodes instead of all aiming at the centre.
import { NODE_SHAPE } from '../graph/types';
import type { DiagramEdge, DiagramNode, Point } from '../graph/types';
import { centerOf, outlineIntersection, routePoints } from './base';
import type { Box } from './base';
import { isRectNode } from './stubs';
import type { StubInfo } from './stubs';

const CORNER_GAP = 6;
const FIXED_GAP = 8;
const GAP_PITCH = 8;
const STUB_CLEAR = 4;

type Side = 'top' | 'bottom' | 'left' | 'right';

function sideToward(box: Box, toward: Point): Side {
  const c = centerOf(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const tx = Math.abs(dx) > 1e-12 ? box.width / 2 / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-12 ? box.height / 2 / Math.abs(dy) : Infinity;
  if (tx < ty) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/** Offset along the side (x for top/bottom, y for left/right), measured from the box's top-left. */
function along(side: Side, p: Point, box: Box): number {
  return side === 'top' || side === 'bottom' ? p.x - box.x : p.y - box.y;
}

function pointOnSide(side: Side, offset: number, box: Box): Point {
  switch (side) {
    case 'top': return { x: box.x + offset, y: box.y };
    case 'bottom': return { x: box.x + offset, y: box.y + box.height };
    case 'left': return { x: box.x, y: box.y + offset };
    default: return { x: box.x + box.width, y: box.y + offset };
  }
}

/** Side of the box on which a fixed (loop / bus) endpoint lies, or null. */
function fixedSide(p: Point, box: Box): Side | null {
  const eps = 0.5;
  const inX = p.x >= box.x - eps && p.x <= box.x + box.width + eps;
  const inY = p.y >= box.y - eps && p.y <= box.y + box.height + eps;
  if (inX && Math.abs(p.y - box.y) < eps) return 'top';
  if (inX && Math.abs(p.y - box.y - box.height) < eps) return 'bottom';
  if (inY && Math.abs(p.x - box.x) < eps) return 'left';
  if (inY && Math.abs(p.x - box.x - box.width) < eps) return 'right';
  return null;
}

interface End { edge: DiagramEdge; isSource: boolean; other: Point }

/** Free gap centres (absolute y) between the stub rows of one side, including above / below the outermost row. */
export function gapCentres(rows: number[], box: Box): number[] {
  const ys = [box.y, ...rows, box.y + box.height];
  const out: number[] = [];
  for (let i = 0; i + 1 < ys.length; i++) out.push(((ys[i] as number) + (ys[i + 1] as number)) / 2);
  return out;
}

/**
 * Port point for each straight edge end on a rectangle node: `result.get(edge.id + ':s' | ':t')`.
 * Self edges and non-straight edges get no port.
 */
export function computePorts(
  edges: DiagramEdge[],
  nodes: Map<string, DiagramNode>,
  boxes: Record<string, Box>,
  stubs?: StubInfo,
): Map<string, Point> {
  const ends = new Map<string, End[]>(); // `${nodeId}|${side}`
  const gapEnds = new Map<string, End[]>(); // `${nodeId}|${side}|${gapIndex}`: side ends squeezed between stub rows
  const fixed = new Map<string, number[]>(); // same key → offsets of fixed endpoints
  const addFixed = (nodeId: string, p: Point): void => {
    const box = boxes[nodeId] as Box;
    const side = fixedSide(p, box);
    if (!side) return;
    const k = `${nodeId}|${side}`;
    const l = fixed.get(k) ?? [];
    l.push(along(side, p, box));
    fixed.set(k, l);
  };

  for (const e of edges) {
    const sn = nodes.get(e.source);
    const tn = nodes.get(e.target);
    const sb = boxes[e.source];
    const tb = boxes[e.target];
    if (!sn || !tn || !sb || !tb) continue;
    if (e.route !== 'straight') {
      const pts = routePoints(e, { node: sn, box: sb }, { node: tn, box: tb });
      if (isRectNode(sn)) addFixed(e.source, pts[0] as Point);
      if (isRectNode(tn)) addFixed(e.target, pts[pts.length - 1] as Point);
      continue;
    }
    if (e.source === e.target || stubs?.points.has(e.id)) continue;
    const sides: [DiagramNode, Box, boolean, Box][] = [[sn, sb, true, tb], [tn, tb, false, sb]];
    for (const [n, b, isSource, ob] of sides) {
      if (!isRectNode(n)) continue;
      const other = centerOf(ob);
      let side = sideToward(b, other);
      const r = stubs?.rows.get(n.id);
      if (r && (side === 'left' || side === 'right')) {
        const dy = other.y - centerOf(b).y;
        if (Math.abs(dy) >= b.height / 2) side = dy >= 0 ? 'bottom' : 'top';
        else if ((side === 'left' ? r.left : r.right).length > 0) {
          const centres = gapCentres(side === 'left' ? r.left : r.right, b);
          let gi = 0;
          centres.forEach((c, i) => {
            if (Math.abs(c - other.y) < Math.abs((centres[gi] as number) - other.y)) gi = i;
          });
          const gk = `${n.id}|${side}|${gi}`;
          const gl = gapEnds.get(gk) ?? [];
          gl.push({ edge: e, isSource, other });
          gapEnds.set(gk, gl);
          continue;
        }
      }
      const key = `${n.id}|${side}`;
      const l = ends.get(key) ?? [];
      l.push({ edge: e, isSource, other });
      ends.set(key, l);
    }
  }

  const ports = new Map<string, Point>();
  for (const [key, list] of ends) {
    const [nodeId, side] = key.split('|') as [string, Side];
    const box = boxes[nodeId] as Box;
    const horizontal = side === 'top' || side === 'bottom';
    const L = horizontal ? box.width : box.height;
    const fx = fixed.get(key) ?? [];
    list.sort((a, b) => {
      const d = (horizontal ? a.other.x - b.other.x : a.other.y - b.other.y);
      return d !== 0 ? d : a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0;
    });
    const k = list.length;
    list.forEach((end, i) => {
      let pos = (L * (i + 1)) / (k + 1);
      for (const f of fx) {
        if (Math.abs(pos - f) < FIXED_GAP) pos = pos >= f ? f + FIXED_GAP : f - FIXED_GAP;
      }
      const lo = Math.min(CORNER_GAP, L / 2);
      pos = Math.min(Math.max(pos, lo), L - lo);
      ports.set(end.edge.id + (end.isSource ? ':s' : ':t'), pointOnSide(side, pos, box));
    });
  }
  for (const [key, list] of gapEnds) {
    const [nodeId, side, gi] = key.split('|') as [string, Side, string];
    const box = boxes[nodeId] as Box;
    const r = stubs?.rows.get(nodeId) as { left: number[]; right: number[] };
    const rows = side === 'left' ? r.left : r.right;
    const ys = [box.y, ...rows, box.y + box.height];
    const lo = ys[Number(gi)] as number;
    const hi = ys[Number(gi) + 1] as number;
    const centre = (lo + hi) / 2;
    const room = Math.max(0, (hi - lo) / 2 - STUB_CLEAR - (Number(gi) === 0 || Number(gi) === rows.length ? CORNER_GAP / 2 : 0));
    list.sort((a, b) => a.other.y - b.other.y || (a.edge.id < b.edge.id ? -1 : a.edge.id > b.edge.id ? 1 : 0));
    const k = list.length;
    const pitch = k > 1 ? Math.min(GAP_PITCH, (2 * room) / (k - 1)) : 0;
    list.forEach((end, i) => {
      const y = centre + (i - (k - 1) / 2) * pitch;
      ports.set(end.edge.id + (end.isSource ? ':s' : ':t'), pointOnSide(side, y - box.y, box));
    });
  }
  return ports;
}

/** Straight polyline for an edge given the ports of its ends (either may be undefined). */
export function portPoints(
  edge: DiagramEdge,
  source: { node: DiagramNode; box: Box },
  target: { node: DiagramNode; box: Box },
  sPort: Point | undefined,
  tPort: Point | undefined,
): Point[] {
  const sShape = NODE_SHAPE[source.node.type];
  const tShape = NODE_SHAPE[target.node.type];
  if (sPort && tPort) return [sPort, tPort];
  if (sPort) return [sPort, outlineIntersection(tShape, target.box, sPort)];
  if (tPort) return [outlineIntersection(sShape, source.box, tPort), tPort];
  return routePoints(edge, source, target);
}

