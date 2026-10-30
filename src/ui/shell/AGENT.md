# Agent T09 — App shell: layout, toolbar, error panel, storage, sync

You are the **only** agent working in `src/ui/shell/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T09-app-shell.md`](../../../spec/tasks/T09-app-shell.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **all (C00–C08), mainly C08**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/ui/shell/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `App` (rendered by the frozen `src/main.tsx`). Also `storage.ts`, `ErrorPanel.tsx` per C08.

## You may import

Every other agent's `index.ts`, `../../examples`, frozen contract files, `react`. Global CSS lives here.

## Dependencies on other agents

Everybody. Wire against the stubs from day one (they throw — guard with error boundaries / try-catch while developing); finish as others land. Also owns the root `README.md`.

## Commands

```bash
npx vitest run src/ui/shell          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T09` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.

## Current follow-up task (Wave 11, CHANGELOG 2026-10-30, contract C08)

**T38**: [`../../../spec/tasks/T38-shell-sidebar-toggle.md`](../../../spec/tasks/T38-shell-sidebar-toggle.md), contract [`../../../spec/contracts/C08-ui-components.md`](../../../spec/contracts/C08-ui-components.md) §Additions for the sidebar toggle,
spec [`../../../spec/feature_text2interactive.md`](../../../spec/feature_text2interactive.md). If you were started for T38, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Current follow-up task (Wave 10, CHANGELOG 2026-10-30, contract C13)

**T36**: [`../../../spec/tasks/T36-shell-json.md`](../../../spec/tasks/T36-shell-json.md), contract [`../../../spec/contracts/C13-json-interchange.md`](../../../spec/contracts/C13-json-interchange.md),
spec [`../../../spec/feature_json_import_export.md`](../../../spec/feature_json_import_export.md). If you were started for T36, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Current follow-up task (Wave 4, CHANGELOG 2026-10-30)

**T19**: [`../../../spec/tasks/T19-shell-language-switch.md`](../../../spec/tasks/T19-shell-language-switch.md), spec [`../../../spec/fix_editor.md`](../../../spec/fix_editor.md).
If you were started for T19, read that task file instead of the original one in "Read first" item 1. Everything else
in this file still applies.

## Current follow-up task (Wave 8, CHANGELOG 2026-10-30, contract C11)

**T32**: [`../../../spec/tasks/T32-shell-sql-dialect.md`](../../../spec/tasks/T32-shell-sql-dialect.md), contract [`../../../spec/contracts/C11-sql-dialects.md`](../../../spec/contracts/C11-sql-dialects.md),
spec [`../../../spec/feature_multy_language.md`](../../../spec/feature_multy_language.md). If you were started for T32, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Previous follow-up task (Wave 7, CHANGELOG 2026-10-30, contract C10)

**T28**: [`../../../spec/tasks/T28-shell-domains-constraints.md`](../../../spec/tasks/T28-shell-domains-constraints.md), contract [`../../../spec/contracts/C10-domains-and-constraints.md`](../../../spec/contracts/C10-domains-and-constraints.md),
spec [`../../../spec/feature_domain_strucutre.md`](../../../spec/feature_domain_strucutre.md). If you were started for T28, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.
