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
