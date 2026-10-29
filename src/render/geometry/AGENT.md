# Agent T12 — Edge geometry: intersections, routes, labels, arrows

You are the **only** agent working in `src/render/geometry/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T12-geometry.md`](../../../spec/tasks/T12-geometry.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C05, C06 §Geometry**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/render/geometry/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `boxOf`, `centerOf`, `outlineIntersection`, `computeEdgeGeometry`, `Box`, `EdgeGeometry`

## You may import

`../graph/types` (frozen), `../graph` (T04's index, for `estimateTextWidth` only), `../style`.

## Dependencies on other agents

T04's `estimateTextWidth` — mock it with `vi.mock('../graph', …)` in unit tests until it lands.

## Commands

```bash
npx vitest run src/render/geometry          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T12` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
