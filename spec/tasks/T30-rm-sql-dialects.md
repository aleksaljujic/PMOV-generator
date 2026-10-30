# T30 — Relational model: SQL dialects

**Wave:** 8 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C11-sql-dialects.md`](../contracts/C11-sql-dialects.md) §1.
Feature spec: [`../feature_multy_language.md`](../feature_multy_language.md).
**Folder (owns everything inside):** `src/rm/`.

Read first: your folder's `AGENT.md`, then C11, then the feature spec (all of *Mapping per dialect*). Frozen files
(C11 §0) are already written; never edit them or other folders. Golden data: `src/fixtures/sql.ts`. Other Wave-8
agents (T31 `src/ui/tabs/`, T32 `src/ui/shell/`) work in parallel in the same working tree, so failures in **other**
folders while you work are expected; ignore them.

## Goal

`generateSql(rm, ir?, locale?, dialect?)` emits PostgreSQL (today's output, unchanged), Microsoft SQL Server or
Oracle 19c DDL.

## Steps

1. Factor the dialect-specific parts of `src/rm/sql.ts` behind a small per-dialect table (quote, type mapping,
   literal, FK clauses). Keep the PostgreSQL path producing exactly today's text.
2. Inlined domains for `mssql` / `oracle`: comment section, column type from the domain, `NOT NULL` and column
   `CHECK` from `effectiveConstraint`, untranslatable parts into the column comment.
3. Referential actions per the spec table; Oracle comment lines; SQL Server cascade-path downgrade.
4. sr + en comment strings (spec *New comment strings*).

## Tests

- `SQL_DIALECT_SAMPLE_SQL[d]` for all three dialects equals `generateSql(SQL_DIALECT_SAMPLE_RM, SQL_DIALECT_SAMPLE_IR, 'sr', d)`.
- `SQL_CASCADE_DIAMOND_SQL.postgres` / `.mssql` likewise; Oracle diamond has no downgrade comment.
- Default argument: `generateSql(rm, ir, 'sr')` equals the `postgres` output.
- Unit cases: `]` / `"` escaping; `NVARCHAR(MAX)` for n > 4000; `In(a, b)` → `N'a'` on SQL Server; a derived domain's
  inherited check on both inlining dialects; a self-referencing FK and a 2-cycle are downgraded on SQL Server;
  Oracle `ON DELETE SET DEFAULT` and `ON UPDATE` comments; `en` comment strings; child-side comments in all dialects.
- An `*.integration.test.ts` that compiles all five `EXAMPLES` and checks spec acceptance criterion 3 (no
  `CREATE DOMAIN` / `RESTRICT` on mssql/oracle, no `ON UPDATE` on oracle) and that `postgres` equals the 3-arg call.

## Definition of done

- [ ] `npx vitest run src/rm src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder **unedited** and green.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T30.md`.

## Status

Done. `generateSql(rm, ir?, locale?, dialect?)` implemented in `src/rm/sql.ts`; tests in `src/rm/sql.dialects.test.ts` and `sql.dialects.integration.test.ts`. `npx vitest run src/rm src/architecture.test.ts`: 64 passed; no typecheck errors in `src/rm`.

## Contract notes

- Acceptance criterion 3 says mssql/oracle output contains no `CREATE DOMAIN`, but the mandated comment line ("SQL Server nema CREATE DOMAIN; ...") contains those words. The integration test therefore checks that no line starts with `CREATE DOMAIN`.
- The spec does not say how a domain line shows untranslatable parts or NotNull. Implemented: `domen X: TYPE [NOT NULL] [CHECK (...)][; rest]`.
- FK columns that copy a `userDomain` get the inlined type/NOT NULL/CHECK too (same as other columns).
- Comment order after an ALTER: parent UPDATE, parent DELETE, then child INSERT, child UPDATE.
- No fixture contradiction found.
