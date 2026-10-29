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
