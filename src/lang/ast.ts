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
  /** Built-in type only. null when absent OR when the type is a user domain (see `userDomain`). */
  domain: { value: Domain; span: SourceSpan } | null;
  /** Free text after the domain, trimmed; null when absent. */
  constraint: { text: string; span: SourceSpan } | null;
  span: SourceSpan;
  /** C10: user domain used as the type (`Starost : Starost`). Key present ONLY when non-null. */
  userDomain?: NameAst | null;
  /** C10: `string(40)` → 40. Key present ONLY when given. Parser accepts it on any built-in; checker → E14 unless `string`. */
  length?: { value: number; span: SourceSpan } | null;
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
  /** C10: `domen` lines in source order. Key present ONLY when non-empty (keeps old golden ASTs equal). */
  domains?: DomainDeclAst[];
  /** C10: `ograničenje` blocks in source order; NOT in `blocks` (no diagram element). Key present ONLY when non-empty. */
  constraints?: ConstraintBlockAst[];
}

// ---------- C10: domains and cross-table constraints (spec/feature_domain_strucutre.md) ----------

/** Top-level keyword → canonical. Case-sensitive, like the other keywords. */
export const DOMAIN_DECL_KEYWORDS: Readonly<Record<string, 'domen'>> = { domen: 'domen', domain: 'domen' };
export const CONSTRAINT_BLOCK_KEYWORDS: Readonly<Record<string, 'ograničenje'>> = {
  'ograničenje': 'ograničenje', ogranicenje: 'ograničenje', constraint: 'ograničenje',
};
/** First word of a general constraint's condition line (`uslov: …`). */
export const CONDITION_KEYWORDS: Readonly<Record<string, 'uslov'>> = { uslov: 'uslov', condition: 'uslov' };

export function isDomainDeclKeyword(word: string): boolean { return hasOwn(DOMAIN_DECL_KEYWORDS, word); }
export function isConstraintBlockKeyword(word: string): boolean { return hasOwn(CONSTRAINT_BLOCK_KEYWORDS, word); }
export function isConditionKeyword(word: string): boolean { return hasOwn(CONDITION_KEYWORDS, word); }

/** Keyword spelling used when generating text (builder) in the given UI language. */
export const DECL_KEYWORDS: Readonly<Record<Locale, { domain: string; constraint: string; condition: string }>> = {
  sr: { domain: 'domen', constraint: 'ograničenje', condition: 'uslov' },
  en: { domain: 'domain', constraint: 'constraint', condition: 'condition' },
};

/** Operations and actions are case-insensitive in source; the AST/IR hold them lower-case. */
export type ConstraintOp = 'insert' | 'update' | 'delete';
export const CONSTRAINT_OPS: readonly ConstraintOp[] = ['insert', 'update', 'delete'];
export type ConstraintAction = 'restricted' | 'cascades' | 'nullifies' | 'default';
export const CONSTRAINT_ACTIONS: readonly ConstraintAction[] = ['restricted', 'cascades', 'nullifies', 'default'];

/** `domen <name> : <base> [constraint]` (one top-level line). */
export interface DomainDeclAst {
  kind: 'domainDecl';
  keywordSpan: SourceSpan;
  name: NameAst;
  /** null when the `: type` part is missing (parser also reports an S-code). */
  base: {
    /** Built-in type, or null when the base is another domain (`name`). */
    builtin: Domain | null;
    /** Naddomen name; null for a built-in base. */
    name: NameAst | null;
    length: { value: number; span: SourceSpan } | null;
    span: SourceSpan;
  } | null;
  /** Free text after the type, trimmed (same rule as an attribute constraint). */
  constraint: { text: string; span: SourceSpan } | null;
  /** Whole line, keyword … end of constraint. */
  span: SourceSpan;
}

/** `Child[(a, b)] -> Parent` — first line of a referential constraint. */
export interface RefHeaderAst {
  kind: 'refHeader';
  child: NameAst;
  /** null when the `(…)` list is omitted. */
  attrs: NameAst[] | null;
  parent: NameAst;
  span: SourceSpan;
}

/** `uslov: <free text>` — first line of a general constraint. */
export interface ConditionLineAst {
  kind: 'condition';
  keywordSpan: SourceSpan;
  /** Raw text after the colon, trimmed. May be ''. */
  text: string;
  textSpan: SourceSpan;
  span: SourceSpan;
}

/** `Relation : op action {, op action}`. Unknown words are kept raw (lower-cased) for the checker (E17). */
export interface RuleLineAst {
  kind: 'rule';
  relation: NameAst;
  items: { op: { value: string; span: SourceSpan }; action: { value: string; span: SourceSpan } | null; span: SourceSpan }[];
  span: SourceSpan;
}

export type ConstraintLineAst = RefHeaderAst | ConditionLineAst | RuleLineAst;

export interface ConstraintBlockAst {
  kind: 'ograničenje';
  kindSpan: SourceSpan;
  name: NameAst;
  lines: ConstraintLineAst[];
  /** From the keyword to the closing "}" (or to EOF if unclosed). */
  span: SourceSpan;
}

export type TokenType =
  | 'ident' | 'quoted' | 'number'
  | 'lbrace' | 'rbrace' | 'lparen' | 'rparen' | 'comma' | 'colon' | 'hash'
  | 'newline' | 'eof' | 'unknown'
  /** C10: `->` in a referential constraint header. */
  | 'arrow';

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
