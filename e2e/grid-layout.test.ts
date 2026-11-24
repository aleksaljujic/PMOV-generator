// T50: acceptance of the grid layout, cards, locked drag and the JSON round trip (contracts C05 C06 C08 C13).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { compile } from '../src/lang';
import { buildDiagramGraph, estimateTextWidth } from '../src/render/graph';
import type { DiagramGraph, PositionMap } from '../src/render/graph';
import { cardBoxes, layoutDiagram, type LayoutAlgorithm } from '../src/render/layout';
import { boxOf, computeDiagramGeometry } from '../src/render/geometry';
import { applyLockedDrag, nudgeToFree } from '../src/render/flow';
import { graphToSvg } from '../src/render/svg';
import { exportDiagramJson, parseDiagramJson } from '../src/interchange';

type R = { x: number; y: number; w: number; h: number };
const ov = (a: R, b: R) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function synthetic(): string {
  const attrs = Array.from({ length: 17 }, (_, i) => (i === 0 ? 'Id#' : `Polje${i}`)).join(', ');
  const lines = [`objekat Centar { ${attrs} }`];
  for (let i = 1; i <= 10; i++) lines.push(`objekat Obj${i} { Sif${i}#, Naziv${i} }`);
  for (let i = 1; i <= 10; i++) {
    lines.push(`veza Veza${i} {\n  Centar (0,M) Ima${i}\n  Obj${i} (1,1) Pripada${i}\n}`);
  }
  return lines.join('\n');
}

const cases = [
  ...EXAMPLES.map((e) => ({ name: e.id, source: e.source })),
  { name: 'synthetic-17x10', source: synthetic() },
];

interface Metrics {
  labels: number; labelLabel: number; labelCore: number; labelPill: number; close: number;
  cardOverlaps: number; slanted: number; betweenFail: string[]; hits: string[];
}

async function measure(source: string, algorithm: LayoutAlgorithm) {
  const { ir } = compile(source);
  expect(ir).not.toBeNull();
  const g = buildDiagramGraph(ir!);
  const pos = await layoutDiagram(g, { algorithm });
  const boxes = Object.fromEntries(g.nodes.map((n) => [n.id, boxOf(n, pos[n.id]!)]));
  const geo = computeDiagramGeometry(g, boxes);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const m: Metrics = { labels: 0, labelLabel: 0, labelCore: 0, labelPill: 0, close: 0, cardOverlaps: 0, slanted: 0, betweenFail: [], hits: [] };

  const cards = Object.entries(cardBoxes(g, pos));
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i]![1], b = cards[j]![1];
      if (ov({ x: a.x, y: a.y, w: a.width, h: a.height }, { x: b.x, y: b.y, w: b.width, h: b.height }) > 1) {
        m.cardOverlaps++; m.hits.push(`cards ${cards[i]![0]} x ${cards[j]![0]}`);
      }
    }

  const labels: { e: string; r: R }[] = [];
  const ends: { node: string; edge: string; x: number; y: number }[] = [];
  for (const e of g.edges) {
    const x = geo[e.id]!;
    const t = byId.get(e.target)!, s = byId.get(e.source)!;
    if (t.type === 'atribut' || s.type === 'atribut') {
      const a = x.points[0]!, b = x.points[x.points.length - 1]!;
      if (Math.abs(a.y - b.y) > 0.5) { m.slanted++; m.hits.push(`slanted stub ${e.id}`); }
    }
    if (x.label && e.label) {
      const w = estimateTextWidth(e.label, 12);
      const lx = x.label.anchor === 'start' ? x.label.x : x.label.anchor === 'end' ? x.label.x - w : x.label.x - w / 2;
      labels.push({ e: `${e.id} "${e.label}"`, r: { x: lx, y: x.label.y - 7, w, h: 14 } });
    }
    const first = x.points[0]!, last = x.points[x.points.length - 1]!;
    for (const [n, p] of [[e.source, first], [e.target, last]] as const) {
      const t2 = byId.get(n)!.type;
      if (t2 !== 'spec' && t2 !== 'junction') ends.push({ node: n, edge: e.id, x: p.x, y: p.y });
    }
  }
  m.labels = labels.length;
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++)
      if (ov(labels[i]!.r, labels[j]!.r) > 1) { m.labelLabel++; m.hits.push(`label ${labels[i]!.e} x label ${labels[j]!.e}`); }
  for (const l of labels)
    for (const n of g.nodes) {
      const b = boxes[n.id]!;
      if (ov(l.r, { x: b.x, y: b.y, w: b.width, h: b.height }) <= 1) continue;
      if (n.type === 'atribut') { m.labelPill++; m.hits.push(`label ${l.e} x pill ${n.id}`); }
      else { m.labelCore++; m.hits.push(`label ${l.e} x ${n.type} ${n.id}`); }
    }
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i]!, b = ends[j]!;
      if (a.node === b.node && a.edge !== b.edge && Math.hypot(a.x - b.x, a.y - b.y) < 8) {
        m.close++; m.hits.push(`close endpoints ${a.edge}/${b.edge} on ${a.node}`);
      }
    }

  // veza between its two (different) participants
  for (const v of g.nodes.filter((n) => n.type === 'veza')) {
    const parts = new Set<string>();
    for (const e of g.edges) {
      if (e.source === v.id && byId.get(e.target)!.type !== 'atribut') parts.add(e.target);
      if (e.target === v.id && byId.get(e.source)!.type !== 'atribut') parts.add(e.source);
    }
    if (parts.size !== 2) continue;
    const [p, q] = [...parts].map((id) => boxes[id]!);
    const c = boxes[v.id]!;
    const cy = c.y + c.height / 2, cx = c.x + c.width / 2;
    const py = p!.y + p!.height / 2, qy = q!.y + q!.height / 2;
    const px = p!.x + p!.width / 2, qx = q!.x + q!.width / 2;
    const inY = cy >= Math.min(py, qy) && cy <= Math.max(py, qy);
    const inX = cx >= Math.min(px, qx) && cx <= Math.max(px, qx);
    if (!inY && !inX) m.betweenFail.push(`${v.id} (${v.label}) cy=${cy} vs ${py}/${qy}, cx=${cx} vs ${px}/${qx}`);
  }
  return { g, pos, m };
}

describe('grid layout acceptance', () => {
  for (const c of cases) {
    describe(c.name, () => {
      it('grid: every metric is 0', async () => {
        const { m } = await measure(c.source, 'grid');
        console.log(`[grid] ${c.name}: ${JSON.stringify({ ...m, hits: undefined, betweenFail: m.betweenFail.length })}`);
        expect(m.hits).toEqual([]);
        expect(m.labelLabel).toBe(0);
        expect(m.labelCore).toBe(0);
        expect(m.labelPill).toBe(0);
        expect(m.close).toBe(0);
        expect(m.cardOverlaps).toBe(0);
        expect(m.slanted).toBe(0);
        expect(m.betweenFail).toEqual([]);
      }, 60_000);

      it('free: metrics printed for the log', async () => {
        const { m } = await measure(c.source, 'free');
        console.log(`[free] ${c.name}: ${JSON.stringify({ ...m, hits: undefined, betweenFail: m.betweenFail.length })}`);
      }, 60_000);
    });
  }
});

describe('locked drag, nudge and JSON round trip (proizvodnja)', async () => {
  const src = EXAMPLES.find((e) => e.id === 'proizvodnja')!.source;
  const { ir } = compile(src);
  const g: DiagramGraph = buildDiagramGraph(ir!);
  const pos: PositionMap = await layoutDiagram(g, { algorithm: 'grid' });
  const owner = g.nodes.find((n) => n.type === 'objekat' && n.label === 'RadniNalog')!;
  const pills = g.nodes.filter((n) => n.type === 'atribut' && n.ownerNodeId === owner.id);

  it('RadniNalog has pills', () => expect(pills.length).toBeGreaterThan(0));

  it('locked drag moves the owner and all pills by the same delta', () => {
    const to = { x: pos[owner.id]!.x + 130, y: pos[owner.id]!.y - 70 };
    const r = applyLockedDrag(g, pos, owner.id, to, { lock: true, alt: false });
    expect(Object.keys(r).sort()).toEqual([owner.id, ...pills.map((p) => p.id)].sort());
    for (const id of Object.keys(r)) {
      expect(r[id]!.x - pos[id]!.x).toBeCloseTo(130);
      expect(r[id]!.y - pos[id]!.y).toBeCloseTo(-70);
    }
  });

  it('dragging a pill (locked) moves the whole card', () => {
    const p = pills[0]!;
    const r = applyLockedDrag(g, pos, p.id, { x: pos[p.id]!.x + 20, y: pos[p.id]!.y + 30 }, { lock: true, alt: false });
    expect(Object.keys(r)).toContain(owner.id);
    expect(Object.keys(r).length).toBe(pills.length + 1);
  });

  it('Alt moves one pill only; unlocked moves only the node', () => {
    const p = pills[0]!;
    const to = { x: pos[p.id]!.x + 15, y: pos[p.id]!.y + 25 };
    expect(applyLockedDrag(g, pos, p.id, to, { lock: true, alt: true })).toEqual({ [p.id]: to });
    expect(applyLockedDrag(g, pos, owner.id, to, { lock: false, alt: false })).toEqual({ [owner.id]: to });
  });

  it('nudgeToFree: a card dropped on another gets a free spot', () => {
    const other = g.nodes.find((n) => n.type === 'objekat' && n.id !== owner.id)!;
    const moved = { ...pos };
    const t = { x: pos[other.id]!.x, y: pos[other.id]!.y };
    Object.assign(moved, applyLockedDrag(g, pos, owner.id, t, { lock: true, alt: false }));
    const d = nudgeToFree(g, moved, owner.id);
    expect(d).not.toBeNull();
    const after = { ...moved };
    for (const id of [owner.id, ...pills.map((p) => p.id)]) after[id] = { x: moved[id]!.x + d!.x, y: moved[id]!.y + d!.y };
    expect(nudgeToFree(g, after, owner.id)).toBeNull();
    const boxes = cardBoxes(g, after);
    const a = boxes[owner.id]!;
    for (const [id, b] of Object.entries(boxes)) {
      if (id === owner.id) continue;
      expect(ov({ x: a.x, y: a.y, w: a.width, h: a.height }, { x: b.x, y: b.y, w: b.width, h: b.height })).toBeLessThanOrEqual(1);
    }
    expect(d!.x % 10).toBe(0);
    expect(d!.y % 10).toBe(0);
  });

  it('positions after a locked drag survive JSON export -> import', () => {
    const to = { x: pos[owner.id]!.x + 130, y: pos[owner.id]!.y - 70 };
    const positions: PositionMap = { ...pos, ...applyLockedDrag(g, pos, owner.id, to, { lock: true, alt: false }) };
    const text = exportDiagramJson({
      source: src, ir, graph: g, positions,
      options: { dg0Mode: 'relation', sqlDialect: 'oracle' }, locale: 'sr', now: new Date('2026-11-04T12:00:00.000Z'),
    });
    const r = parseDiagramJson(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.positions).toEqual(positions);
    for (const p of pills) {
      expect(r.positions[p.id]!.x - r.positions[owner.id]!.x).toBeCloseTo(pos[p.id]!.x - pos[owner.id]!.x);
      expect(r.positions[p.id]!.y - r.positions[owner.id]!.y).toBeCloseTo(pos[p.id]!.y - pos[owner.id]!.y);
    }
  });

  it.runIf(process.env.PMOV_WRITE_SVG === '1')('writes spec/sessions/T50-proizvodnja-grid.svg', () => {
    writeFileSync(resolve(process.cwd(), 'spec/sessions/T50-proizvodnja-grid.svg'), graphToSvg(g, pos));
  });
});
