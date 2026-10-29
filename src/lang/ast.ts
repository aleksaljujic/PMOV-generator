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
