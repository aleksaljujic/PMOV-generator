import { describe, expect, it } from 'vitest';
import type { PositionMap } from '../graph/types';
import { checkLayout, checkSpec } from './__fixtures__/checks';
import { makeFixtureGraph } from './__fixtures__/graph';
import { layoutDiagram, layoutDiagramSync, placeAttributes } from './index';

describe('layout (fixture)', () => {
  const g = makeFixtureGraph();

  it('layoutDiagramSync returns a plain object', () => {
    const r = layoutDiagramSync(g);
    expect(r).not.toBeInstanceOf(Promise);
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
    checkLayout(g, r);
  });

  it('layoutDiagram (ELK) positions everything without overlaps', async () => {
    const r = await layoutDiagram(g);
    checkLayout(g, r);
  });

  it('specialization row constraints, both functions', async () => {
    checkSpec(g, layoutDiagramSync(g));
    checkSpec(g, await layoutDiagram(g));
  });

  it('saved positions are honoured exactly', async () => {
    const saved: PositionMap = { Radnik: { x: 1234, y: 567 }, 'Radnik.Mlb': { x: -50, y: 12.5 } };
    for (const r of [layoutDiagramSync(g, { saved }), await layoutDiagram(g, { saved })]) {
      expect(r.Radnik).toEqual(saved.Radnik);
      expect(r['Radnik.Mlb']).toEqual(saved['Radnik.Mlb']);
    }
  });

  it('is deterministic', async () => {
    expect(layoutDiagramSync(g)).toEqual(layoutDiagramSync(g));
    expect(await layoutDiagram(g)).toEqual(await layoutDiagram(g));
  });

  it('placeAttributes returns attribute positions only, 30-50px from the owner when free', () => {
    const core = layoutDiagramSync(g);
    const attrs = placeAttributes(g, core);
    const attrNodes = g.nodes.filter((n) => n.layoutRole === 'attribute');
    expect(Object.keys(attrs).sort()).toEqual(attrNodes.map((n) => n.id).sort());
    const u = g.nodes.find((n) => n.id === 'Usamljen')!;
    const a = g.nodes.find((n) => n.id === 'Usamljen.X')!;
    const up = core.Usamljen!;
    const ap = attrs['Usamljen.X']!;
    const dx = Math.max(up.x - (ap.x + a.width), ap.x - (up.x + u.width), 0);
    const dy = Math.max(up.y - (ap.y + a.height), ap.y - (up.y + u.height), 0);
    const dist = Math.max(dx, dy);
    expect(dist).toBeGreaterThanOrEqual(30);
    expect(dist).toBeLessThanOrEqual(50);
  });

  it('empty graph', async () => {
    expect(layoutDiagramSync({ nodes: [], edges: [] })).toEqual({});
    expect(await layoutDiagram({ nodes: [], edges: [] })).toEqual({});
  });
});
