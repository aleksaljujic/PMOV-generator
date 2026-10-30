import { describe, expect, it } from 'vitest';
import { formatDiagnostic, type DiagnosticCode } from '../diagnostics';
import { ERROR_FIXTURES } from './errorFixtures';
import { compile } from './index';
import { messagesFor } from './messages';

const SERBIAN_WORDS = /\b(objekat|veza|slab|nadređeni|nadtip|podtip|specijalizacija|agregacija|atribut|domen|učesnik|kardinalnost)/i;

describe('English messages', () => {
  for (const f of ERROR_FIXTURES) {
    it(`${f.code} (${f.title}): same facts, English text`, () => {
      const sr = compile(f.source).diagnostics.filter((d) => d.code === f.code);
      const en = compile(f.source, { locale: 'en' }).diagnostics.filter((d) => d.code === f.code);
      expect(sr.length).toBeGreaterThan(0);
      expect(en.map((d) => [d.code, d.severity, d.span, d.elementId]))
        .toEqual(sr.map((d) => [d.code, d.severity, d.span, d.elementId]));
      for (let i = 0; i < en.length; i++) {
        const quoted = (sr[i]!.message.match(/'[^']*'/g) ?? []).filter((q) => !SERBIAN_WORDS.test(q));
        for (const q of quoted) expect(en[i]!.message).toContain(q);
        expect(en[i]!.message).not.toMatch(SERBIAN_WORDS);
        expect(en[i]!.message).not.toBe(sr[i]!.message);
      }
    });
  }

  it('sr locale equals the default', () => {
    for (const f of ERROR_FIXTURES) {
      expect(compile(f.source, { locale: 'sr' }).diagnostics).toEqual(compile(f.source).diagnostics);
    }
  });

  it('every E/W code has a message in both languages', () => {
    const codes: DiagnosticCode[] = [
      'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E12', 'W01', 'W02', 'W03', 'W04',
    ];
    const covered = new Set(ERROR_FIXTURES.map((f) => f.code));
    for (const c of codes) expect(covered.has(c)).toBe(true);
    expect(Object.keys(messagesFor('en')).sort()).toEqual(Object.keys(messagesFor('sr')).sort());
  });

  it('formatDiagnostic en', () => {
    const f = ERROR_FIXTURES.find((x) => x.code === 'E04')!;
    const d = compile(f.source, { locale: 'en' }).diagnostics.find((x) => x.code === 'E04')!;
    expect(formatDiagnostic(d, 'en')).toBe(`error E04 (line ${d.span.line}, col ${d.span.col}): ${d.message}`);
    expect(d.message).toContain("relationship 'V' has 3 participants");
  });
});
