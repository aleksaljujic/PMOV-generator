# T31 — Tabs: SQL dialect dropdown

**Wave:** 8 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C11-sql-dialects.md`](../contracts/C11-sql-dialects.md) §2.
Feature spec: [`../feature_multy_language.md`](../feature_multy_language.md) (§ *UI → SQL tab*).
**Folder (owns everything inside):** `src/ui/tabs/`.

Read first: your folder's `AGENT.md`, then C11, then the feature spec. Frozen files (C11 §0) are already written;
never edit them or other folders. Other Wave-8 agents (T30 `src/rm/`, T32 `src/ui/shell/`) work in parallel in the
same working tree. T30 adds the fourth `generateSql` parameter; until it lands, your call site may not typecheck.
That is expected (see C11 §4); do not use casts to hide it.

## Goal

`SqlTab` gets `dialect?` / `onDialectChange?` and a dialect `<select>` before **Kopiraj**.

## Steps

1. Extend `SqlTabProps` (C11 §2) and export nothing new besides the props change.
2. Toolbar dropdown with `SQL_DIALECTS` and the product-name labels; label text in `strings.ts` (sr *Dijalekt:*,
   en *Dialect:*).
3. Pass `dialect` to `generateSql`; copy uses the shown text.

## Tests

- Without `onDialectChange`, no dropdown; output as before.
- With it: the select shows the current `dialect`; choosing an option calls `onDialectChange` with the id.
- Rendering with `dialect="mssql"` shows SQL containing `[` quoting (mock `generateSql` in unit tests, or use an
  `*.integration.test.tsx` with `SQL_DIALECT_SAMPLE_IR`).
- Error / empty states render no dropdown. Both locales' label text.

## Definition of done

- [ ] `npx vitest run src/ui/tabs src/architecture.test.ts` green (integration tests may wait for T30; say so).
- [ ] Existing tests in your folder unedited and green.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T31.md`.

## Status

Done. `npx vitest run src/ui/tabs src/architecture.test.ts`: 50 tests green (5 new in `sqlDialect.test.tsx`, existing unedited). Typecheck errors in `Tabs.tsx` and `sqlDialect.test.tsx` (4th `generateSql` arg) wait for T30. No integration test with `SQL_DIALECT_SAMPLE_IR` added (needs T30).

## Contract notes

No deviation from C11 §2. `SQL_DIALECTS` / `DEFAULT_SQL_DIALECT` are imported from `../../rm/types` (frozen file, allowed) because `../../rm` is mocked wholesale in existing unit tests and the mock lacks them.
