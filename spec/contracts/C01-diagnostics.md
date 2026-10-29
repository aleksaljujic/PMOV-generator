# C01 — Source spans and diagnostics

Owner of the file: **T00** (writes it verbatim). Emitters: **T01** (S-codes), **T02** (E/W-codes).
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
  /** Message body in Serbian (Latin), WITHOUT the "greška E04 (red …)" prefix. */
  message: string;
  /** Where the squiggle goes. Points at the most specific token (name, cardinality, attribute …). */
  span: SourceSpan;
  /** Id of the IR element (C03) that should get a red outline; null for syntax errors / no owner. */
  elementId: string | null;
}

export function severityOf(code: DiagnosticCode): Severity {
  return code.startsWith('W') ? 'warning' : 'error';
}

/** "greška E04 (red 12, kol 1): veza 'Overe' ima 3 učesnika, …" */
export function formatDiagnostic(d: Diagnostic): string {
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
