import { expect } from 'vitest';
import type { DiagramGraph, PositionMap } from '../../graph/types';
import { EDGE_LENGTH } from '../constants';
import { attrCountByOwner, inflation } from '../inflate';

interface R { x: number; y: number; w: number; h: number }
const hit = (a: R, b: R): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function checkLayout(graph: DiagramGraph, pos: PositionMap): void {
  for (const n of graph.nodes) {
    const p = pos[n.id];
    expect(p, n.id).toBeDefined();
    expect(Number.isFinite(p!.x) && Number.isFinite(p!.y), n.id).toBe(true);
  }
  const counts = attrCountByOwner(graph);
  const actual = (id: string): R => {
    const n = graph.nodes.find((x) => x.id === id)!;
    return { x: pos[id]!.x, y: pos[id]!.y, w: n.width, h: n.height };
  };
  const inflated = (id: string): R => {
    const n = graph.nodes.find((x) => x.id === id)!;
    const f = inflation(n, counts.get(id) ?? 0, graph);
    const b = actual(id);
    return { x: b.x - f.padX, y: b.y - f.padY, w: b.w + 2 * f.padX, h: b.h + 2 * f.padY };
  };
  const cores = graph.nodes.filter((n) => n.layoutRole === 'core');
  const attrs = graph.nodes.filter((n) => n.layoutRole === 'attribute');
  for (let i = 0; i < cores.length; i++) {
    for (let j = i + 1; j < cores.length; j++) {
      expect(hit(inflated(cores[i]!.id), inflated(cores[j]!.id)), `${cores[i]!.id} x ${cores[j]!.id}`).toBe(false);
    }
    for (const a of attrs) expect(hit(actual(cores[i]!.id), actual(a.id)), `${cores[i]!.id} x ${a.id}`).toBe(false);
  }
}

export function checkSpec(graph: DiagramGraph, pos: PositionMap): void {
  const specs = graph.nodes.filter((n) => n.type === 'spec');
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

/** 2D shape checks: several y bands, balanced aspect ratio, veza between its participants. */
export function checkShape(graph: DiagramGraph, pos: PositionMap): void {
  const center = (id: string) => {
    const n = graph.nodes.find((x) => x.id === id)!;
    return { x: pos[id]!.x + n.width / 2, y: pos[id]!.y + n.height / 2 };
  };
  const cores = graph.nodes.filter((n) => n.layoutRole === 'core');
  const objs = cores.filter((n) => n.type === 'objekat');
  if (objs.length >= 6) {
    const bands = new Set(objs.map((n) => Math.round(center(n.id).y / 60)));
    expect(bands.size).toBeGreaterThanOrEqual(3);
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of cores) {
    x0 = Math.min(x0, pos[n.id]!.x); y0 = Math.min(y0, pos[n.id]!.y);
    x1 = Math.max(x1, pos[n.id]!.x + n.width); y1 = Math.max(y1, pos[n.id]!.y + n.height);
  }
  const ratio = (x1 - x0) / (y1 - y0);
  expect(ratio).toBeGreaterThanOrEqual(1 / 2.5);
  expect(ratio).toBeLessThanOrEqual(2.5);
  const coreIds = new Set(cores.map((n) => n.id));
  for (const v of cores.filter((n) => n.type === 'veza')) {
    const parts = graph.edges
      .filter((e) => coreIds.has(e.source) && coreIds.has(e.target) && (e.source === v.id || e.target === v.id) && e.source !== e.target)
      .map((e) => (e.source === v.id ? e.target : e.source));
    if (parts.length < 2) continue;
    const pc = parts.map(center);
    const c = center(v.id);
    const L = EDGE_LENGTH;
    expect(c.x).toBeGreaterThanOrEqual(Math.min(...pc.map((p) => p.x)) - L);
    expect(c.x).toBeLessThanOrEqual(Math.max(...pc.map((p) => p.x)) + L);
    expect(c.y).toBeGreaterThanOrEqual(Math.min(...pc.map((p) => p.y)) - L);
    expect(c.y).toBeLessThanOrEqual(Math.max(...pc.map((p) => p.y)) + L);
  }
}
