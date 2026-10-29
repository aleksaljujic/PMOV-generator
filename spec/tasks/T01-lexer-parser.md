# T01 — Lexer and parser

**Wave:** 1 (parallel). **Implements:** C02, and the S-codes of C01. **Consumes:** C01.
**Folder (owns everything inside):** `src/lang/syntax/` — read its `AGENT.md` first. Public entry: `src/lang/syntax/index.ts` (`lex`, `parse`).

## Goal

A hand-written lexer and recursive-descent parser for the PMOV DSL that turns source text into the `ModelAst` of C02,
with precise spans and Serbian syntax diagnostics, and that never throws.

## Steps

1. **Lexer** (`lex`): implement the lexical rules of C02 exactly. Track `from/to/line/col/endLine/endCol` for every
   token (1-based line/col, 0-based offsets, UTF-16). `\r\n` is one newline. Comments are dropped, newlines kept.
   Unknown characters become `unknown` tokens without a diagnostic. Unterminated quote → S02.
2. **Parser** (`parse`): recursive descent following C02 §Grammar disambiguation, in this shape:
   `parseModel → parseBlock → parseLine → (parseParticipant | parseAttributeLine → parseAttribute)`.
   - Single-line blocks and a first line on the same line as `{`.
   - The constraint rule (comma after a domain starts a new attribute; otherwise rest of line, commas and parentheses
     included, stopping at a depth-0 `}`). Constraint text is the **exact source slice**, trimmed.
   - `_` as a name is accepted only for `veza` (S01 otherwise).
   - Cardinality contents are kept raw (`min`, `max` strings) — validation is T02's job.
   - Diagnostics use C01 codes S01–S06 with `elementId: null`, messages in Serbian per the C01 templates.
   - Recovery: one diagnostic per bad line, skip to newline; unknown block kind → S04 and resync; EOF in block → S05.
3. Keep everything pure and synchronous; no React; no imports outside `src/lang/`.

## Tests (Vitest)

Cover the list in C02 §Required test coverage, plus:

- Both `EXAMPLES` parse with **zero** diagnostics, and the AST of the main example has 10 blocks with the expected
  kinds in order.
- `Starost : short Between 15,65` → constraint `Between 15,65`; `{ Mlb# : long, Ime : string }` → two attributes;
  `Jezik : string In(Srpski, Ruski)` → constraint `In(Srpski, Ruski)`.
- `objekat "Nalog za nabavku" { Broj# }` → name text `Nalog za nabavku`, `quoted: true`.
- `nadređeni Radnik (0,M)` → role, object, card `{min:'0', max:'M'}`.
- `veza _ { A (1,1)  B (0,M) }` … across lines → name `_`.
- Span check: a diagnostic on line 3 column 5 reports `line: 3, col: 5`, and `from` matches `source.indexOf(...)`.
- Recovery: a garbage line inside block 1 produces one S01 and block 2 is still parsed.
- Fuzz-ish: random slices of the examples never throw.

## Definition of done

- [ ] `lex` and `parse` match C02 signatures exactly; stubs removed.
- [ ] All tests above pass; `npm run typecheck` clean.
- [ ] No file outside the owned list was modified.

## Status

_not started_

## Contract notes

_Record any clarification of C02 you had to make (also append it to C02 + CHANGELOG)._
