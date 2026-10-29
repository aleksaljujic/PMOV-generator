import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR, stripSpans } from '../../fixtures/ir';
import type { Diagnostic } from '../diagnostics';
import { compile, findElementAtOffset } from './index';
import { ERROR_FIXTURES } from './errorFixtures';

const errs = (ds: Diagnostic[]) => ds.filter((d) => d.severity === 'error');

describe('golden examples', () => {
  it('main example', () => {
    const r = compile(EXAMPLES[0]!.source);
    expect(r.hasErrors).toBe(false);
    expect(stripSpans(r.ir)).toEqual(stripSpans(MAIN_EXAMPLE_IR));
    expect(r.diagnostics.length).toBeGreaterThan(0);
    expect(r.diagnostics.every((d) => d.code === 'W02')).toBe(true);
  });
  it('spec example', () => {
    const r = compile(EXAMPLES[1]!.source);
    expect(r.hasErrors).toBe(false);
    expect(stripSpans(r.ir)).toEqual(stripSpans(SPEC_EXAMPLE_IR));
    expect(r.diagnostics.some((d) => d.code === 'W01')).toBe(false);
  });
  it('findElementAtOffset in main example', () => {
    const r = compile(EXAMPLES[0]!.source);
    const off = EXAMPLES[0]!.source.indexOf('Naziv  : string');
    expect(findElementAtOffset(r.ir!, off)).toBe('Odeljenje');
  });
});

describe('syntax errors', () => {
  it('yield ir null', () => {
    const r = compile('objekat A { Id#');
    expect(r.ir).toBeNull();
    expect(r.hasErrors).toBe(true);
    expect(r.diagnostics.some((d) => d.code.startsWith('S'))).toBe(true);
  });
});

describe('ERROR_FIXTURES', () => {
  it('covers every E and W code', () => {
    const codes = ERROR_FIXTURES.map((f) => f.code);
    for (let i = 1; i <= 12; i++) expect(codes).toContain(`E${String(i).padStart(2, '0')}`);
    for (let i = 1; i <= 4; i++) expect(codes).toContain(`W0${i}`);
  });
  for (const f of ERROR_FIXTURES) {
    it(`${f.code} fires`, () => {
      const r = compile(f.source);
      expect(r.diagnostics.filter((d) => d.code.startsWith('S'))).toEqual([]);
      const hit = r.diagnostics.filter((d) => d.code === f.code);
      expect(hit.length).toBeGreaterThan(0);
      if (f.code.startsWith('E')) {
        expect(errs(r.diagnostics).map((d) => d.code)).toEqual(hit.map((d) => d.code));
      }
      for (const d of hit) {
        expect(d.elementId).not.toBeNull();
        if (d.code !== 'E01') expect(r.ir!.elements.some((e) => e.id === d.elementId)).toBe(true);
      }
    });
  }
  it('E01 elementId is the earlier block', () => {
    const d = compile(ERROR_FIXTURES.find((f) => f.code === 'E01')!.source).diagnostics.find((x) => x.code === 'E01')!;
    expect(d.elementId).toBe('A');
    expect(d.message).toContain("'A'");
    expect(d.message).toContain('1');
  });
  it('E04 count message', () => {
    const d = compile(ERROR_FIXTURES.find((f) => f.code === 'E04')!.source).diagnostics.find((x) => x.code === 'E04')!;
    expect(d.message).toContain('ima 3 učesnika');
    expect(d.message).toContain('agregacija');
    expect(d.elementId).toBe('V');
  });
  it('E09 and E11 message names', () => {
    const e9 = compile(ERROR_FIXTURES.find((f) => f.code === 'E09')!.source).diagnostics.find((x) => x.code === 'E09')!;
    expect(e9.message).toContain('A');
    expect(e9.message).toContain('B');
    const e11 = compile(ERROR_FIXTURES.find((f) => f.code === 'E11')!.source).diagnostics.find((x) => x.code === 'E11')!;
    expect(e11.message).toContain("'B'");
    expect(e11.message).toContain("'Id'");
    expect(e11.message).toContain("'A'");
    expect(e11.elementId).toBe('B');
  });
  it('passing cases: fixed sources have no such code', () => {
    const ok = compile('objekat A { Id#: long }\nobjekat B { Id#: long }\nveza V {\n A (0,M) x\n B (1,1) y\n}\n');
    expect(ok.diagnostics).toEqual([]);
  });
});

describe('best-effort IR', () => {
  it('veza with undeclared participant is kept, participant dropped', () => {
    const r = compile(ERROR_FIXTURES.find((f) => f.code === 'E02')!.source);
    const v = r.ir!.elements.find((e) => e.id === 'V');
    expect(v?.kind).toBe('veza');
    if (v?.kind === 'veza') expect(v.participants.map((p) => p.ref)).toEqual(['A']);
  });
  it('unnamed veza ids and m normalization', () => {
    const r = compile('objekat A { Id#: long }\nobjekat B { Id#: long }\nveza _ {\n A (0,m) x\n B (1,1) y\n}\nveza _ {\n A (0,M) x\n B (1,1) y\n}\n');
    expect(r.ir!.elements.map((e) => e.id)).toEqual(['A', 'B', '_#1', '_#2']);
    const v = r.ir!.elements[2]!;
    if (v.kind === 'veza') expect(v.participants[0]!.card.max).toBe('M');
    expect(v.name).toBe('');
  });
});
