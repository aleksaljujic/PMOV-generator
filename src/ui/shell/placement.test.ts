import { describe, expect, it } from 'vitest';
import type { DiagramGraph } from '../../render/graph/types';
import { PLACE_GAP_X, PLACE_GAP_Y, computePlacements, moveKeys } from './placement';

const node = (id: string, w = 100, h = 44) => ({ id, type: 'objekat' as const, label: id, elementId: id, width: w, height: h, layoutRole: 'core' as const });
const graph: DiagramGraph = { nodes: [node('A'), node('B'), node('C'), node('S', 34, 34)], edges: [] };

describe('computePlacements', () => {
  it('places right of the anchor, vertically centred', () => {
    const r = computePlacements(graph, { A: { x: 0, y: 0 } }, [{ id: 'B', near: 'A', dir: 'right' }]);
    expect(r.B).toEqual({ x: 100 + PLACE_GAP_X, y: 0 });
  });
  it('places below, horizontally centred, and chains placements', () => {
    const r = computePlacements(graph, { A: { x: 0, y: 0 } }, [
      { id: 'S', near: 'A', dir: 'below' },
      { id: 'B', near: 'S', dir: 'below' },
    ]);
    expect(r.S).toEqual({ x: 33, y: 44 + PLACE_GAP_Y });
    expect(r.B?.y).toBe(44 + PLACE_GAP_Y + 34 + PLACE_GAP_Y);
  });
  it('moves past nodes in the way and ignores unknown anchors', () => {
    const r = computePlacements(graph, { A: { x: 0, y: 0 }, C: { x: 100 + PLACE_GAP_X, y: 0 } }, [
      { id: 'B', near: 'A', dir: 'right' },
      { id: 'S', near: 'Nema', dir: 'right' },
    ]);
    expect(r.B!.x).toBeGreaterThan(100 + PLACE_GAP_X + 100);
    expect(r.S).toBeUndefined();
  });
});

describe('moveKeys', () => {
  it('moves simultaneously', () => {
    const base = { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } };
    expect(moveKeys(base, base, [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])).toEqual({ b: { x: 1, y: 1 }, c: { x: 2, y: 2 } });
  });
});
