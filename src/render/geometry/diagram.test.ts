import { describe, expect, it, vi } from 'vitest';
vi.mock('../graph', () => ({ estimateTextWidth: (t: string, fs: number) => t.length * fs * 0.55 }));
import { NODE_SHAPE } from '../graph/types';
import type { DiagramEdge, DiagramGraph, DiagramNode } from '../graph/types';
import { centerOf, computeDiagramGeometry, computeEdgeGeometry, outlineIntersection } from './index';
import type { Box } from './index';

const node = (id: string, type: DiagramNode['type'], w: number, h: number): DiagramNode => ({
  id, type, label: id, elementId: id, width: w, height: h, layoutRole: 'core',
});
const edge = (o: Partial<DiagramEdge>): DiagramEdge => ({
  id: 'e', source: 'a', target: 'b', label: null, arrow: false, route: 'straight', elementId: 'x', ...o,
});
const onRectOutline = (p: { x: number; y: number }, b: Box): boolean => {
  const inX = p.x >= b.x - 1e-6 && p.x <= b.x + b.width + 1e-6;
  const inY = p.y >= b.y - 1e-6 && p.y <= b.y + b.height + 1e-6;
  return (inX && (Math.abs(p.y - b.y) < 1e-6 || Math.abs(p.y - b.y - b.height) < 1e-6))
    || (inY && (Math.abs(p.x - b.x) < 1e-6 || Math.abs(p.x - b.x - b.width) < 1e-6));
};

function star(n: number): { graph: DiagramGraph; boxes: Record<string, Box> } {
  const nodes = [node('hub', 'objekat', 212, 85)];
  const edges: DiagramEdge[] = [];
  const boxes: Record<string, Box> = { hub: { x: 0, y: 0, width: 212, height: 85 } };
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n;
    const id = `n${i}`;
    nodes.push(node(id, i % 2 ? 'veza' : 'objekat', 60, 40));
    boxes[id] = { x: 106 + 400 * Math.cos(ang) - 30, y: 42 + 300 * Math.sin(ang) - 20, width: 60, height: 40 };
    edges.push(edge({ id: `e${i}`, source: 'hub', target: id, arrow: i % 3 === 0 }));
  }
  return { graph: { nodes, edges }, boxes };
}

describe('computeDiagramGeometry', () => {
  it('is deterministic including key order', () => {
    const { graph, boxes } = star(27);
    const a = computeDiagramGeometry(graph, boxes);
    const b = computeDiagramGeometry(graph, boxes);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.keys(a)).toEqual(graph.edges.map((e) => e.id));
  });

  it('star: ports are on the outline, >= 8 px apart, >= 6 px from corners', () => {
    const { graph, boxes } = star(27);
    const g = computeDiagramGeometry(graph, boxes);
    const hub = boxes.hub as Box;
    const ends = graph.edges.map((e) => (g[e.id]?.points[0]) as { x: number; y: number });
    for (const p of ends) {
      expect(onRectOutline(p, hub)).toBe(true);
      const corners = [[hub.x, hub.y], [hub.x + hub.width, hub.y], [hub.x, hub.y + hub.height], [hub.x + hub.width, hub.y + hub.height]];
      for (const [cx, cy] of corners) expect(Math.hypot(p.x - (cx as number), p.y - (cy as number))).toBeGreaterThanOrEqual(6 - 1e-9);
    }
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const a = ends[i] as { x: number; y: number };
        const b = ends[j] as { x: number; y: number };
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('rect to diamond: far end on the diamond outline, arrow tip on target outline', () => {
    const nodes = [node('a', 'objekat', 100, 44), node('v', 'veza', 80, 50)];
    const boxes = { a: { x: 0, y: 0, width: 100, height: 44 }, v: { x: 250, y: 100, width: 80, height: 50 } };
    const g = computeDiagramGeometry({ nodes, edges: [edge({ id: 'e1', source: 'a', target: 'v', arrow: true })] }, boxes)['e1'];
    const end = g?.points[1] as { x: number; y: number };
    const c = centerOf(boxes.v);
    expect(Math.abs(end.x - c.x) / 40 + Math.abs(end.y - c.y) / 25).toBeCloseTo(1, 6);
    expect(g?.arrow?.tip).toEqual(end);
    expect(onRectOutline(g?.points[0] as { x: number; y: number }, boxes.a)).toBe(true);
    void NODE_SHAPE; void outlineIntersection;
  });

  it('two aligned nodes match computeEdgeGeometry', () => {
    const a = node('a', 'objekat', 100, 44);
    const b = node('b', 'objekat', 100, 44);
    const boxes = { a: { x: 0, y: 0, width: 100, height: 44 }, b: { x: 300, y: 0, width: 100, height: 44 } };
    const e = edge({ id: 'e1', label: '1,N', arrow: true });
    const g = computeDiagramGeometry({ nodes: [a, b], edges: [e] }, boxes)['e1'];
    const s = computeEdgeGeometry(e, { node: a, box: boxes.a }, { node: b, box: boxes.b });
    expect(g?.points).toEqual(s.points);
    expect(g?.path).toBe(s.path);
    expect(g?.label).toEqual(s.label);
  });

  it('label avoids a node box that covers the default spot', () => {
    const a = node('a', 'objekat', 100, 44);
    const b = node('b', 'objekat', 100, 44);
    const at = node('at', 'atribut', 60, 24);
    const boxes: Record<string, Box> = {
      a: { x: 0, y: 0, width: 100, height: 44 }, b: { x: 400, y: 0, width: 100, height: 44 },
      at: { x: 118, y: 22 - 12 - 20, width: 60, height: 24 },
    };
    const graph = { nodes: [a, b, at], edges: [edge({ id: 'e1', label: '1,N' })] };
    const l = computeDiagramGeometry(graph, boxes)['e1']?.label;
    expect(l).toBeTruthy();
    const w = 3 * 12 * 0.55;
    const lb: Box = {
      x: l!.anchor === 'start' ? l!.x : l!.anchor === 'end' ? l!.x - w : l!.x - w / 2,
      y: l!.y - 7, width: w, height: 14,
    };
    for (const bx of Object.values(boxes)) {
      const ov = Math.min(lb.x + lb.width, bx.x + bx.width) > Math.max(lb.x, bx.x)
        && Math.min(lb.y + lb.height, bx.y + bx.height) > Math.max(lb.y, bx.y);
      expect(ov).toBe(false);
    }
    expect(l!.x).toBeLessThan(0.45 * 300 + 100 + 1);
    expect(l!.x).toBeGreaterThan(100);
  });

  it('labels do not overlap each other', () => {
    const { graph, boxes } = star(6);
    const labelled = { ...graph, edges: graph.edges.map((e) => ({ ...e, label: '0,N' })) };
    const g = computeDiagramGeometry(labelled, boxes);
    const bs = labelled.edges.map((e) => {
      const l = g[e.id]?.label as { x: number; y: number; anchor: string };
      const w = 3 * 12 * 0.55;
      const x = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
      return { x, y: l.y - 7, width: w, height: 14 };
    });
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i] as Box; const b = bs[j] as Box;
      expect(Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)).toBe(false);
    }
  });

  it('skips edges without boxes; loop and bus match computeEdgeGeometry', () => {
    const a = node('a', 'objekat', 100, 44);
    const v = node('v', 'veza', 80, 50);
    const boxes = { a: { x: 0, y: 100, width: 100, height: 44 }, v: { x: 20, y: 0, width: 80, height: 50 } };
    const edges = [
      edge({ id: 'l', source: 'v', target: 'a', route: 'loopTop', arrow: true }),
      edge({ id: 'b', source: 'v', target: 'a', route: 'busDown' }),
      edge({ id: 'x', source: 'v', target: 'zz' }),
    ];
    const g = computeDiagramGeometry({ nodes: [a, v], edges }, boxes);
    expect(Object.keys(g)).toEqual(['l', 'b']);
    for (const e of edges.slice(0, 2)) {
      const s = computeEdgeGeometry(e, { node: v, box: boxes.v }, { node: a, box: boxes.a });
      expect(g[e.id]?.points).toEqual(s.points);
      expect(g[e.id]?.path).toBe(s.path);
    }
  });

  it('is fast on ~100 edges', () => {
    const { graph, boxes } = star(100);
    computeDiagramGeometry(graph, boxes);
    const t = performance.now();
    computeDiagramGeometry(graph, boxes);
    expect(performance.now() - t).toBeLessThan(25);
  });
});

describe('computeDiagramGeometry: cards (T47)', () => {
  const BOX: Box = { x: 400, y: 300, width: 120, height: 204 };
  const owner = node('o', 'objekat', 120, 204);
  function card(extra: { id: string; box: Box }[] = []): { graph: DiagramGraph; boxes: Record<string, Box> } {
    const nodes = [owner];
    const edges: DiagramEdge[] = [];
    const boxes: Record<string, Box> = { o: BOX };
    for (let i = 0; i < 6; i++) {
      const left = i < 3;
      const row = i % 3;
      const id = `at${i}`;
      nodes.push(node(id, 'atribut', 70, 24));
      boxes[id] = { x: left ? BOX.x - 24 - 70 : BOX.x + BOX.width + 24, y: BOX.y + 22 + row * 32 * 2 - 12, width: 70, height: 24 };
      edges.push(edge({ id: `a${i}`, source: 'o', target: id }));
    }
    for (const x of extra) {
      nodes.push(node(x.id, 'objekat', x.box.width, x.box.height));
      boxes[x.id] = x.box;
      edges.push(edge({ id: `r_${x.id}`, source: 'o', target: x.id }));
    }
    return { graph: { nodes, edges }, boxes };
  }

  it('stubs are horizontal, from the box side to the pill outline', () => {
    const { graph, boxes } = card();
    const g = computeDiagramGeometry(graph, boxes);
    for (let i = 0; i < 6; i++) {
      const pts = g[`a${i}`]?.points as { x: number; y: number }[];
      const pill = boxes[`at${i}`] as Box;
      expect(pts).toHaveLength(2);
      expect(pts[0]?.y).toBe(pts[1]?.y);
      expect(pts[0]?.y).toBe(pill.y + 12);
      expect(pts[0]?.x).toBe(i < 3 ? BOX.x : BOX.x + BOX.width);
      expect(pts[1]?.x).toBe(i < 3 ? pill.x + pill.width : pill.x);
    }
  });

  it('a pill above the box keeps the old behaviour', () => {
    const o = node('o', 'objekat', 100, 44);
    const at = node('at', 'atribut', 60, 24);
    const boxes = { o: { x: 0, y: 100, width: 100, height: 44 }, at: { x: 20, y: 0, width: 60, height: 24 } };
    const e = edge({ id: 'e1', source: 'o', target: 'at' });
    const g = computeDiagramGeometry({ nodes: [o, at], edges: [e] }, boxes)['e1'];
    const s = computeEdgeGeometry(e, { node: o, box: boxes.o }, { node: at, box: boxes.at });
    expect(g?.points).toEqual(s.points);
  });

  it('neighbours above / below use top / bottom, >= 8 px apart; a level neighbour sits in a gap', () => {
    const extra = [
      { id: 'u1', box: { x: 150, y: 100, width: 80, height: 40 } },
      { id: 'u2', box: { x: 350, y: 100, width: 80, height: 40 } },
      { id: 'u3', box: { x: 550, y: 100, width: 80, height: 40 } },
      { id: 'd1', box: { x: 300, y: 700, width: 80, height: 40 } },
      { id: 'd2', box: { x: 500, y: 700, width: 80, height: 40 } },
    ];
    const level = { id: 'lv', box: { x: 900, y: 380, width: 80, height: 40 } };
    const { graph, boxes } = card([...extra, level]);
    const g = computeDiagramGeometry(graph, boxes);
    const ends = extra.map((x) => g[`r_${x.id}`]?.points[0] as { x: number; y: number });
    for (const p of ends) expect(p.y === BOX.y || p.y === BOX.y + BOX.height).toBe(true);
    for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
      const a = ends[i] as { x: number; y: number };
      const b = ends[j] as { x: number; y: number };
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(8);
    }
    const p = g['r_lv']?.points[0] as { x: number; y: number };
    expect(p.x).toBe(BOX.x + BOX.width);
    for (let i = 3; i < 6; i++) expect(Math.abs(p.y - ((boxes[`at${i}`] as Box).y + 12))).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(computeDiagramGeometry(graph, boxes))).toBe(JSON.stringify(g));
  });
});

describe('computeDiagramGeometry: crowded labels (T47 fix)', () => {
  it('short edge between boxes with pills: label free of every box and label', () => {
    const a = node('a', 'objekat', 100, 44);
    const b = node('b', 'objekat', 100, 44);
    const nodes = [a, b];
    const boxes: Record<string, Box> = { a: { x: 0, y: 0, width: 100, height: 44 }, b: { x: 160, y: 0, width: 100, height: 44 } };
    const edges = [edge({ id: 'e1', label: '(0,M)' })];
    // pills above and below the gap, covering the default spots
    const pill = (id: string, x: number, y: number): void => {
      nodes.push(node(id, 'atribut', 50, 24));
      boxes[id] = { x, y, width: 50, height: 24 };
    };
    pill('p1', 105, -34);
    pill('p2', 105, 54);
    const l = computeDiagramGeometry({ nodes, edges }, boxes)['e1']?.label;
    expect(l).toBeTruthy();
    const w = 5 * 12 * 0.55;
    const lb: Box = {
      x: l!.anchor === 'start' ? l!.x : l!.anchor === 'end' ? l!.x - w : l!.x - w / 2,
      y: l!.y - 7, width: w, height: 14,
    };
    for (const bx of Object.values(boxes)) {
      const ov = Math.min(lb.x + lb.width, bx.x + bx.width) > Math.max(lb.x, bx.x)
        && Math.min(lb.y + lb.height, bx.y + bx.height) > Math.max(lb.y, bx.y);
      expect(ov).toBe(false);
    }
  });
});

describe('computeDiagramGeometry: loop end vs stub (T47 fix 3)', () => {
  it('stacked loopBottom end does not coincide with a centre stub', () => {
    const o = node('o', 'objekat', 100, 44);
    const v = node('v', 'veza', 80, 50);
    const at = node('at', 'atribut', 60, 24);
    const boxes: Record<string, Box> = {
      o: { x: 150, y: 20, width: 100, height: 44 }, v: { x: 160, y: 120, width: 80, height: 50 },
      at: { x: 66, y: 30, width: 60, height: 24 },
    };
    const edges = [edge({ id: 'a', source: 'o', target: 'at' }), edge({ id: 'l', source: 'o', target: 'v', route: 'loopBottom' })];
    const g = computeDiagramGeometry({ nodes: [o, v, at], edges }, boxes);
    const stub = g['a']?.points as { x: number; y: number }[];
    const loop = g['l']?.points as { x: number; y: number }[];
    expect(stub[0]?.y).toBe(stub[1]?.y);
    expect(Math.hypot(stub[0]!.x - loop[0]!.x, stub[0]!.y - loop[0]!.y)).toBeGreaterThanOrEqual(8);
    expect(loop[0]?.x).toBe(150);
    expect(loop[0]?.y).toBe(loop[1]?.y);
    expect(loop[1]?.x).toBe(loop[2]?.x);
    expect(loop[2]?.y).toBe(loop[3]?.y);
    expect(loop[3]?.y).toBe(145);
  });
});
