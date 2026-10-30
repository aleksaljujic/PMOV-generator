# C12 — Triggers (PostgreSQL)

Owner: orchestrator (CHANGELOG 2026-10-30). Implemented by T34.
Feature spec: [`../feature_triggers.md`](../feature_triggers.md). The spec gives the exact SQL text, the condition
translation rules and the reason strings. This contract says **who produces what, and what must not change**. Where
they differ, this contract wins. Report the difference in your task's Contract notes.

## 0. Frozen code

**None.** No change to the DSL, AST, IR, `RelationalModel`, `src/rm/types.ts`, fixtures or any UI folder.

## 1. `generateSql` (T34, `src/rm/`)

The signature is the C11 one, unchanged:

```ts
export function generateSql(rm: RelationalModel, ir?: PmovIR, locale: Locale = 'sr', dialect: SqlDialect = DEFAULT_SQL_DIALECT): string;
```

- **`dialect === 'postgres'`** amends C10 §3:
  - **Child-side cells.** For each `ReferentialConstraint` cell `childInsert` / `childUpdate` whose action is not
    `restricted`, the `-- "C" INSERT|UPDATE: … (zahteva okidač)` comment is **replaced** by a function and a BEFORE
    ROW trigger, at the same position (right after that FK's `ALTER TABLE`). Spec §*Child-side referential
    triggers*.
  - **General constraints.** After the two existing comment lines (header + `-- CREATE ASSERTION …`), either the
    function and one AFTER STATEMENT trigger per `checks` entry, or one `-- okidač nije generisan: <reason>` line.
    Spec §*General-constraint triggers*.
- **`dialect === 'mssql' | 'oracle'`:** the output is exactly what C11 / T30 produce. No triggers.
- **C11 §1 amended:** PostgreSQL output stays byte-identical to the pre-C11 output **except** where this contract
  adds triggers. When `rm` has no non-restricted child cell and no general constraint, the output is byte-identical.
  This keeps every golden SQL in `src/fixtures/sql.ts` and in the existing `src/rm` tests valid.
- The references in a general constraint's `condition` are re-extracted with the C10 §2 regex (`GeneralConstraint`
  has no `refs`). The join uses only `rm.referential` (or the existing fallback for an RM without it).
- Locale: the comments, the reason lines and the `RAISE` message follow `locale` (sr / en), with the texts from the spec.
- A pure function. No React, and no imports beyond `src/lang` (index / frozen files) and `src/rm` itself.

## 2. Who implements what

| Task | Folder | Sections | Starts after |
|---|---|---|---|
| T34 | `src/rm/` | §1 | T30 (same folder, same function) |
