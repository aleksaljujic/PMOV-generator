// Converts builder `placeAt` hints into saved node positions (T13, contract C09). Pure; no React.
import type { Placement } from '../../builder';
import type { DiagramGraph, PositionMap } from '../../render/graph/types';

export const PLACE_GAP_X = 90;
export const PLACE_GAP_Y = 70;
const MARGIN = 14;

interface Box { x: number; y: number; w: number; h: number }

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w + MARGIN && b.x < a.x + a.w + MARGIN && a.y < b.y + b.h + MARGIN && b.y < a.y + a.h + MARGIN;

/**
 * Position for every placement whose anchor has a known position. New nodes go to the right of / below their anchor
 * (centred on the other axis) and are pushed further along that direction until they overlap nothing.
 * `positions` are the current top-left positions of existing nodes (saved + on screen).
 */
export function computePlacements(graph: DiagramGraph, positions: PositionMap, placements: Placement[]): PositionMap {
  const size = new Map(graph.nodes.map((n) => [n.id, { w: n.width, h: n.height }]));
  const boxes = new Map<string, Box>();
  for (const [id, p] of Object.entries(positions)) {
    const s = size.get(id);
    if (s) boxes.set(id, { x: p.x, y: p.y, w: s.w, h: s.h });
  }
  const out: PositionMap = {};
  for (const pl of placements) {
    const anchor = boxes.get(pl.near);
    const s = size.get(pl.id);
    if (!anchor || !s) continue;
    let x = pl.dir === 'right' ? anchor.x + anchor.w + PLACE_GAP_X : anchor.x + (anchor.w - s.w) / 2;
    let y = pl.dir === 'right' ? anchor.y + (anchor.h - s.h) / 2 : anchor.y + anchor.h + PLACE_GAP_Y;
    for (let i = 0; i < 60; i++) {
      const me: Box = { x, y, w: s.w, h: s.h };
      let hit: Box | null = null;
      for (const [id, b] of boxes) {
        if (id !== pl.id && overlaps(me, b)) {
          hit = b;
          break;
        }
      }
      if (!hit) break;
      if (pl.dir === 'right') x = hit.x + hit.w + MARGIN * 2;
      else y = hit.y + hit.h + MARGIN * 2;
    }
    boxes.set(pl.id, { x, y, w: s.w, h: s.h });
    out[pl.id] = { x, y };
  }
  return out;
}

/** Moves saved positions from old node ids to new ones (simultaneously, so chains like a→b, b→c work). */
export function moveKeys(saved: PositionMap, base: PositionMap, renames: { from: string; to: string }[]): PositionMap {
  const next = { ...saved };
  for (const r of renames) delete next[r.from];
  for (const r of renames) {
    const p = base[r.from];
    if (p) next[r.to] = p;
  }
  return next;
}
