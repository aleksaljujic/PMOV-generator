import type { DiagramGraph, DiagramNode } from '../graph/types';
import { ATTR_GAP, ATTR_PITCH_PAD } from './constants';

export function attrCountByOwner(graph: DiagramGraph): Map<string, number> {
  const c = new Map<string, number>();
  for (const n of graph.nodes) {
    if (n.layoutRole === 'attribute' && n.ownerNodeId) c.set(n.ownerNodeId, (c.get(n.ownerNodeId) ?? 0) + 1);
  }
  return c;
}

/** Space (per side) a node's attribute fan reserves around it: horizontal padX, vertical padY. */
export function inflation(node: DiagramNode, attrCount: number, graph: DiagramGraph): { padX: number; padY: number } {
  if (attrCount === 0) return { padX: 0, padY: 0 };
  let maxW = 0;
  let maxH = 0;
  for (const a of graph.nodes) {
    if (a.layoutRole === 'attribute' && a.ownerNodeId === node.id) { maxW = Math.max(maxW, a.width); maxH = Math.max(maxH, a.height); }
  }
  const sides = attrCount > 4 ? 2 : 1;
  const perSide = Math.ceil(attrCount / sides);
  const fanH = perSide * (maxH + ATTR_PITCH_PAD);
  return { padX: ATTR_GAP + maxW, padY: Math.max(0, (fanH - node.height) / 2) };
}
