import { describe, expect, it } from 'vitest';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR } from '../fixtures/ir';
import { MAIN_EXAMPLE_RM } from '../fixtures/rm';
import { NO_SPAN } from '../lang/diagnostics';
import type { IRElement, IRParticipant, PmovIR } from '../lang/ir';
import {
  buildDomainTable, dg0ToggleableVezas, formatModelText, generateRelationalModel, generateSql,
} from './index';
import type { RelationalModel } from './index';

/** Replace group strings by canonical indices so only same/different matters. */
function normGroups(rm: RelationalModel): unknown {
  const map = new Map<string, number>();
  return {
    relations: rm.relations.map((r) => ({
      ...r,
      attributes: r.attributes.map((a) => {
        if (!a.references) return a;
        const key = `${r.name}|${a.references.group}`;
        if (!map.has(key)) map.set(key, map.size);
        return { ...a, references: { ...a.references, group: map.get(key) } };
      }),
    })),
  };
}

const p = (ref: string, min: 0 | 1, max: 1 | 'M', mapping: string | null = null): IRParticipant => ({
  ref, card: { min, max }, mapping, span: NO_SPAN,
});
const base = (id: string) => ({ id, name: id, span: NO_SPAN, nameSpan: NO_SPAN });
const attr = (name: string, isId = false, domain: 'long' | 'short' | null = null) => ({
  name, isId, domain, constraint: null, span: NO_SPAN,
});
const obj = (id: string, ...attrs: ReturnType<typeof attr>[]): IRElement => ({ ...base(id), kind: 'objekat', attributes: attrs });
const names = (rm: RelationalModel, rel: string) => rm.relations.find((r) => r.name === rel)!.attributes.map((a) => a.name);
const get = (rm: RelationalModel, rel: string) => rm.relations.find((r) => r.name === rel)!;

describe('generateRelationalModel', () => {
  it('MAIN equals golden fixture', () => {
    expect(normGroups(generateRelationalModel(MAIN_EXAMPLE_IR))).toEqual(normGroups(MAIN_EXAMPLE_RM));
  });

  it('formatModelText matches C04 block', () => {
    expect(formatModelText(MAIN_EXAMPLE_RM)).toBe([
      'Radnik(Mlb, ImeR, Adresa, Starost, SifOd)  key: Mlb; FK: SifOd',
      'Odeljenje(SifOd, Naziv, Mlb)  key: SifOd; FK: Mlb',
      'Student(BrojInd, Ime, Smer)  key: BrojInd',
      'Predmet(SifPred, NazivPred)  key: SifPred',
      'Nastavnik(ŠifraNast, ImeNast, Zvanje)  key: ŠifraNast',
      'Isplata(Mlb, Datum, Iznos)  key: Mlb, Datum',
      'Prijava(BrojInd, SifPred, DatumPol, Ocena, ŠifraNast)  key: BrojInd, SifPred; FK: ŠifraNast',
    ].join('\n'));
  });

  it('subtypes and recursive M:N (SPEC)', () => {
    const rm = generateRelationalModel(SPEC_EXAMPLE_IR);
    expect(formatModelText(rm).split('\n')).toEqual([
      'Građanin(Mlb, Ime, Starost)  key: Mlb',
      'Student(Mlb, BrojInd, Semestar)  key: Mlb',
      'Radnik(Mlb, Plata)  key: Mlb',
      'Dete(Mlb, Dodatak)  key: Mlb',
      'Penzioner(Mlb, Penzija)  key: Mlb',
      'Proizvod(SifProizvoda, NazivProizvoda)  key: SifProizvoda',
      'Struktura(SifProizvoda_Sastavljen, SifProizvoda_Ugrađen)  key: SifProizvoda_Sastavljen, SifProizvoda_Ugrađen',
    ]);
    const mlb = get(rm, "Student").attributes[0]!;
    expect(mlb).toMatchObject({ pk: true, fk: true, references: { relation: 'Građanin', attribute: 'Mlb' } });
    const s = get(rm, 'Struktura').attributes;
    expect(s[0]!.references!.attribute).toBe('SifProizvoda');
    expect(s[0]!.references!.group).not.toBe(s[1]!.references!.group);
  });

  it('recursive veza without mapping names gets _2', () => {
    const ir: PmovIR = { elements: [
      obj('P', attr('Id', true)),
      { ...base('S'), kind: 'veza', participants: [p('P', 0, 'M'), p('P', 0, 'M')] },
    ] };
    expect(names(generateRelationalModel(ir), 'S')).toEqual(['Id', 'Id_2']);
  });

  it('slab takes owner key + own #', () => {
    const rm = generateRelationalModel(MAIN_EXAMPLE_IR);
    const isp = get(rm, 'Isplata').attributes;
    expect(isp.map((a) => [a.name, a.pk, a.fk])).toEqual([['Mlb', true, true], ['Datum', true, false], ['Iznos', false, false]]);
  });

  it('aggregation with a GG=1 component keys on it only', () => {
    const ir: PmovIR = { elements: [
      obj('Radnik', attr('Mlb', true, 'long')),
      obj('Sindikat', attr('SifSind', true, 'short')),
      { ...base('Članstvo'), kind: 'agregacija', components: [p('Radnik', 0, 1), p('Sindikat', 0, 'M')], attributes: [] },
    ] };
    const a = get(generateRelationalModel(ir), 'Članstvo').attributes;
    expect(a.map((x) => [x.name, x.pk, x.fk])).toEqual([['Mlb', true, true], ['SifSind', false, true]]);
  });

  it('dg0Mode relation', () => {
    const rm = generateRelationalModel(MAIN_EXAMPLE_IR, { dg0Mode: 'relation' });
    expect(names(rm, 'Radnik')).toEqual(['Mlb', 'ImeR', 'Adresa', 'Starost']);
    expect(names(rm, 'Odeljenje')).toEqual(['SifOd', 'Naziv']);
    expect(names(rm, 'Prijava')).toEqual(['BrojInd', 'SifPred', 'DatumPol', 'Ocena']);
    expect(names(rm, 'Zapošljavanje')).toEqual(['Mlb', 'SifOd']);
    expect(names(rm, 'Rukovođenje')).toEqual(['Mlb', 'SifOd']);
    expect(names(rm, 'Overe')).toEqual(['BrojInd', 'SifPred', 'ŠifraNast']);
    const pkOf = (n: string) => get(rm, n).attributes.filter((a) => a.pk).map((a) => a.name);
    expect(pkOf('Zapošljavanje')).toEqual(['Mlb']);
    expect(pkOf('Rukovođenje')).toEqual(['Mlb']);
    expect(pkOf('Overe')).toEqual(['BrojInd', 'SifPred']);
  });

  it('dg0ToggleableVezas', () => {
    expect(dg0ToggleableVezas(MAIN_EXAMPLE_IR)).toEqual(['Zapošljavanje', 'Rukovođenje', 'Overe']);
  });

  it('(0,1)/(0,M): holder is the (0,1) side, nullable', () => {
    const ir: PmovIR = { elements: [
      obj('A', attr('IdA', true)), obj('B', attr('IdB', true)),
      { ...base('V'), kind: 'veza', participants: [p('A', 0, 1), p('B', 0, 'M')] },
    ] };
    const rm = generateRelationalModel(ir);
    expect(get(rm, "A").attributes[1]!).toMatchObject({ name: 'IdB', fk: true, nullable: true, pk: false });
    expect(names(rm, 'B')).toEqual(['IdB']);
  });

  it('unnamed veza relation named P_Q', () => {
    const ir: PmovIR = { elements: [
      obj('A', attr('IdA', true)), obj('B', attr('IdB', true)),
      { ...base('_#1'), name: '', kind: 'veza', participants: [p('A', 1, 'M'), p('B', 1, 'M')] },
    ] };
    expect(generateRelationalModel(ir).relations[2]!.name).toBe('A_B');
  });

  it('does not throw on odd veza', () => {
    const ir: PmovIR = { elements: [obj('A', attr('IdA', true)), { ...base('V'), kind: 'veza', participants: [p('A', 1, 1)] }] };
    expect(() => generateRelationalModel(ir)).not.toThrow();
  });
});

describe('generateSql', () => {
  const sql = generateSql(generateRelationalModel(MAIN_EXAMPLE_IR));
  it('tables, types, constraints', () => {
    expect(sql).toContain('CREATE TABLE "Radnik" (\n  "Mlb" BIGINT NOT NULL,\n  "ImeR" VARCHAR(255),');
    expect(sql).toContain('"Starost" SMALLINT, -- Between 15,65');
    expect(sql).toContain('"SifOd" SMALLINT NOT NULL, -- Moduo_11');
    expect(sql).toContain('"Datum" DATE NOT NULL');
    expect(sql).toContain('PRIMARY KEY ("Mlb", "Datum")');
    expect(sql).toContain('"BrojInd" VARCHAR(255) NOT NULL');
  });
  it('foreign keys / cycle', () => {
    expect(sql).toContain('ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;');
    expect(sql).toContain('ALTER TABLE "Odeljenje" ADD CONSTRAINT "fk_Odeljenje_Radnik" FOREIGN KEY ("Mlb") REFERENCES "Radnik" ("Mlb") ON UPDATE CASCADE ON DELETE RESTRICT;');
    expect(sql.indexOf('CREATE TABLE "Prijava"')).toBeLessThan(sql.indexOf('ALTER TABLE'));
  });
  it('composite FK in relation mode', () => {
    const s = generateSql(generateRelationalModel(MAIN_EXAMPLE_IR, { dg0Mode: 'relation' }));
    expect(s).toContain('ALTER TABLE "Overe" ADD CONSTRAINT "fk_Overe_Prijava" FOREIGN KEY ("BrojInd", "SifPred") REFERENCES "Prijava" ("BrojInd", "SifPred") ON UPDATE CASCADE ON DELETE RESTRICT;');
  });
  it('nullable FK has no NOT NULL', () => {
    const ir: PmovIR = { elements: [
      obj('A', attr('IdA', true)), obj('B', attr('IdB', true)),
      { ...base('V'), kind: 'veza', participants: [p('A', 0, 1), p('B', 0, 'M')] },
    ] };
    expect(generateSql(generateRelationalModel(ir))).toContain('"IdB" VARCHAR(255),');
  });
});

describe('buildDomainTable', () => {
  const rows = buildDomainTable(MAIN_EXAMPLE_IR);
  it('first row and dashes', () => {
    expect(rows[0]).toEqual({ attribute: 'Mlb', domain: 'long', constraint: 'NotNull' });
    expect(rows).toContainEqual({ attribute: 'BrojInd', domain: '–', constraint: '–' });
  });
  it('no # and deduplicated', () => {
    expect(rows.some((r) => r.attribute.includes('#'))).toBe(false);
    const keys = rows.map((r) => JSON.stringify(r));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
