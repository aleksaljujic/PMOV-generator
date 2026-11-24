import type { DiagramNode } from '../graph/types';
import { ATTR_GAP, ATTR_PITCH_PAD } from './constants';

export type Side = 'right' | 'left' | 'bottom' | 'top';
/** Preference order of sides when nothing else decides. */
export const SIDE_ORDER: Side[] = ['right', 'left', 'bottom', 'top'];
/** Most pills in one straight row (or column); more than this → two staggered rows. */
export const MAX_ROW = 6;
/** Extra distance between the two rows of a staggered fan. */
const ROW_GAP = 6;

export interface Rect { x: number; y: number; w: number; h: number }

/** How far (px) the end of a straight fan along a top/bottom side may stick out beyond the owner box. */
const REACH = 100;

/** Pills that fit in one straight row on `side`: MAX_ROW, fewer on a short top/bottom side with wide pills. */
export function rowCapacity(owner: { width: number; height: number }, attrs: DiagramNode[], side: Side): number {
  if (side === 'left' || side === 'right') return MAX_ROW;
  const maxW = Math.max(...attrs.map((a) => a.width));
  const fit = Math.floor((owner.width + 2 * REACH - maxW) / (maxW + ATTR_PITCH_PAD)) + 1;
  return Math.max(1, Math.min(MAX_ROW, fit));
}

/** Capacity of a side: a single row, or two staggered rows (twice as many pills in the same length). */
export function capacity(owner: { width: number; height: number }, attrs: DiagramNode[], side: Side, two: boolean): number {
  return rowCapacity(owner, attrs, side) * (two ? 2 : 1);
}

/**
 * How many sides a fan uses (1 to 4, in SIDE_ORDER) and whether it needs two staggered rows. Few pills go on one
 * side; otherwise the smallest number of sides whose single rows hold all pills; if even four sides do not, all four
 * with two rows each.
 */
export function fanPlan(owner: { width: number; height: number }, attrs: DiagramNode[]): { k: number; two: boolean } {
  const n = attrs.length;
  if (n <= 4) return { k: 1, two: false };
  let sum = 0;
  for (let k = 1; k <= SIDE_ORDER.length; k++) {
    sum += rowCapacity(owner, attrs, SIDE_ORDER[k - 1]!);
    if (k >= 2 && sum >= n) return { k, two: false };
  }
  return { k: SIDE_ORDER.length, two: true };
}

/**
 * Splits `n` pills over sides in proportion to `weights` (free side lengths), no side above its `caps` entry.
 * Deterministic: ties go to the earlier side. If the caps cannot hold everything the rest goes to the first side.
 */
export function splitCounts(n: number, weights: number[], caps: number[]): number[] {
  const k = weights.length;
  const out = new Array<number>(k).fill(0);
  let left = n;
  const open = new Set(weights.map((_, i) => i).filter((i) => caps[i]! > 0));
  while (left > 0 && open.size > 0) {
    const sum = [...open].reduce((t, i) => t + Math.max(weights[i]!, 1e-6), 0);
    const share = new Map<number, number>();
    for (const i of open) share.set(i, (left * Math.max(weights[i]!, 1e-6)) / sum);
    const add = new Map<number, number>();
    let given = 0;
    for (const i of open) { const a = Math.min(Math.floor(share.get(i)!), caps[i]! - out[i]!); add.set(i, a); given += a; }
    const byRemainder = [...open].sort((a, b) => (share.get(b)! - Math.floor(share.get(b)!)) - (share.get(a)! - Math.floor(share.get(a)!)) || a - b);
    for (const i of byRemainder) {
      if (given >= left) break;
      if (out[i]! + add.get(i)! < caps[i]!) { add.set(i, add.get(i)! + 1); given++; }
    }
    if (given === 0) break;
    for (const i of open) { out[i]! += add.get(i)!; if (out[i]! >= caps[i]!) open.delete(i); }
    left -= given;
  }
  if (left > 0) out[0]! += left;
  return out;
}

/** Extent of `m` pills along the side (axis) and across it (away from the owner). */
function extents(m: number, pillAlong: number, pillAcross: number, two: boolean): { along: number; across: number } {
  const pitch = pillAlong + ATTR_PITCH_PAD;
  if (!two) return { along: m * pitch, across: pillAcross };
  return { along: ((m - 1) / 2 + 1) * pitch, across: 2 * pillAcross + ROW_GAP };
}

/** Pill rectangles of one side's fan. More than MAX_ROW pills: two staggered rows / columns. */
export function fan(owner: Rect, attrs: DiagramNode[], side: Side, gap: number): Rect[] {
  const cx = owner.x + owner.w / 2;
  const cy = owner.y + owner.h / 2;
  const horizontal = side === 'left' || side === 'right';
  const maxAlong = Math.max(...attrs.map((a) => (horizontal ? a.height : a.width)));
  const maxAcross = Math.max(...attrs.map((a) => (horizontal ? a.width : a.height)));
  const two = attrs.length > rowCapacity({ width: owner.w, height: owner.h }, attrs, side);
  const step = (maxAlong + ATTR_PITCH_PAD) / (two ? 2 : 1);
  const total = (attrs.length - 1) * step;
  return attrs.map((a, i) => {
    const row = two ? i % 2 : 0;
    const off = gap + row * (maxAcross + ROW_GAP);
    const along = (horizontal ? cy : cx) - total / 2 + i * step;
    if (horizontal) {
      const x = side === 'right' ? owner.x + owner.w + off : owner.x - off - a.width;
      return { x, y: along - a.height / 2, w: a.width, h: a.height };
    }
    const y = side === 'bottom' ? owner.y + owner.h + off : owner.y - off - a.height;
    return { x: along - a.width / 2, y, w: a.width, h: a.height };
  });
}

/** Free length of a side: its length shared by the core edges that leave through it. */
export function freeLength(owner: { width: number; height: number }, side: Side, edges: number): number {
  return (side === 'left' || side === 'right' ? owner.height : owner.width) / (1 + edges);
}

/**
 * Space (per side of the owner) the fan reserves: the first `sideCount` sides in SIDE_ORDER, split in proportion to
 * their length. Horizontal padX, vertical padY (symmetric around the box).
 */
export function fanPadding(owner: DiagramNode, attrs: DiagramNode[]): { padX: number; padY: number } {
  if (attrs.length === 0) return { padX: 0, padY: 0 };
  const maxW = Math.max(...attrs.map((a) => a.width));
  const maxH = Math.max(...attrs.map((a) => a.height));
  const plan = fanPlan(owner, attrs);
  const sides = SIDE_ORDER.slice(0, plan.k);
  const counts = splitCounts(attrs.length, sides.map((s) => freeLength(owner, s, 0)), sides.map((s) => capacity(owner, attrs, s, plan.two)));
  let padX = 0;
  let padY = 0;
  sides.forEach((s, i) => {
    const m = counts[i]!;
    if (m === 0) return;
    if (s === 'left' || s === 'right') {
      const e = extents(m, maxH, maxW, m > rowCapacity(owner, attrs, s));
      padX = Math.max(padX, ATTR_GAP + e.across);
      padY = Math.max(padY, (e.along - owner.height) / 2);
    } else {
      const e = extents(m, maxW, maxH, m > rowCapacity(owner, attrs, s));
      padY = Math.max(padY, ATTR_GAP + e.across);
      padX = Math.max(padX, (e.along - owner.width) / 2);
    }
  });
  return { padX, padY };
}
