import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalBlockKind, canonicalRole, BLOCK_KIND_ALIASES, ROLE_ALIASES, type AttributeLineAst, type ParticipantAst } from '../ast';
import { parse } from './index';

const examplesPath = ['..', '..', 'examples'].join('/');
const { EXAMPLES } = (await import(/* @vite-ignore */ examplesPath)) as {
  EXAMPLES: { id: string; source: string; sourceEn?: string }[];
};

/** Strip spans and the written spelling of keywords. */
const strip = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (k, x) => (k === 'span' || k === 'kindSpan' || k === 'hashSpan' || k === 'keywordSpan' || k === 'textSpan' ? undefined : x)));

describe('keyword aliases', () => {
  it('nadredjeni gives the same AST as nadređeni', () => {
    const mk = (r: string) => `slab S {\n  ${r} A (1,1)\n  X#\n}\nobjekat A { Id# }`;
    expect(strip(parse(mk('nadredjeni')).ast)).toEqual(strip(parse(mk('nadređeni')).ast));
    const b = parse(mk('nadredjeni')).ast.blocks[0]!;
    expect((b.lines[0] as ParticipantAst).role?.value).toBe('nadređeni');
  });

  for (const ex of EXAMPLES) {
    it(`sourceEn of '${ex.id}' parses clean and equals the Serbian AST`, () => {
      expect(ex.sourceEn).toBeTruthy();
      const en = parse(ex.sourceEn!);
      expect(en.diagnostics).toEqual([]);
      const sr = parse(ex.source);
      expect(sr.diagnostics).toEqual([]);
      const norm = (a: unknown) =>
        JSON.parse(JSON.stringify(strip(a), (k, x) => (k === 'name' || k === 'object' || k === 'mapping' || k === 'userDomain' || k === 'child' || k === 'parent' || k === 'relation' || k === 'attrs' || k === 'text' ? undefined : k === 'constraint' ? x !== null : x)));
      expect(norm(en.ast)).toEqual(norm(sr.ast));
    });
  }

  it('mixes Serbian and English keywords', () => {
    const src = 'objekat A { Id# }\nobject B { Id# }\nspecialization S {\n  nadtip A\n  subtype B\n}';
    const r = parse(src);
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.blocks.map((b) => b.kind)).toEqual(['objekat', 'objekat', 'specijalizacija']);
    const lines = r.ast.blocks[2]!.lines as ParticipantAst[];
    expect(lines.map((l) => l.role?.value)).toEqual(['nadtip', 'podtip']);
    expect(lines[1]!.role?.span.from).toBe(src.indexOf('subtype'));
  });

  it('is case-sensitive: Object is a name', () => {
    const r = parse('objekat Object { Id# }');
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.blocks[0]!.name.text).toBe('Object');
    expect(parse('Object A { Id# }').diagnostics[0]?.code).toBe('S04');
  });

  it('resyncs at an English keyword after an error', () => {
    const r = parse('object A { Id# }\nfoo bar\nobject B { Id# }');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S04']);
    expect(r.ast.blocks.map((b) => b.name.text)).toEqual(['A', 'B']);
    const r2 = parse('foo bar baz\nobjekat B { Id# }');
    expect(r2.ast.blocks).toHaveLength(1);
  });

  it('_ name only for relationship', () => {
    expect(parse('relationship _ { A(1,1)\n B(1,1) }').diagnostics).toEqual([]);
    expect(parse('object _ { Id# }').diagnostics.map((d) => d.code)).toEqual(['S01']);
  });
});

describe('English messages', () => {
  const bad = [
    'foo A { }',
    'objekat A { Id#',
    'objekat "A { Id# }',
    'objekat { }',
    'objekat A @ { }',
    'objekat A { Id# Name }',
    'veza V { A (1 }',
  ];
  it('same codes and spans in en as in sr; messages differ; every reachable S-code covered (S06 is no longer emitted)', () => {
    const seen = new Set<string>();
    for (const src of bad) {
      const sr = parse(src);
      const en = parse(src, { locale: 'en' });
      expect(en.diagnostics.map((d) => [d.code, d.span])).toEqual(sr.diagnostics.map((d) => [d.code, d.span]));
      expect(parse(src, { locale: 'sr' })).toEqual(sr);
      for (const [i, d] of en.diagnostics.entries()) {
        seen.add(d.code);
        expect(d.message).not.toBe(sr.diagnostics[i]!.message);
      }
    }
    expect([...seen].sort()).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
  });
  it('S04 in English lists English kinds first', () => {
    expect(parse('foo A { }', { locale: 'en' }).diagnostics[0]!.message).toBe(
      "unknown block kind 'foo'. Allowed: object, relationship, weak, specialization, aggregation (or objekat, veza, slab, specijalizacija, agregacija).",
    );
  });
  it('Serbian S04 is unchanged', () => {
    expect(parse('foo A { }').diagnostics[0]!.message).toBe(
      "nepoznata vrsta bloka 'foo'. Dozvoljeno: objekat, veza, slab, specijalizacija, agregacija.",
    );
  });
});

describe('fixtures do not use alias words as names', () => {
  it('no alias word appears as a name in fixture sources', async () => {
    const aliases = new Set([...Object.keys(BLOCK_KIND_ALIASES), ...Object.keys(ROLE_ALIASES)]);
    const dir = fileURLToPath(new URL('../../fixtures/', import.meta.url));
    for (const f of readdirSync(dir)) {
      const text = readFileSync(dir + f, 'utf8');
      for (const m of text.matchAll(/(['"`])([^'"`\n]*)\1/g)) expect(aliases.has(m[2]!)).toBe(false);
    }
    expect(canonicalBlockKind('object')).toBe('objekat');
    expect(canonicalRole('owner')).toBe('nadređeni');
  });
});
