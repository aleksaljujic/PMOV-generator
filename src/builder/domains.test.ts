import { describe, expect, it } from 'vitest';
import { relName, isBuiltin } from './domains';
import { MESSAGES } from './types';
import { applyBuilderAction } from './index';

describe('C10 helpers', () => {
  it('relation names drop spaces', () => {
    expect(relName('Moj objekat')).toBe('Mojobjekat');
    expect(isBuiltin('string')).toBe(true);
    expect(isBuiltin('Naziv')).toBe(false);
  });
  it('sr and en messages cover the same keys, none empty', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.sr).sort());
    for (const l of ['sr', 'en'] as const) for (const v of Object.values(MESSAGES[l])) expect(v).not.toBe('');
  });
  it('sources without C10 syntax keep working (no constraints touched)', () => {
    const src = 'objekat A {\n  X# : long\n}\n';
    const r = applyBuilderAction(src, { kind: 'rename', element: 'A', newName: 'B' });
    expect(r).toEqual({ ok: true, source: 'objekat B {\n  X# : long\n}\n', select: 'B', renames: [{ from: 'A', to: 'B' }, { from: 'attr:A:X', to: 'attr:B:X' }] });
  });
});
