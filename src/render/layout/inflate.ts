import type { DiagramGraph, DiagramNode } from '../graph/types';
import { fanPadding } from './fan';

export function attrCountByOwner(graph: DiagramGraph): Map<string, number> {
  const c = new Map<string, number>();
  for (const n of graph.nodes) {
    if (n.layoutRole === 'attribute' && n.ownerNodeId) c.set(n.ownerNodeId, (c.get(n.ownerNodeId) ?? 0) + 1);
  }
  return c;
}

/** Space (per side) the attribute fan of a node reserves around it: horizontal padX, vertical padY. */
export function inflation(node: DiagramNode, attrCount: number, graph: DiagramGraph): { padX: number; padY: number } {
  if (attrCount === 0) return { padX: 0, padY: 0 };
  const attrs = graph.nodes.filter((a) => a.layoutRole === 'attribute' && a.ownerNodeId === node.id);
  return fanPadding(node, attrs);
}
