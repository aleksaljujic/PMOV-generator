# Agent T13 — Interactive builder: pure source edits

You are the **only** agent working on the interactive builder (task T13). This folder holds the **pure** part:
`applyBuilderAction(source, action)`, which turns a builder action into a minimal text edit on the DSL source.
The same agent also owns `src/ui/builder/` (see its `AGENT.md`).

## Read first (in this order)

1. [`../../spec/tasks/T13-interactive-builder.md`](../../spec/tasks/T13-interactive-builder.md): your task (steps, tests, definition of done, ownership exception)
2. [`../../spec/feature_interactive_pmov.md`](../../spec/feature_interactive_pmov.md): the feature spec
3. [`../../spec/contracts/README.md`](../../spec/contracts/README.md) and [`C00-project.md`](../../spec/contracts/C00-project.md): the rules
4. Your contracts: C09 (you write it first), C02, C03, C05, C08
5. [`../../spec/requrement.md`](../../spec/requrement.md): the product, for context

## You own

Everything inside `src/builder/`. **No React here** (enforced by `src/architecture.test.ts`).

Public entry point: `index.ts`, exporting exactly the C09 signatures (`applyBuilderAction`, `BuilderAction`,
`BuilderResult`, helpers you define in C09).

## You may import

`../lang` (`src/lang/index.ts`) and the other frozen contract files, `../examples`, `../fixtures`.

## Commands

```bash
npx vitest run src/builder                 # your tests
npx vitest run src/architecture.test.ts    # import rules
npm run typecheck                          # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T13` stub.
- Fill in **Status** and **Contract notes** in the task file, and write `spec/sessions/T13.md`.

## Current follow-up task (Wave 4, CHANGELOG 2026-10-30)

**T18**: [`../../spec/tasks/T18-builder-locale.md`](../../spec/tasks/T18-builder-locale.md), spec [`../../spec/fix_editor.md`](../../spec/fix_editor.md).
If you were started for T18, read that task file instead of the original one in "Read first" item 1. Everything else
in this file still applies.

## Current follow-up task (Wave 7, CHANGELOG 2026-10-30, contract C10)

**T26**: [`../../spec/tasks/T26-builder-domains-constraints.md`](../../spec/tasks/T26-builder-domains-constraints.md), contract [`../../spec/contracts/C10-domains-and-constraints.md`](../../spec/contracts/C10-domains-and-constraints.md),
spec [`../../spec/feature_domain_strucutre.md`](../../spec/feature_domain_strucutre.md). If you were started for T26, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.
