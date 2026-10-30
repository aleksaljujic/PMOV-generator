import { describe, expect, it } from 'vitest';
import { compile } from '../lang';
import { applyBuilderAction, isPlaceholderName, pickRejection, placeholderName } from './index';
import { MESSAGES, MSG } from './types';

describe('locale: names and messages', () => {
  it('isPlaceholderName recognises both languages', () => {
    for (const n of ['Weak3', 'Slab3', 'Object1', 'Objekat1', 'Aggregation2', 'Kind1', 'Subtype9', 'Vrsta4', 'Podtip1']) {
      expect(isPlaceholderName(n)).toBe(true);
    }
    for (const n of ['Employee', 'Object', 'Weak', 'Objekat1x', 'object1']) expect(isPlaceholderName(n)).toBe(false);
  });

  it('placeholderName uses the locale prefix', () => {
    expect(placeholderName(null, 'objekat')).toBe('Objekat1');
    expect(placeholderName(null, 'objekat', [], 'en')).toBe('Object1');
    expect(placeholderName(null, 'slab', [], 'en')).toBe('Weak1');
    expect(placeholderName(null, 'agregacija', [], 'en')).toBe('Aggregation1');
    expect(placeholderName(null, 'specijalizacija', [], 'en')).toBe('Kind1');
    expect(placeholderName(null, 'podtip', [], 'en')).toBe('Subtype1');
    expect(placeholderName(null, 'objekat', ['Objekat1'], 'en')).toBe('Object1');
    expect(placeholderName(null, 'objekat', ['Object1'], 'en')).toBe('Object2');
    expect(placeholderName(null, 'objekat', ['Object1'])).toBe('Objekat1');
  });

  it('message tables have identical keys', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.sr).sort());
    expect(MESSAGES.sr.syntax).toBe(MSG.syntax);
  });

  it('failures are reported in the requested locale', () => {
    const src = 'objekat A {\n}\nobjekat B {\n}\n';
    const sr = applyBuilderAction(src, { kind: 'rename', element: 'A', newName: 'B' });
    const en = applyBuilderAction(src, { kind: 'rename', element: 'A', newName: 'B' }, { locale: 'en' });
    expect(sr).toEqual({ ok: false, message: 'Ime je već zauzeto.' });
    expect(en).toEqual({ ok: false, message: 'That name is already taken.' });
    expect(applyBuilderAction('objekat {', { kind: 'addObject', near: 'A' }, { locale: 'en' })).toEqual({
      ok: false,
      message: MESSAGES.en.syntax,
    });
  });

  it('delete confirmation is localised', () => {
    const src = 'objekat A {\n}\nobjekat B {\n}\nagregacija G {\n  A (0,M)\n  B (0,M)\n}\n';
    const r = applyBuilderAction(src, { kind: 'deleteElement', element: 'A', withDependents: false }, { locale: 'en' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('Also delete dependent elements (1)?');
  });

  it('pickRejection is localised', () => {
    const ir = compile('objekat A {\n}\nobjekat B {\n}\nagregacija G {\n  A (0,M)\n  B (0,M)\n}\n').ir!;
    expect(pickRejection(ir, { kind: 'agregacija', first: 'A' }, 'A')).toBe('Komponente moraju biti različiti elementi.');
    expect(pickRejection(ir, { kind: 'agregacija', first: 'A' }, 'A', 'en')).toBe('Components must be different elements.');
    expect(pickRejection(ir, { kind: 'component', agregacija: 'G' }, 'A', 'en')).toBe('The element is already a component.');
  });
});
