import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { compile } from '../../lang';
import { buildDiagramGraph } from '../graph';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { estimateTextWidth } from '../graph';
import { EDGE_FONT_SIZE } from '../style';
import { checkSpec } from './__fixtures__/checks';
import { makeFixtureGraph, makeStarGraph } from './__fixtures__/graph';
import { cardBoxes, layoutDiagram, layoutDiagramSync } from './index';

const hit = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Every grid guarantee of C06 §Additions for the grid layout. */
function checkGrid(g: DiagramGraph, pos: PositionMap): void {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  for (const n of g.nodes) {
    const p = pos[n.id];
    expect(p, n.id).toBeDefined();
    expect(Number.isFinite(p!.x) && Number.isFinite(p!.y), n.id).toBe(true);
  }
  const cores = g.nodes.filter((n) => n.layoutRole === 'core');
  for (const n of cores) {
    expect(pos[n.id]!.x % 10, `${n.id} x`).toBe(0);
    expect(pos[n.id]!.y % 10, `${n.id} y`).toBe(0);
  }
  const cards = cardBoxes(g, pos);
  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      expect(hit(cards[cores[i]!.id]!, cards[cores[j]!.id]!), `${cores[i]!.id} x ${cores[j]!.id}`).toBe(false);
    }
  }
  for (const a of g.nodes.filter((n) => n.layoutRole === 'attribute')) {
    const o = byId.get(a.ownerNodeId!)!;
    const op = pos[o.id]!;
    const p = pos[a.id]!;
    const cy = p.y + a.height / 2;
    expect(cy, `${a.id} centre y`).toBeGreaterThanOrEqual(op.y);
    expect(cy, `${a.id} centre y`).toBeLessThanOrEqual(op.y + o.height);
    expect(p.x + a.width <= op.x || p.x >= op.x + o.width, `${a.id} beside the box`).toBe(true);
  }
  // veza between its first two (different) participants
  const coreIds = new Set(cores.map((n) => n.id));
  const cy = (id: string): number => pos[id]!.y + byId.get(id)!.height / 2;
  for (const v of cores.filter((n) => n.type === 'veza')) {
    const parts: string[] = [];
    for (const e of g.edges) {
      if (!coreIds.has(e.source) || !coreIds.has(e.target) || (e.source !== v.id && e.target !== v.id)) continue;
      const o = e.source === v.id ? e.target : e.source;
      if (o !== v.id && !parts.includes(o)) parts.push(o);
    }
    if (parts.length < 2) continue;
    const ys = [cy(parts[0]!), cy(parts[1]!)];
    expect(cy(v.id), v.id).toBeGreaterThan(Math.min(...ys));
    expect(cy(v.id), v.id).toBeLessThan(Math.max(...ys));
  }
  // labelled edges between vertically separated boxes have room for their label (label rule of C06)
  for (const e of g.edges) {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!e.label || !a || !b || a.layoutRole !== 'core' || b.layoutRole !== 'core' || a === b) continue;
    const pa = pos[a.id]!, pb = pos[b.id]!;
    const gap = Math.max(pb.y - (pa.y + a.height), pa.y - (pb.y + b.height));
    if (gap <= 0) continue;
    if (a.type === 'spec' || b.type === 'spec' || a.type === 'junction' || b.type === 'junction') continue;
    expect(gap, `${e.id} label room`).toBeGreaterThanOrEqual(2.3 * (estimateTextWidth(e.label, EDGE_FONT_SIZE) / 2 + 10));
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of Object.values(cards)) {
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.width); y1 = Math.max(y1, c.y + c.height);
  }
  const ratio = (x1 - x0) / (y1 - y0);
  expect(ratio).toBeGreaterThanOrEqual(1 / 3);
  expect(ratio).toBeLessThanOrEqual(3);
}

const cases: Array<[string, DiagramGraph]> = [
  ...EXAMPLES.map((ex): [string, DiagramGraph] => [ex.id, buildDiagramGraph(compile(ex.source).ir!)]),
  ['star 17 attributes, 10 vezas', makeStarGraph(10, 17)],
];

describe.each(cases)('grid layout: %s', (_name, g) => {
  const hasSpec = g.nodes.some((n) => n.type === 'spec');

  it('sync: guarantees hold', () => {
    const r = layoutDiagramSync(g);
    checkGrid(g, r);
    if (hasSpec) checkSpec(g, r);
  });

  it('ELK: guarantees hold', async () => {
    const r = await layoutDiagram(g);
    checkGrid(g, r);
    if (hasSpec) checkSpec(g, r);
  });

  it('is deterministic', async () => {
    expect(layoutDiagramSync(g)).toEqual(layoutDiagramSync(g));
    expect(await layoutDiagram(g)).toEqual(await layoutDiagram(g));
  });
});

describe('grid layout (fixture graph)', () => {
  const g = makeFixtureGraph();

  it('guarantees hold, sync and ELK', async () => {
    checkGrid(g, layoutDiagramSync(g));
    checkGrid(g, await layoutDiagram(g));
    checkSpec(g, layoutDiagramSync(g));
    checkSpec(g, await layoutDiagram(g));
  });

  it('pills are at 90 degrees: left column then right column, identifiers first', () => {
    const r = layoutDiagramSync(g);
    const o = r.Radnik!;
    const w = g.nodes.find((n) => n.id === 'Radnik')!.width;
    // Radnik: Mlb# first → left; 4 attributes → 2 left (Mlb, ImeR), 2 right (Adresa, Starost)
    expect(r['Radnik.Mlb']!.x).toBeLessThan(o.x);
    expect(r['Radnik.ImeR']!.x).toBeLessThan(o.x);
    expect(r['Radnik.Adresa']!.x).toBeGreaterThanOrEqual(o.x + w + 24);
    expect(r['Radnik.Starost']!.x).toBeGreaterThanOrEqual(o.x + w + 24);
    expect(r['Radnik.Mlb']!.y).toBeLessThan(r['Radnik.ImeR']!.y);
  });

  it('saved owner moves its unsaved pills; saved pills stay', async () => {
    const base = layoutDiagramSync(g);
    const saved: PositionMap = { Radnik: { x: 1230, y: 560 }, 'Radnik.Adresa': { x: -5, y: 7 } };
    for (const r of [layoutDiagramSync(g, { saved }), await layoutDiagram(g, { saved })]) {
      expect(r.Radnik).toEqual(saved.Radnik);
      expect(r['Radnik.Adresa']).toEqual(saved['Radnik.Adresa']);
      const b = layoutDiagramSync(g);
      void b;
      const moved = r['Radnik.Mlb']!;
      const o = layoutDiagramSync(g, { saved: { Radnik: base.Radnik! } });
      expect(moved.x - r.Radnik!.x).toBe(o['Radnik.Mlb']!.x - o.Radnik!.x);
      expect(moved.y - r.Radnik!.y).toBe(o['Radnik.Mlb']!.y - o.Radnik!.y);
    }
  });

  it('cardBoxes is the bounding box of the owner and its pills', () => {
    const r = layoutDiagramSync(g);
    const cards = cardBoxes(g, r);
    const o = g.nodes.find((n) => n.id === 'Radnik')!;
    const items = [o, ...g.nodes.filter((n) => n.ownerNodeId === 'Radnik')];
    const x0 = Math.min(...items.map((n) => r[n.id]!.x));
    const y0 = Math.min(...items.map((n) => r[n.id]!.y));
    const x1 = Math.max(...items.map((n) => r[n.id]!.x + n.width));
    const y1 = Math.max(...items.map((n) => r[n.id]!.y + n.height));
    expect(cards.Radnik).toEqual({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  });

  it('staggered columns for more than 6 rows per side keep pills apart', () => {
    const star = makeStarGraph(2, 17);
    const r = layoutDiagramSync(star);
    const pills = star.nodes.filter((n) => n.layoutRole === 'attribute');
    for (let i = 0; i < pills.length; i++) {
      for (let j = i + 1; j < pills.length; j++) {
        const a = pills[i]!, b = pills[j]!;
        const ra = { ...r[a.id]!, width: a.width, height: a.height };
        const rb = { ...r[b.id]!, width: b.width, height: b.height };
        expect(hit(ra, rb), `${a.id} x ${b.id}`).toBe(false);
      }
    }
  });
});
