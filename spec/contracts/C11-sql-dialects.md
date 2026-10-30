# C11 — SQL dialects

Owner of the frozen code: orchestrator (Wave 0, CHANGELOG 2026-10-30). Implemented by T30–T32.
Feature spec: [`../feature_multy_language.md`](../feature_multy_language.md). The spec says **what** the output looks
like, rule by rule. This contract says **who produces what, in which shape**. Where they differ, this contract wins.
Report the difference in your task's Contract notes.

## 0. Frozen code (already written; read it, don't change it)

| File | What C11 added |
|---|---|
| `src/rm/types.ts` | `SqlDialect = 'postgres' \| 'mssql' \| 'oracle'`, `SQL_DIALECTS` (UI order), `DEFAULT_SQL_DIALECT = 'postgres'` |
| `src/fixtures/sql.ts` | `SQL_DIALECT_SAMPLE_SOURCE` / `_IR` / `_RM` / `_SQL` (all 3 dialects, `sr`); `SQL_CASCADE_DIAMOND_SOURCE` / `_IR` / `_RM` / `_SQL` (`postgres`, `mssql`) |

The `*_POSTGRES` / `.postgres` strings in the fixture are the output of today's `generateSql`. The IR and RM in the
fixture were produced by today's `compile` + `generateRelationalModel(ir, { dg0Mode: 'fk' })`, with spans set to
`NO_SPAN`. The SQL Server and Oracle strings were written by hand from the feature spec and are **normative**. If you
believe one of them contradicts the spec, say so in Contract notes; do not change the fixture.

**No change** to the DSL, AST, IR, `RelationalModel`, or any tab other than SQL.

## 1. `generateSql` (T30, `src/rm/`)

```ts
export function generateSql(
  rm: RelationalModel,
  ir?: PmovIR,
  locale: Locale = 'sr',
  dialect: SqlDialect = DEFAULT_SQL_DIALECT,
): string;
```

- Additive fourth parameter. Every existing call site keeps working.
- `dialect === 'postgres'` returns **byte for byte** what the function returns today, for every input. Existing
  tests in `src/rm/` must stay green **unedited**.
- `mssql` / `oracle` follow the feature spec's *Mapping per dialect*: identifier quoting, built-in types, inlined
  domains with a column `CHECK` built from `IRDomain.effectiveConstraint` (`VALUE` replaced by the quoted column),
  `N'…'` literals (SQL Server only), the referential-action table, Oracle's comment lines, and the SQL Server
  multiple-cascade-path rule (`up(P) ∩ up(C)`, in `rm.referential` order; for an RM without `referential`, use the
  existing fallback order).
- Comment wording (sr / en) is exactly the *New comment strings* table of the spec.
- Untyped attributes, and attributes with no user domain, keep today's behaviour apart from the type mapping.
- Pure function, no React, no other-folder imports beyond `src/lang` (index / frozen files).

## 2. `SqlTab` (T31, `src/ui/tabs/`)

```ts
export interface SqlTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
  locale?: Locale;
  /** C11: default DEFAULT_SQL_DIALECT. */
  dialect?: SqlDialect;
  /** C11: when absent, no dropdown is shown. */
  onDialectChange?(dialect: SqlDialect): void;
}
```

- Toolbar: `<label>` *"Dijalekt:"* / *"Dialect:"* + `<select>` with options from `SQL_DIALECTS`, labelled
  `PostgreSQL`, `Microsoft SQL Server`, `Oracle` (the same in both locales), placed before **Kopiraj**. Use
  `aria-label` or a `<label htmlFor>` so tests can find it by its label text.
- Calls `generateSql(rm, ir ?? undefined, locale, dialect)`. **Kopiraj** copies that text.
- In the error / empty states, nothing changes (no dropdown).
- Strings go in the folder's `strings.ts`.

## 3. Shell (T32, `src/ui/shell/`)

- `STORAGE_KEYS.sqlDialect = 'pmov.sqlDialect.v1'` with `loadSqlDialect(): SqlDialect` (missing / unknown →
  `DEFAULT_SQL_DIALECT`; storage errors are caught) and `saveSqlDialect(d)`.
- `App` holds `sqlDialect` state (initialised from `loadSqlDialect()`), saves it on change, and passes `dialect` and
  `onDialectChange` to `SqlTab`. Loading an example, **Novi dijagram**, a mode switch and a language switch do not
  reset it.
- README: a short "SQL dijalekt" / "SQL dialects" section (what each choice changes, and the Oracle / SQL Server
  limitations as comments).

## 4. Who implements what

| Task | Folder | Sections |
|---|---|---|
| T30 | `src/rm/` | §1 |
| T31 | `src/ui/tabs/` | §2 |
| T32 | `src/ui/shell/` | §3 |

T31 and T32 depend only on the frozen types, so all three run in parallel. Until T30 lands, `generateSql` ignores the
fourth argument (TypeScript accepts the extra argument only after T30 adds the parameter). T31 may therefore see a
type error at its call site until then. That is expected; note it and do not work around it with casts.
