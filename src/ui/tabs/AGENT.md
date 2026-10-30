# Agent T08 — Domeni / Relacioni model / SQL tabs

You are the **only** agent working in `src/ui/tabs/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T08-output-tabs.md`](../../../spec/tasks/T08-output-tabs.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C03, C04, C08 §Output tabs**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/ui/tabs/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `DomainTab`, `RelationalTab`, `SqlTab` (+ prop types)

## You may import

`../../lang` (index), `../../rm` (index), `react`. Tests: `../../fixtures/*`.

## Dependencies on other agents

T03 — mock `../../rm` with `vi.mock` in component tests; real generator only in `*.integration.test.tsx`.

## Commands

```bash
npx vitest run src/ui/tabs          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T08` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.

## Current follow-up task (Wave 4, CHANGELOG 2026-10-30)

**T17**: [`../../../spec/tasks/T17-tabs-locale.md`](../../../spec/tasks/T17-tabs-locale.md), spec [`../../../spec/fix_editor.md`](../../../spec/fix_editor.md).
If you were started for T17, read that task file instead of the original one in "Read first" item 1. Everything else
in this file still applies.

## Current follow-up task (Wave 8, CHANGELOG 2026-10-30, contract C11)

**T31**: [`../../../spec/tasks/T31-tabs-sql-dialect.md`](../../../spec/tasks/T31-tabs-sql-dialect.md), contract [`../../../spec/contracts/C11-sql-dialects.md`](../../../spec/contracts/C11-sql-dialects.md),
spec [`../../../spec/feature_multy_language.md`](../../../spec/feature_multy_language.md). If you were started for T31, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Previous follow-up task (Wave 7, CHANGELOG 2026-10-30, contract C10)

**T25**: [`../../../spec/tasks/T25-tabs-domains-constraints.md`](../../../spec/tasks/T25-tabs-domains-constraints.md), contract [`../../../spec/contracts/C10-domains-and-constraints.md`](../../../spec/contracts/C10-domains-and-constraints.md),
spec [`../../../spec/feature_domain_strucutre.md`](../../../spec/feature_domain_strucutre.md). If you were started for T25, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.
