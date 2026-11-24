import type { PositionMap } from '../graph/types';
import { MARGIN, NODE_GAP, SPEC_GAP } from './constants';
import type { CoreModel } from './model';

/** Layout state in center coordinates. w,h = actual node size; px,py = attribute padding per side. */
export interface State {
  cx: number[];
  cy: number[];
  w: number[];
  h: number[];
  px: number[];
  py: number[];
}

const top = (s: State, i: number): number => s.cy[i]! - s.h[i]! / 2;
const bottom = (s: State, i: number): number => s.cy[i]! + s.h[i]! / 2;

/** Specialization: supertype above S above junction above one centred row of podtipovi. Only moves things down/sideways. */
export function enforceSpec(m: CoreModel, s: State): void {
  const groups = m.groups.map((g) => ({
    sp: m.index.get(g.spec)!,
    j: g.junction !== null ? m.index.get(g.junction)! : -1,
    subs: g.subs.map((id) => m.index.get(id)!),
    sups: g.supers.map((id) => m.index.get(id)!),
  }));
  for (let pass = 0; pass < groups.length + 2; pass++) {
    for (const g of groups) {
      if (g.j < 0 || g.subs.length === 0) continue;
      // podtip row: separate horizontally (sorted by x), keep centre
      const subs = [...g.subs].sort((a, b) => s.cx[a]! - s.cx[b]! || a - b);
      const inflW = (i: number): number => s.w[i]! + 2 * s.px[i]!;
      const total = subs.reduce((t, i) => t + inflW(i), 0) + (subs.length - 1) * NODE_GAP;
      const mid = subs.reduce((t, i) => t + s.cx[i]!, 0) / subs.length;
      let x = mid - total / 2;
      for (const i of subs) { s.cx[i] = x + inflW(i) / 2; x += inflW(i) + NODE_GAP; }
      const cx = mid;
      s.cx[g.j] = cx;
      s.cx[g.sp] = cx;
      const maxPy = Math.max(...subs.map((i) => s.py[i]!));
      // required row top from supertype(s) and meanwhile current positions
      let rowTop = Math.max(...subs.map((i) => top(s, i)));
      const supBottom = g.sups.length ? Math.max(...g.sups.map((i) => bottom(s, i) + s.py[i]!)) : -Infinity;
      const chain = s.h[g.sp]! + s.h[g.j]! + 3 * SPEC_GAP + maxPy;
      rowTop = Math.max(rowTop, supBottom + chain);
      for (const i of subs) s.cy[i] = rowTop + s.h[i]! / 2;
      const jTop = rowTop - maxPy - SPEC_GAP - s.h[g.j]!;
      s.cy[g.j] = jTop + s.h[g.j]! / 2;
      const sTop = jTop - SPEC_GAP - s.h[g.sp]!;
      s.cy[g.sp] = sTop + s.h[g.sp]! / 2;
    }
  }
}

/** Rigid items: spec blocks (supertypes + S + junction + podtipovi, merged when sharing members) and singletons. */
export function buildItems(m: CoreModel): number[][] {
  const n = m.nodes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  for (const g of m.groups) {
    const members = [g.spec, ...(g.junction ? [g.junction] : []), ...g.supers, ...g.subs].map((id) => m.index.get(id)!);
    for (const a of members) parent[find(a)] = find(members[0]!);
  }
  const map = new Map<number, number[]>();
  for (let i = 0; i < n; i++) map.set(find(i), [...(map.get(find(i)) ?? []), i]);
  return [...map.values()];
}

/** Iterative minimal-displacement separation of inflated boxes (+ NODE_GAP); blocks move as units. */
export function removeOverlaps(items: number[][], s: State): void {
  const n = s.cx.length;
  const itemOf = new Array<number>(n).fill(0);
  items.forEach((it, k) => it.forEach((i) => { itemOf[i] = k; }));
  const dx = new Array<number>(items.length).fill(0);
  const dy = new Array<number>(items.length).fill(0);
  for (let pass = 0; pass < 600; pass++) {
    dx.fill(0); dy.fill(0);
    let any = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = itemOf[i]!, b = itemOf[j]!;
        if (a === b) continue;
        const ox = (s.w[i]! + s.w[j]!) / 2 + s.px[i]! + s.px[j]! + NODE_GAP - Math.abs(s.cx[i]! - s.cx[j]!);
        const oy = (s.h[i]! + s.h[j]!) / 2 + s.py[i]! + s.py[j]! + NODE_GAP - Math.abs(s.cy[i]! - s.cy[j]!);
        if (ox <= 0 || oy <= 0) continue;
        any = true;
        const ca = items[a]!.length > 1 ? 0.5 : 0.5;
        if (ox <= oy) {
          const sg = s.cx[i]! === s.cx[j]! ? (i < j ? -1 : 1) : Math.sign(s.cx[i]! - s.cx[j]!);
          dx[a]! += sg * ox * ca; dx[b]! -= sg * ox * ca;
        } else {
          const sg = s.cy[i]! === s.cy[j]! ? (i < j ? -1 : 1) : Math.sign(s.cy[i]! - s.cy[j]!);
          dy[a]! += sg * oy * ca; dy[b]! -= sg * oy * ca;
        }
      }
    }
    if (!any) break;
    items.forEach((it, k) => it.forEach((i) => { s.cx[i]! += dx[k]! * 1.02; s.cy[i]! += dy[k]! * 1.02; }));
  }
}

/**
 * Moves every free-standing veza to the free spot (inflated boxes + NODE_GAP) nearest to the centre of its
 * participants, searched on a 10 px grid around that centre. Keeps relationships of busy nodes (large attribute
 * fans, stretched edges) close to their participants. Only moves when it gains at least 20 px.
 */
export function pullVeza(m: CoreModel, s: State, items: number[][]): void {
  const n = m.nodes.length;
  const single = new Set(items.filter((it) => it.length === 1).map((it) => it[0]!));
  const nbrs: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (const [a, b] of m.edges) { nbrs[a]!.add(b); nbrs[b]!.add(a); }
  const free = (i: number, x: number, y: number): boolean => {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const ox = (s.w[i]! + s.w[j]!) / 2 + s.px[i]! + s.px[j]! + NODE_GAP - Math.abs(x - s.cx[j]!);
      const oy = (s.h[i]! + s.h[j]!) / 2 + s.py[i]! + s.py[j]! + NODE_GAP - Math.abs(y - s.cy[j]!);
      if (ox > 1e-6 && oy > 1e-6) return false;
    }
    return true;
  };
  const STEP = 10;
  for (let k = 0; k < 2 * n; k++) {
    const i = k % n;
    if (m.nodes[i]!.type !== 'veza' || !single.has(i) || nbrs[i]!.size === 0) continue;
    const parts = [...nbrs[i]!];
    const tx = parts.reduce((t, j) => t + s.cx[j]!, 0) / parts.length;
    const ty = parts.reduce((t, j) => t + s.cy[j]!, 0) / parts.length;
    const here = Math.hypot(tx - s.cx[i]!, ty - s.cy[i]!);
    const reach = Math.min(here, 400);
    let best = { d: here - 20, x: s.cx[i]!, y: s.cy[i]!, moved: false };
    for (let gy = -reach; gy <= reach; gy += STEP) {
      for (let gx = -reach; gx <= reach; gx += STEP) {
        const x = tx + gx;
        const y = ty + gy;
        const d = Math.hypot(gx, gy);
        if (d >= best.d || !free(i, x, y)) continue;
        best = { d, x, y, moved: true };
      }
    }
    if (best.moved) { s.cx[i] = best.x; s.cy[i] = best.y; }
  }
}

/** Shift so the inflated bounding box starts at MARGIN and return top-left positions. */
export function toPositions(m: CoreModel, s: State): PositionMap {
  const n = m.nodes.length;
  if (n === 0) return {};
  let minX = Infinity, minY = Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, s.cx[i]! - s.w[i]! / 2 - s.px[i]!);
    minY = Math.min(minY, s.cy[i]! - s.h[i]! / 2 - s.py[i]!);
  }
  const out: PositionMap = {};
  for (let i = 0; i < n; i++) {
    out[m.nodes[i]!.id] = { x: s.cx[i]! - s.w[i]! / 2 - minX + MARGIN, y: s.cy[i]! - s.h[i]! / 2 - minY + MARGIN };
  }
  return out;
}

/** Shared post-processing for both layout paths. */
export function postProcess(m: CoreModel, s: State): PositionMap {
  enforceSpec(m, s);
  const items = buildItems(m);
  removeOverlaps(items, s);
  pullVeza(m, s, items);
  return toPositions(m, s);
}
