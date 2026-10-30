import { describe, expect, it } from 'vitest';
import { compile, type Locale } from '../lang';
import { EXAMPLES } from '../examples';
import { JSON_MODEL } from '../fixtures/json';
import { stripSpans } from '../fixtures/ir';
import { modelToSource, type PmovJsonModel } from './index';

const roundTrip = (model: PmovJsonModel, locale: Locale) => {
  const source = modelToSource(model, locale);
  const res = compile(source, { locale });
  return { source, ir: stripSpans(res.ir), res };
};

describe('modelToSource round trip', () => {
  for (const locale of ['sr', 'en'] as const) {
    it(`JSON_MODEL (${locale})`, () => {
      const { source, ir, res } = roundTrip(JSON_MODEL, locale);
      expect(res.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(ir).toEqual(JSON_MODEL);
      expect(source.endsWith('\n') && !source.endsWith('\n\n')).toBe(true);
    });
  }

  for (const ex of EXAMPLES) {
    const variants: [Locale, string | undefined][] = [['sr', ex.source], ['en', ex.sourceEn]];
    for (const [locale, src] of variants) {
      if (src === undefined) continue;
      it(`example ${ex.id} (${locale})`, () => {
        const model = stripSpans(compile(src, { locale }).ir) as PmovJsonModel;
        const { ir } = roundTrip(model, locale);
        expect(ir).toEqual(model);
      });
    }
  }

  it('uses English keywords for locale en', () => {
    const text = modelToSource(JSON_MODEL, 'en');
    expect(text).toContain('domain Naziv');
    expect(text).toContain('relationship _ {');
    expect(text).toContain('weak Isplata {');
    expect(text).toContain('owner Radnik');
    expect(text).toContain('condition: Isplata.Iznos >= 0');
    expect(text).toContain('"Radna jedinica"');
  });

  it('prints an unknown ref and the compile reports the usual E-code', () => {
    const model: PmovJsonModel = {
      elements: [
        { kind: 'objekat', id: 'A', name: 'A', attributes: [{ name: 'X', isId: true, domain: 'long', constraint: null }] },
        { kind: 'veza', id: 'V', name: 'V', participants: [
          { ref: 'A', card: { min: 0, max: 'M' }, mapping: null },
          { ref: 'Nepostojeci', card: { min: 1, max: 1 }, mapping: null },
        ] },
      ],
    };
    const { res } = roundTrip(model, 'sr');
    expect(res.diagnostics.some((d) => d.code === 'E02')).toBe(true);
  });
});
