# Agent T02 — Checker, IR builder, `compile()`

You are the **only** agent working in `src/lang/semantic/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T02-checker-ir-compile.md`](../../../spec/tasks/T02-checker-ir-compile.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C01, C02, C03**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/lang/semantic/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `compile`, `getElement`, `findElementAtOffset`, `supertypeOf`, `isSubtype`. Also `errorFixtures.ts`.

## You may import

`../ast`, `../diagnostics`, `../ir` (frozen), `../syntax` (T01's index). Tests may import `../../fixtures/*`, `../../examples`.

## Dependencies on other agents

T01 (parser). Until it lands, unit-test with hand-built ASTs; tests through `compile()` go in `*.integration.test.ts`. `query.ts` is already implemented (copied from C03) — you own it now.

## Commands

```bash
npx vitest run src/lang/semantic          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T02` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
