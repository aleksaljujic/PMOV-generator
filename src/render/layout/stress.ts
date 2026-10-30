import type { CoreModel } from './model';
import { EDGE_LENGTH } from './constants';

export interface Vec { x: number[]; y: number[] }

/** Desired center distance between neighbours i,j given inflated sizes. */
export function edgeLength(w: number[], h: number[], i: number, j: number): number {
  const r = (k: number): number => Math.hypot(w[k]! / 2, h[k]! / 2) * 0.75;
  return Math.max(EDGE_LENGTH, r(i) + r(j) + 50);
}

/** All-pairs weighted shortest paths (Floyd-Warshall); disconnected pairs get a large finite distance. */
export function distances(m: CoreModel, w: number[], h: number[]): number[][] {
  const n = m.nodes.length;
  const INF = Infinity;
  const d: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
  for (const [a, b] of m.edges) {
    const L = edgeLength(w, h, a, b);
    if (L < d[a]![b]!) { d[a]![b] = L; d[b]![a] = L; }
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
    const dik = d[i]![k]!;
    if (dik === INF) continue;
    for (let j = 0; j < n; j++) {
      const v = dik + d[k]![j]!;
      if (v < d[i]![j]!) d[i]![j] = v;
    }
  }
  let mx = 0;
  for (const row of d) for (const v of row) if (v !== INF && v > mx) mx = v;
  for (const row of d) for (let j = 0; j < n; j++) if (row[j] === INF) row[j] = mx + EDGE_LENGTH * 2;
  return d;
}

/** Deterministic init: BFS rings around the highest-degree node. */
function init(m: CoreModel, d: number[][]): Vec {
  const n = m.nodes.length;
  const deg = new Array<number>(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of m.edges) { deg[a]!++; deg[b]!++; adj[a]!.push(b); adj[b]!.push(a); }
  let root = 0;
  for (let i = 1; i < n; i++) if (deg[i]! > deg[root]!) root = i;
  const depth = new Array<number>(n).fill(-1);
  const order: number[] = [];
  const bfs = (s: number, base: number): void => {
    depth[s] = base;
    const q = [s];
    while (q.length) {
      const v = q.shift()!;
      order.push(v);
      for (const u of adj[v]!) if (depth[u] === -1) { depth[u] = depth[v]! + 1; q.push(u); }
    }
  };
  bfs(root, 0);
  for (let i = 0; i < n; i++) if (depth[i] === -1) {
    const md = Math.max(...depth);
    bfs(i, md + 1);
  }
  const byDepth = new Map<number, number[]>();
  for (const v of order) byDepth.set(depth[v]!, [...(byDepth.get(depth[v]!) ?? []), v]);
  const x = new Array<number>(n).fill(0);
  const y = new Array<number>(n).fill(0);
  for (const [dp, list] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
    if (dp === 0 && list.length === 1) continue;
    const radius = dp * EDGE_LENGTH * 1.2 + (dp === 0 ? 0 : 0);
    list.forEach((v, k) => {
      const ang = (2 * Math.PI * (k + 0.5 * (dp % 2))) / list.length;
      x[v] = radius * Math.cos(ang);
      y[v] = radius * Math.sin(ang);
    });
  }
  void d;
  return { x, y };
}

/** Stress majorization (localized SMACOF), fixed iteration count, no randomness. Returns centers. */
export function stressLayout(m: CoreModel, w: number[], h: number[], iterations = 120): Vec {
  const n = m.nodes.length;
  if (n === 0) return { x: [], y: [] };
  const d = distances(m, w, h);
  const p = init(m, d);
  if (n === 1) return { x: [0], y: [0] };
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0, sw = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dij = d[i]![j]!;
        const wij = 1 / (dij * dij);
        let dx = p.x[i]! - p.x[j]!;
        let dy = p.y[i]! - p.y[j]!;
        let len = Math.hypot(dx, dy);
        if (len < 1e-6) { dx = 1e-3 * ((i + j) % 7 - 3); dy = 1e-3 * ((i * j) % 5 - 2); len = Math.hypot(dx, dy) || 1e-3; }
        sx += wij * (p.x[j]! + (dij * dx) / len);
        sy += wij * (p.y[j]! + (dij * dy) / len);
        sw += wij;
      }
      p.x[i] = sx / sw;
      p.y[i] = sy / sw;
    }
  }
  return p;
}
