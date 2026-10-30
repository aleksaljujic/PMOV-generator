// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSqlDialect, saveSqlDialect } from './storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('sql dialect storage (C11)', () => {
  it('missing or unknown means postgres', () => {
    expect(loadSqlDialect()).toBe('postgres');
    localStorage.setItem('pmov.sqlDialect.v1', 'mysql');
    expect(loadSqlDialect()).toBe('postgres');
  });
  it('round trips every dialect', () => {
    for (const d of ['postgres', 'mssql', 'oracle'] as const) {
      saveSqlDialect(d);
      expect(localStorage.getItem('pmov.sqlDialect.v1')).toBe(d);
      expect(loadSqlDialect()).toBe(d);
    }
  });
  it('storage throwing falls back to postgres', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    expect(loadSqlDialect()).toBe('postgres');
    expect(() => saveSqlDialect('oracle')).not.toThrow();
  });
});
