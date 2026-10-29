import { describe, expect, it } from 'vitest';
import type { AttributeLineAst, ParticipantAst } from '../ast';
import { lex, parse } from './index';

// src/lang may not import src/examples statically (architecture rule C00); tests load it dynamically.
const examplesPath = ['..', '..', 'examples'].join('/');
const { EXAMPLES } = (await import(/* @vite-ignore */ examplesPath)) as {
  EXAMPLES: { id: string; source: string }[];
};

const attrs = (src: string) => {
  const b = parse(src).ast.blocks[0]!;
  return (b.lines[0] as AttributeLineAst).attributes;
};

describe('lex', () => {
  it('tokenizes with spans (1-based line/col, 0-based offsets)', () => {
    const src = 'objekat A {\n  Ime#\n}';
    const { tokens } = lex(src);
    const ime = tokens.find((t) => t.text === 'Ime')!;
    expect(ime.span).toMatchObject({ line: 2, col: 3, endLine: 2, endCol: 6, from: src.indexOf('Ime'), to: src.indexOf('Ime') + 3 });
    expect(tokens.at(-1)!.type).toBe('eof');
    expect(tokens.filter((t) => t.type === 'eof')).toHaveLength(1);
  });
  it('treats \\r\\n as one newline, drops comments, keeps newlines', () => {
    const { tokens } = lex('a // c\r\nb');
    expect(tokens.map((t) => t.type)).toEqual(['ident', 'newline', 'ident', 'eof']);
    expect(tokens[1]!.text).toBe('\r\n');
    expect(tokens[2]!.span.line).toBe(2);
    expect(tokens[2]!.span.col).toBe(1);
  });
  it('handles Serbian letters, numbers, quoted, unknown', () => {
    const { tokens, diagnostics } = lex('ŠifraNast čćžšđ 12 "a b" @');
    expect(tokens.map((t) => t.type)).toEqual(['ident', 'ident', 'number', 'quoted', 'unknown', 'eof']);
    expect(tokens[3]!.value).toBe('a b');
    expect(tokens[3]!.text).toBe('"a b"');
    expect(diagnostics).toEqual([]);
  });
  it('unterminated quote -> S02', () => {
    const { diagnostics, tokens } = lex('objekat "abc\nx');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('S02');
    expect(diagnostics[0]!.span).toMatchObject({ line: 1, col: 9, endCol: 13 });
    expect(tokens.some((t) => t.type === 'newline')).toBe(true);
  });
});

describe('parse blocks', () => {
  it('every block kind', () => {
    const src = `objekat A { Id# }
veza V {
  A (1,1)
  B (0,M)
}
slab S { nadređeni A (0,M) }
specijalizacija P {
  nadtip A (1,1)
  podtip B
  podtip C
}
agregacija G {
  A (0,M)
  B (0,M)
}`;
    const r = parse(src);
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.blocks.map((b) => b.kind)).toEqual(['objekat', 'veza', 'slab', 'specijalizacija', 'agregacija']);
  });
  it('Serbian names, quoted names, comments', () => {
    const r = parse('// head\nobjekat "Nalog za nabavku" { Broj# // trailing\n}\n');
    expect(r.diagnostics).toEqual([]);
    const b = r.ast.blocks[0]!;
    expect(b.name).toMatchObject({ text: 'Nalog za nabavku', quoted: true });
    expect((b.lines[0] as AttributeLineAst).attributes[0]!.isId).toBe(true);
    expect(parse('objekat Šđčćž { ŠifraNast# }').ast.blocks[0]!.name.text).toBe('Šđčćž');
  });
  it('attributes: constraints and comma rules', () => {
    expect(attrs('objekat A {\n Starost : short Between 15,65\n}')[0]!.constraint?.text).toBe('Between 15,65');
    const two = attrs('objekat A { Mlb# : long, Ime : string }');
    expect(two.map((a) => a.name.text)).toEqual(['Mlb', 'Ime']);
    expect(two[0]!.constraint).toBeNull();
    expect(two[0]!.domain?.value).toBe('long');
    expect(attrs('objekat A {\n Jezik : string In(Srpski, Ruski)\n}')[0]!.constraint?.text).toBe('In(Srpski, Ruski)');
    const plain = attrs('objekat Student { BrojInd#, Ime, Smer }');
    expect(plain).toHaveLength(3);
    expect(plain[1]!.domain).toBeNull();
  });
  it('single-line block with constraint stops at }', () => {
    const r = parse('objekat A { X : long NotNull }\nobjekat B { Y#  }');
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.blocks).toHaveLength(2);
    expect((r.ast.blocks[0]!.lines[0] as AttributeLineAst).attributes[0]!.constraint?.text).toBe('NotNull');
  });
  it('participants', () => {
    const r = parse('slab S {\n nadređeni Radnik (0,M)\n Radnik (1,1) Radi\n "Moj obj" (0,1)\n podtip X\n}');
    expect(r.diagnostics).toEqual([]);
    const [a, b, c, d] = r.ast.blocks[0]!.lines as [ParticipantAst, ParticipantAst, ParticipantAst, ParticipantAst];
    expect(a!.role?.value).toBe('nadređeni');
    expect(a.object.text).toBe('Radnik');
    expect(a.card).toMatchObject({ min: '0', max: 'M' });
    expect(a.mapping).toBeNull();
    expect(b.role).toBeNull();
    expect(b.mapping?.text).toBe('Radi');
    expect(c.object.quoted).toBe(true);
    expect(d.role?.value).toBe('podtip');
    expect(d.card).toBeNull();
  });
  it('raw cardinality is not validated', () => {
    const p = parse('veza V { A (2,X) }').ast.blocks[0]!.lines[0] as ParticipantAst;
    expect(p.card).toMatchObject({ min: '2', max: 'X' });
    expect(p.card!.span.from).toBe('veza V { A '.length);
  });
  it('veza _ across lines', () => {
    const r = parse('veza _ {\n A (1,1)\n B (0,M)\n}');
    expect(r.diagnostics).toEqual([]);
    expect(r.ast.blocks[0]!.name.text).toBe('_');
    expect(r.ast.blocks[0]!.lines).toHaveLength(2);
  });
  it('_ name outside veza -> S01', () => {
    expect(parse('objekat _ { A# }').diagnostics.map((d) => d.code)).toEqual(['S01']);
  });
});

describe('diagnostics', () => {
  it('S04 unknown block kind with resync', () => {
    const r = parse('foo Bar {\n x\n}\nobjekat A { Id# }');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S04']);
    expect(r.diagnostics[0]!.message).toContain('foo');
    expect(r.ast.blocks.map((b) => b.name.text)).toEqual(['A']);
  });
  it('S05 unclosed block', () => {
    const r = parse('objekat A {\n X#\n');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S05']);
    expect(r.diagnostics[0]!.message).toContain('A');
    expect(r.ast.blocks[0]!.lines).toHaveLength(1);
  });
  it('S06 unknown domain keeps attribute', () => {
    const r = parse('objekat A {\n X : integer\n Y : long\n}');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S06']);
    const a = (r.ast.blocks[0]!.lines[0] as AttributeLineAst).attributes[0]!;
    expect(a.domain).toBeNull();
    expect(r.ast.blocks[0]!.lines).toHaveLength(2);
  });
  it('S03 unknown character', () => {
    const r = parse('objekat A {\n @ \n}');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S03']);
  });
  it('S02 through parse', () => {
    expect(parse('objekat "A {\n}').diagnostics.some((d) => d.code === 'S02')).toBe(true);
  });
  it('span check: line 3 col 5', () => {
    const src = 'objekat A {\n  X\n    ) \n}';
    const r = parse(src);
    expect(r.diagnostics).toHaveLength(1);
    const d = r.diagnostics[0]!;
    expect(d.code).toBe('S01');
    expect(d.span).toMatchObject({ line: 3, col: 5 });
    expect(d.span.from).toBe(src.indexOf(')'));
    expect(d.elementId).toBeNull();
  });
  it('recovery: garbage line in block 1, block 2 still parsed', () => {
    const r = parse('objekat A {\n ( ( (\n X#\n}\nobjekat B { Y# }');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r.ast.blocks.map((b) => b.name.text)).toEqual(['A', 'B']);
  });
  it('participant trailing garbage -> one S01', () => {
    const r = parse('veza V {\n A (1,1) Radi extra\n B (0,M)\n}');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['S01']);
    expect(r.ast.blocks[0]!.lines).toHaveLength(2);
  });
});

describe('examples', () => {
  it('all examples parse with zero diagnostics', () => {
    for (const ex of EXAMPLES) expect(parse(ex.source).diagnostics, ex.id).toEqual([]);
  });
  it('main example has 10 blocks in order', () => {
    const r = parse(EXAMPLES[0]!.source);
    expect(r.ast.blocks.map((b) => b.kind)).toEqual([
      'objekat', 'objekat', 'objekat', 'objekat', 'objekat',
      'veza', 'veza', 'slab', 'agregacija', 'veza',
    ]);
  });
});

describe('robustness', () => {
  it('never throws on slices of examples or noise', () => {
    const noise = '{}(),:#"//\r\n_ objekat veza ŠČ@\u{1F600}';
    for (const ex of EXAMPLES) {
      for (let i = 0; i < 400; i++) {
        const a = Math.floor(Math.random() * ex.source.length);
        const b = a + Math.floor(Math.random() * 120);
        const s = ex.source.slice(a, b);
        expect(() => parse(s)).not.toThrow();
        expect(() => lex(s)).not.toThrow();
      }
    }
    for (let i = 0; i < 1000; i++) {
      let s = '';
      const len = Math.floor(Math.random() * 40);
      for (let j = 0; j < len; j++) s += [...noise][Math.floor(Math.random() * [...noise].length)];
      expect(() => parse(s)).not.toThrow();
    }
  });
});
