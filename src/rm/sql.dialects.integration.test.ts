import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { compile } from '../lang';
import { generateRelationalModel, generateSql } from './index';

describe('SQL dialects over the examples', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id}`, () => {
      const { ir } = compile(ex.source);
      expect(ir).toBeTruthy();
      const rm = generateRelationalModel(ir!, { dg0Mode: 'fk' });
      for (const d of ['mssql', 'oracle'] as const) {
        const s = generateSql(rm, ir!, 'sr', d);
        // The mandated comment line itself mentions CREATE DOMAIN; only statements are forbidden.
        expect(s).not.toMatch(/^CREATE DOMAIN/m);
        expect(s).not.toMatch(/RESTRICT/);
        if (d === 'oracle') expect(s).not.toContain('ON UPDATE');
      }
      expect(generateSql(rm, ir!, 'sr', 'postgres')).toBe(generateSql(rm, ir!, 'sr'));
    });
  }
});
