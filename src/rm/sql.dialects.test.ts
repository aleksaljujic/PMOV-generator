import { describe, expect, it } from 'vitest';
import {
  SQL_CASCADE_DIAMOND_IR, SQL_CASCADE_DIAMOND_RM, SQL_CASCADE_DIAMOND_SQL,
  SQL_DIALECT_SAMPLE_IR, SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_SQL,
} from '../fixtures/sql';
import { NO_SPAN } from '../lang/diagnostics';
import type { IRDomain, PmovIR } from '../lang';
import { generateSql } from './index';
import type { RelationalModel, ReferentialConstraint, SqlDialect } from './types';
import { DEFAULT_REF_ACTIONS } from './types';

const DIALECTS: SqlDialect[] = ['postgres', 'mssql', 'oracle'];

const dom = (name: string, parent: string | null, base: IRDomain['base'], length: number | null, constraint: string | null, eff: string | null): IRDomain =>
  ({ name, parent, base, length, constraint, effectiveConstraint: eff, span: NO_SPAN, nameSpan: NO_SPAN });
const ir = (domains: IRDomain[]): PmovIR => ({ elements: [], domains } as unknown as PmovIR);
const attr = (name: string, over: Record<string, unknown> = {}) =>
  ({ name, pk: false, fk: false, nullable: true, domain: 'string', length: null, constraint: null, references: null, ...over });
const rmOf = (attributes: unknown[], referential?: ReferentialConstraint[]): RelationalModel =>
  ({ relations: [{ name: 'T', attributes }], ...(referential ? { referential } : {}) }) as unknown as RelationalModel;
const fk = (child: string, parent: string, over: Partial<ReferentialConstraint['actions']> = {}): ReferentialConstraint => ({
  name: `fk_${child}_${parent}`, constraintId: null, child, parent, attributes: ['x'], referenced: ['x'], group: null,
  fkKind: 'identifying', actions: { ...DEFAULT_REF_ACTIONS.identifying, ...over }, explicitCells: [],
} as unknown as ReferentialConstraint);

describe('golden dialects', () => {
  for (const d of DIALECTS) {
    it(`sample ${d}`, () => {
      expect(generateSql(SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_IR, 'sr', d)).toBe(SQL_DIALECT_SAMPLE_SQL[d]);
    });
  }
  it('default is postgres', () => {
    expect(generateSql(SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_IR, 'sr')).toBe(SQL_DIALECT_SAMPLE_SQL.postgres);
  });
  it('diamond', () => {
    expect(generateSql(SQL_CASCADE_DIAMOND_RM, SQL_CASCADE_DIAMOND_IR, 'sr', 'postgres')).toBe(SQL_CASCADE_DIAMOND_SQL.postgres);
    expect(generateSql(SQL_CASCADE_DIAMOND_RM, SQL_CASCADE_DIAMOND_IR, 'sr', 'mssql')).toBe(SQL_CASCADE_DIAMOND_SQL.mssql);
    const o = generateSql(SQL_CASCADE_DIAMOND_RM, SQL_CASCADE_DIAMOND_IR, 'sr', 'oracle');
    expect(o).not.toContain('višestruke');
  });
});

describe('unit cases', () => {
  it('escapes ] and "', () => {
    const rm = rmOf([attr('a]b"c', { pk: true })]);
    expect(generateSql(rm, undefined, 'sr', 'mssql')).toContain('[a]]b"c]');
    expect(generateSql(rm, undefined, 'sr', 'oracle')).toContain('"a]b""c"');
  });
  it('NVARCHAR(MAX) above 4000', () => {
    const rm = rmOf([attr('a', { length: 4001 }), attr('b', { length: 4000 }), attr('c')]);
    const s = generateSql(rm, undefined, 'sr', 'mssql');
    expect(s).toContain('NVARCHAR(MAX)');
    expect(s).toContain('NVARCHAR(4000)');
    expect(s).toContain('NVARCHAR(255)');
  });
  it('In literals use N on SQL Server only', () => {
    const rm = rmOf([attr('a', { userDomain: 'D' })]);
    const i = ir([dom('D', null, 'string', 5, "In(a, b, 3)", "In(a, b, 3)")]);
    expect(generateSql(rm, i, 'sr', 'mssql')).toContain(`[a] IN (N'a', N'b', 3)`);
    expect(generateSql(rm, i, 'sr', 'oracle')).toContain(`"a" IN ('a', 'b', 3)`);
  });
  it('derived domain inherits check, NotNull and untranslatable parts', () => {
    const rm = rmOf([attr('a', { userDomain: 'Child' })]);
    const i = ir([
      dom('Base', null, 'short', null, 'Between 1,9 And Moduo_11', 'Between 1,9 And Moduo_11'),
      dom('Child', 'Base', 'short', null, 'NotNull And >= 3', 'Between 1,9 And Moduo_11 And NotNull And >= 3'),
    ]);
    for (const d of ['mssql', 'oracle'] as const) {
      const s = generateSql(rm, i, 'sr', d);
      const col = d === 'mssql' ? '[a]' : '"a"';
      expect(s).toContain(`${col} ${d === 'mssql' ? 'SMALLINT' : 'NUMBER(5)'} NOT NULL CHECK (${col} BETWEEN 1 AND 9 AND ${col} >= 3) -- Moduo_11`);
      expect(s).toContain('-- domen Base:');
    }
  });
  it('self reference and 2-cycle are downgraded on SQL Server', () => {
    const self = rmOf([attr('x', { pk: true })], [fk('T', 'T')]);
    expect(generateSql(self, undefined, 'sr', 'mssql')).toContain('ON UPDATE NO ACTION ON DELETE NO ACTION;\n-- [T] UPDATE: CASCADES (SQL Server');
    const cyc = rmOf([attr('x', { pk: true })], [fk('A', 'B'), fk('B', 'A')]);
    const s = generateSql(cyc, undefined, 'en', 'mssql');
    expect(s).toContain('[fk_B_A] FOREIGN KEY ([x]) REFERENCES [A] ([x]) ON UPDATE NO ACTION ON DELETE NO ACTION;');
    expect(s).toContain('[fk_A_B] FOREIGN KEY ([x]) REFERENCES [B] ([x]) ON UPDATE CASCADE');
    expect(s).toContain('-- [A] UPDATE: CASCADES (SQL Server: multiple cascade paths, requires a trigger)');
  });
  it('Oracle SET DEFAULT delete and ON UPDATE comments', () => {
    const rm = rmOf([attr('x', { pk: true })], [fk('A', 'B', { parentDelete: 'default', parentUpdate: 'nullifies' })]);
    const s = generateSql(rm, undefined, 'en', 'oracle');
    expect(s).toContain('REFERENCES "B" ("x");');
    expect(s).toContain('-- "B" UPDATE: NULLIFIES (requires a trigger)');
    expect(s).toContain('-- "B" DELETE: DEFAULT (requires a trigger)');
    expect(s).not.toContain('ON UPDATE');
  });
  it('en comment strings', () => {
    const en = generateSql(SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_IR, 'en', 'oracle');
    expect(en).toContain('-- Oracle 19c has no CREATE DOMAIN; domains are inlined into columns.');
    expect(en).toContain('-- domain Starost: NUMBER(5) CHECK (VALUE BETWEEN 15 AND 65)');
    expect(en).toContain('-- "Odeljenje" UPDATE: CASCADES (requires a trigger)');
  });
  it('child-side comments in all dialects', () => {
    const rm = rmOf([attr('x', { pk: true })], [fk('A', 'B', { childInsert: 'cascades', childUpdate: 'nullifies' })]);
    expect(generateSql(rm, undefined, 'sr', 'postgres')).toContain('-- "A" INSERT: CASCADES (zahteva okidač)');
    expect(generateSql(rm, undefined, 'sr', 'mssql')).toContain('-- [A] UPDATE: NULLIFIES (zahteva okidač)');
    expect(generateSql(rm, undefined, 'sr', 'oracle')).toContain('-- "A" INSERT: CASCADES (zahteva okidač)');
  });
});
