# Agent T04 — IR → DiagramGraph

You are the **only** agent working in `src/render/graph/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T04-graph.md`](../../../spec/tasks/T04-graph.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C03, C05**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/render/graph/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `buildDiagramGraph`, `estimateTextWidth`, `attributeNodeId` (+ re-exports `types.ts`)

## You may import

`../../lang` (index), `./types`, `../style`. Tests: `../../fixtures/*`.

## Dependencies on other agents

None (use the IR fixtures). `types.ts` is FROZEN — do not edit it. Note: T11 and T12 depend on you; `estimateTextWidth` is the first thing to land.

## Commands

```bash
npx vitest run src/render/graph          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T04` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.

## Current follow-up task (Wave 13, CHANGELOG 2026-11-04, contract C05)

**T45**: [`../../../spec/tasks/T45-graph-card-sizing.md`](../../../spec/tasks/T45-graph-card-sizing.md), contract [`../../../spec/contracts/C05-diagram-graph.md`](../../../spec/contracts/C05-diagram-graph.md) §Additions for the grid layout,
spec [`../../../spec/feature_grid_layout.md`](../../../spec/feature_grid_layout.md). If you were started for T45, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Current follow-up task (Wave 12, CHANGELOG 2026-11-04, contract C05)

**T39**: [`../../../spec/tasks/T39-graph-size-by-degree.md`](../../../spec/tasks/T39-graph-size-by-degree.md), contract [`../../../spec/contracts/C05-diagram-graph.md`](../../../spec/contracts/C05-diagram-graph.md) §Additions for busy nodes,
spec [`../../../spec/feature_dense_nodes.md`](../../../spec/feature_dense_nodes.md). If you were started for T39, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.
