// Grid layout (C06 §Additions for the grid layout): cards on ELK `layered` (or a deterministic rank layout).
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { DiagramGraph, DiagramNode, PositionMap } from '../graph/types';
import { estimateTextWidth } from '../graph';
import { EDGE_FONT_SIZE } from '../style';
import { attributesByOwner, cardGeometry, type CardGeometry } from './card';
import { MARGIN, NODE_GAP } from './constants';
import { buildCore, type CoreModel } from './model';
import { buildItems, enforceSpec, removeOverlaps, type State } from './post';

/** Final positions of core nodes are rounded to this grid. */
export const GRID = 10;
/** Vertical gap between rows (ranks) of cards. */
export const RANK_GAP = 60;
/** A label sits at most 45 % along its edge, at least textW/2 + 10 from the source outline: edges need 2.3x that. */
const LABEL_ROOM = 2.3;
/** Slack for the rounding of both end cards to GRID. */
const ROUND_SLACK = 2 * GRID;

/** Gap between two ranks: RANK_GAP, or more when a labelled relationship edge needs the room (label rule of C06). */
export function rankGap(graph: DiagramGraph): number {
  const core = new Set(graph.nodes.filter((n) => n.layoutRole === 'core').map((n) => n.id));
  let gap = RANK_GAP;
  for (const e of graph.edges) {
    if (!e.label || !core.has(e.source) || !core.has(e.target) || e.source === e.target) continue;
    gap = Math.max(gap, Math.ceil(LABEL_ROOM * (estimateTextWidth(e.label, EDGE_FONT_SIZE) / 2 + 10)) + ROUND_SLACK);
  }
  return gap;
}
/** Width : height the layouts aim for. */
export const ASPECT = 1.6;

export interface GridModel {
  m: CoreModel;
  geo: CardGeometry[];
  /** Card size per core node (owner box plus pills). */
  cw: number[];
  ch: number[];
  /** Edges as fed to the layered layout: veza chains participant₁ → veza → participant₂. */
  edges: Array<[number, number]>;
  /** Gap between ranks (grows with the longest edge label). */
  gap: number;
}

/** Orients `m.edges` for a layered layout: the first edge of a veza points into it, all others point out of it. */
export function orientEdges(m: CoreModel): Array<[number, number]> {
  const isVeza = (i: number): boolean => m.nodes[i]!.type === 'veza';
  const seenVeza = new Set<number>();
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const [a, b] of m.edges) {
    let [s, t] = [a, b];
    if (isVeza(a) !== isVeza(b)) {
      const v = isVeza(a) ? a : b;
      const other = v === a ? b : a;
      if (m.nodes[other]!.type !== 'spec' && m.nodes[other]!.type !== 'junction') {
        const first = !seenVeza.has(v);
        seenVeza.add(v);
        [s, t] = first ? [other, v] : [v, other];
      }
    }
    const key = s < t ? `${s}:${t}` : `${t}:${s}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([s, t]);
  }
  return out;
}

export function buildGridModel(graph: DiagramGraph): GridModel {
  const m = buildCore(graph);
  const attrs = attributesByOwner(graph);
  const geo = m.nodes.map((n) => cardGeometry(n, attrs.get(n.id) ?? []));
  return {
    m, geo,
    cw: geo.map((g) => g.bounds.width),
    ch: geo.map((g) => g.bounds.height),
    edges: orientEdges(m),
    gap: rankGap(graph),
  };
}

/** Assigns the card top-left to every core node; returns owner positions rounded to GRID, minimum at MARGIN. */
export function ownerPositions(gm: GridModel, cardX: number[], cardY: number[]): PositionMap {
  const n = gm.m.nodes.length;
  if (n === 0) return {};
  const minX = Math.min(...cardX);
  const minY = Math.min(...cardY);
  const snap = (v: number): number => Math.round(v / GRID) * GRID;
  const out: PositionMap = {};
  for (let i = 0; i < n; i++) {
    const b = gm.geo[i]!.bounds;
    out[gm.m.nodes[i]!.id] = {
      x: snap(cardX[i]! - b.x - minX + MARGIN),
      y: snap(cardY[i]! - b.y - minY + MARGIN),
    };
  }
  return out;
}

/** Spec rows and overlap removal on card rectangles (ELK output, centre coordinates). */
export function legalize(gm: GridModel, cardX: number[], cardY: number[]): void {
  const n = gm.m.nodes.length;
  const zero = gm.cw.map(() => 0);
  const s: State = {
    cx: cardX.map((x, i) => x + gm.cw[i]! / 2), cy: cardY.map((y, i) => y + gm.ch[i]! / 2),
    w: gm.cw, h: gm.ch, px: zero, py: [...zero],
  };
  enforceSpec(gm.m, s);
  removeOverlaps(buildItems(gm.m), s);
  for (let i = 0; i < n; i++) { cardX[i] = s.cx[i]! - gm.cw[i]! / 2; cardY[i] = s.cy[i]! - gm.ch[i]! / 2; }
}

/** ELK `layered` input for the grid layout. */
export function elkGraph(gm: GridModel, wrap = true): ElkNode {
  const ranks = computeRanks(gm);
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(NODE_GAP),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(gm.gap),
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.aspectRatio': String(ASPECT),
      ...(wrap ? { 'elk.layered.wrapping.strategy': 'MULTI_EDGE' } : {}),
    },
    // ranks are fixed up front (veza chains and spec rows), ELK orders the cards inside them
    children: gm.m.nodes.map((nd, i) => ({
      id: nd.id, width: gm.cw[i]!, height: gm.ch[i]!,
      layoutOptions: { 'elk.layered.layering.layerChoiceConstraint': String(ranks[i]) },
    })),
    edges: gm.edges.map(([a, b], k) => ({ id: `e${k}`, sources: [gm.m.nodes[a]!.id], targets: [gm.m.nodes[b]!.id] })),
  };
}

/** Core positions from an ELK result (throws when it is unusable). */
export function fromElk(gm: GridModel, res: ElkNode): PositionMap {
  const byId = new Map((res.children ?? []).map((c) => [c.id, c]));
  const x: number[] = [];
  const y: number[] = [];
  gm.m.nodes.forEach((nd) => {
    const c = byId.get(nd.id);
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) throw new Error('bad ELK result');
    x.push(c.x as number); y.push(c.y as number);
  });
  legalize(gm, x, y);
  return ownerPositions(gm, x, y);
}

/** C06 grid guarantees ELK cannot give by itself: aspect 1:3 - 3:1 and every veza between its two participants. */
export function acceptable(gm: GridModel, pos: PositionMap): boolean {
  const n = gm.m.nodes.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const cy = (i: number): number => pos[gm.m.nodes[i]!.id]!.y + gm.m.nodes[i]!.height / 2;
  for (let i = 0; i < n; i++) {
    const p = pos[gm.m.nodes[i]!.id]!;
    const b = gm.geo[i]!.bounds;
    x0 = Math.min(x0, p.x + b.x); y0 = Math.min(y0, p.y + b.y);
    x1 = Math.max(x1, p.x + b.x + b.width); y1 = Math.max(y1, p.y + b.y + b.height);
  }
  const ratio = (x1 - x0) / (y1 - y0);
  if (ratio < 1 / 3 || ratio > 3) return false;
  for (let v = 0; v < n; v++) {
    if (gm.m.nodes[v]!.type !== 'veza') continue;
    const from = gm.edges.find(([a, b]) => b === v && gm.m.nodes[a]!.type !== 'veza');
    const to = gm.edges.find(([a, b]) => a === v && gm.m.nodes[b]!.type !== 'veza');
    if (!from || !to) continue;
    const lo = Math.min(cy(from[0]), cy(to[1]));
    const hi = Math.max(cy(from[0]), cy(to[1]));
    if (!(cy(v) > lo && cy(v) < hi)) return false;
  }
  return true;
}

// ---- deterministic rank layout (no ELK) -------------------------------------------------------------------------

/** Longest-path ranks over the oriented edges (cycles broken by DFS), spec sub rows on one rank. */
export function computeRanks(gm: GridModel): number[] {
  const n = gm.m.nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of gm.edges) adj[a]!.push(b);
  const state = new Array<number>(n).fill(0);
  const order: number[] = [];
  const dag: Array<[number, number]> = [];
  const visit = (u: number): void => {
    state[u] = 1;
    for (const v of adj[u]!) {
      if (state[v] === 1) continue; // back edge
      dag.push([u, v]);
      if (state[v] === 0) visit(v);
    }
    state[u] = 2;
    order.push(u);
  };
  for (let i = 0; i < n; i++) if (state[i] === 0) visit(i);
  const rank = new Array<number>(n).fill(0);
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of dag) out[a]!.push(b);
  const groups = gm.m.groups.map((g) => g.subs.map((id) => gm.m.index.get(id)!));
  for (let pass = 0; pass <= n + 1; pass++) {
    let changed = false;
    for (const u of [...order].reverse()) {
      for (const v of out[u]!) if (rank[v]! < rank[u]! + 1) { rank[v] = rank[u]! + 1; changed = true; }
    }
    for (const subs of groups) {
      const top = Math.max(0, ...subs.map((i) => rank[i]!));
      for (const i of subs) if (rank[i]! < top) { rank[i] = top; changed = true; }
    }
    if (!changed) break;
  }
  return rank;
}

interface Unit { members: number[]; width: number; height: number }

function lines(units: Unit[], maxW: number): Unit[][] {
  const rows: Unit[][] = [];
  let cur: Unit[] = [];
  let w = 0;
  for (const u of units) {
    const next = cur.length ? w + NODE_GAP + u.width : u.width;
    if (cur.length && next > maxW) { rows.push(cur); cur = []; w = 0; }
    w = cur.length ? w + NODE_GAP + u.width : u.width;
    cur.push(u);
  }
  if (cur.length) rows.push(cur);
  return rows;
}

/** Deterministic rank layout: one row per rank (wrapped into several rows when too wide), cards centred. */
export function rankLayout(gm: GridModel): PositionMap {
  const n = gm.m.nodes.length;
  if (n === 0) return {};
  const rank = computeRanks(gm);
  const maxRank = Math.max(...rank);
  const subGroup = new Map<number, number[]>();
  for (const g of gm.m.groups) {
    const subs = g.subs.map((id) => gm.m.index.get(id)!);
    for (const i of subs) if (!subGroup.has(i)) subGroup.set(i, subs);
  }
  const unitsByRank: Unit[][] = [];
  for (let r = 0; r <= maxRank; r++) {
    const units: Unit[] = [];
    const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      if (rank[i] !== r || used.has(i)) continue;
      const members = (subGroup.get(i) ?? [i]).filter((j) => rank[j] === r && !used.has(j));
      members.forEach((j) => used.add(j));
      units.push({
        members,
        width: members.reduce((t, j) => t + gm.cw[j]!, 0) + (members.length - 1) * NODE_GAP,
        height: Math.max(...members.map((j) => gm.ch[j]!)),
      });
    }
    unitsByRank.push(units);
  }
  const widest = Math.max(...unitsByRank.map((us) => us.reduce((t, u) => t + u.width, 0) + Math.max(0, us.length - 1) * NODE_GAP));
  const minW = Math.max(...unitsByRank.flat().map((u) => u.width));
  // pick the wrap width whose bounding box is closest to the aspect target
  const measure = (maxW: number): { w: number; h: number } => {
    let h = 0, w = 0, rows = 0;
    for (const us of unitsByRank) {
      for (const row of lines(us, maxW)) {
        w = Math.max(w, row.reduce((t, u) => t + u.width, 0) + (row.length - 1) * NODE_GAP);
        h += Math.max(...row.map((u) => u.height));
        rows++;
      }
    }
    return { w, h: h + Math.max(0, rows - 1) * gm.gap };
  };
  let best = { maxW: Math.max(minW, widest), score: Infinity };
  for (let c = minW; ; c = Math.min(widest, Math.ceil(c * 1.15))) {
    const { w, h } = measure(c);
    const score = Math.abs(Math.log(w / h / ASPECT));
    if (score < best.score - 1e-9) best = { maxW: c, score };
    if (c >= widest) break;
  }
  const rows: Unit[][] = unitsByRank.flatMap((us) => lines(us, best.maxW));
  const total = Math.max(...rows.map((row) => row.reduce((t, u) => t + u.width, 0) + (row.length - 1) * NODE_GAP));
  const x = new Array<number>(n).fill(0);
  const y = new Array<number>(n).fill(0);
  let top = 0;
  for (const row of rows) {
    let cx = (total - (row.reduce((t, u) => t + u.width, 0) + (row.length - 1) * NODE_GAP)) / 2;
    for (const u of row) {
      let mx = cx;
      for (const j of u.members) { x[j] = mx; y[j] = top; mx += gm.cw[j]! + NODE_GAP; }
      cx += u.width + NODE_GAP;
    }
    top += Math.max(...row.map((u) => u.height)) + gm.gap;
  }
  return ownerPositions(gm, x, y);
}

/** Adds the pills (card offsets, or saved positions) and applies saved core positions. */
export function completeGrid(graph: DiagramGraph, core: PositionMap, saved: PositionMap = {}): PositionMap {
  const coreAll: PositionMap = { ...core };
  for (const n of graph.nodes) if (n.layoutRole === 'core' && saved[n.id]) coreAll[n.id] = { ...saved[n.id]! };
  const attrs = attributesByOwner(graph);
  const byId = new Map<string, DiagramNode>(graph.nodes.map((n) => [n.id, n]));
  const out: PositionMap = {};
  for (const n of graph.nodes) {
    let p = saved[n.id] ?? coreAll[n.id];
    if (!p && n.layoutRole === 'attribute' && n.ownerNodeId) {
      const owner = byId.get(n.ownerNodeId);
      const op = coreAll[n.ownerNodeId];
      if (owner && op) {
        const o = cardGeometry(owner, attrs.get(owner.id) ?? []).offsets[n.id];
        if (o) p = { x: op.x + o.x, y: op.y + o.y };
      }
    }
    p ??= { x: 0, y: 0 };
    out[n.id] = Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }
  return out;
}
