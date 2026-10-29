import type { DiagramGraph, PositionMap } from '../graph/types';
import { LAYER_GAP, MARGIN, NODE_GAP } from './constants';
import { attrCountByOwner, inflation } from './inflate';
import { assignRanks, buildCore, type CoreModel } from './model';

/** Layered ordering step: returns the left edge (inflated box) per core node, per layer ordered. */
export type XPlacer = (m: CoreModel, rank: number[], w: number[]) => number[];

/** Shared finalisation: resolve overlaps per layer, centre specialization chains, compute y by layer. */
export function finalize(graph: DiagramGraph, m: CoreModel, rank: number[], xLeft: number[], w: number[]): PositionMap {
  const n = m.nodes.length;
  const L = rank.length === 0 ? 0 : Math.max(...rank) + 1;
  const layers: number[][] = Array.from({ length: L }, () => []);
  for (let i = 0; i < n; i++) layers[rank[i]!]!.push(i);

  const resolve = (layer: number[]): void => {
    layer.sort((a, b) => xLeft[a]! - xLeft[b]! || a - b);
    let edge = -Infinity;
    for (const i of layer) {
      if (xLeft[i]! < edge) xLeft[i] = edge;
      edge = xLeft[i]! + w[i]! + NODE_GAP;
    }
  };
  for (const layer of layers) resolve(layer);

  // Specialization: junction centred above podtipovi, S diamond above junction (same centre x).
  const center = (i: number): number => xLeft[i]! + w[i]! / 2;
  for (const g of m.groups) {
    const s = m.index.get(g.spec)!;
    const j = g.junction !== null ? m.index.get(g.junction)! : -1;
    const subs = g.subs.map((id) => m.index.get(id)!);
    if (j >= 0 && subs.length > 0) {
      const lo = Math.min(...subs.map((i) => xLeft[i]!));
      const hi = Math.max(...subs.map((i) => xLeft[i]! + w[i]!));
      xLeft[j] = (lo + hi) / 2 - w[j]! / 2;
    }
    if (j >= 0) xLeft[s] = center(j) - w[s]! / 2;
  }
  for (const layer of layers) resolve(layer);

  // y per layer: top aligned (nodes in one layer share y).
  const pos: PositionMap = {};
  const minX = n === 0 ? 0 : Math.min(...xLeft.map((x, i) => x));
  let y = MARGIN;
  const counts = attrCountByOwner(graph);
  const inflates = m.nodes.map((nd) => inflation(nd, counts.get(nd.id) ?? 0, graph));
  layers.forEach((layer) => {
    if (layer.length === 0) return;
    const topPad = Math.max(...layer.map((i) => inflates[i]!.padY));
    const hMax = Math.max(...layer.map((i) => m.nodes[i]!.height));
    for (const i of layer) {
      const nd = m.nodes[i]!;
      pos[nd.id] = { x: xLeft[i]! - minX + MARGIN + inflates[i]!.padX, y: y + topPad };
    }
    y += topPad * 2 + hMax + LAYER_GAP;
  });
  return pos;
}

/** Barycenter ordering + simple x assignment. */
export const barycenterX: XPlacer = (m, rank, w) => {
  const n = m.nodes.length;
  const L = rank.length === 0 ? 0 : Math.max(...rank) + 1;
  const layers: number[][] = Array.from({ length: L }, () => []);
  for (let i = 0; i < n; i++) layers[rank[i]!]!.push(i);
  const up: number[][] = Array.from({ length: n }, () => []);
  const down: number[][] = Array.from({ length: n }, () => []);
  for (const [s, t] of m.edges) {
    if (rank[s] === rank[t]) continue;
    const [a, b] = rank[s]! < rank[t]! ? [s, t] : [t, s];
    down[a]!.push(b);
    up[b]!.push(a);
  }
  const order = new Array<number>(n).fill(0);
  const reindex = (): void => layers.forEach((l) => l.forEach((v, k) => { order[v] = k; }));
  reindex();
  for (let sweep = 0; sweep < 6; sweep++) {
    const downward = sweep % 2 === 0;
    const seq = downward ? layers.map((_, k) => k).slice(1) : layers.map((_, k) => k).slice(0, -1).reverse();
    for (const k of seq) {
      const layer = layers[k]!;
      const nb = downward ? up : down;
      const key = (v: number): number => {
        const ns = nb[v]!;
        return ns.length === 0 ? order[v]! : ns.reduce((s, u) => s + order[u]!, 0) / ns.length;
      };
      const keys = new Map(layer.map((v) => [v, key(v)]));
      layer.sort((a, b) => keys.get(a)! - keys.get(b)! || a - b);
      layer.forEach((v, idx) => { order[v] = idx; });
    }
  }
  // initial packing, centred
  const x = new Array<number>(n).fill(0);
  const widths = layers.map((l) => l.reduce((s, v) => s + w[v]!, 0) + Math.max(0, l.length - 1) * NODE_GAP);
  const maxW = Math.max(0, ...widths);
  layers.forEach((l, k) => {
    let cx = (maxW - widths[k]!) / 2;
    for (const v of l) { x[v] = cx; cx += w[v]! + NODE_GAP; }
  });
  // relaxation towards neighbours' centres, order-preserving
  const cen = (v: number): number => x[v]! + w[v]! / 2;
  for (let sweep = 0; sweep < 6; sweep++) {
    const downward = sweep % 2 === 0;
    const seq = downward ? layers.map((_, k) => k).slice(1) : layers.map((_, k) => k).slice(0, -1).reverse();
    for (const k of seq) {
      const l = layers[k]!;
      const nb = downward ? up : down;
      const desired = l.map((v) => {
        const ns = nb[v]!;
        return ns.length === 0 ? cen(v) : ns.reduce((s, u) => s + cen(u), 0) / ns.length;
      });
      // left-to-right placement, then right-to-left correction (keeps min spacing)
      const left = l.map((v, idx) => desired[idx]! - w[v]! / 2);
      for (let idx = 1; idx < l.length; idx++) {
        const minL = left[idx - 1]! + w[l[idx - 1]!]! + NODE_GAP;
        if (left[idx]! < minL) left[idx] = minL;
      }
      // shift to reduce average displacement
      let shift = 0;
      l.forEach((v, idx) => { shift += desired[idx]! - w[v]! / 2 - left[idx]!; });
      shift /= Math.max(1, l.length);
      l.forEach((v, idx) => { x[v] = left[idx]! + shift; });
    }
  }
  return x;
};

export function layoutCoreSync(graph: DiagramGraph): PositionMap {
  const m = buildCore(graph);
  const rank = assignRanks(m);
  const counts = attrCountByOwner(graph);
  const w = m.nodes.map((nd) => nd.width + 2 * inflation(nd, counts.get(nd.id) ?? 0, graph).padX);
  const x = barycenterX(m, rank, w);
  return finalize(graph, m, rank, x, w);
}
