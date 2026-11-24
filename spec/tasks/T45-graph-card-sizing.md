# T45 — Graph: card sizing (height from attributes, width from relationships)

**Wave:** 13 (Sonnet 5.5). **Implements:** [`../contracts/C05-diagram-graph.md`](../contracts/C05-diagram-graph.md) §Additions for the grid layout.
Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §1 (read all of it).
**Folder (owns everything inside):** `src/render/graph/`.

Read first: your folder's `AGENT.md`, the feature spec, C05 §Sizes, §Additions for busy nodes (being replaced) and
§Additions for the grid layout. `types.ts` is frozen. Never edit other folders.

## Goal

Replace the Wave 12 size-by-degree rule (`sizeByDegree` in `build.ts`, T39) with the card rule: the box is tall
enough for its attribute columns and wide enough for its relationship ports.

## Steps

1. `build.ts`: for `objekat` / `slab` / `agregacija`: `a` = its attribute nodes, `r` = its non-attribute incident
   edges. `rows = ceil(a/2)`; `rows ≤ 6` → `h = max(h0, rows·32 + 12)`, else `h = max(h0, ceil(rows/2)·32 + 28)`;
   `w = max(w0, round(r·11 + 20))`.
2. Export `ATTR_ROW_PITCH = 32` and `PORT_PITCH = 22` from `index.ts` (layout and geometry use them).
3. Remove the old rule and its tests (replace them with the new ones below).

## Tests

- 17 attributes + 10 vezas: `rows = 9` → staggered → `h = 188`, `w = max(w0, 130)`.
- 6 attributes → `rows = 3` → `h = max(44, 108) = 108`; 1 attribute → `h = 44`; 0 attributes → base size.
- 13 attributes → `rows = 7` → staggered → `h = 156`.
- `veza`, `atribut`, `spec`, `junction` never change; `agregacija` uses its own `h0 = max(72, …)`.
- Existing size tests: update only those whose expected size changes because of this rule (main-example nodes with
  attributes get taller). List them in **Contract notes**.
- Note: `src/fixtures/json.ts` is frozen. If `buildDiagramGraph` now gives different sizes than its stored
  `diagram.nodes`, do **not** edit it; report the difference (node id, old/new size) in **Status** for the
  orchestrator.

## Definition of done

- [ ] `npx vitest run src/render/graph src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/graph/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T45.md`.

## Status

Done. `sizeCard` replaces `sizeByDegree` in `build.ts`; `ATTR_ROW_PITCH = 32` and `PORT_PITCH = 22` exported from
`index.ts`. `npx vitest run src/render/graph src/architecture.test.ts`: 21/21 pass. `npm run typecheck`: only error is in
`src/ui/shell/App.tsx` (`onNodesMoved` not yet on `DiagramViewProps`, other agents' work).
Fixture difference for the orchestrator: `buildDiagramGraph(MAIN_EXAMPLE_IR)` vs stored `src/fixtures/json.ts`
`diagram.nodes`: only `Radnik` differs, stored 100 x 44, now 100 x 76 (4 attributes -> 2 rows -> 76). `json.ts` not edited.

## Contract notes

- Changed existing assertion: `sizes and errors > sizes`, `Radnik` height 44 -> 76 (4 attributes, rows 2).
- Replaced the T39 `size by degree` tests with `card sizing (T45)` tests (17 attrs + 10 vezas -> 130 x 188; 0/1/6/12/13
  attributes; slab, agregacija with own h0 = 72, spec/junction unchanged).
- `r` counts every edge whose target is not an attribute node, at both ends (so a recursive veza counts 2 for its object).
- The contract needed no change.
