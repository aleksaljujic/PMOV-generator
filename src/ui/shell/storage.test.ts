// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS, clearPositions, loadDg0Mode, loadEditorWidth, loadPositions, loadSource,
  saveDg0Mode, saveEditorWidth, savePositions, saveSource,
} from './storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
  it('round trips source, positions, dg0Mode, width', () => {
    expect(loadSource()).toBeNull();
    saveSource('objekat A {}');
    expect(loadSource()).toBe('objekat A {}');
    savePositions({ A: { x: 1, y: 2 } });
    expect(loadPositions()).toEqual({ A: { x: 1, y: 2 } });
    clearPositions();
    expect(loadPositions()).toEqual({});
    saveDg0Mode('relation');
    expect(loadDg0Mode()).toBe('relation');
    saveEditorWidth(444.4);
    expect(loadEditorWidth()).toBe(444);
  });

  it('defaults on corrupted data', () => {
    localStorage.setItem(STORAGE_KEYS.positions, '{not json');
    expect(loadPositions()).toEqual({});
    localStorage.setItem(STORAGE_KEYS.positions, '[1,2]');
    expect(loadPositions()).toEqual({});
    localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify({ A: { x: 1, y: 'q' }, B: { x: 3, y: 4 } }));
    expect(loadPositions()).toEqual({ B: { x: 3, y: 4 } });
    localStorage.setItem(STORAGE_KEYS.dg0Mode, 'bogus');
    expect(loadDg0Mode()).toBe('fk');
    localStorage.setItem(STORAGE_KEYS.editorWidth, 'abc');
    expect(loadEditorWidth()).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    const boom = () => { throw new Error('denied'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    expect(loadSource()).toBeNull();
    expect(loadPositions()).toEqual({});
    expect(loadDg0Mode()).toBe('fk');
    expect(() => { saveSource('x'); savePositions({}); clearPositions(); saveDg0Mode('fk'); saveEditorWidth(1); }).not.toThrow();
  });
});
