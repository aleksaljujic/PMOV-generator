import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, loadLang, saveLang } from './storage';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
});

describe('language storage', () => {
  it('uses the pmov.lang.v1 key', () => expect(STORAGE_KEYS.lang).toBe('pmov.lang.v1'));
  it('defaults to sr', () => expect(loadLang()).toBe('sr'));
  it('round-trips', () => {
    saveLang('en');
    expect(loadLang()).toBe('en');
    saveLang('sr');
    expect(loadLang()).toBe('sr');
  });
  it('falls back to sr on invalid values', () => {
    store.set('pmov.lang.v1', 'de');
    expect(loadLang()).toBe('sr');
  });
});
