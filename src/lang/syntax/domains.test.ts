import { describe, expect, it } from 'vitest';
import type { AttributeLineAst, ConstraintBlockAst } from '../ast';
import { lex, parse } from './index';

const examplesPath = ['..', '..', 'examples'].join('/');
const { EXAMPLES } = (await import(/* @vite-ignore */ examplesPath)) as {
  EXAMPLES: { id: string; source: string; sourceEn?: string }[];
};

const codes = (src: string, locale?: 'sr' | 'en') => parse(src, { locale }).diagnostics.map((d) => d.code);
const attr = (src: string) => (parse(src).ast.blocks[0]!.lines[0] as AttributeLineAst).attributes[0]!;
const block = (src: string): ConstraintBlockAst => parse(src).ast.constraints![0]!;

describe('lexer arrow', () => {
  it('-> is one arrow token', () => {
    expect(lex('A -> B').tokens.map((t) => t.type)).toEqual(['ident', 'arrow', 'ident', 'eof']);
  });
});

describe('domen lines', () => {
  it('builtin with and without length, both keywords', () => {
    for (const kw of ['domen', 'domain']) {
      const r = parse(`${kw} Naziv : string(40)\n${kw} Dug : long >= 0`);
      expect(r.diagnostics).toEqual([]);
      const [a, b] = r.ast.domains!;
      expect(a!.name.text).toBe('Naziv');
      expect(a!.base).toMatchObject({ builtin: 'string', name: null, length: { value: 40 } });
      expect(a!.constraint).toBeNull();
      expect(b!.base).toMatchObject({ builtin: 'long', length: null });
      expect(b!.constraint!.text).toBe('>= 0');
    }
  });
  it('derived domain with constraint tail containing . , \' <> <=', () => {
    const r = parse("domen B : A NotNull\ndomen C : A <> 'x.y', 3 <= 4");
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.domains![0]!.base).toMatchObject({ builtin: null, name: { text: 'A' } });
    expect(r.ast.domains![0]!.constraint!.text).toBe('NotNull');
    expect(r.ast.domains![1]!.constraint!.text).toBe("<> 'x.y', 3 <= 4");
  });
  it('length on non-string parses (checker reports)', () => {
    const r = parse('domen D : short(3)');
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.domains![0]!.base!.length!.value).toBe(3);
  });
  it('missing colon / type -> S01, base null, next line unaffected', () => {
    const r = parse('domen A string\ndomen B :\ndomen C : long');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01', 'S01']);
    expect(r.ast.domains!.map((d) => d.base === null)).toEqual([true, true, false]);
  });
  it('missing name -> S01, no decl', () => {
    const r = parse('domen\ndomen X : long');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r.ast.domains).toHaveLength(1);
  });
  it('domains anywhere between blocks; keys omitted when empty', () => {
    const r = parse('objekat A { Id# }\ndomen X : long\nobjekat B { Id# }');
    expect(r.ast.blocks).toHaveLength(2);
    expect(r.ast.domains).toHaveLength(1);
    const plain = parse('objekat A { Id# }').ast;
    expect('domains' in plain).toBe(false);
    expect('constraints' in plain).toBe(false);
  });
  it('messages exist in en', () => {
    const sr = parse('domen A string');
    const en = parse('domen A string', { locale: 'en' });
    expect(en.diagnostics[0]!.span).toEqual(sr.diagnostics[0]!.span);
    expect(en.diagnostics[0]!.message).not.toBe(sr.diagnostics[0]!.message);
  });
});

describe('attribute user domain and length', () => {
  it('user domain', () => {
    const a = attr('objekat A { X : Starost NotNull }');
    // declared nowhere in this snippet: still userDomain (plus legacy S06)
    expect(a.domain).toBeNull();
    expect(a.userDomain!.text).toBe('Starost');
    expect(a.constraint!.text).toBe('NotNull');
  });
  it('declared user domain gives no diagnostics', () => {
    const r = parse('objekat A {\n X : Starost >= 1\n Y : long\n}\ndomen Starost : short');
    expect(r.diagnostics).toEqual([]);
    const [x, y] = r.ast.blocks[0]!.lines.map((l) => (l as AttributeLineAst).attributes[0]!);
    expect(x!.userDomain!.text).toBe('Starost');
    expect(x!.constraint!.text).toBe('>= 1');
    expect('userDomain' in y!).toBe(false);
    expect('length' in y!).toBe(false);
  });
  it('string(40) and length on another type', () => {
    expect(attr('objekat A { X : string(40) NotNull }').length!.value).toBe(40);
    expect(attr('objekat A { X : string(40) NotNull }').constraint!.text).toBe('NotNull');
    expect(attr('objekat A { X : short(3) }').length!.value).toBe(3);
    expect(codes('objekat A { X : short(3) }')).toEqual([]);
  });
  it('undeclared type is a user domain without S-codes (checker: E13)', () => {
    expect(codes('objekat A { X : integer }')).toEqual([]);
  });
});

describe('ograničenje blocks', () => {
  it('referential header with and without attrs, rules', () => {
    const r = parse('ograničenje R {\n  Radnik(SifOd, B) -> Odeljenje\n  Odeljenje : update CASCADES, delete restricted\n}');
    expect(r.diagnostics).toEqual([]);
    const b = r.ast.constraints![0]!;
    expect(b.kind).toBe('ograničenje');
    expect(b.name.text).toBe('R');
    expect(b.lines[0]).toMatchObject({ kind: 'refHeader', child: { text: 'Radnik' }, parent: { text: 'Odeljenje' } });
    expect((b.lines[0] as { attrs: { text: string }[] }).attrs.map((a) => a.text)).toEqual(['SifOd', 'B']);
    const rule = b.lines[1] as Extract<ConstraintBlockAst['lines'][number], { kind: 'rule' }>;
    expect(rule.items.map((i) => [i.op.value, i.action?.value])).toEqual([['update', 'cascades'], ['delete', 'restricted']]);
    const b2 = block('ogranicenje R { A -> B }');
    expect(b2.lines[0]).toMatchObject({ kind: 'refHeader', attrs: null });
    expect(block('constraint R { A -> B }').kind).toBe('ograničenje');
  });
  it('quoted relation names', () => {
    const b = block('ograničenje "Moje R" {\n  "Stavka Fakture" -> "Faktura Glava"\n  "Faktura Glava" : delete cascades\n}');
    expect(b.name).toMatchObject({ text: 'Moje R', quoted: true });
    expect(b.lines[0]).toMatchObject({ child: { text: 'Stavka Fakture', quoted: true }, parent: { text: 'Faktura Glava' } });
    expect(b.lines[1]).toMatchObject({ kind: 'rule', relation: { text: 'Faktura Glava', quoted: true } });
  });
  it('condition with <=, ., comma, quote; empty condition', () => {
    const text = "I.Iznos <= R.Plata, 'a.b' <> x";
    const b = block(`ograničenje C {\n  uslov: ${text}\n  I : insert restricted\n}`);
    expect(b.lines[0]).toMatchObject({ kind: 'condition', text });
    const e = block('constraint C {\n  condition:\n  I : insert restricted\n}');
    expect(e.lines[0]).toMatchObject({ kind: 'condition', text: '' });
    expect(parse('constraint C {\n  condition:\n}').diagnostics).toEqual([]);
  });
  it('rule items kept raw, missing action -> null, unknown words kept', () => {
    const b = block('ograničenje C {\n  A -> B\n  B : INSERT, Drop Foo, update NULLIFIES\n}');
    const rule = b.lines[1] as Extract<ConstraintBlockAst['lines'][number], { kind: 'rule' }>;
    expect(rule.items.map((i) => [i.op.value, i.action?.value ?? null])).toEqual([['insert', null], ['drop', 'foo'], ['update', 'nullifies']]);
  });
  it('bad line reports S01 and is skipped', () => {
    const r = parse('ograničenje C {\n  ??? !\n  A -> B\n}');
    expect(r.diagnostics.length).toBeGreaterThan(0);
    expect(r.ast.constraints![0]!.lines).toHaveLength(1);
    const r2 = parse('ograničenje C {\n  just words\n  A -> B\n}');
    expect(r2.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r2.ast.constraints![0]!.lines).toHaveLength(1);
  });
  it('broken header does not swallow the next block', () => {
    const r = parse('ograničenje C {\n  A -> \n  B : delete\n}\nobjekat X { Id# }\nconstraint D { P -> Q }');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r.ast.blocks.map((b) => b.name.text)).toEqual(['X']);
    expect(r.ast.constraints!.map((c) => c.name.text)).toEqual(['C', 'D']);
  });
  it('unclosed block -> S05; missing brace resyncs to next keyword', () => {
    expect(codes('ograničenje C {\n A -> B\n')).toEqual(['S05']);
    const r = parse('ograničenje C\n  A -> B\ndomen X : long\nobjekat O { Id# }');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r.ast.domains).toHaveLength(1);
    expect(r.ast.blocks).toHaveLength(1);
  });
  it('en messages for new situations', () => {
    const src = 'ograničenje C {\n  just words\n}';
    expect(parse(src, { locale: 'en' }).diagnostics[0]!.message).not.toBe(parse(src).diagnostics[0]!.message);
  });
});

describe('examples', () => {
  it('domeni parses clean in both languages with full structure', () => {
    const ex = EXAMPLES.find((e) => e.id === 'domeni')!;
    for (const src of [ex.source, ex.sourceEn!]) {
      const r = parse(src);
      expect(r.diagnostics).toEqual([]);
      expect(r.ast.domains).toHaveLength(5);
      expect(r.ast.constraints).toHaveLength(3);
    }
  });
  it('other examples have no domains / constraints / userDomain / length keys', () => {
    for (const ex of EXAMPLES.filter((e) => e.id !== 'domeni')) {
      const ast = parse(ex.source).ast;
      expect('domains' in ast).toBe(false);
      expect('constraints' in ast).toBe(false);
      expect(JSON.stringify(ast)).not.toMatch(/userDomain|"length"/);
    }
  });
});
