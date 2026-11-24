// Attribute cards (C06 §Additions for the grid layout): an owner box with its pills at 90° in left / right columns.
import { ATTR_ROW_PITCH } from '../graph';
import type { DiagramGraph, DiagramNode, PositionMap } from '../graph/types';

/** Horizontal stub between the owner box and the (inner) pill column. */
export const ATTR_STUB = 24;
/** Most rows in one straight column; more rows on a side → two staggered columns. */
const MAX_ROWS = 6;
/** Vertical pitch between consecutive rows of a staggered side. */
const STAGGER_PITCH = ATTR_ROW_PITCH / 2;

export interface Rect { x: number; y: number; width: number; height: number }

export interface CardGeometry {
  /** Pill offsets (top-left) relative to the owner's top-left corner. */
  offsets: Record<string, { x: number; y: number }>;
  /** Bounding box of the owner and its pills, relative to the owner's top-left corner. */
  bounds: Rect;
}

/** The attributes of an owner in card order: identifiers first, then source order. */
export function cardAttributes(attrs: DiagramNode[]): DiagramNode[] {
  return [...attrs.filter((a) => a.isIdentifier), ...attrs.filter((a) => !a.isIdentifier)];
}

function side(
  pills: DiagramNode[], owner: DiagramNode, dir: -1 | 1, out: Record<string, { x: number; y: number }>,
): void {
  const m = pills.length;
  if (m === 0) return;
  const stagger = m > MAX_ROWS;
  const pitch = stagger ? STAGGER_PITCH : ATTR_ROW_PITCH;
  const inner = pills.filter((_, i) => !stagger || i % 2 === 0);
  const innerMax = Math.max(0, ...inner.map((p) => p.width));
  pills.forEach((p, i) => {
    const cy = owner.height / 2 + (i - (m - 1) / 2) * pitch;
    const outer = stagger && i % 2 === 1;
    const shift = outer ? innerMax + ATTR_STUB : 0;
    const x = dir < 0 ? -ATTR_STUB - shift - p.width : owner.width + ATTR_STUB + shift;
    out[p.id] = { x, y: Math.round(cy - p.height / 2) };
  });
}

/** Pill offsets and card bounds for one owner. `attrs` are the owner's attribute nodes in source order. */
export function cardGeometry(owner: DiagramNode, attrs: DiagramNode[]): CardGeometry {
  const offsets: Record<string, { x: number; y: number }> = {};
  const ordered = cardAttributes(attrs);
  const nLeft = Math.ceil(ordered.length / 2);
  side(ordered.slice(0, nLeft), owner, -1, offsets);
  side(ordered.slice(nLeft), owner, 1, offsets);
  let x0 = 0, y0 = 0, x1 = owner.width, y1 = owner.height;
  for (const a of attrs) {
    const o = offsets[a.id]!;
    x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y);
    x1 = Math.max(x1, o.x + a.width); y1 = Math.max(y1, o.y + a.height);
  }
  return { offsets, bounds: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
}

/** Attribute nodes by owner id, in graph order. */
export function attributesByOwner(graph: DiagramGraph): Map<string, DiagramNode[]> {
  const m = new Map<string, DiagramNode[]>();
  for (const n of graph.nodes) {
    if (n.layoutRole === 'attribute' && n.ownerNodeId) m.set(n.ownerNodeId, [...(m.get(n.ownerNodeId) ?? []), n]);
  }
  return m;
}

/** Card rectangles (owner box + pills at the given positions) by core node id. */
export function cardBoxes(graph: DiagramGraph, positions: PositionMap): Record<string, Rect> {
  const attrs = attributesByOwner(graph);
  const out: Record<string, Rect> = {};
  for (const n of graph.nodes) {
    if (n.layoutRole !== 'core') continue;
    const p = positions[n.id];
    if (!p) continue;
    let x0 = p.x, y0 = p.y, x1 = p.x + n.width, y1 = p.y + n.height;
    for (const a of attrs.get(n.id) ?? []) {
      const q = positions[a.id];
      if (!q) continue;
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x + a.width); y1 = Math.max(y1, q.y + a.height);
    }
    out[n.id] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }
  return out;
}
