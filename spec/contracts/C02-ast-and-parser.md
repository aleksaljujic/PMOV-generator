# C02 — AST, lexer and parser

Owner: **T01**. Consumers: T02 (checker, IR builder), T07 (editor highlighting may reuse `lex`).

## Contract code

```ts
// FILE: src/lang/ast.ts
// CONTRACT C02 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Diagnostic, Locale, SourceSpan } from './diagnostics';

export type BlockKind = 'objekat' | 'veza' | 'slab' | 'specijalizacija' | 'agregacija';
export const BLOCK_KINDS: readonly BlockKind[] = ['objekat', 'veza', 'slab', 'specijalizacija', 'agregacija'];

export type Role = 'nadređeni' | 'nadtip' | 'podtip';
export const ROLES: readonly Role[] = ['nadređeni', 'nadtip', 'podtip'];

/** Alternative keyword spellings accepted by the parser. The AST always holds the canonical (Serbian) value. */
export const BLOCK_KIND_ALIASES: Readonly<Record<string, BlockKind>> = {
  object: 'objekat',
  relationship: 'veza',
  weak: 'slab',
  specialization: 'specijalizacija',
  aggregation: 'agregacija',
};
export const ROLE_ALIASES: Readonly<Record<string, Role>> = {
  nadredjeni: 'nadređeni',
  owner: 'nadređeni',
  supertype: 'nadtip',
  subtype: 'podtip',
};

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Canonical block kind for a keyword or alias (`object` → `objekat`), else null. Case-sensitive. */
export function canonicalBlockKind(word: string): BlockKind | null {
  if ((BLOCK_KINDS as readonly string[]).includes(word)) return word as BlockKind;
  return hasOwn(BLOCK_KIND_ALIASES, word) ? (BLOCK_KIND_ALIASES[word] ?? null) : null;
}

/** Canonical role for a keyword or alias (`nadredjeni`, `owner` → `nadređeni`), else null. Case-sensitive. */
export function canonicalRole(word: string): Role | null {
  if ((ROLES as readonly string[]).includes(word)) return word as Role;
  return hasOwn(ROLE_ALIASES, word) ? (ROLE_ALIASES[word] ?? null) : null;
}

/** Keyword spelling used when generating DSL text (builder) in the given UI language. */
export const BLOCK_KIND_KEYWORDS: Readonly<Record<Locale, Readonly<Record<BlockKind, string>>>> = {
  sr: { objekat: 'objekat', veza: 'veza', slab: 'slab', specijalizacija: 'specijalizacija', agregacija: 'agregacija' },
  en: { objekat: 'object', veza: 'relationship', slab: 'weak', specijalizacija: 'specialization', agregacija: 'aggregation' },
};
export const ROLE_KEYWORDS: Readonly<Record<Locale, Readonly<Record<Role, string>>>> = {
  sr: { nadređeni: 'nadređeni', nadtip: 'nadtip', podtip: 'podtip' },
  en: { nadređeni: 'owner', nadtip: 'supertype', podtip: 'subtype' },
};

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
export function lex(source: string, options?: LangOptions): LexResult;

// src/lang/syntax/index.ts
export function parse(source: string, options?: LangOptions): ParseResult;   // calls lex() internally; locale only affects messages
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
   - A word after `:` that is not a domain → S06 (the attribute is kept with `domain: null`). **Superseded by C10 (T22): no S06 any more; the word sets `userDomain` and the checker reports E13.**
   - **Constraint rule:** after a domain, if the next token is `,` a new attribute starts
     (`{ Mlb# : long, Ime : string }`). Otherwise *everything* up to the end of the line — or up to a `}` at
     paren-depth 0 that closes the block — is the constraint, commas included (`Between 15,65`,
     `In(Srpski, Ruski)`). Constraint text = exact source slice from the first to the last constraint token,
     trimmed.
6. Error recovery: on an error inside a line, report once, skip to the next newline, continue. On EOF inside a
   block → S05, close the block with what was collected.

### Keyword aliases (spec/fix_editor.md, CHANGELOG 2026-10-30)

- Wherever the grammar above says "block kind" or "role keyword", the parser uses `canonicalBlockKind(word)` /
  `canonicalRole(word)`, so the aliases in `BLOCK_KIND_ALIASES` / `ROLE_ALIASES` (`object`, `relationship`, `weak`,
  `specialization`, `aggregation`, `nadredjeni`, `owner`, `supertype`, `subtype`) work exactly like the canonical
  Serbian words, in any UI language, and can be mixed in one source. This includes rule 1 (top level and error
  resync) and rule 3 (participant detection).
- `BlockAst.kind` and `ParticipantAst.role.value` always hold the **canonical** value. `kindSpan` and `role.span`
  still point at the word as written, so a source edit can see how it was spelled.
- Matching is case-sensitive (`Object` is a plain name).
- The `_` name is allowed only when the canonical kind is `veza`.

## Required test coverage (T01)

Every block kind; Serbian letters in names; quoted names with spaces; comments (full-line and trailing);
comma-separated attributes with and without domains; constraint containing commas and parentheses; single-line
blocks; participant with/without role, cardinality and mapping; `_` veza name; correct `line`/`col`/`from`/`to`
on tokens and diagnostics; recovery (an error in block 1 still yields block 2); both examples in
`src/examples/index.ts` parse with zero diagnostics.
