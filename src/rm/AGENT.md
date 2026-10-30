# Agent T03 — Relational model, SQL, domain table

You are the **only** agent working in `src/rm/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../spec/tasks/T03-relational-model.md`](../../spec/tasks/T03-relational-model.md): your task (steps, tests, definition of done)
2. [`../../spec/contracts/README.md`](../../spec/contracts/README.md) and [`C00-project.md`](../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C03, C04**
4. [`../../spec/requrement.md`](../../spec/requrement.md): the product, for context

## You own

Everything inside `src/rm/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `generateRelationalModel`, `formatRelation`, `formatModelText`, `generateSql`, `buildDomainTable`, `dg0ToggleableVezas` (+ re-exports `types.ts`)

## You may import

`../lang` (index), `./types`. Tests: `../fixtures/*`, `../examples`.

## Dependencies on other agents

None for unit tests (use `MAIN_EXAMPLE_IR`, `SPEC_EXAMPLE_IR`, `MAIN_EXAMPLE_RM`). `types.ts` is FROZEN — do not edit it.

## Commands

```bash
npx vitest run src/rm          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T03` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.

## Current follow-up task (Wave 8, CHANGELOG 2026-10-30, contract C11)

**T30**: [`../../spec/tasks/T30-rm-sql-dialects.md`](../../spec/tasks/T30-rm-sql-dialects.md), contract [`../../spec/contracts/C11-sql-dialects.md`](../../spec/contracts/C11-sql-dialects.md),
spec [`../../spec/feature_multy_language.md`](../../spec/feature_multy_language.md). If you were started for T30, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Previous follow-up task (Wave 7, CHANGELOG 2026-10-30, contract C10)

**T24**: [`../../spec/tasks/T24-rm-constraints-sql.md`](../../spec/tasks/T24-rm-constraints-sql.md), contract [`../../spec/contracts/C10-domains-and-constraints.md`](../../spec/contracts/C10-domains-and-constraints.md),
spec [`../../spec/feature_domain_strucutre.md`](../../spec/feature_domain_strucutre.md). If you were started for T24, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Follow-up task after T30 (Wave 9, CHANGELOG 2026-10-30, contract C12)

**T34**: [`../../spec/tasks/T34-rm-triggers.md`](../../spec/tasks/T34-rm-triggers.md), contract [`../../spec/contracts/C12-triggers.md`](../../spec/contracts/C12-triggers.md),
spec [`../../spec/feature_triggers.md`](../../spec/feature_triggers.md). Run it only after T30 is done. If you were started
for T34, read that task file instead of the original one in "Read first" item 1. Everything else in this file still applies.
