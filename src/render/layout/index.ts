// Public entry of src/render/layout — owned by T11. Contract C06 §Layout.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { placeAttributes } from './attributes';
import { EDGE_LENGTH, NODE_GAP } from './constants';
import { layoutCoreSync, prepare } from './core';
import { cardBoxes } from './card';
import { acceptable, buildGridModel, completeGrid, elkGraph, fromElk, rankLayout } from './grid';
import { postProcess } from './post';
import { edgeLength } from './stress';

export { placeAttributes, cardBoxes };

export type LayoutAlgorithm = 'grid' | 'free';

export interface LayoutOptions {
  /** Positions the user dragged (from localStorage). They override computed positions for those node ids. */
  saved?: PositionMap;
  /** 'grid' (default): ELK layered with attribute cards. 'free': the Wave 12 stress layout, unchanged. */
  algorithm?: LayoutAlgorithm;
}

function complete(graph: DiagramGraph, core: PositionMap, options?: LayoutOptions): PositionMap {
  const saved = options?.saved ?? {};
  const ids = new Set(graph.nodes.map((n) => n.id));
  const coreAll: PositionMap = { ...core };
  for (const n of graph.nodes) {
    if (n.layoutRole === 'core' && saved[n.id]) coreAll[n.id] = { ...saved[n.id]! };
  }
  const attrs = placeAttributes(graph, coreAll, saved);
  const out: PositionMap = {};
  for (const n of graph.nodes) {
    const p = saved[n.id] ?? coreAll[n.id] ?? attrs[n.id] ?? { x: 0, y: 0 };
    out[n.id] = Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : { x: 0, y: 0 };
  }
  void ids;
  return out;
}

/** ELK layered on attribute cards (chain-oriented vezas), rounded to a 10 px grid. Falls back to the rank layout. */
async function layoutGrid(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap> {
  let core: PositionMap;
  try {
    const gm = buildGridModel(graph);
    core = {};
    if (gm.m.nodes.length > 0) {
      // wrapped layers first (contract), then unwrapped; the rank layout when neither keeps the guarantees
      const elk = new ELK();
      for (const wrap of [true, false]) {
        core = fromElk(gm, await elk.layout(elkGraph(gm, wrap)));
        if (acceptable(gm, core)) break;
        core = rankLayout(gm);
      }
    }
  } catch {
    core = rankLayout(buildGridModel(graph));
  }
  return completeGrid(graph, core, options?.saved);
}

/** ELK stress (undirected 2D) on core nodes, then spec post-processing, overlap removal and attribute placement. */
async function layoutFree(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap> {
  let core: PositionMap;
  try {
    const { m, s, iw, ih } = prepare(graph);
    const elk = new ELK();
    const res = await elk.layout({
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'stress',
        'org.eclipse.elk.stress.desiredEdgeLength': String(EDGE_LENGTH),
        'elk.spacing.nodeNode': String(NODE_GAP),
        'elk.separateConnectedComponents': 'false',
      },
      children: m.nodes.map((nd, i) => ({ id: nd.id, width: iw[i]!, height: ih[i]! })),
      edges: m.edges.map(([a, b], k) => ({
        id: `e${k}`,
        sources: [m.nodes[a]!.id],
        targets: [m.nodes[b]!.id],
        layoutOptions: { 'org.eclipse.elk.stress.desiredEdgeLength': String(edgeLength(s.w, s.h, a, b, m.degree)) },
      })),
    });
    const byId = new Map((res.children ?? []).map((c) => [c.id, c]));
    m.nodes.forEach((nd, i) => {
      const c = byId.get(nd.id);
      if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) throw new Error('bad ELK result');
      s.cx[i] = (c.x as number) + iw[i]! / 2;
      s.cy[i] = (c.y as number) + ih[i]! / 2;
    });
    core = postProcess(m, s);
  } catch {
    core = layoutCoreSync(graph);
  }
  return complete(graph, core, options);
}

/** `algorithm: 'grid'` (default): ELK layered on cards. `'free'`: ELK stress, overlap removal, attribute fans. */
export function layoutDiagram(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap> {
  return options?.algorithm === 'free' ? layoutFree(graph, options) : layoutGrid(graph, options);
}

/** Same contract, no ELK: deterministic rank layout (`grid`) or stress fallback (`free`). Synchronous. */
export function layoutDiagramSync(graph: DiagramGraph, options?: LayoutOptions): PositionMap {
  if (options?.algorithm === 'free') return complete(graph, layoutCoreSync(graph), options);
  return completeGrid(graph, rankLayout(buildGridModel(graph)), options?.saved);
}
