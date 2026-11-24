// computeDiagramGeometry (T40, C06 §Additions for busy nodes): ports + collision-checked labels for the whole graph.
import type { DiagramGraph, DiagramNode } from '../graph/types';
import { estimateTextWidth } from '../graph';
import { EDGE_FONT_SIZE } from '../style';
import { finishGeometry, labelAt, routePoints } from './base';
import type { Box, EdgeGeometry, LabelPos } from './base';
import type { Point } from '../graph/types';
import { computePorts, gapCentres, portPoints } from './ports';
import { findStubs, isRectNode } from './stubs';
import type { StubInfo } from './stubs';

const FRACTIONS = [0.18, 0.28, 0.38];
// Fallbacks when all primary candidates collide: further along the line, then pushed further off it.
const EXTRA_FRACTIONS = [0.48, 0.58];
const EXTRA_GAPS = [0, 8, 16];

function labelBox(l: LabelPos, textW: number): Box {
  const h = EDGE_FONT_SIZE + 2;
  const x = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - textW : l.x - textW / 2;
  return { x, y: l.y - h / 2, width: textW, height: h };
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const STUB_CLASH = 8;

/** Moves a loop / bus end that lies on a left / right side within STUB_CLASH of a stub to the nearest stub gap.
 *  `i` is the end point, `j` its neighbour; a horizontal first segment (same y) stays horizontal. */
function dodgeStub(points: Point[], i: number, j: number, node: DiagramNode, box: Box, stubs: StubInfo): void {
  const r = stubs.rows.get(node.id);
  const p = points[i];
  const q = points[j];
  if (!r || !p || !isRectNode(node)) return;
  const rows = Math.abs(p.x - box.x) < 0.5 ? r.left : Math.abs(p.x - box.x - box.width) < 0.5 ? r.right : [];
  if (!rows.some((y) => Math.abs(y - p.y) < STUB_CLASH)) return;
  let best = p.y;
  let bestD = Infinity;
  for (const c of gapCentres(rows, box)) {
    if (Math.abs(c - p.y) < bestD) {
      best = c;
      bestD = Math.abs(c - p.y);
    }
  }
  const horizontal = q !== undefined && q.y === p.y;
  p.y = best;
  if (horizontal && q) q.y = best;
}

export function computeDiagramGeometry(graph: DiagramGraph, boxes: Record<string, Box>): Record<string, EdgeGeometry> {
  const nodes = new Map<string, DiagramNode>(graph.nodes.map((n) => [n.id, n]));
  const stubs = findStubs(graph.edges, nodes, boxes);
  const ports = computePorts(graph.edges, nodes, boxes, stubs);
  const obstacles: Box[] = [];
  for (const n of graph.nodes) {
    const b = boxes[n.id];
    if (b) obstacles.push(b);
  }

  const out: Record<string, EdgeGeometry> = {};
  for (const e of graph.edges) {
    const sn = nodes.get(e.source);
    const tn = nodes.get(e.target);
    const sb = boxes[e.source];
    const tb = boxes[e.target];
    if (!sn || !tn || !sb || !tb) continue;
    const source = { node: sn, box: sb };
    const target = { node: tn, box: tb };
    const points = stubs.points.get(e.id)?.map((p) => ({ ...p })) ?? (e.route === 'straight' && e.source !== e.target
      ? portPoints(e, source, target, ports.get(`${e.id}:s`), ports.get(`${e.id}:t`))
      : routePoints(e, source, target));
    if (e.route !== 'straight' && !stubs.points.has(e.id) && stubs.rows.size > 0) {
      dodgeStub(points, 0, 1, sn, sb, stubs);
      dodgeStub(points, points.length - 1, points.length - 2, tn, tb, stubs);
    }

    let label: EdgeGeometry['label'] = null;
    if (e.label) {
      const textW = estimateTextWidth(e.label, EDGE_FONT_SIZE);
      let best: LabelPos | null = null;
      let bestBox: Box | null = null;
      let bestArea = Infinity;
      const tryCand = (f: number, flip: boolean, gap: number, maxF: number): boolean => {
        const cand = labelAt(points, e.label as string, sb, f, flip, gap, maxF);
        const cb = labelBox(cand, textW);
        let area = 0;
        for (const o of obstacles) area += overlapArea(cb, o);
        if (area < bestArea) {
          best = cand;
          bestBox = cb;
          bestArea = area;
        }
        return area === 0;
      };
      search: {
        for (const f of FRACTIONS) for (const flip of [false, true]) if (tryCand(f, flip, 0, 0.45)) break search;
        for (const gap of EXTRA_GAPS) {
          for (const f of [...(gap === 0 ? [] : FRACTIONS), ...EXTRA_FRACTIONS]) {
            for (const flip of [false, true]) if (tryCand(f, flip, gap, 0.6)) break search;
          }
        }
      }
      label = best;
      if (bestBox) obstacles.push(bestBox);
    }
    const { path, arrow } = finishGeometry(e, points);
    out[e.id] = { points, path, label, arrow };
  }
  return out;
}
