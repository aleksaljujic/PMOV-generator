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

## Current follow-up task (Wave 13, CHANGELOG 2026-11-04, contract C08)

**T48**: [`../../../spec/tasks/T48-flow-locked-drag-snap.md`](../../../spec/tasks/T48-flow-locked-drag-snap.md), contract [`../../../spec/contracts/C08-ui-components.md`](../../../spec/contracts/C08-ui-components.md) §Additions for the grid layout,
spec [`../../../spec/feature_grid_layout.md`](../../../spec/feature_grid_layout.md). If you were started for T48, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Current follow-up task (Wave 12, CHANGELOG 2026-11-04, contract C08)

**T43**: [`../../../spec/tasks/T43-flow-diagram-geometry.md`](../../../spec/tasks/T43-flow-diagram-geometry.md), contract [`../../../spec/contracts/C08-ui-components.md`](../../../spec/contracts/C08-ui-components.md) §Additions for busy nodes,
spec [`../../../spec/feature_dense_nodes.md`](../../../spec/feature_dense_nodes.md). If you were started for T43, read that task file
instead of the original one in "Read first" item 1. It overrides older follow-up sections. Everything else in this
file still applies.

## Current follow-up task (Wave 4, CHANGELOG 2026-10-30)

**T19**: [`../../../spec/tasks/T19-shell-language-switch.md`](../../../spec/tasks/T19-shell-language-switch.md), spec [`../../../spec/fix_editor.md`](../../../spec/fix_editor.md).
If you were started for T19, read that task file instead of the original one in "Read first" item 1. Everything else
in this file still applies. This folder's owner stays as above; T19 may only make the additive edits listed in its task file.
