import { describe, expect, it } from 'vitest';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { makeStarGraph } from './__fixtures__/graph';
import { layoutDiagram, layoutDiagramSync, placeAttributes } from './index';

type Side = 'left' | 'right' | 'top' | 'bottom';

interface Fan { sides: Set<Side>; rowMax: number; maxDist: number; overlapsCore: boolean }

/** Which side of the owner each pill is on, how many pills share one row/column, and how far they are. */
function describeFan(g: DiagramGraph, pos: PositionMap, ownerId = 'Centar'): Fan {
  const owner = g.nodes.find((n) => n.id === ownerId)!;
  const o = pos[ownerId]!;
  const rows = new Map<string, number>();
  const sides = new Set<Side>();
  let maxDist = 0;
  let overlapsCore = false;
  for (const a of g.nodes.filter((n) => n.layoutRole === 'attribute' && n.ownerNodeId === ownerId)) {
    const p = pos[a.id]!;
    const dxr = p.x - (o.x + owner.width);
    const dxl = o.x - (p.x + a.width);
    const dyb = p.y - (o.y + owner.height);
    const dyt = o.y - (p.y + a.height);
    const best = Math.max(dxr, dxl, dyb, dyt);
    const side: Side = best === dxr ? 'right' : best === dxl ? 'left' : best === dyb ? 'bottom' : 'top';
    sides.add(side);
    maxDist = Math.max(maxDist, best);
    // pills in one row share the distance from the owner (within a pill size)
    const key = `${side}:${Math.round(best / 4)}`;
    rows.set(key, (rows.get(key) ?? 0) + 1);
    for (const c of g.nodes.filter((n) => n.layoutRole === 'core')) {
      const q = pos[c.id]!;
      if (p.x < q.x + c.width && q.x < p.x + a.width && p.y < q.y + c.height && q.y < p.y + a.height) overlapsCore = true;
    }
  }
  return { sides, rowMax: Math.max(0, ...rows.values()), maxDist, overlapsCore };
}

const FREE = { algorithm: 'free' as const };

describe('attribute fans', () => {
  const g = makeStarGraph(10, 17);

  it.each([
    ['sync', () => layoutDiagramSync(g, FREE)],
    ['ELK', () => layoutDiagram(g, FREE)],
  ])('17 attributes, 10 neighbours (%s): at least 3 sides, short rows, close, no core overlap', async (_n, run) => {
    const pos = await run();
    const f = describeFan(g, pos);
    expect(f.sides.size).toBeGreaterThanOrEqual(3);
    expect(f.rowMax).toBeLessThanOrEqual(6);
    expect(f.maxDist).toBeLessThanOrEqual(120);
    expect(f.overlapsCore).toBe(false);
  });

  it('puts no attributes on the side with the most core edges when another side is free', () => {
    // neighbours: 3 to the right, 1 above → attributes (few) go to a side without edges
    const star = makeStarGraph(4, 3);
    const core: PositionMap = {
      Centar: { x: 400, y: 400 },
      N0: { x: 700, y: 390 }, N1: { x: 700, y: 440 }, N2: { x: 700, y: 340 }, N3: { x: 400, y: 200 },
    };
    const attrs = placeAttributes(star, core);
    const owner = star.nodes[0]!;
    for (const a of star.nodes.filter((n) => n.layoutRole === 'attribute')) {
      const p = attrs[a.id]!;
      const right = p.x >= core.Centar!.x + owner.width;
      const top = p.y + a.height <= core.Centar!.y;
      expect(right, a.id).toBe(false);
      expect(top, a.id).toBe(false);
    }
  });

  it('edge length grows with degree: median centre distance of a degree-12 star > degree-4 star', async () => {
    const median = (s: DiagramGraph, pos: PositionMap): number => {
      const c = pos.Centar!;
      const d = s.nodes.filter((n) => n.id.startsWith('N')).map((n) => Math.hypot(pos[n.id]!.x - c.x, pos[n.id]!.y - c.y)).sort((a, b) => a - b);
      return d[Math.floor(d.length / 2)]!;
    };
    const small = makeStarGraph(4);
    const big = makeStarGraph(12);
    expect(median(big, layoutDiagramSync(big, FREE))).toBeGreaterThan(median(small, layoutDiagramSync(small, FREE)));
    expect(median(big, await layoutDiagram(big, FREE))).toBeGreaterThan(median(small, await layoutDiagram(small, FREE)));
  });

  it('is deterministic and honours saved positions', async () => {
    const saved: PositionMap = { Centar: { x: 10, y: 20 }, 'Centar.A3': { x: -7, y: 9 } };
    const a = layoutDiagramSync(g, { saved, algorithm: 'free' });
    expect(a.Centar).toEqual(saved.Centar);
    expect(a['Centar.A3']).toEqual(saved['Centar.A3']);
    expect(layoutDiagramSync(g, FREE)).toEqual(layoutDiagramSync(g, FREE));
    expect(await layoutDiagram(g, FREE)).toEqual(await layoutDiagram(g, FREE));
  });
});
