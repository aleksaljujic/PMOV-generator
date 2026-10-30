import { describe, expect, it } from 'vitest';
import { childTrigger, generalTriggers, translateCondition } from './triggers';
import { generateSql } from './sql';
import { DEFAULT_REF_ACTIONS } from './types';
import type { ConstraintOp } from '../lang';
import type { GeneralConstraint, ReferentialConstraint, RelAttribute, RelationalModel } from './types';

const attr = (name: string, extra: Partial<RelAttribute> = {}): RelAttribute =>
  ({ name, domain: 'long', length: null, pk: false, fk: false, nullable: false, references: null, constraint: null, ...extra }) as RelAttribute;

const fk = (child: string, parent: string, attributes: string[], referenced: string[], over: Partial<ReferentialConstraint> = {}): ReferentialConstraint => ({
  name: `fk_${child}_${parent}`, constraintId: null, child, parent, attributes, referenced, group: 'g', fkKind: 'nullable',
  actions: { ...DEFAULT_REF_ACTIONS.nullable }, explicitCells: [], ...over,
});

const rel = (name: string, attrs: string[]) => ({ name, elementId: name, attributes: attrs.map((a) => attr(a)) });
const gen = (name: string, condition: string, checks: [string, ConstraintOp[]][]): GeneralConstraint =>
  ({ name, constraintId: name, condition, checks: checks.map(([relation, ops]) => ({ relation, ops })) });

const rm: RelationalModel = {
  relations: [rel('A', ['Id', 'X', 'Y']), rel('B', ['Id', 'AId', 'Z']), rel('C', ['Id', 'BId', 'W']), rel('D', ['Id']), rel('E', ['Id', 'A1', 'A2'])],
  referential: [
    fk('B', 'A', ['AId'], ['Id']),
    fk('C', 'B', ['BId'], ['Id']),
    fk('E', 'A', ['A1'], ['Id']),
    fk('E', 'A', ['A2'], ['Id'], { name: 'fk_E_A_2' }),
  ],
};

describe('childTrigger', () => {
  const c = fk('Radnik', 'Odeljenje', ['SifOd'], ['SifOd'], { actions: { ...DEFAULT_REF_ACTIONS.nullable, childInsert: 'nullifies' } });
  it('exact text for the spec example', () => {
    expect(childTrigger(c, 'childInsert')).toBe([
      'CREATE FUNCTION "fk_Radnik_Odeljenje_ins_fn"() RETURNS trigger LANGUAGE plpgsql AS $$',
      'BEGIN',
      '  IF NEW."SifOd" IS NOT NULL',
      '     AND NOT EXISTS (SELECT 1 FROM "Odeljenje" WHERE "Odeljenje"."SifOd" = NEW."SifOd") THEN',
      '    NEW."SifOd" := NULL;',
      '  END IF;',
      '  RETURN NEW;',
      'END;',
      '$$;',
      'CREATE TRIGGER "fk_Radnik_Odeljenje_ins" BEFORE INSERT ON "Radnik"',
      '  FOR EACH ROW EXECUTE FUNCTION "fk_Radnik_Odeljenje_ins_fn"();',
    ].join('\n'));
  });
  it('composite update with default, sr and en comment', () => {
    const k = fk('T', 'P', ['a', 'b'], ['x', 'y'], { actions: { ...DEFAULT_REF_ACTIONS.nullable, childUpdate: 'default' } });
    const sr = childTrigger(k, 'childUpdate');
    expect(sr).toContain('IF NEW."a" IS NOT NULL AND NEW."b" IS NOT NULL');
    expect(sr).toContain('WHERE "P"."x" = NEW."a" AND "P"."y" = NEW."b") THEN');
    expect(sr).toContain('-- DEFAULT: kolona nema podrazumevanu vrednost, koristi se NULL');
    expect(sr).toContain('NEW."a" := NULL;\n    NEW."b" := NULL;');
    expect(sr).toContain('BEFORE UPDATE OF "a", "b" ON "T"');
    expect(sr).toContain('"fk_T_P_upd_fn"');
    expect(childTrigger(k, 'childUpdate', 'en')).toContain('-- DEFAULT: the column has no default value, NULL is used');
  });
  it('is placed after its ALTER TABLE, replaces the comment, restricted cell has none', () => {
    const model: RelationalModel = {
      relations: [{ name: 'O', elementId: 'o', attributes: [attr('S', { pk: true })] }, { name: 'R', elementId: 'r', attributes: [attr('S', { nullable: true, fk: true })] }],
      referential: [fk('R', 'O', ['S'], ['S'], { actions: { ...DEFAULT_REF_ACTIONS.nullable, childInsert: 'nullifies' } })],
    };
    const s = generateSql(model);
    expect(s).not.toContain('zahteva okidač');
    expect(s).toMatch(/ON DELETE SET NULL;\nCREATE FUNCTION "fk_R_O_ins_fn"/);
    expect(s).not.toContain('_upd');
    expect(generateSql(model, undefined, 'sr', 'mssql')).toContain('-- [R] INSERT: NULLIFIES (zahteva okidač)');
    expect(generateSql(model, undefined, 'sr', 'oracle')).not.toContain('CREATE FUNCTION');
  });
});

describe('translateCondition', () => {
  const ok = (c: string, m = rm) => {
    const t = translateCondition(c, m);
    if (!t.ok) throw new Error(t.reason);
    return t;
  };
  const bad = (c: string, locale: 'sr' | 'en' = 'sr') => {
    const t = translateCondition(c, rm, locale);
    if (t.ok) throw new Error('expected failure');
    return t.reason;
  };
  it('one relation has no join', () => {
    const t = ok('A.X > 5 And A.Y != 3');
    expect(t.from).toBe('FROM "A"');
    expect(t.where).toBe('"A"."X" > 5 AND "A"."Y" <> 3');
  });
  it('child to parent and parent to child joins', () => {
    expect(ok('B.Z <= A.X').from).toBe('FROM "B"\n    JOIN "A" ON "B"."AId" = "A"."Id"');
    expect(ok('A.X <= B.Z').from).toBe('FROM "A"\n    JOIN "B" ON "B"."AId" = "A"."Id"');
  });
  it('three-relation chain', () => {
    expect(ok('A.X < B.Z and C.W > 1').from).toBe('FROM "A"\n    JOIN "B" ON "B"."AId" = "A"."Id"\n    JOIN "C" ON "C"."BId" = "B"."Id"');
    expect(ok('C.W < A.X Or B.Z = 1').from).toBe('FROM "C"\n    JOIN "A" ON "C"."BId" = "B"."Id"'.replace('JOIN "A" ON "C"."BId" = "B"."Id"', 'JOIN "B" ON "C"."BId" = "B"."Id"') + '\n    JOIN "A" ON "B"."AId" = "A"."Id"');
  });
  it('keywords, strings, numbers', () => {
    expect(ok("not (A.X between 1 and 2.5) or A.Y in ('a''b', 'c') and A.X is not null").where)
      .toBe(`NOT ("A"."X" BETWEEN 1 AND 2.5) OR "A"."Y" IN ('a''b', 'c') AND "A"."X" IS NOT NULL`);
  });
  it('fallbacks, one per reason', () => {
    expect(bad('1 = 1')).toBe('uslov ne navodi nijedan atribut');
    expect(bad('', 'en')).toBe('the condition names no attribute');
    expect(bad('A.Q > 1')).toBe("'A.Q' ne postoji u relacionom modelu");
    expect(bad('A.X > foo()')).toBe("nepoznat deo uslova: 'foo'");
    expect(bad('A.X > 1 ; drop', 'en')).toBe("unknown part of the condition: ';'");
    expect(bad('A.X < D.Id')).toBe("relacije 'A', 'D' nisu povezane stranim ključem");
    expect(bad('A.X < E.Id', 'en')).toBe("there are several foreign keys between 'A' and 'E'");
  });
});

describe('generalTriggers', () => {
  it('orders ops INSERT, UPDATE, DELETE and one trigger per check', () => {
    const s = generalTriggers(gen('G', 'A.X > 0', [['A', ['delete', 'insert']], ['B', ['update', 'insert', 'delete']]]), rm);
    expect(s).toContain('CREATE TRIGGER "G_A" AFTER INSERT OR DELETE ON "A"\n  FOR EACH STATEMENT EXECUTE FUNCTION "G_fn"();');
    expect(s).toContain('CREATE TRIGGER "G_B" AFTER INSERT OR UPDATE OR DELETE ON "B"');
    expect(s).toContain("RAISE EXCEPTION 'ograničenje G je narušeno' USING ERRCODE = 'check_violation';");
  });
  it('en message and reason', () => {
    expect(generalTriggers(gen('G', 'A.X > 0', [['A', ['insert']]]), rm, 'en')).toContain("'constraint G is violated'");
    expect(generalTriggers(gen('G', 'A.X > 0 +', [['A', ['insert']]]), rm, 'en')).toContain('"G_fn"');
    expect(generalTriggers(gen('G', 'zzz', [['A', ['insert']]]), rm, 'en')).toBe('-- trigger not generated: the condition names no attribute');
  });
  it('fallback keeps both comment lines and adds the reason', () => {
    const m: RelationalModel = { ...rm, general: [gen('G', 'A.X < D.Id', [['A', ['insert']]])] };
    const s = generateSql(m);
    expect(s).toContain("-- ograničenje G (proverava se: A INSERT)\n-- CREATE ASSERTION \"G\" CHECK (A.X < D.Id);\n-- okidač nije generisan: relacije 'A', 'D' nisu povezane stranim ključem\n");
    expect(generateSql(m, undefined, 'sr', 'mssql')).not.toContain('okidač nije');
  });
});
