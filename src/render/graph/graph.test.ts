import { describe, expect, it } from 'vitest';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR } from '../../fixtures/ir';
import type { PmovIR } from '../../lang';
import { ATTR_ROW_PITCH, PORT_PITCH, attributeNodeId, buildDiagramGraph, estimateTextWidth } from './index';

const count = <T,>(xs: T[], f: (x: T) => string) =>
  xs.reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});

describe('golden counts', () => {
  it('main', () => {
    const g = buildDiagramGraph(MAIN_EXAMPLE_IR);
    expect(g.nodes.length).toBe(28);
    expect(count(g.nodes, (n) => n.type)).toEqual({ objekat: 5, veza: 3, slab: 1, agregacija: 1, atribut: 18 });
    expect(g.edges.length).toBe(27);
    expect(g.edges.filter((e) => e.arrow).length).toBe(3);
    expect(g.edges.filter((e) => e.id.startsWith('e:attr:')).length).toBe(18);
  });
  it('spec', () => {
    const g = buildDiagramGraph(SPEC_EXAMPLE_IR);
    expect(g.nodes.length).toBe(19);
    expect(count(g.nodes, (n) => n.type)).toEqual({ objekat: 6, spec: 1, junction: 1, veza: 1, atribut: 10 });
    expect(g.edges.length).toBe(18);
    expect(g.edges.filter((e) => e.arrow).length).toBe(4);
    expect(g.edges.filter((e) => e.route === 'busDown').length).toBe(4);
  });
});

describe('edges', () => {
  const m = buildDiagramGraph(MAIN_EXAMPLE_IR);
  const s = buildDiagramGraph(SPEC_EXAMPLE_IR);
  const e = (g: typeof m, id: string) => g.edges.find((x) => x.id === id)!;
  it('labels', () => {
    expect(e(m, 'e:Zapošljavanje:0').label).toBe('(1,1) Radi');
    expect(e(m, 'e:Zapošljavanje:0').source).toBe('Radnik');
    expect(e(m, 'e:Zapošljavanje:0').target).toBe('Zapošljavanje');
    expect(e(m, 'e:Overe:0').label).toBe('(1,1)');
    expect(e(m, 'e:Isplata:owner')).toMatchObject({ label: '(0,M)', arrow: true, source: 'Radnik', target: 'Isplata' });
    expect(e(s, 'e:Vrsta:super').label).toBe('Vrsta (0,M)');
    expect(e(s, 'e:Vrsta:super').target).toBe('spec:Vrsta');
    expect(e(s, 'e:Vrsta:sub:0')).toMatchObject({ route: 'busDown', arrow: true, source: 'junction:Vrsta', target: 'Student' });
    expect(e(s, 'e:Vrsta:link').arrow).toBe(false);
  });
  it('recursive', () => {
    expect(e(s, 'e:Struktura:0').route).toBe('loopTop');
    expect(e(s, 'e:Struktura:1').route).toBe('loopBottom');
  });
});

describe('attributes', () => {
  it('identifier and owner', () => {
    const g = buildDiagramGraph(MAIN_EXAMPLE_IR);
    const mlb = g.nodes.find((n) => n.id === 'attr:Radnik:Mlb')!;
    expect(mlb).toMatchObject({ label: 'Mlb#', isIdentifier: true, layoutRole: 'attribute', ownerNodeId: 'Radnik', elementId: 'Radnik' });
    expect(g.nodes.find((n) => n.id === 'attr:Prijava:Ocena')!.ownerNodeId).toBe('Prijava');
  });
  it('duplicates', () => {
    const ir: PmovIR = { elements: [{
      kind: 'objekat', id: 'A', name: 'A', span: null as never, nameSpan: null as never,
      attributes: [1, 2, 3].map(() => ({ name: 'x', isId: false, domain: null, constraint: null, span: null as never })),
    }] };
    const ids = buildDiagramGraph(ir).nodes.map((n) => n.id);
    expect(ids).toEqual(['A', 'attr:A:x', 'attr:A:x~2', 'attr:A:x~3']);
    expect(attributeNodeId('A', 'x')).toBe('attr:A:x');
    expect(attributeNodeId('A', 'x', 2)).toBe('attr:A:x~2');
  });
  it('order', () => {
    const ids = buildDiagramGraph(MAIN_EXAMPLE_IR).nodes.map((n) => n.id);
    expect(ids.slice(0, 6)).toEqual(['Radnik', 'attr:Radnik:Mlb', 'attr:Radnik:ImeR', 'attr:Radnik:Adresa', 'attr:Radnik:Starost', 'Odeljenje']);
    const sp = buildDiagramGraph(SPEC_EXAMPLE_IR).nodes.map((n) => n.id);
    expect(sp.indexOf('junction:Vrsta')).toBe(sp.indexOf('spec:Vrsta') + 1);
  });
});

describe('sizes and errors', () => {
  it('sizes', () => {
    const g = buildDiagramGraph(MAIN_EXAMPLE_IR);
    const n = (id: string) => g.nodes.find((x) => x.id === id)!;
    // Radnik: 4 attributes -> rows 2 -> h = 76 (T45 card rule).
    expect(n('Radnik')).toMatchObject({ width: Math.max(100, estimateTextWidth('Radnik', 13) + 32), height: 76 });
    const z = n('Zapošljavanje');
    expect(z.width).toBeCloseTo(Math.max(100, estimateTextWidth('Zapošljavanje', 13) * 1.6 + 30));
    expect(z.height).toBe(Math.max(56, z.width * 0.5));
    expect(n('Prijava').width).toBeGreaterThanOrEqual(140);
    expect(n('attr:Radnik:Mlb').height).toBe(24);
    const s = buildDiagramGraph(SPEC_EXAMPLE_IR);
    expect(s.nodes.find((x) => x.id === 'spec:Vrsta')).toMatchObject({ width: 34, height: 34, label: 'S' });
    expect(s.nodes.find((x) => x.id === 'junction:Vrsta')).toMatchObject({ width: 12, height: 12, label: '' });
  });
  it('unnamed veza width 70', () => {
    const ir: PmovIR = { elements: [{ kind: 'veza', id: '_#1', name: '', span: null as never, nameSpan: null as never, participants: [] }] };
    expect(buildDiagramGraph(ir).nodes[0]).toMatchObject({ width: 70, height: 56 });
  });
  it('error IRs do not throw', () => {
    const p = (ref: string) => ({ ref, card: { min: 1 as const, max: 'M' as const }, mapping: null, span: null as never });
    const b = { span: null as never, nameSpan: null as never };
    const ir: PmovIR = { elements: [
      { kind: 'veza', id: 'V1', name: 'V1', ...b, participants: [p('A')] },
      { kind: 'veza', id: 'V3', name: 'V3', ...b, participants: [p('A'), p('B'), p('C')] },
      { kind: 'specijalizacija', id: 'S', name: 'S', ...b, supertype: null, subtypes: [{ ref: 'A', span: null as never }] },
    ] };
    const g = buildDiagramGraph(ir);
    expect(g.edges.filter((e) => e.elementId === 'V1').length).toBe(1);
    expect(g.edges.filter((e) => e.elementId === 'V3').length).toBe(3);
    expect(g.nodes.map((n) => n.id)).toEqual(['V1', 'V3', 'spec:S', 'junction:S']);
    expect(g.edges.map((e) => e.id)).toContain('e:S:link');
    expect(g.edges.map((e) => e.id)).toContain('e:S:sub:0');
  });
});

describe('estimateTextWidth', () => {
  it('monotonic, deterministic, ordering', () => {
    expect(estimateTextWidth('', 13)).toBe(0);
    expect(estimateTextWidth('abcd', 13)).toBeGreaterThan(estimateTextWidth('abc', 13));
    expect(estimateTextWidth('Radnik', 13)).toBe(estimateTextWidth('Radnik', 13));
    expect(estimateTextWidth('iii', 12)).toBeLessThan(estimateTextWidth('aaa', 12));
    expect(estimateTextWidth('MMM', 12)).toBeGreaterThan(estimateTextWidth('aaa', 12));
    expect(estimateTextWidth('a', 26)).toBeCloseTo(2 * estimateTextWidth('a', 13));
  });
});

describe('card sizing (T45)', () => {
  const b = { span: null as never, nameSpan: null as never };
  const attrs = (k: number) => Array.from({ length: k }, (_, i) => ({
    name: `a${i}`, isId: false, domain: null, constraint: null, span: null as never,
  }));
  const p = (ref: string) => ({ ref, card: { min: 1 as const, max: 'M' as const }, mapping: null, span: null as never });
  const objWith = (k: number): PmovIR => ({ elements: [{ kind: 'objekat', id: 'O', name: 'O', ...b, attributes: attrs(k) }] });
  const sizeOf = (ir: PmovIR, id: string) => {
    const n = buildDiagramGraph(ir).nodes.find((x) => x.id === id)!;
    return [n.width, n.height];
  };

  it('exports the pitches', () => {
    expect(ATTR_ROW_PITCH).toBe(32);
    expect(PORT_PITCH).toBe(22);
  });
  it('17 attributes + 10 vezas: staggered, h = 188, w = max(w0, 130)', () => {
    const elements: PmovIR['elements'] = [{ kind: 'objekat', id: 'O', name: 'O', ...b, attributes: attrs(17) }];
    for (let i = 0; i < 10; i++) elements.push({ kind: 'veza', id: `V${i}`, name: `V${i}`, ...b, participants: [p('O'), p('X')] });
    const g = buildDiagramGraph({ elements });
    const o = g.nodes.find((x) => x.id === 'O')!;
    expect([o.width, o.height]).toEqual([130, 188]);
    expect(sizeOf({ elements }, 'V0')).toEqual([100, 56]);
    expect(g.nodes.find((x) => x.id === 'attr:O:a0')).toMatchObject({ height: 24 });
  });
  it('rows to height', () => {
    expect(sizeOf(objWith(0), 'O')).toEqual([100, 44]);
    expect(sizeOf(objWith(1), 'O')).toEqual([100, 44]);
    expect(sizeOf(objWith(6), 'O')).toEqual([100, 108]);
    expect(sizeOf(objWith(12), 'O')).toEqual([100, 204]);
    expect(sizeOf(objWith(13), 'O')).toEqual([100, 156]);
  });
  it('slab and agregacija use the rule; agregacija keeps its own h0; spec/junction never grow', () => {
    const slab: PmovIR = { elements: [{ kind: 'slab', id: 'S', name: 'S', ...b, owner: null, attributes: attrs(6) }] };
    expect(sizeOf(slab, 'S')).toEqual([100, 108]);
    const agg: PmovIR = { elements: [{ kind: 'agregacija', id: 'G', name: 'G', ...b, attributes: attrs(2), components: [] }] };
    expect(sizeOf(agg, 'G')).toEqual([140, 72]);
    const agg2: PmovIR = { elements: [{ kind: 'agregacija', id: 'G', name: 'G', ...b, attributes: attrs(6), components: [] }] };
    expect(sizeOf(agg2, 'G')).toEqual([140, 108]);
    const sp = buildDiagramGraph(SPEC_EXAMPLE_IR);
    expect(sp.nodes.find((x) => x.id === 'spec:Vrsta')).toMatchObject({ width: 34, height: 34 });
    expect(sp.nodes.find((x) => x.id === 'junction:Vrsta')).toMatchObject({ width: 12, height: 12 });
  });
});
