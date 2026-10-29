import { describe, expect, it } from 'vitest';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { makeFixtureGraph } from './__fixtures__/graph';
import { layoutDiagram, layoutDiagramSync, placeAttributes } from './index';

export function checkLayout(graph: DiagramGraph, pos: PositionMap): void {
  for (const n of graph.nodes) {
    const p = pos[n.id];
    expect(p, n.id).toBeDefined();
    expect(Number.isFinite(p!.x) && Number.isFinite(p!.y), n.id).toBe(true);
  }
  const box = (id: string) => {
    const n = graph.nodes.find((x) => x.id === id)!;
    return { x: pos[id]!.x, y: pos[id]!.y, w: n.width, h: n.height };
  };
  const hit = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const cores = graph.nodes.filter((n) => n.layoutRole === 'core');
  const attrs = graph.nodes.filter((n) => n.layoutRole === 'attribute');
  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      expect(hit(box(cores[i]!.id), box(cores[j]!.id)), `${cores[i]!.id} x ${cores[j]!.id}`).toBe(false);
    }
    for (const a of attrs) expect(hit(box(cores[i]!.id), box(a.id)), `${cores[i]!.id} x ${a.id}`).toBe(false);
  }
}

export function checkSpec(graph: DiagramGraph, pos: PositionMap): void {
  const specs = graph.nodes.filter((n) => n.type === 'spec');
  expect(specs.length).toBeGreaterThan(0);
  for (const s of specs) {
    const j = graph.nodes.find((n) => n.type === 'junction' && n.elementId === s.elementId)!;
    const subs = graph.edges.filter((e) => e.source === j.id).map((e) => e.target);
    const sup = graph.edges.find((e) => e.target === s.id)?.source;
    const ys = new Set(subs.map((id) => pos[id]!.y));
    expect(ys.size).toBe(1);
    expect([...ys][0]!).toBeGreaterThan(pos[j.id]!.y);
    expect(pos[j.id]!.y).toBeGreaterThan(pos[s.id]!.y);
    if (sup) expect(pos[s.id]!.y).toBeGreaterThan(pos[sup]!.y);
  }
}

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
