// Public entry of src/render/layout — owned by T11. Contract C06 §Layout.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { placeAttributes } from './attributes';
import { EDGE_LENGTH, NODE_GAP } from './constants';
import { layoutCoreSync, prepare } from './core';
import { postProcess } from './post';

export { placeAttributes };

export interface LayoutOptions {
  /** Positions the user dragged (from localStorage). They override computed positions for those node ids. */
  saved?: PositionMap;
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

/** ELK stress (undirected 2D) on core nodes, then spec post-processing, overlap removal and attribute placement. */
export async function layoutDiagram(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap> {
  let core: PositionMap;
  try {
    const { m, s, iw, ih } = prepare(graph);
    const mean = iw.length ? iw.reduce((t, v, i) => t + Math.hypot(v, ih[i]!), 0) / iw.length : 0;
    const desired = Math.min(480, Math.max(EDGE_LENGTH, mean * 1.0));
    const elk = new ELK();
    const res = await elk.layout({
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'stress',
        'org.eclipse.elk.stress.desiredEdgeLength': String(desired),
        'elk.spacing.nodeNode': String(NODE_GAP),
        'elk.separateConnectedComponents': 'false',
      },
      children: m.nodes.map((nd, i) => ({ id: nd.id, width: iw[i]!, height: ih[i]! })),
      edges: m.edges.map(([a, b], k) => ({ id: `e${k}`, sources: [m.nodes[a]!.id], targets: [m.nodes[b]!.id] })),
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

/** Same contract, no ELK: deterministic layered fallback. Synchronous. */
export function layoutDiagramSync(graph: DiagramGraph, options?: LayoutOptions): PositionMap {
  return complete(graph, layoutCoreSync(graph), options);
}
