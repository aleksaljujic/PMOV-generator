# Agent T13 — Interactive builder: UI overlay

You are the **only** agent working on the interactive builder (task T13). This folder holds the **React** part:
the overlay on the diagram (+ buttons and menus, pick mode, attribute form, inline rename, cardinality and
mapping-name pickers, delete confirmation). The same agent also owns `src/builder/` (see its `AGENT.md`).

## Read first (in this order)

1. [`../../../spec/tasks/T13-interactive-builder.md`](../../../spec/tasks/T13-interactive-builder.md): your task, **including the ownership exception**
2. [`../../../spec/feature_interactive_pmov.md`](../../../spec/feature_interactive_pmov.md): the feature spec
3. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
4. Your contracts: C09 (you write it), C05, C08

## You own

Everything inside `src/ui/builder/`. All edits leave this component through one callback,
`onAction(action: BuilderAction)`. It never edits source text itself.

Ownership exception (T13 only): additive edits in `src/ui/shell/` and `src/render/flow/`. Don't change Tekst-mode
behaviour, don't remove or rename exports, and don't edit existing tests there. Details are in the task file.

## You may import

Other folders' `index.ts` (notably `../../builder`, `../../render/flow`), frozen contract files, `react`.

## Commands

```bash
npx vitest run src/ui/builder src/builder src/ui/shell src/render/flow
npx vitest run src/architecture.test.ts
npm run typecheck
```

## Current follow-up task (Wave 4, CHANGELOG 2026-10-30)

**T18**: [`../../../spec/tasks/T18-builder-locale.md`](../../../spec/tasks/T18-builder-locale.md), spec [`../../../spec/fix_editor.md`](../../../spec/fix_editor.md).
If you were started for T18, read that task file instead of the original one in "Read first" item 1. Everything else
in this file still applies.

## Current follow-up task (Wave 7, CHANGELOG 2026-10-30, contract C10)

**T26**: [`../../../spec/tasks/T26-builder-domains-constraints.md`](../../../spec/tasks/T26-builder-domains-constraints.md), contract [`../../../spec/contracts/C10-domains-and-constraints.md`](../../../spec/contracts/C10-domains-and-constraints.md),
spec [`../../../spec/feature_domain_strucutre.md`](../../../spec/feature_domain_strucutre.md). If you were started for T26, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.
