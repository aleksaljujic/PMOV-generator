import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { compile } from '../lang';
import { generateRelationalModel, generateSql } from './index';

describe('domeni example triggers', () => {
  const ex = EXAMPLES.find((e) => e.id === 'domeni')!;
  const { ir } = compile(ex.source);
  const rm = generateRelationalModel(ir!, { dg0Mode: 'fk' });
  it('IsplataDoPlate matches the spec text', () => {
    const s = generateSql(rm, ir!);
    expect(s).toContain([
      '-- ograničenje IsplataDoPlate (proverava se: Isplata INSERT, UPDATE; Radnik UPDATE)',
      '-- CREATE ASSERTION "IsplataDoPlate" CHECK (Isplata.Iznos <= Radnik.Plata);',
      'CREATE FUNCTION "IsplataDoPlate_fn"() RETURNS trigger LANGUAGE plpgsql AS $$',
      'BEGIN',
      '  IF EXISTS (',
      '    SELECT 1',
      '    FROM "Isplata"',
      '    JOIN "Radnik" ON "Isplata"."Mlb" = "Radnik"."Mlb"',
      '    WHERE NOT ("Isplata"."Iznos" <= "Radnik"."Plata")',
      '  ) THEN',
      "    RAISE EXCEPTION 'ograničenje IsplataDoPlate je narušeno' USING ERRCODE = 'check_violation';",
      '  END IF;',
      '  RETURN NULL;',
      'END;',
      '$$;',
      'CREATE TRIGGER "IsplataDoPlate_Isplata" AFTER INSERT OR UPDATE ON "Isplata"',
      '  FOR EACH STATEMENT EXECUTE FUNCTION "IsplataDoPlate_fn"();',
      'CREATE TRIGGER "IsplataDoPlate_Radnik" AFTER UPDATE ON "Radnik"',
      '  FOR EACH STATEMENT EXECUTE FUNCTION "IsplataDoPlate_fn"();',
    ].join('\n'));
  });
  it('mssql / oracle have no triggers', () => {
    for (const d of ['mssql', 'oracle'] as const) expect(generateSql(rm, ir!, 'sr', d)).not.toMatch(/CREATE (FUNCTION|TRIGGER)/);
  });
  it('en run', () => {
    const s = generateSql(rm, ir!, 'en');
    expect(s).toContain("'constraint IsplataDoPlate is violated'");
  });
});
