# Agent T07 — CodeMirror 6 editor

You are the **only** agent working in `src/ui/editor/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T07-editor.md`](../../../spec/tasks/T07-editor.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C01, C02, C08 §Editor**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/ui/editor/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `Editor`, `EditorHandle`, `EditorProps`

## You may import

`../../lang` (index — types, `formatDiagnostic`, `BLOCK_KINDS`, `ROLES`, `DOMAINS`), `codemirror`, `@codemirror/*`, `@lezer/highlight`, `react`.

## Dependencies on other agents

None for unit tests (you receive diagnostics as props; never call `compile`).

## Commands

```bash
npx vitest run src/ui/editor          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T07` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
