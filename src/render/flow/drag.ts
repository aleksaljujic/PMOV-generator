// Owned by T48. Pure drag helpers (C08 §Additions for the grid layout); no React.
import { cardBoxes } from '../layout';
import type { DiagramGraph, Point, PositionMap } from '../graph/types';

const GRID = 10;
const MAX_NUDGE = 300;

/** Id of the owner of a node: the owner node for a pill, the node itself otherwise. */
function ownerOf(graph: DiagramGraph, id: string): string {
  const node = graph.nodes.find((n) => n.id === id);
  return node?.type === 'atribut' && node.ownerNodeId ? node.ownerNodeId : id;
}

/** The owner and all its pills (ids). */
function cardMembers(graph: DiagramGraph, ownerId: string): string[] {
  const ids = [ownerId];
  for (const n of graph.nodes) if (n.type === 'atribut' && n.ownerNodeId === ownerId) ids.push(n.id);
  return ids;
}

/**
 * Locked drag: dragging an owner or one of its pills moves the owner and all its pills by the same delta.
 * `alt` (one pill) or `!lock` move only the dragged node. Returns the new positions of every node that moved.
 */
export function applyLockedDrag(
  graph: DiagramGraph,
  positions: PositionMap,
  draggedId: string,
  to: Point,
  opts: { lock: boolean; alt: boolean },
): Record<string, Point> {
  const from = positions[draggedId];
  const dragged = graph.nodes.find((n) => n.id === draggedId);
  const single = !opts.lock || !from || !dragged || (opts.alt && dragged.type === 'atribut');
  if (single) return { [draggedId]: { x: to.x, y: to.y } };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const out: Record<string, Point> = {};
  for (const id of cardMembers(graph, ownerOf(graph, draggedId))) {
    const p = positions[id];
    if (p) out[id] = { x: p.x + dx, y: p.y + dy };
  }
  out[draggedId] = { x: to.x, y: to.y };
  return out;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * On drop: if the card of `ownerId` overlaps another card, the nearest free position on a 10 px grid
 * (spiral, at most 300 px). Returns the delta to apply to the whole card, or null if it is free already
 * or nothing free is found.
 */
export function nudgeToFree(graph: DiagramGraph, positions: PositionMap, ownerId: string): Point | null {
  const boxes = cardBoxes(graph, positions);
  const mine = boxes[ownerId];
  if (!mine) return null;
  const others = Object.entries(boxes)
    .filter(([id]) => id !== ownerId)
    .map(([, b]) => b);
  const hits = (dx: number, dy: number) => {
    const r = { ...mine, x: mine.x + dx, y: mine.y + dy };
    return others.some((o) => overlaps(r, o));
  };
  if (!hits(0, 0)) return null;
  for (let ring = 1; ring <= MAX_NUDGE / GRID; ring++) {
    const cands: Point[] = [];
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) === ring) cands.push({ x: i * GRID, y: j * GRID });
      }
    }
    cands.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y) || a.y - b.y || a.x - b.x);
    for (const c of cands) if (!hits(c.x, c.y)) return c;
  }
  return null;
}
