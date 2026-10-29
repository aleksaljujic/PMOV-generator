# Agent T05 — React Flow nodes, floating `pmov` edge, `DiagramView`

You are the **only** agent working in `src/render/flow/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T05-react-flow-view.md`](../../../spec/tasks/T05-react-flow-view.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C05, C06, C08 §DiagramView**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/render/flow/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `DiagramView`, `DiagramViewHandle`, `DiagramViewProps`, `toReactFlow`, `PmovNodeData`, `PmovEdgeData`

## You may import

`../graph/types` (frozen), `../graph`, `../layout`, `../geometry` (indexes), `../style`, `@xyflow/react`, `react`.

## Dependencies on other agents

T04 (graph), T11 (layout), T12 (geometry) at runtime. Unit tests use your own `__fixtures__/` graph; anything calling their code goes in `*.integration.test.ts(x)`.

## Commands

```bash
npx vitest run src/render/flow          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T05` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
