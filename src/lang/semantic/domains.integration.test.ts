// Needs T22 (parser for `domen` / `ograničenje`). Contract C10 §2.
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR, stripSpans } from '../../fixtures/ir';
import { DOMAIN_CHAIN_SOURCE, DOMAIN_EXAMPLE_IR } from '../../fixtures/domains';
import { compile } from './index';

const AB = `objekat A {\n  Id# : long\n}\nobjekat B {\n  Id# : long\n}\nveza V {\n  A (0,M) a\n  B (0,M) b\n}\n`;
const codes = (src: string, locale?: 'sr' | 'en') => compile(src, { locale }).diagnostics.map((d) => d.code);
const nonW02 = (ds: { code: string }[]) => ds.filter((d) => d.code !== 'W02' && d.code !== 'W03');

describe('domeni example', () => {
  const ex = EXAMPLES.find((e) => e.id === 'domeni')!;
  it('sr: IR equals the golden fixture, no diagnostics', () => {
    const r = compile(ex.source);
    expect(nonW02(r.diagnostics)).toEqual([]);
    expect(stripSpans(r.ir)).toEqual(stripSpans(DOMAIN_EXAMPLE_IR));
  });
  it('en: no diagnostics, same IR shape', () => {
    const r = compile(ex.sourceEn!, { locale: 'en' });
    expect(nonW02(r.diagnostics)).toEqual([]);
    expect(r.ir!.domains!.map((d) => [d.base, d.length, d.effectiveConstraint === null]))
      .toEqual(DOMAIN_EXAMPLE_IR.domains!.map((d) => [d.base, d.length, d.effectiveConstraint === null]));
    expect(r.ir!.constraints!.map((c) => [c.kind, c.rules.map((x) => [x.op, x.action])]))
      .toEqual(DOMAIN_EXAMPLE_IR.constraints!.map((c) => [c.kind, c.rules.map((x) => [x.op, x.action])]));
  });
  it('refs carry exact source spans', () => {
    const r = compile(ex.source);
    const g = r.ir!.constraints!.find((c) => c.kind === 'general')!;
    if (g.kind !== 'general') throw new Error();
    for (const ref of g.refs) expect(ex.source.slice(ref.span.from, ref.span.to)).toBe(`${ref.relation}.${ref.attribute}`);
  });
});

describe('domain chain', () => {
  it('Oznaka resolves to string(40) with the combined constraint', () => {
    const r = compile(DOMAIN_CHAIN_SOURCE);
    expect(r.hasErrors).toBe(false);
    const d = r.ir!.domains!.find((x) => x.name === 'Oznaka')!;
    expect(d.base).toBe('string');
    expect(d.length).toBe(40);
    expect(d.effectiveConstraint).toBe("NotNull And Like '[A-Z]%'");
    const at = (r.ir!.elements[0] as { attributes: { userDomain?: string; domain: string; length?: number }[] }).attributes[1]!;
    expect(at).toMatchObject({ userDomain: 'Oznaka', domain: 'string', length: 40 });
  });
});

describe('older examples are unchanged', () => {
  it('no C10 keys appear', () => {
    for (const ex of EXAMPLES.filter((e) => e.id !== 'domeni')) {
      const ir = compile(ex.source).ir!;
      expect('domains' in ir || 'constraints' in ir).toBe(false);
      expect(JSON.stringify(ir)).not.toContain('userDomain');
    }
    expect(stripSpans(compile(EXAMPLES[0]!.source).ir)).toEqual(stripSpans(MAIN_EXAMPLE_IR));
    expect(stripSpans(compile(EXAMPLES[1]!.source).ir)).toEqual(stripSpans(SPEC_EXAMPLE_IR));
  });
});

describe('E13–E17, W05 from source', () => {
  it('E13', () => {
    expect(codes('domen D : Nema\nobjekat A {\n  Id# : D\n}')).toContain('E13');
    expect(codes('domen D : long\nobjekat A {\n  Id# : D\n}')).not.toContain('E13');
  });
  it('E13 for an undeclared attribute type (sr and en)', () => {
    const src = 'objekat A { X# : Nepostojeci }';
    for (const locale of ['sr', 'en'] as const) {
      const d = compile(src, { locale }).diagnostics.filter((x) => x.code === 'E13');
      expect(d).toHaveLength(1);
      expect(d[0]!.message).toContain("'Nepostojeci'");
    }
  });
  it('E14', () => {
    expect(codes('domen D : long\ndomen D : short\nobjekat A {\n  Id# : D\n}')).toContain('E14');
    expect(codes('domen D : long\nobjekat A {\n  Id# : D\n}')).not.toContain('E14');
    expect(codes('domen D : long(5)\nobjekat A {\n  Id# : D\n}')).toContain('E14');
    expect(codes('objekat A {\n  Id# : long(5)\n}')).toContain('E14');
    expect(codes('objekat A {\n  Id# : string(5)\n}')).not.toContain('E14');
  });
  it('E15', () => {
    const r = compile('domen A : B\ndomen B : A\nobjekat O {\n  Id# : A\n}');
    expect(r.diagnostics.filter((d) => d.code === 'E15')).toHaveLength(1);
  });
  it('W05 and W02 suppression', () => {
    const r = compile('domen D : long\ndomen U : long\nobjekat A {\n  Id# : D\n  Y\n}');
    expect(r.diagnostics.filter((d) => d.code === 'W05').map((d) => d.message)).toEqual(["domen 'U' se ne koristi."]);
    expect(r.diagnostics.filter((d) => d.code === 'W02')).toHaveLength(1);
  });
  it('E16 / E17 / valid', () => {
    expect(codes(`${AB}ograničenje C {\n  A -> Z\n}`)).toContain('E16');
    expect(codes(`${AB}ograničenje C {\n  A -> B\n  B : delete cascades\n}`)).not.toContain('E17');
    expect(codes(`${AB}ograničenje C {\n  A -> B\n  A : delete restricted\n}`)).toContain('E17');
    expect(codes(`${AB}ograničenje C {\n  A -> B\n  B : delete cascades\n}`, 'en')).not.toContain('E17');
    expect(compile(`${AB}ograničenje C {\n  A -> B\n  A : delete restricted\n}`, { locale: 'en' }).diagnostics
      .find((d) => d.code === 'E17')!.message).toContain('DELETE is not allowed for the child relation');
  });
});
