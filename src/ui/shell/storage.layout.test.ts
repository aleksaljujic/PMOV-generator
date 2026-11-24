// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAttrLock, loadLayout, loadSnap, saveAttrLock, saveLayout, saveSnap } from './storage';

beforeEach(() => localStorage.clear());

describe('layout settings storage (T49)', () => {
  it('layout defaults to grid, round trips, invalid -> grid', () => {
    expect(loadLayout()).toBe('grid');
    saveLayout('free');
    expect(localStorage.getItem('pmov.layout.v1')).toBe('free');
    expect(loadLayout()).toBe('free');
    localStorage.setItem('pmov.layout.v1', 'garbage');
    expect(loadLayout()).toBe('grid');
  });

  it.each([
    ['pmov.attrLock.v1', loadAttrLock, saveAttrLock],
    ['pmov.snap.v1', loadSnap, saveSnap],
  ] as const)('%s defaults to true and round trips', (key, load, save) => {
    expect(load()).toBe(true);
    save(false);
    expect(localStorage.getItem(key)).toBe('false');
    expect(load()).toBe(false);
    save(true);
    expect(load()).toBe(true);
    localStorage.setItem(key, 'garbage');
    expect(load()).toBe(true);
  });
});
