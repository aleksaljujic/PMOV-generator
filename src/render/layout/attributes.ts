import type { DiagramGraph, DiagramNode, PositionMap } from '../graph/types';
import { ATTR_GAP_TRIES, ATTR_PITCH_PAD } from './constants';
import { capacity, fan, fanPlan, freeLength, SIDE_ORDER, splitCounts, type Rect, type Side } from './fan';

function overlapArea(a: Rect, b: Rect, pad = 2): number {
  const ox = Math.min(a.x + a.w + pad, b.x + b.w) - Math.max(a.x - pad, b.x);
  const oy = Math.min(a.y + a.h + pad, b.y + b.h) - Math.max(a.y - pad, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
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

    // candidates: every subset of `k` sides (fewest incident core edges first), then single sides as a fallback
    const { k, two } = fanPlan(owner, attrs);
    type Cand = { sides: Side[]; rank: number };
    const subsets = (n: number): Side[][] => {
      const all: Side[][] = [];
      const rec = (start: number, cur: Side[]): void => {
        if (cur.length === n) { all.push([...cur]); return; }
        for (let q = start; q < sides.length; q++) rec(q + 1, [...cur, sides[q]!]);
      };
      rec(0, []);
      return all.sort((x, y) => x.reduce((t, z) => t + counts[z], 0) - y.reduce((t, z) => t + counts[z], 0));
    };
    const room = (p: Side[]): number => p.reduce((t, x) => t + capacity(owner, attrs, x, two), 0);
    const cands: Cand[] = subsets(k).filter((p) => room(p) >= attrs.length).map((p, r) => ({ sides: p, rank: r }));
    if (cands.length === 0) cands.push({ sides: [...SIDE_ORDER], rank: 0 });
    // fallbacks: one side, as long as it holds every pill
    sides.forEach((s, r) => { if (k > 1 && capacity(owner, attrs, s, true) >= attrs.length) cands.push({ sides: [s], rank: 100 + r }); });

    let best: { rects: Rect[]; score: number } | null = null;
    const others = [...obstacles.filter((o) => o.id !== owner.id).map((o) => o.r), ...placed];
    outer: for (const c of cands) {
      const used = SIDE_ORDER.filter((x) => c.sides.includes(x));
      const share = splitCounts(attrs.length, used.map((x) => freeLength(owner, x, counts[x])), used.map((x) => capacity(owner, attrs, x, two || used.length === 1)));
      for (const gap of ATTR_GAP_TRIES) {
        const rects: Rect[] = [];
        let from = 0;
        used.forEach((x, q) => {
          const part = attrs.slice(from, from + share[q]!);
          from += share[q]!;
          if (part.length) rects.push(...fan(orect, part, x, gap));
        });
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
