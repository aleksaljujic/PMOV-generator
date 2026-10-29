# Agent T06 — Standalone SVG / PNG export

You are the **only** agent working in `src/render/svg/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../../spec/tasks/T06-svg-png-export.md`](../../../spec/tasks/T06-svg-png-export.md): your task (steps, tests, definition of done)
2. [`../../../spec/contracts/README.md`](../../../spec/contracts/README.md) and [`C00-project.md`](../../../spec/contracts/C00-project.md): the rules
3. Your contracts: **C03, C05, C06, C07**
4. [`../../../spec/requrement.md`](../../../spec/requrement.md): the product, for context

## You own

Everything inside `src/render/svg/`. Create any files you need here. **Edit nothing outside this folder.**

Public entry point (other agents import only this, so keep the signatures exactly as in the contract):
`index.ts`: `graphToSvg`, `renderSvg`, `renderSvgAsync`, `svgToPngBlob`, `SvgOptions`

## You may import

`../../lang` (index), `../graph/types` (frozen), `../graph`, `../layout`, `../geometry` (indexes), `../style`. **No React.**

## Dependencies on other agents

T02, T04, T11, T12. Pure helpers get unit tests; full rendering tests are `*.integration.test.ts`.

## Commands

```bash
npx vitest run src/render/svg          # your tests
npx vitest run src/architecture.test.ts   # import rules
npm run typecheck                 # whole repo must stay green
```

## When you finish

- Replace every `not implemented: T06` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
