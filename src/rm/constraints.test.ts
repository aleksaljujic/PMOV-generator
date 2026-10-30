import { describe, expect, it } from 'vitest';
import { DOMAIN_EXAMPLE_IR, DOMAIN_EXAMPLE_REFERENTIAL, DOMAIN_EXAMPLE_STRUCTURE } from '../fixtures/domains';
import { MAIN_EXAMPLE_IR } from '../fixtures/ir';
import { MAIN_EXAMPLE_RM } from '../fixtures/rm';
import { NO_SPAN } from '../lang/diagnostics';
import type { IRConstraint, IRConstraintRule, IRElement, IRParticipant, PmovIR } from '../lang/ir';
import {
  buildDomainStructure, buildDomainTable, formatConstraintsText, generateRelationalModel, generateSql,
} from './index';
import type { ReferentialConstraint } from './index';

const sp = (from: number, line = 1) => ({ ...NO_SPAN, from, to: from + 1, line });
const p = (ref: string, min: 0 | 1, max: 1 | 'M'): IRParticipant => ({ ref, card: { min, max }, mapping: null, span: NO_SPAN });
const base = (id: string) => ({ id, name: id, span: NO_SPAN, nameSpan: NO_SPAN });
const obj = (id: string, ...ids: string[]): IRElement => ({
  ...base(id), kind: 'objekat',
  attributes: ids.map((n) => ({ name: n, isId: true, domain: null, constraint: null, span: NO_SPAN })),
});
const rule = (relation: string, op: IRConstraintRule['op'], action: IRConstraintRule['action'], from = 0): IRConstraintRule =>
  ({ relation, op, action, span: sp(from) });
const ref = (id: string, child: string, parent: string, childAttrs: string[] | null, rules: IRConstraintRule[], line = 1): IRConstraint => ({
  kind: 'referential', id, name: id, child, parent, childAttrs, rules, span: sp(0, line), nameSpan: NO_SPAN, headerSpan: sp(5, line),
});
const withC = (ir: PmovIR, ...constraints: IRConstraint[]): PmovIR => ({ ...ir, constraints });

/** A(IdA) <-(0,1)/(0,M)- B: A holds nullable FK IdB. */
const NULLABLE_IR: PmovIR = { elements: [obj('A', 'IdA'), obj('B', 'IdB'), { ...base('V'), kind: 'veza', participants: [p('A', 0, 1), p('B', 0, 'M')] }] };
/** Two FKs from A to B (two vezas), regular. */
const TWO_IR: PmovIR = { elements: [
  obj('A', 'IdA'), obj('B', 'IdB'),
  { ...base('V1'), kind: 'veza', participants: [p('A', 1, 1), p('B', 0, 'M')] },
  { ...base('V2'), kind: 'veza', participants: [p('A', 1, 1), p('B', 0, 'M')] },
] };

describe('referential / general', () => {
  const rm = generateRelationalModel(DOMAIN_EXAMPLE_IR);
  it('matches DOMAIN_EXAMPLE_REFERENTIAL', () => {
    const norm = (l: ReferentialConstraint[]) => {
      const seen = new Map<string, number>();
      return l.map((c) => ({ ...c, group: seen.get(c.group) ?? (seen.set(c.group, seen.size), seen.size - 1) }));
    };
    expect(norm(rm.referential!)).toEqual(norm(DOMAIN_EXAMPLE_REFERENTIAL));
    expect(rm.diagnostics).toBeUndefined();
  });
  it('general constraint', () => {
    expect(rm.general).toEqual([{
      name: 'IsplataDoPlate', constraintId: 'IsplataDoPlate', condition: 'Isplata.Iznos <= Radnik.Plata',
      checks: [{ relation: 'Isplata', ops: ['insert', 'update'] }, { relation: 'Radnik', ops: ['update'] }],
    }]);
  });
  it('userDomain / length copied, also on borrowed FKs', () => {
    const radnik = rm.relations.find((r) => r.name === 'Radnik')!;
    expect(radnik.attributes.find((a) => a.name === 'ImeR')).toMatchObject({ userDomain: 'Naziv', length: 40 });
    expect(radnik.attributes.find((a) => a.name === 'SifOd')).toMatchObject({ userDomain: 'Šifra', fk: true });
    expect(radnik.attributes.find((a) => a.name === 'Adresa')).not.toHaveProperty('userDomain');
    expect('length' in radnik.attributes.find((a) => a.name === 'Adresa')!).toBe(false);
  });
  it('old IR: RM equals golden, no new keys', () => {
    const m = generateRelationalModel(MAIN_EXAMPLE_IR);
    expect(m.relations).toEqual(MAIN_EXAMPLE_RM.relations);
    expect(m.general).toBeUndefined();
    expect(m.diagnostics).toBeUndefined();
    expect(m.referential!.length).toBeGreaterThan(0);
  });
});

describe('defaults per fkKind', () => {
  it('nullable', () => {
    const c = generateRelationalModel(NULLABLE_IR).referential![0]!;
    expect(c).toMatchObject({ fkKind: 'nullable', name: 'fk_A_B', constraintId: null });
    expect(c.actions.parentDelete).toBe('nullifies');
    expect(c.explicitCells).toEqual([]);
  });
  it('identifying (slab) / component (agregacija) / regular', () => {
    const r = generateRelationalModel(DOMAIN_EXAMPLE_IR).referential!;
    expect(r.map((c) => c.fkKind)).toEqual(['regular', 'regular', 'identifying', 'component', 'component', 'regular']);
    expect(r[2]!.actions.parentDelete).toBe('restricted'); // overridden by the block
  });
  it('identifying (podtip)', () => {
    const ir: PmovIR = { elements: [
      obj('S', 'IdS'), { ...base('T'), kind: 'objekat', attributes: [] },
      { ...base('Sp'), kind: 'specijalizacija', supertype: { ref: 'S', span: NO_SPAN }, subtypes: [{ ref: 'T', span: NO_SPAN }] } as unknown as IRElement,
    ] };
    const c = generateRelationalModel(ir).referential![0]!;
    expect(c).toMatchObject({ child: 'T', parent: 'S', fkKind: 'identifying' });
    expect(c.actions.parentDelete).toBe('cascades');
  });
});

describe('diagnostics', () => {
  const codes = (ir: PmovIR, o = {}) => (generateRelationalModel(ir, { dg0Mode: 'fk', ...o }).diagnostics ?? []).map((d) => d.code);
  it('E18 missing / ambiguous / wrong attrs', () => {
    const m = generateRelationalModel(withC(NULLABLE_IR, ref('X', 'B', 'A', null, [])));
    expect(m.diagnostics![0]).toMatchObject({ code: 'E18', severity: 'error', elementId: null, message: "ne postoji strani ključ iz 'B' u 'A'." });
    const amb = generateRelationalModel(withC(TWO_IR, ref('X', 'A', 'B', null, [])), { dg0Mode: 'fk', locale: 'en' });
    expect(amb.diagnostics![0]!.message).toContain('several foreign keys from');
    expect(amb.diagnostics![0]!.message).toContain('A(IdB); A(IdB_2)');
    expect(codes(withC(TWO_IR, ref('X', 'A', 'B', ['IdB_2'], [])))).toEqual([]);
    expect(codes(withC(TWO_IR, ref('X', 'A', 'B', ['Nope'], [])))).toEqual(['E18']);
  });
  it('named block resolves ambiguity and names the FK', () => {
    const m = generateRelationalModel(withC(TWO_IR, ref('X', 'A', 'B', ['IdB_2'], [rule('B', 'delete', 'cascades')])));
    expect(m.referential!.map((c) => c.name)).toEqual(['fk_A_B', 'X']);
    expect(m.referential![1]).toMatchObject({ constraintId: 'X', explicitCells: ['parentDelete'] });
    expect(m.referential![1]!.actions.parentDelete).toBe('cascades');
    const dup = generateRelationalModel(TWO_IR).referential!.map((c) => c.name);
    expect(dup).toEqual(['fk_A_B', 'fk_A_B_2']);
  });
  it('E19 both variants, cell keeps default', () => {
    const pkIr = withC(DOMAIN_EXAMPLE_IR, ref('Z', 'Isplata', 'Radnik', null, [rule('Radnik', 'delete', 'nullifies', 9)]));
    const z = { ...pkIr, constraints: pkIr.constraints!.filter((c) => c.id !== 'IsplateRadnika') };
    const m = generateRelationalModel(z);
    expect(m.diagnostics![0]).toMatchObject({ code: 'E19', message: "NULLIFIES nije moguć: 'Isplata.Mlb' je deo primarnog ključa.", span: { from: 9 } });
    expect(m.referential!.find((c) => c.name === 'Z')!.actions.parentDelete).toBe('cascades');
    const reg = generateRelationalModel(withC(TWO_IR, ref('Q', 'A', 'B', ['IdB'], [rule('B', 'delete', 'nullifies')])), { dg0Mode: 'fk', locale: 'en' });
    expect(reg.diagnostics![0]!.message).toBe("NULLIFIES is not possible: foreign key 'A(IdB)' is not optional.");
    expect(codes(withC(NULLABLE_IR, ref('Q', 'A', 'B', null, [rule('A', 'insert', 'nullifies')])))).toEqual([]);
  });
  it('E20 second block, first wins', () => {
    const ir = withC(NULLABLE_IR, ref('F', 'A', 'B', null, [rule('B', 'delete', 'cascades')], 3), ref('S', 'A', 'B', null, [], 7));
    const m = generateRelationalModel(ir);
    expect(m.diagnostics!.map((d) => d.code)).toEqual(['E20']);
    expect(m.diagnostics![0]!.message).toBe("strani ključ 'A(IdB) → B' već ima ograničenje (red 3).");
    expect(m.referential![0]!.name).toBe('F');
  });
  it('W06 for unknown relation / attribute, sorted by span', () => {
    const g: IRConstraint = {
      kind: 'general', id: 'G', name: 'G', condition: 'A.IdA < B.Nope and Z.X > 1', conditionSpan: NO_SPAN, rules: [],
      refs: [
        { relation: 'Z', attribute: 'X', span: sp(30) }, { relation: 'A', attribute: 'IdA', span: sp(0) },
        { relation: 'B', attribute: 'Nope', span: sp(10) },
      ],
      span: NO_SPAN, nameSpan: NO_SPAN,
    };
    const m = generateRelationalModel(withC(NULLABLE_IR, g), { dg0Mode: 'fk', locale: 'en' });
    expect(m.diagnostics!.map((d) => [d.code, d.severity, d.span.from])).toEqual([['W06', 'warning', 10], ['W06', 'warning', 30]]);
    expect(m.diagnostics![0]!.message).toBe("'B.Nope' does not exist in the relational model.");
  });
  it('DG=0 toggle changes E18', () => {
    const ir = withC(NULLABLE_IR, ref('X', 'A', 'B', null, []));
    expect(codes(ir, { dg0Mode: 'fk' })).toEqual([]);
    expect(codes(ir, { dg0Mode: 'relation' })).toEqual(['E18']);
  });
});

describe('buildDomainStructure / buildDomainTable', () => {
  it('fixture', () => expect(buildDomainStructure(DOMAIN_EXAMPLE_IR)).toEqual(DOMAIN_EXAMPLE_STRUCTURE));
  it('derived domain shows inherited', () => {
    const d = (name: string, parent: string | null, c: string | null, eff: string | null) =>
      ({ name, parent, base: 'string' as const, length: 40, constraint: c, effectiveConstraint: eff, span: NO_SPAN, nameSpan: NO_SPAN });
    const ir: PmovIR = { elements: [], domains: [d('N', null, 'NotNull', 'NotNull'), d('K', 'N', "Like 'A'", "NotNull And Like 'A'"), d('O', 'K', null, "NotNull And Like 'A'")] };
    expect(buildDomainStructure(ir)).toEqual([
      { domain: 'N', base: 'string', length: '40', constraint: 'NotNull', inherited: null },
      { domain: 'K', base: 'N', length: '40', constraint: "Like 'A'", inherited: 'NotNull' },
      { domain: 'O', base: 'K', length: '40', constraint: '–', inherited: "NotNull And Like 'A'" },
    ]);
    expect(buildDomainStructure({ elements: [] })).toEqual([]);
  });
  it('DOMEN column', () => {
    const rows = buildDomainTable(DOMAIN_EXAMPLE_IR);
    expect(rows).toContainEqual({ attribute: 'ImeR', domain: 'Naziv', constraint: '–' });
    expect(rows).toContainEqual({ attribute: 'Adresa', domain: 'string', constraint: '–' });
    const ir: PmovIR = { elements: [{ ...base('X'), kind: 'objekat', attributes: [{ name: 'N', isId: false, domain: 'string', constraint: null, length: 40, span: NO_SPAN }] }] };
    expect(buildDomainTable(ir)).toEqual([{ attribute: 'N', domain: 'string(40)', constraint: '–' }]);
  });
});

describe('formatConstraintsText', () => {
  const rm = generateRelationalModel(DOMAIN_EXAMPLE_IR);
  const text = formatConstraintsText(rm);
  it('explicit card', () => {
    expect(text.split('\n\n')[0]).toBe(
      'RadnikUOdeljenju  Radnik.SifOd ⊆ Odeljenje.SifOd\n' +
      '           INSERT      UPDATE      DELETE\n' +
      'Radnik     RESTRICTED  RESTRICTED  /\n' +
      'Odeljenje  /           CASCADES    RESTRICTED',
    );
  });
  it('derived, composite and general cards', () => {
    expect(text).toContain('Odeljenje.Mlb ⊆ Radnik.Mlb (podrazumevano)');
    expect(formatConstraintsText(generateRelationalModel(MAIN_EXAMPLE_IR, { dg0Mode: 'relation' }), 'en'))
      .toContain('Overe(BrojInd, SifPred) ⊆ Prijava(BrojInd, SifPred) (default)');
    expect(text).toContain('IsplataDoPlate\n  Uslov: Isplata.Iznos <= Radnik.Plata\n');
    expect(text).toContain('Isplata  RESTRICTED  RESTRICTED  /\nRadnik   /           RESTRICTED  /');
    expect(formatConstraintsText({ relations: [] })).toBe('');
  });
});

describe('generateSql with domains and constraints', () => {
  const d = (name: string, parent: string | null, b: 'string' | 'long' | null, len: number | null, c: string | null) =>
    ({ name, parent, base: b, length: len, constraint: c, effectiveConstraint: c, span: NO_SPAN, nameSpan: NO_SPAN });
  const chainIr: PmovIR = {
    elements: [{ ...base('Artikal'), kind: 'objekat', attributes: [
      { name: 'Sifra', isId: true, domain: 'long', constraint: null, span: NO_SPAN },
      { name: 'Oznaka', isId: false, domain: 'string', length: 40, userDomain: 'Oznaka', constraint: null, span: NO_SPAN },
      { name: 'Opis', isId: false, domain: 'string', length: 100, constraint: null, span: NO_SPAN },
    ] }],
    domains: [d('Oznaka', 'KratakNaziv', 'string', 40, null), d('KratakNaziv', 'Naziv', 'string', 40, "Like '[A-Z]%'"), d('Naziv', null, 'string', 40, 'NotNull')],
  };
  const sql = generateSql(generateRelationalModel(chainIr), chainIr);
  it('domains parents first, types in tables', () => {
    expect(sql.indexOf('"Naziv"')).toBeLessThan(sql.indexOf('CREATE DOMAIN "KratakNaziv"'));
    expect(sql).toContain('CREATE DOMAIN "Naziv" AS VARCHAR(40) NOT NULL;\nCREATE DOMAIN "KratakNaziv" AS "Naziv";\n-- Like \'[A-Z]%\'\nCREATE DOMAIN "Oznaka" AS "KratakNaziv";');
    expect(sql).toContain('"Oznaka" "Oznaka",');
    expect(sql).toContain('"Opis" VARCHAR(100),');
    expect(sql.indexOf('CREATE DOMAIN')).toBeLessThan(sql.indexOf('CREATE TABLE'));
  });
  it('recognized forms become CHECK', () => {
    const mk = (c: string) => generateSql({ relations: [] }, { elements: [], domains: [d('D', null, 'long', null, c)] });
    expect(mk('Between 15,65')).toContain('CREATE DOMAIN "D" AS BIGINT CHECK (VALUE BETWEEN 15 AND 65);');
    expect(mk('In(Srpski, 3)')).toContain("CHECK (VALUE IN ('Srpski', 3));");
    expect(mk('>= 0 And <> 5 And NotNull')).toContain('AS BIGINT NOT NULL CHECK (VALUE >= 0 AND VALUE <> 5);');
    expect(mk('Moduo_11')).toContain('AS BIGINT;\n-- Moduo_11');
    expect(mk('< 3 and Moduo_11')).toContain('CHECK (VALUE < 3);\n-- Moduo_11');
  });
  it('FK actions, trigger comments, assertions', () => {
    const ir = withC(NULLABLE_IR, ref('F', 'A', 'B', null, [rule('A', 'insert', 'nullifies'), rule('B', 'update', 'restricted'), rule('B', 'delete', 'cascades')]),
      { kind: 'general', id: 'G', name: 'G', condition: 'A.IdA > B.IdB', conditionSpan: NO_SPAN, refs: [], rules: [rule('A', 'insert', 'restricted'), rule('A', 'update', 'restricted'), rule('B', 'update', 'restricted')], span: NO_SPAN, nameSpan: NO_SPAN });
    const rm = generateRelationalModel(ir);
    const s = generateSql(rm, ir);
    expect(s).toContain('ALTER TABLE "A" ADD CONSTRAINT "F" FOREIGN KEY ("IdB") REFERENCES "B" ("IdB") ON UPDATE RESTRICT ON DELETE CASCADE;\nCREATE FUNCTION "F_ins_fn"() RETURNS trigger');
    expect(s).not.toContain('(zahteva okidač)');
    expect(s).toContain('-- ograničenje G (proverava se: A INSERT, UPDATE; B UPDATE)\n-- CREATE ASSERTION "G" CHECK (A.IdA > B.IdB);');
    expect(generateSql(rm, ir, 'en')).toContain("RAISE EXCEPTION 'constraint G is violated'");
    expect(generateSql(rm, ir, 'en')).toContain('-- constraint G (checked on: A INSERT, UPDATE; B UPDATE)');
    const d2 = generateSql(generateRelationalModel(NULLABLE_IR));
    expect(d2).toContain('ON UPDATE CASCADE ON DELETE SET NULL;');
    expect(d2).not.toContain('--');
  });
  it('works for models without referential', () => {
    expect(generateSql(MAIN_EXAMPLE_RM)).toContain('ADD CONSTRAINT "fk_');
  });
});
