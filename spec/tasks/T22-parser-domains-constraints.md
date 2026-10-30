# T22 — Parser: domains and constraint blocks

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §1.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/lang/syntax/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

`lex` / `parse` understand `domen` lines, `ograničenje` blocks (both kinds), user domains and `string(n)` on
attributes, with Serbian and English keywords (C02 keyword tables in `ast.ts`).

## Steps

1. Lexer: `->` → `arrow`. Free-text tails keep accepting any character.
2. Parser: top-level dispatch on `isDomainDeclKeyword` / `isConstraintBlockKeyword`; `DomainDeclAst`; attribute
   `userDomain` / `length`; constraint lines in the order of C10 §1; error recovery as for blocks today.
3. sr + en messages for any new S situation (reuse existing S codes; document which in Contract notes).
4. Omit-when-empty for every new key.

## Tests

- Every construct in C10 §1, both keyword languages, quoted relation names, `->` with and without `(a, b)`,
  `uslov` text containing `<=`, `.`, `,`, `'`; `string(40)` on attribute and domain; length on another type parses
  (checker reports it).
- `EXAMPLES` id `domeni` (`source` and `sourceEn`) parse with zero diagnostics; the AST of the other four examples
  is unchanged (no `domains` / `constraints` / `userDomain` keys).
- Error recovery: a broken header line inside an `ograničenje` block does not swallow the next block.

## Definition of done

- [ ] `npx vitest run src/lang/syntax` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T22.md`.

## Status

Done. `npx vitest run src/lang/syntax src/architecture.test.ts` green (65 tests: 43 existing + 22 new in `domains.test.ts`); no typecheck errors in `src/lang/syntax`.

## Contract notes

- **S-codes reused:** missing domain name, missing `:`, missing type in `domen`, and any bad line inside an `ograničenje` block (header, `uslov`, rule) are all S01 with new "expected" phrases (sr + en in `messages.ts`). Unclosed constraint block: S05. Missing `{` after the name: S01 + resync.
- **S06 no longer emitted (orchestrator decision):** any identifier after `:` that is not a built-in sets `userDomain` with no S-diagnostic (a typo becomes E13 from the checker, so `ir` stays non-null). A non-identifier in type position is S01. Tests 'S06 unknown domain keeps attribute' (syntax.test.ts) and the S06 entries in aliases.test.ts were updated accordingly.
- Constraint on an attribute with a user domain is kept (before: only for known built-ins).
- `(n)` is a length only if it is exactly `( number )` right after the type; otherwise `(` starts the constraint tail.
- Constraint-line decision: arrow anywhere on the line -> header (malformed header = S01, line skipped); `uslov`/`condition` + `:` -> condition (`textSpan` zero-width after the colon when empty); `Name :` -> rule; else S01. Rule item `op [action]`: more than two words in an item is S01 (line aborted, items parsed so far are dropped with the line). Empty item (`a, , b` or `Rel :`) is S01.
- `uslov` text and domain constraint end at end of line; the `uslov` text also stops at a depth-0 `}` (so `{ uslov: x }` on one line works), domain constraint does not.
- Top-level resync now also stops at lines starting with a domain/constraint keyword.
- **Existing test edited (only exception):** `aliases.test.ts` "sourceEn of 'domeni' ... equals the Serbian AST" cannot pass otherwise, because user domain names, relation names, attribute lists and `uslov` text differ between sr and en sources. I extended the test's `strip`/`norm` helpers to also drop keys `keywordSpan`, `textSpan`, `userDomain`, `child`, `parent`, `relation`, `attrs`, `text`. No assertion was weakened for the other four examples (their AST has none of these keys except `text`, which sits inside already-normalized objects).

