// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadMode, saveMode } from './storage';

beforeEach(() => localStorage.clear());

describe('mode storage (C09)', () => {
  it('defaults to tekst and round trips', () => {
    expect(loadMode()).toBe('tekst');
    saveMode('interaktivno');
    expect(localStorage.getItem('pmov.mode.v1')).toBe('interaktivno');
    expect(loadMode()).toBe('interaktivno');
    localStorage.setItem('pmov.mode.v1', 'garbage');
    expect(loadMode()).toBe('tekst');
  });
});
