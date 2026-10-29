import { describe, expect, it } from 'vitest';
import type { ModelAst } from '../ast';
import { buildIr } from './buildIr';
import { check } from './check';
import { findElementAtOffset, getElement, isSubtype, supertypeOf } from './query';
import { attr, attrs, block, model, part } from './testAst';

const O = (n: string, ...extra: ReturnType<typeof attrs>[]) => block('objekat', n, attrs(attr('Id', true, 'long')), ...extra);
const codes = (m: ModelAst) => check(m).map((d) => d.code);
const A = O('A');
const B = O('B');
const okVeza = block('veza', 'V', part('A', ['0', 'M']), part('B', ['1', '1']));

describe('checker (hand-built ASTs)', () => {
  it('valid model has no E codes', () => {
    expect(codes(model(A, B, okVeza)).filter((c) => c.startsWith('E'))).toEqual([]);
  });
  it('E01', () => {
    expect(codes(model(A, O('A')))).toContain('E01');
    const d = check(model(A, O('A'))).find((x) => x.code === 'E01')!;
    expect(d.elementId).toBe('A');
    expect(d.message).toContain("'A'");
    expect(codes(model(A, B))).not.toContain('E01');
  });
  it('E02', () => {
    const m = model(A, block('veza', 'V', part('A', ['0', 'M']), part('Z', ['0', 'M'])));
    const d = check(m).find((x) => x.code === 'E02')!;
    expect(d.message).toContain("'Z'");
    expect(d.elementId).toBe('V');
    expect(codes(model(A, B, okVeza))).not.toContain('E02');
    // veza names are not referencable
    expect(codes(model(A, B, okVeza, block('veza', 'W', part('A', ['0', 'M']), part('V', ['0', 'M']))))).toContain('E02');
  });
  it('E03', () => {
    for (const c of [['2', 'M'], ['1', '0'], ['0', 'X']] as [string, string][]) {
      expect(codes(model(A, B, block('veza', 'V', part('A', c), part('B', ['1', '1']))))).toContain('E03');
    }
    for (const c of [['1', '1'], ['1', 'M'], ['0', 'm']] as [string, string][]) {
      expect(codes(model(A, B, block('veza', 'V', part('A', c), part('B', ['1', '1']))))).not.toContain('E03');
    }
  });
  it('E04', () => {
    const m = model(A, B, block('veza', 'V', part('A', ['0', 'M']), part('B', ['0', 'M']), part('A', ['0', 'M'])));
    const d = check(m).find((x) => x.code === 'E04')!;
    expect(d.message).toContain('ima 3 učesnika');
    expect(d.message).toContain('agregacija');
    expect(codes(model(A, B, block('veza', 'V', part('A', ['0', 'M'], 'nadtip'), part('B', ['0', 'M']))))).toContain('E04');
  });
  it('E05', () => {
    const m = model(A, B, block('veza', 'V', part('A', ['0', 'M']), part('B', ['0', 'M']), attrs(attr('X'))));
    expect(check(m).find((x) => x.code === 'E05')!.message).toContain("'X'");
    expect(codes(model(A, B, okVeza))).not.toContain('E05');
  });
  it('E06', () => {
    const bad = block('slab', 'S', attrs(attr('N', true)));
    expect(codes(model(A, bad))).toContain('E06');
    const noId = block('slab', 'S', part('A', ['0', 'M'], 'nadređeni'), attrs(attr('N')));
    expect(codes(model(A, noId))).toContain('E06');
    const ok = block('slab', 'S', part('A', ['0', 'M'], 'nadređeni'), attrs(attr('N', true)));
    expect(codes(model(A, ok))).not.toContain('E06');
  });
  it('E07', () => {
    const bad = block('specijalizacija', 'S', part('A', ['0', 'M'], 'nadtip'), part('B', undefined, 'podtip'));
    expect(codes(model(A, B, bad))).toContain('E07');
    const ok = block('specijalizacija', 'S', part('A', ['0', 'M'], 'nadtip'), part('B', undefined, 'podtip'), part('C', undefined, 'podtip'));
    expect(codes(model(A, B, block('objekat', 'C'), ok))).not.toContain('E07');
  });
  it('E08', () => {
    expect(codes(model(A, block('agregacija', 'G', part('A', ['0', 'M']))))).toContain('E08');
    expect(codes(model(A, B, block('agregacija', 'G', part('A', ['0', 'M']), part('B', ['0', 'M']))))).not.toContain('E08');
  });
  it('E09', () => {
    const s1 = block('specijalizacija', 'S1', part('A', ['0', 'M'], 'nadtip'), part('B', undefined, 'podtip'), part('C', undefined, 'podtip'));
    const s2 = block('specijalizacija', 'S2', part('B', ['0', 'M'], 'nadtip'), part('A', undefined, 'podtip'), part('C', undefined, 'podtip'));
    const C = block('objekat', 'C');
    const d = check(model(A, B, C, s1, s2)).find((x) => x.code === 'E09')!;
    expect(d.elementId).toBe('S2');
    expect(d.message).toContain('A');
    expect(codes(model(A, B, C, s1))).not.toContain('E09');
  });
  it('E10', () => {
    expect(codes(model(block('objekat', 'X', attrs(attr('a')))))).toContain('E10');
    expect(codes(model(A))).not.toContain('E10');
  });
  it('E11', () => {
    const sub = block('objekat', 'B', attrs(attr('Id')));
    const s = block('specijalizacija', 'S', part('A', ['0', 'M'], 'nadtip'), part('B', undefined, 'podtip'), part('C', undefined, 'podtip'));
    const d = check(model(A, sub, block('objekat', 'C'), s)).find((x) => x.code === 'E11')!;
    expect(d.elementId).toBe('B');
    expect(codes(model(A, block('objekat', 'B', attrs(attr('Other'))), block('objekat', 'C'), s))).not.toContain('E11');
  });
  it('E12', () => {
    expect(codes(model(A, O('B', attrs(), part('A', ['0', 'M']))))).toContain('E12');
    expect(codes(model(A, B, block('agregacija', 'G', part('A', ['0', 'M'], 'nadtip'), part('B', ['0', 'M']))))).toContain('E12');
    expect(codes(model(A, B))).not.toContain('E12');
  });
  it('W01-W04', () => {
    const rec = (m1?: string, m2?: string) => model(A, block('veza', 'V', part('A', ['0', 'M'], undefined, m1), part('A', ['0', 'M'], undefined, m2)));
    expect(codes(rec())).toContain('W01');
    expect(codes(rec('x', 'y'))).not.toContain('W01');
    expect(codes(model(block('objekat', 'X', attrs(attr('a', true)))))).toContain('W02');
    expect(codes(model(O('X')))).not.toContain('W02');
    expect(codes(model(A))).toContain('W03');
    expect(codes(model(A, B, okVeza))).not.toContain('W03');
    expect(codes(model(block('objekat', 'X', attrs(attr('a', true, 'long'), attr('a', false, 'long')))))).toContain('W04');
    expect(codes(model(A))).not.toContain('W04');
  });
});

describe('buildIr and queries', () => {
  it('drops bad participants, keeps blocks, normalizes m', () => {
    const m = model(A, B, block('veza', '_', part('A', ['0', 'm']), part('Z', ['0', 'M']), part('B', ['2', 'M'])), block('veza', '_', part('A', ['1', '1']), part('B', ['1', '1'])));
    const ir = buildIr(m);
    expect(ir.elements.map((e) => e.id)).toEqual(['A', 'B', '_#1', '_#2']);
    const v = ir.elements[2]!;
    expect(v.kind === 'veza' && v.participants.map((p) => p.ref)).toEqual(['A']);
    expect(v.kind === 'veza' && v.participants[0]!.card).toEqual({ min: 0, max: 'M' });
    expect(v.name).toBe('');
  });
  it('drops duplicates', () => {
    expect(buildIr(model(A, O('A'))).elements).toHaveLength(1);
  });
  it('queries', () => {
    const s = block('specijalizacija', 'S', part('A', ['0', 'M'], 'nadtip'), part('B', undefined, 'podtip'), part('C', undefined, 'podtip'));
    const ir = buildIr(model(A, B, block('objekat', 'C'), s));
    expect(supertypeOf(ir, 'B')).toBe('A');
    expect(isSubtype(ir, 'A')).toBe(false);
    expect(getElement(ir, 'S')?.kind).toBe('specijalizacija');
    expect(findElementAtOffset(ir, ir.elements[0]!.span.from)).toBe('A');
  });
});
