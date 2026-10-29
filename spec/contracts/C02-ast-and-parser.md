# C02 — AST, lexer and parser

Owner: **T01**. Consumers: T02 (checker, IR builder), T07 (editor highlighting may reuse `lex`).

## Contract code

```ts
// FILE: src/lang/ast.ts
// CONTRACT C02 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Diagnostic, SourceSpan } from './diagnostics';

export type BlockKind = 'objekat' | 'veza' | 'slab' | 'specijalizacija' | 'agregacija';
export const BLOCK_KINDS: readonly BlockKind[] = ['objekat', 'veza', 'slab', 'specijalizacija', 'agregacija'];

export type Role = 'nadređeni' | 'nadtip' | 'podtip';
export const ROLES: readonly Role[] = ['nadređeni', 'nadtip', 'podtip'];

export type Domain = 'long' | 'short' | 'string' | 'date';
export const DOMAINS: readonly Domain[] = ['long', 'short', 'string', 'date'];

export interface NameAst {
  /** Name without quotes. `_` for the unnamed veza. */
  text: string;
  quoted: boolean;
  span: SourceSpan;
}

export interface CardinalityAst {
  /** Raw trimmed text between "(" and ",". NOT validated by the parser (checker → E03). */
  min: string;
  /** Raw trimmed text between "," and ")". */
  max: string;
  /** Span from "(" to ")" inclusive. */
  span: SourceSpan;
}

export interface AttributeAst {
  kind: 'attribute';
  name: NameAst;
  isId: boolean;
  hashSpan: SourceSpan | null;
  domain: { value: Domain; span: SourceSpan } | null;
  /** Free text after the domain, trimmed; null when absent. */
  constraint: { text: string; span: SourceSpan } | null;
  span: SourceSpan;
}

export interface AttributeLineAst {
  kind: 'attributeLine';
  attributes: AttributeAst[];
  span: SourceSpan;
}

export interface ParticipantAst {
  kind: 'participant';
  role: { value: Role; span: SourceSpan } | null;
  object: NameAst;
  card: CardinalityAst | null;
  mapping: NameAst | null;
  span: SourceSpan;
}

export type LineAst = AttributeLineAst | ParticipantAst;

export interface BlockAst {
  kind: BlockKind;
  kindSpan: SourceSpan;
  name: NameAst;
  lines: LineAst[];
  /** From the kind keyword to the closing "}" (or to EOF if unclosed). */
  span: SourceSpan;
}

export interface ModelAst {
  blocks: BlockAst[];
}

export type TokenType =
  | 'ident' | 'quoted' | 'number'
  | 'lbrace' | 'rbrace' | 'lparen' | 'rparen' | 'comma' | 'colon' | 'hash'
  | 'newline' | 'eof' | 'unknown';

export interface Token {
  type: TokenType;
  /** Exact source text (including quotes for `quoted`). */
  text: string;
  /** Decoded value: quoted → content without quotes; others → same as text. */
  value: string;
  span: SourceSpan;
}

export interface LexResult { tokens: Token[]; diagnostics: Diagnostic[] }
export interface ParseResult { ast: ModelAst; diagnostics: Diagnostic[] }
```

## Function signatures

```ts
// src/lang/syntax/index.ts   (exported via src/lang)
export function lex(source: string): LexResult;

// src/lang/syntax/index.ts
export function parse(source: string): ParseResult;   // calls lex() internally
```

Both are pure, synchronous, never throw on any input (fuzz-safe), and always return a (possibly partial) AST.

## Lexical rules

- `ident` = `[\p{L}_][\p{L}\p{N}_]*` (Unicode letters, so č ć ž š đ Č Ć Ž Š Đ work). Case-sensitive.
  Keywords (block kinds, roles, domains, `M`, `m`) are plain `ident` tokens; the parser interprets them.
- `quoted` = `"` … `"` on one line; no escapes. Unterminated → S02, token ends at end of line.
- `number` = `[0-9]+`.
- Punctuation: `{ } ( ) , : #`.
- `//` to end of line is a comment: dropped, the newline is still emitted.
- Whitespace other than `\n` is skipped. `\r\n` counts as one newline.
- Any other character → token `unknown` **without** a diagnostic (the parser decides: inside a constraint it is
  fine, elsewhere it reports S03).
- Exactly one `eof` token at the end.

## Grammar disambiguation (the parser must implement exactly this)

1. Top level: skip `newline`s; expect an `ident` that is a block kind (else S04, then skip to the next line whose
   first token is a block kind keyword, or past the next balanced `}`). Then a name (`ident` or `quoted`;
   `_` allowed only for `veza` — otherwise S01). Then `{`.
2. Inside a block, content between newlines is one **line**. The first line may start right after `{` on the
   same line, and the last may end right before `}` on the same line (`objekat Student { BrojInd#, Ime, Smer }`).
3. A line is a **participant** if its first token is a role keyword, or if the token after the name is `(`.
   Otherwise it is an **attribute line**.
4. Participant: `[role] name [ "(" tokens "," tokens ")" [ name ] ]`. The cardinality text is taken raw (so
   `(2,X)` parses and the checker reports E03). Anything after the mapping name → S01, skip rest of line.
5. Attribute line: `attribute { "," attribute }` where
   `attribute = name ["#"] [":" domain [constraint]]`.
   - A word after `:` that is not a domain → S06 (the attribute is kept with `domain: null`).
   - **Constraint rule:** after a domain, if the next token is `,` a new attribute starts
     (`{ Mlb# : long, Ime : string }`). Otherwise *everything* up to the end of the line — or up to a `}` at
     paren-depth 0 that closes the block — is the constraint, commas included (`Between 15,65`,
     `In(Srpski, Ruski)`). Constraint text = exact source slice from the first to the last constraint token,
     trimmed.
6. Error recovery: on an error inside a line, report once, skip to the next newline, continue. On EOF inside a
   block → S05, close the block with what was collected.

## Required test coverage (T01)

Every block kind; Serbian letters in names; quoted names with spaces; comments (full-line and trailing);
comma-separated attributes with and without domains; constraint containing commas and parentheses; single-line
blocks; participant with/without role, cardinality and mapping; `_` veza name; correct `line`/`col`/`from`/`to`
on tokens and diagnostics; recovery (an error in block 1 still yields block 2); both examples in
`src/examples/index.ts` parse with zero diagnostics.
