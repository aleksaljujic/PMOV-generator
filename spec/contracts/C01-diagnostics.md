# C01 — Source spans and diagnostics

Owner of the file: **T00** (writes it verbatim). Emitters: **T01** (S-codes), **T02** (E/W-codes); for the English
messages **T15** (S-codes) and **T16** (E/W-codes), see §English messages.
Consumers: T07 (lint squiggles), T09 (error panel, red outlines), T05 (via `elementId`).

## Contract code

```ts
// FILE: src/lang/diagnostics.ts
// CONTRACT C01 — frozen. Change only via spec/contracts/CHANGELOG.md.

export interface SourceSpan {
  /** 0-based UTF-16 offset of the first character (CodeMirror position). */
  from: number;
  /** 0-based UTF-16 offset one past the last character. */
  to: number;
  /** 1-based line of `from`. */
  line: number;
  /** 1-based column of `from` (UTF-16 units). */
  col: number;
  /** 1-based line of `to`. */
  endLine: number;
  /** 1-based column of `to`. */
  endCol: number;
}

/** Placeholder span for synthesized nodes and hand-written fixtures. */
export const NO_SPAN: SourceSpan = { from: 0, to: 0, line: 0, col: 0, endLine: 0, endCol: 0 };

export function joinSpans(a: SourceSpan, b: SourceSpan): SourceSpan {
  const first = a.from <= b.from ? a : b;
  const last = a.to >= b.to ? a : b;
  return { from: first.from, line: first.line, col: first.col, to: last.to, endLine: last.endLine, endCol: last.endCol };
}

export type Severity = 'error' | 'warning';

export type SyntaxCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06';
export type ErrorCode =
  | 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08' | 'E09' | 'E10' | 'E11' | 'E12';
export type WarningCode = 'W01' | 'W02' | 'W03' | 'W04';
export type DiagnosticCode = SyntaxCode | ErrorCode | WarningCode;

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Message body in the requested locale (default Serbian Latin), WITHOUT the "greška E04 (red …)" prefix. */
  message: string;
  /** Where the squiggle goes. Points at the most specific token (name, cardinality, attribute …). */
  span: SourceSpan;
  /** Id of the IR element (C03) that should get a red outline; null for syntax errors / no owner. */
  elementId: string | null;
}

export function severityOf(code: DiagnosticCode): Severity {
  return code.startsWith('W') ? 'warning' : 'error';
}

/** Language of UI text and diagnostic messages. Codes, spans and the DSL itself do not depend on it. */
export type Locale = 'sr' | 'en';
export const LOCALES: readonly Locale[] = ['sr', 'en'];
export const DEFAULT_LOCALE: Locale = 'sr';

/** Options accepted by `lex`, `parse` and `compile`; omitted ⇒ Serbian messages. */
export interface LangOptions {
  locale?: Locale;
}

/** sr: "greška E04 (red 12, kol 1): veza 'Overe' ima 3 učesnika, …"
 *  en: "error E04 (line 12, col 1): relationship 'Overe' has 3 participants, …" */
export function formatDiagnostic(d: Diagnostic, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'en') {
    const prefix = d.severity === 'error' ? 'error' : 'warning';
    return `${prefix} ${d.code} (line ${d.span.line}, col ${d.span.col}): ${d.message}`;
  }
  const prefix = d.severity === 'error' ? 'greška' : 'upozorenje';
  return `${prefix} ${d.code} (red ${d.span.line}, kol ${d.span.col}): ${d.message}`;
}
```

## Code catalogue

Messages are templates; `{x}` is substituted. Wording may be refined by the emitter, but **the code,
severity, the span target and the listed facts in the message must stay**. Tests (T02) match on
`code` and `elementId`, plus `toContain` on the quoted names — never on the full sentence.

### Syntax (emitted by T01 `lex`/`parse`; `elementId` = null)

| Code | When | Span | Message template |
|---|---|---|---|
| S01 | Unexpected token / expected X | offending token | `neočekivan simbol '{tok}', očekivano {what}.` |
| S02 | Unterminated quoted name (newline or EOF before `"`) | from `"` to end of line | `nezatvoren naziv pod navodnicima.` |
| S03 | Character that cannot start any token, outside a constraint | the char | `nepoznat znak '{ch}'.` |
| S04 | Unknown block kind at top level | the word | `nepoznata vrsta bloka '{word}'. Dozvoljeno: objekat, veza, slab, specijalizacija, agregacija.` |
| S05 | EOF before the closing `}` of a block | block header name | `blok '{name}' nije zatvoren — nedostaje '}'.` |
| S06 | Word after `:` is not a domain | the word | `nepoznat domen '{word}'. Dozvoljeno: long, short, string, date.` |

### Semantic errors (emitted by T02 checker)

| Code | When | Span | `elementId` | Message template |
|---|---|---|---|---|
| E01 | Block name already declared (any kind) | name of the later block | earlier block's id | `ime '{name}' je već deklarisano u redu {line}.` |
| E02 | Participant / nadređeni / nadtip / podtip names an undeclared `objekat`/`slab`/`agregacija` (a `veza` or `specijalizacija` name also counts as undeclared) | the referenced name | enclosing block | `'{name}' nije deklarisan objekat, slab objekat ni agregacija.` |
| E03 | Cardinality not DG∈{0,1}, GG∈{1,M,m}, DG≤GG | the `(DG,GG)` | enclosing block | `neispravna kardinalnost ({dg},{gg}): DG mora biti 0 ili 1, GG mora biti 1 ili M, i DG ≤ GG.` |
| E04 | `veza` has ≠2 participants, or a participant has a role | block name (count) / role word (role) | the veza | `veza '{name}' ima {n} učesnika, a veza mora imati tačno 2. Za vezu više objekata koristi 'agregacija'.` / `učesnik veze ne sme imati ulogu '{role}'.` |
| E05 | `veza` contains an attribute line | the attribute name | the veza | `veza '{name}' ne može imati atribut '{attr}'. Ako je to učesnik, dodaj kardinalnost (DG,GG); za vezu sa atributima koristi 'agregacija'.` |
| E06 | `slab` without exactly one `nadređeni X (DG,GG)`, or without any `#` attribute, or with a non-`nadređeni` participant | block name | the slab | `slab objekat '{name}' mora imati tačno jednog učesnika 'nadređeni X (DG,GG)'.` / `slab objekat '{name}' mora imati bar jedan parcijalni identifikator (#).` |
| E07 | `specijalizacija` shape wrong: ≠1 `nadtip X (DG,GG)`, <2 `podtip`, podtip with cardinality, attributes, participant without role | block name (or the offending line) | the spec | `specijalizacija '{name}' mora imati tačno jedan 'nadtip X (DG,GG)' i bar dva 'podtip Y' (bez kardinalnosti), i ne sme imati atribute.` |
| E08 | `agregacija` with <2 components, or a component with a role / without cardinality | block name | the agregacija | `agregacija '{name}' ima {n} komponenti, a mora imati bar 2.` |
| E09 | Cycle in specialization (A podtip of B … podtip of A), incl. A podtip of itself | name of the nadtip in the spec closing the cycle | that spec | `ciklična specijalizacija: {A} → {B} → … → {A}.` |
| E10 | `objekat` with no `#` attribute that is not a podtip in any spec | block name | the objekat | `objekat '{name}' nema identifikator (#). Svaki objekat koji nije podtip mora imati identifikator.` |
| E11 | A podtip declares an attribute whose name equals an identifier attribute of any of its (transitive) nadtipovi | the attribute | the podtip objekat | `podtip '{sub}' ponavlja identifikator '{attr}' nadtipa '{sup}' — podtip ga nasleđuje.` |
| E12 | *(extension)* participant line inside `objekat`, or a role word in `agregacija` | the line | enclosing block | `red '{text}' nije dozvoljen u bloku '{kind}'.` |

### Warnings (emitted by T02 checker)

| Code | When | Span | `elementId` | Message template |
|---|---|---|---|---|
| W01 | Recursive `veza` (both participants same object) without a mapping name on **both** lines | block name | the veza | `rekurzivna veza '{name}' treba da ima nazive preslikavanja za oba učesnika.` |
| W02 | Attribute without a domain | attribute name | owner block | `atribut '{attr}' nema domen.` |
| W03 | `objekat` that does not appear in any veza, slab, agregacija or specijalizacija | block name | the objekat | `objekat '{name}' ne učestvuje ni u jednoj vezi.` |
| W04 | Same attribute name twice in one block | second occurrence | owner block | `atribut '{attr}' je već naveden u bloku '{block}'.` |

The main example (C03) must produce **zero errors**; it legitimately produces W02 warnings for
attributes without a domain.

## English messages (spec/fix_editor.md, CHANGELOG 2026-10-30)

`lex`, `parse` and `compile` take `options?: LangOptions`. With `locale: 'en'` every `message` is in English;
omitted or `'sr'` gives exactly today's Serbian messages. Code, severity, span, `elementId` and the facts in the
message (quoted names, numbers, line) are the same in both languages. Keywords inside messages are spelled in the
message's language (`relationship`, `weak object`, `owner`, `supertype`, `subtype` in English).

`formatDiagnostic(d, 'en')` gives `error E04 (line 12, col 1): …` / `warning W02 (line 3, col 3): …`.

The emitters add the English template for each code to this contract (an additive clarification) as a fourth
column or a separate table: T15 for S01–S06, T16 for E01–E12 and W01–W04. Examples of the expected style:

| Code | English template |
|---|---|
| S04 | `unknown block kind '{word}'. Allowed: object, relationship, weak, specialization, aggregation (or objekat, veza, slab, specijalizacija, agregacija).` |
| E04 | `relationship '{name}' has {n} participants, but a relationship must have exactly 2. Use 'aggregation' to connect more objects.` |
| W02 | `attribute '{attr}' has no domain.` |

English templates for S01–S06 (T15, `src/lang/syntax/messages.ts`; `{found}` is `end of file` / `new line` / the token text; `{what}` is one of `attribute name`, `domain`, `',' or end of line`, `object name`, `end of line`, `block name`, `','`, `')'`, `'{'`):

| Code | English template |
|---|---|
| S01 | `unexpected symbol '{found}', expected {what}.` |
| S02 | `unclosed quoted name.` |
| S03 | `unknown character '{char}'.` |
| S04 | `unknown block kind '{word}'. Allowed: object, relationship, weak, specialization, aggregation (or objekat, veza, slab, specijalizacija, agregacija).` |
| S05 | `block '{name}' is not closed — missing '}'.` |
| S06 | `unknown domain '{word}'. Allowed: long, short, string, date.` |

English templates for E01–E12 and W01–W04 (T16, `src/lang/semantic/messages.ts`; `{min}`/`{max}` are the raw cardinality text; role words in `{line}` are English `owner` / `supertype` / `subtype`):

| Code | English template |
|---|---|
| E01 | `name '{name}' is already declared on line {n}.` |
| E02 | `'{name}' is not a declared object, weak object or aggregation.` |
| E03 | `invalid cardinality ({min},{max}): min must be 0 or 1, max must be 1 or M, and min ≤ max.` / `missing cardinality (min,max) for '{name}': …same hint…` |
| E04 | `relationship '{name}' has {n} participants, but a relationship must have exactly 2. Use 'aggregation' to connect more objects.` / `a relationship participant must not have the role '{role}'.` |
| E05 | `relationship '{name}' cannot have the attribute '{attr}'. If it is a participant, add a cardinality (min,max); for a relationship with attributes use 'aggregation'.` |
| E06 | `weak object '{name}' must have exactly one participant 'owner X (min,max)'.` / `weak object '{name}' must have at least one partial identifier (#).` |
| E07 | base: `specialization '{name}' must have exactly one 'supertype X (min,max)' and at least two 'subtype Y' (without cardinality), and must not have attributes.` plus ` Line '{line}' has neither the supertype nor the subtype role.` / ` Subtype '{name}' must not have a cardinality.` / ` Attribute '{attr}' is not allowed.` |
| E08 | `aggregation '{name}' has {n} components, but must have at least 2.` / `component '{comp}' of aggregation '{name}' has no cardinality (min,max).` |
| E09 | `cyclic specialization: A → B → A.` |
| E10 | `object '{name}' has no identifier (#). Every object that is not a subtype must have an identifier.` |
| E11 | `subtype '{sub}' repeats the identifier '{attr}' of supertype '{sup}' — a subtype inherits it.` |
| E12 | `line '{line}' is not allowed in an 'object' block.` / `… in an 'aggregation' block.` |
| W01 | `recursive relationship '{name}' should have mapping names for both participants.` |
| W02 | `attribute '{attr}' has no domain.` |
| W03 | `object '{name}' does not take part in any relationship.` |
| W04 | `attribute '{attr}' is already listed in block '{block}'.` |
