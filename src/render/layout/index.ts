// Public entry of src/render/layout — owned by T11. Contract C06 §Layout.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { placeAttributes } from './attributes';
import { NODE_GAP } from './constants';
import { attrCountByOwner, inflation } from './inflate';
import { finalize, layoutCoreSync } from './layered';
import { assignRanks, buildCore } from './model';

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

/** ELK (layered, DOWN, orthogonal) on core nodes, then attribute placement. */
export async function layoutDiagram(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap> {
  const m = buildCore(graph);
  let core: PositionMap;
  try {
    const rank = assignRanks(m);
    const counts = attrCountByOwner(graph);
    const infl = m.nodes.map((nd) => inflation(nd, counts.get(nd.id) ?? 0, graph));
    const w = m.nodes.map((nd, i) => nd.width + 2 * infl[i]!.padX);
    const elk = new ELK();
    const res = await elk.layout({
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': String(NODE_GAP),
        'elk.layered.spacing.nodeNodeBetweenLayers': '90',
        'elk.separateConnectedComponents': 'false',
        'elk.partitioning.activate': 'true',
      },
      children: m.nodes.map((nd, i) => ({
        id: nd.id,
        width: w[i]!,
        height: nd.height + 2 * infl[i]!.padY,
        layoutOptions: { 'elk.partitioning.partition': String(rank[i]!) },
      })),
      edges: m.edges.map(([s, t], k) => ({ id: `e${k}`, sources: [m.nodes[s]!.id], targets: [m.nodes[t]!.id] })),
    });
    const x = m.nodes.map((nd, i) => {
      const c = res.children?.find((ch) => ch.id === nd.id);
      return Number.isFinite(c?.x) ? (c!.x as number) : i * 200;
    });
    core = finalize(graph, m, rank, x, w);
  } catch {
    core = layoutCoreSync(graph);
  }
  return complete(graph, core, options);
}

/** Same contract, no ELK: deterministic layered fallback. Synchronous. */
export function layoutDiagramSync(graph: DiagramGraph, options?: LayoutOptions): PositionMap {
  return complete(graph, layoutCoreSync(graph), options);
}
