import type { DiagramGraph, DiagramNode, PositionMap } from '../graph/types';
import { ATTR_GAP_TRIES, ATTR_PITCH_PAD } from './constants';

type Side = 'right' | 'left' | 'bottom' | 'top';
const SIDE_ORDER: Side[] = ['right', 'left', 'bottom', 'top'];

interface Rect { x: number; y: number; w: number; h: number }

function overlapArea(a: Rect, b: Rect, pad = 2): number {
  const ox = Math.min(a.x + a.w + pad, b.x + b.w) - Math.max(a.x - pad, b.x);
  const oy = Math.min(a.y + a.h + pad, b.y + b.h) - Math.max(a.y - pad, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

function fan(owner: Rect, attrs: DiagramNode[], side: Side, gap: number): Rect[] {
  const cx = owner.x + owner.w / 2;
  const cy = owner.y + owner.h / 2;
  const out: Rect[] = [];
  if (side === 'left' || side === 'right') {
    const pitch = Math.max(...attrs.map((a) => a.height)) + ATTR_PITCH_PAD;
    const total = (attrs.length - 1) * pitch;
    attrs.forEach((a, i) => {
      const y = cy - total / 2 + i * pitch - a.height / 2;
      const x = side === 'right' ? owner.x + owner.w + gap : owner.x - gap - a.width;
      out.push({ x, y, w: a.width, h: a.height });
    });
  } else {
    const pitch = Math.max(...attrs.map((a) => a.width)) + ATTR_PITCH_PAD;
    const total = (attrs.length - 1) * pitch;
    attrs.forEach((a, i) => {
      const x = cx - total / 2 + i * pitch - a.width / 2;
      const y = side === 'bottom' ? owner.y + owner.h + gap : owner.y - gap - a.height;
      out.push({ x, y, w: a.width, h: a.height });
    });
  }
  return out;
}

/** Places every attribute node around its owner. Returns positions for attribute nodes only. */
export function placeAttributes(graph: DiagramGraph, core: PositionMap, saved: PositionMap = {}): PositionMap {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const rectOf = (id: string, p: { x: number; y: number }): Rect => {
    const n = byId.get(id)!;
    return { x: p.x, y: p.y, w: n.width, h: n.height };
  };
  const obstacles: Array<{ id: string; r: Rect }> = [];
  for (const n of graph.nodes) {
    if (n.layoutRole !== 'core') continue;
    const p = core[n.id];
    if (p) obstacles.push({ id: n.id, r: rectOf(n.id, p) });
  }
  const result: PositionMap = {};
  const placed: Rect[] = [];
  // saved attributes are obstacles and keep their positions
  for (const n of graph.nodes) {
    if (n.layoutRole === 'attribute' && saved[n.id]) {
      result[n.id] = { ...saved[n.id]! };
      placed.push(rectOf(n.id, saved[n.id]!));
    }
  }

  const attrsByOwner = new Map<string, DiagramNode[]>();
  for (const n of graph.nodes) {
    if (n.layoutRole !== 'attribute' || !n.ownerNodeId || saved[n.id]) continue;
    const l = attrsByOwner.get(n.ownerNodeId) ?? [];
    l.push(n);
    attrsByOwner.set(n.ownerNodeId, l);
  }

  for (const owner of graph.nodes) {
    const attrs = attrsByOwner.get(owner.id);
    if (!attrs || attrs.length === 0) continue;
    const op = core[owner.id] ?? saved[owner.id];
    if (!op) continue;
    const orect = rectOf(owner.id, op);
    const ocx = orect.x + orect.w / 2;
    const ocy = orect.y + orect.h / 2;

    // incident edge directions
    const counts: Record<Side, number> = { right: 0, left: 0, bottom: 0, top: 0 };
    for (const e of graph.edges) {
      if (e.source === e.target && e.source === owner.id) {
        if (e.route === 'loopTop') counts.top++;
        else if (e.route === 'loopBottom') counts.bottom++;
        continue;
      }
      const other = e.source === owner.id ? e.target : e.target === owner.id ? e.source : null;
      if (other === null) continue;
      const on = byId.get(other);
      if (!on || on.layoutRole !== 'core') continue;
      const q = core[other] ?? saved[other];
      if (!q) continue;
      const dx = q.x + on.width / 2 - ocx;
      const dy = q.y + on.height / 2 - ocy;
      const side: Side = Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? 'bottom' : 'top') : dx >= 0 ? 'right' : 'left';
      counts[side]++;
    }
    const sides = [...SIDE_ORDER].sort((a, b) => counts[a] - counts[b] || SIDE_ORDER.indexOf(a) - SIDE_ORDER.indexOf(b));

    // candidate assignments: single side, or the two best sides when many attributes
    type Cand = { sides: Side[]; rank: number };
    const cands: Cand[] = [];
    if (attrs.length > 4) {
      // pairs ordered by total edge count
      const pairs: Side[][] = [];
      for (let i = 0; i < sides.length; i++) for (let j = i + 1; j < sides.length; j++) pairs.push([sides[i]!, sides[j]!]);
      pairs.forEach((p, k) => cands.push({ sides: p, rank: k }));
    }
    sides.forEach((s, k) => cands.push({ sides: [s], rank: 100 + k }));

    let best: { rects: Rect[]; score: number } | null = null;
    const others = [...obstacles.filter((o) => o.id !== owner.id).map((o) => o.r), ...placed];
    outer: for (const c of cands) {
      for (const gap of ATTR_GAP_TRIES) {
        const rects: Rect[] = [];
        if (c.sides.length === 1) rects.push(...fan(orect, attrs, c.sides[0]!, gap));
        else {
          const half = Math.ceil(attrs.length / 2);
          rects.push(...fan(orect, attrs.slice(0, half), c.sides[0]!, gap), ...fan(orect, attrs.slice(half), c.sides[1]!, gap));
        }
        let score = 0;
        for (const r of rects) for (const o of others) score += overlapArea(r, o);
        score += c.sides.reduce((s, x) => s + counts[x], 0) * 0.01 + c.rank * 0.001 + gap * 0.0001;
        if (!best || score < best.score) best = { rects, score };
        if (score < 1) break outer;
      }
    }
    if (best) {
      const ordered = best.rects;
      attrs.forEach((a, i) => {
        const r = ordered[i]!;
        result[a.id] = { x: r.x, y: r.y };
        placed.push(r);
      });
    }
  }
  return result;
}

export { ATTR_PITCH_PAD };
