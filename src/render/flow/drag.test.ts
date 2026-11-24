import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_GRAPH } from './__fixtures__/graph';
import type { PositionMap } from '../graph/types';

const boxes = vi.hoisted(() => ({ value: {} as Record<string, { x: number; y: number; width: number; height: number }> }));
vi.mock('../layout', () => ({ cardBoxes: vi.fn(() => boxes.value) }));

import { applyLockedDrag, nudgeToFree } from './drag';

const pos: PositionMap = {
  Radnik: { x: 100, y: 100 },
  'attr:Radnik:Mlb': { x: 20, y: 110 },
  Odeljenje: { x: 400, y: 100 },
  Radi: { x: 250, y: 100 },
};

describe('applyLockedDrag', () => {
  const to = { x: 130, y: 90 };
  it('owner drag moves owner and pills by the same delta', () => {
    const r = applyLockedDrag(FIXTURE_GRAPH, pos, 'Radnik', to, { lock: true, alt: false });
    expect(r).toEqual({ Radnik: to, 'attr:Radnik:Mlb': { x: 50, y: 100 } });
  });
  it('pill drag while locked moves the whole card', () => {
    const r = applyLockedDrag(FIXTURE_GRAPH, pos, 'attr:Radnik:Mlb', { x: 30, y: 110 }, { lock: true, alt: false });
    expect(r).toEqual({ Radnik: { x: 110, y: 100 }, 'attr:Radnik:Mlb': { x: 30, y: 110 } });
  });
  it('alt moves only the pill', () => {
    const r = applyLockedDrag(FIXTURE_GRAPH, pos, 'attr:Radnik:Mlb', { x: 30, y: 110 }, { lock: true, alt: true });
    expect(r).toEqual({ 'attr:Radnik:Mlb': { x: 30, y: 110 } });
  });
  it('lock off moves only the dragged node', () => {
    const r = applyLockedDrag(FIXTURE_GRAPH, pos, 'Radnik', to, { lock: false, alt: false });
    expect(r).toEqual({ Radnik: to });
  });
  it('a veza moves alone', () => {
    const r = applyLockedDrag(FIXTURE_GRAPH, pos, 'Radi', { x: 260, y: 100 }, { lock: true, alt: false });
    expect(r).toEqual({ Radi: { x: 260, y: 100 } });
  });
});

describe('nudgeToFree', () => {
  it('returns null when free', () => {
    boxes.value = { A: { x: 0, y: 0, width: 100, height: 50 }, B: { x: 200, y: 0, width: 100, height: 50 } };
    expect(nudgeToFree(FIXTURE_GRAPH, pos, 'A')).toBeNull();
  });
  it('returns a grid delta to a free spot', () => {
    boxes.value = { A: { x: 0, y: 0, width: 100, height: 50 }, B: { x: 50, y: 0, width: 100, height: 50 } };
    const d = nudgeToFree(FIXTURE_GRAPH, pos, 'A');
    expect(d).not.toBeNull();
    expect(d!.x % 10 === 0 && d!.y % 10 === 0).toBe(true);
    expect(Math.max(Math.abs(d!.x), Math.abs(d!.y))).toBeLessThanOrEqual(300);
    const a = { x: d!.x, y: d!.y, width: 100, height: 50 };
    expect(a.x < 150 && 50 < a.x + 100 && a.y < 50 && 0 < a.y + 50).toBe(false);
  });
  it('returns null when nothing free within 300 px', () => {
    boxes.value = { A: { x: 0, y: 0, width: 100, height: 50 }, B: { x: -1000, y: -1000, width: 3000, height: 3000 } };
    expect(nudgeToFree(FIXTURE_GRAPH, pos, 'A')).toBeNull();
  });
});
