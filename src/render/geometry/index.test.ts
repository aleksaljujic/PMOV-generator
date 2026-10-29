import { describe, expect, it, vi } from 'vitest';
vi.mock('../graph', () => ({ estimateTextWidth: (t: string, fs: number) => t.length * fs * 0.55 }));
import type { DiagramEdge, DiagramNode } from '../graph/types';
import { ARROW_LENGTH } from '../style';
import { boxOf, centerOf, computeEdgeGeometry, outlineIntersection } from './index';

const node = (id: string, type: DiagramNode['type'], w: number, h: number): DiagramNode => ({
  id, type, label: id, elementId: id, width: w, height: h, layoutRole: 'core',
});
const edge = (o: Partial<DiagramEdge>): DiagramEdge => ({
  id: 'e', source: 'a', target: 'b', label: null, arrow: false, route: 'straight', elementId: 'x', ...o,
});
const P = <T,>(a: T[], i: number): T => a[i] as T;
const box = { x: 100, y: 100, width: 120, height: 60 };

describe('outlineIntersection', () => {
  it('diamond lies on true edges at many angles', () => {
    const c = centerOf(box);
    for (const deg of [0, 45, 90, 137, 200, 300]) {
      const r = (deg * Math.PI) / 180;
      const p = outlineIntersection('diamond', box, { x: c.x + 500 * Math.cos(r), y: c.y + 500 * Math.sin(r) });
      expect(Math.abs(p.x - c.x) / 60 + Math.abs(p.y - c.y) / 30).toBeCloseTo(1, 6);
    }
  });
  it('rect hits the outer rectangle', () => {
    const p = outlineIntersection('rect', box, { x: 1000, y: 130 });
    expect(p).toEqual({ x: 220, y: 130 });
    expect(outlineIntersection('doubleRect', box, { x: 160, y: -500 })).toEqual({ x: 160, y: 100 });
    expect(outlineIntersection('rectDiamond', box, { x: 160, y: 900 })).toEqual({ x: 160, y: 160 });
  });
  it('pill end cap is on the circle, flat part on the top', () => {
    const b = { x: 0, y: 0, width: 100, height: 24 };
    const p = outlineIntersection('pill', b, { x: 300, y: 12 + 20 });
    expect(Math.hypot(p.x - 88, p.y - 12)).toBeCloseTo(12, 6);
    const q = outlineIntersection('pill', b, { x: 50, y: 500 });
    expect(q.y).toBeCloseTo(24, 6);
    const e = outlineIntersection('pill', b, { x: 1000, y: 12 });
    expect(e.x).toBeCloseTo(100, 6);
  });
  it('circle uses min(w,h)/2', () => {
    const p = outlineIntersection('circle', { x: 0, y: 0, width: 12, height: 12 }, { x: 50, y: 6 });
    expect(p.x).toBeCloseTo(12, 6);
  });
  it('toward == center is deterministic', () => {
    expect(outlineIntersection('diamond', box, centerOf(box))).toEqual({ x: 160, y: 100 });
  });
});

describe('boxOf/centerOf', () => {
  it('works', () => {
    const b = boxOf(node('a', 'objekat', 100, 44), { x: 10, y: 20 });
    expect(b).toEqual({ x: 10, y: 20, width: 100, height: 44 });
    expect(centerOf(b)).toEqual({ x: 60, y: 42 });
  });
});

describe('computeEdgeGeometry', () => {
  const sn = node('a', 'objekat', 100, 44);
  const tn = node('b', 'veza', 100, 56);
  const sb = boxOf(sn, { x: 0, y: 0 });
  const tb = boxOf(tn, { x: 300, y: 100 });

  it('straight: endpoints on outlines', () => {
    const g = computeEdgeGeometry(edge({}), { node: sn, box: sb }, { node: tn, box: tb });
    expect(g.points).toHaveLength(2);
    const s = P(g.points, 0);
    expect(s.x === 100 || s.y === 0 || s.y === 44).toBe(true);
    const t = P(g.points, 1);
    const c = centerOf(tb);
    expect(Math.abs(t.x - c.x) / 50 + Math.abs(t.y - c.y) / 28).toBeCloseTo(1, 6);
    expect(g.arrow).toBeNull();
    expect(g.label).toBeNull();
  });

  it.each([
    [{ x: 300, y: 10 }], [{ x: 300, y: 300 }], [{ x: -300, y: -100 }], [{ x: 0, y: 300 }],
  ])('label near source, clear of source box and line (target %j)', (pos) => {
    const t = boxOf(tn, pos);
    const e = edge({ label: '(0,M) Mapping' });
    const g = computeEdgeGeometry(e, { node: sn, box: sb }, { node: tn, box: t });
    const l = g.label!;
    const a = P(g.points, 0), b = P(g.points, 1);
    const total = Math.hypot(b.x - a.x, b.y - a.y);
    const hw = (e.label!.length * 12 * 0.55) / 2;
    const left = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - 2 * hw : l.x - hw;
    const tb2 = { x: left, y: l.y - 6, width: 2 * hw, height: 12 };
    const inter = (r: typeof tb2, q: typeof sb) =>
      r.x < q.x + q.width && r.x + r.width > q.x && r.y < q.y + q.height && r.y + r.height > q.y;
    expect(inter(tb2, sb)).toBe(false);
    // distance from label center to the line is > 0 and its projection is in the first 45%
    const ux = (b.x - a.x) / total, uy = (b.y - a.y) / total;
    const cx = left + hw, cy = l.y;
    const proj = (cx - a.x) * ux + (cy - a.y) * uy;
    expect(proj).toBeLessThanOrEqual(0.45 * total + hw + 12);
    // sample the line: no point inside label box
    for (let i = 0; i <= 100; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / 100, y: a.y + ((b.y - a.y) * i) / 100 };
      expect(p.x > tb2.x && p.x < tb2.x + tb2.width && p.y > tb2.y && p.y < tb2.y + tb2.height).toBe(false);
    }
  });

  it('arrow tip on target outline, path stops at base', () => {
    const g = computeEdgeGeometry(edge({ arrow: true }), { node: sn, box: sb }, { node: tn, box: tb });
    expect(g.arrow!.tip).toEqual(g.points[1]);
    const nums = g.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const end = { x: P(nums, 2), y: P(nums, 3) };
    expect(Math.hypot(end.x - P(g.points, 1).x, end.y - P(g.points, 1).y)).toBeCloseTo(ARROW_LENGTH, 1);
    expect(g.arrow!.polygon.split(' ')).toHaveLength(3);
  });

  it('loopTop and loopBottom stay above/below both boxes', () => {
    const top = computeEdgeGeometry(edge({ route: 'loopTop' }), { node: sn, box: sb }, { node: tn, box: tb });
    const bot = computeEdgeGeometry(edge({ route: 'loopBottom' }), { node: sn, box: sb }, { node: tn, box: tb });
    expect(top.points).toHaveLength(4);
    expect(Math.min(...top.points.map((p) => p.y))).toBeLessThan(Math.min(sb.y, tb.y));
    expect(Math.max(...bot.points.map((p) => p.y))).toBeGreaterThan(Math.max(sb.y + 44, tb.y + 56));
    expect(P(top.points, 3)).toEqual({ x: 350, y: 100 });
    expect(P(bot.points, 3)).toEqual({ x: 350, y: 156 });
  });

  it('busDown: 4 axis-aligned points, last vertical down, tip at target top-center', () => {
    const j = node('j', 'junction', 12, 12);
    const p = node('p', 'objekat', 100, 44);
    const jb = boxOf(j, { x: 200, y: 0 });
    const pb = boxOf(p, { x: 20, y: 120 });
    const g = computeEdgeGeometry(edge({ route: 'busDown', arrow: true }), { node: j, box: jb }, { node: p, box: pb });
    expect(g.points).toHaveLength(4);
    for (let i = 1; i < 4; i++) {
      expect(P(g.points, i).x === P(g.points, i - 1).x || P(g.points, i).y === P(g.points, i - 1).y).toBe(true);
    }
    expect(P(g.points, 3).x).toBe(P(g.points, 2).x);
    expect(P(g.points, 3).y).toBeGreaterThan(P(g.points, 2).y);
    expect(g.arrow!.tip).toEqual({ x: 70, y: 120 });
    expect(g.arrow!.angle).toBeCloseTo(Math.PI / 2, 6);
  });
});
