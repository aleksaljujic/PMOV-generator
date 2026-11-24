# T48 — Flow: locked attributes, snap to grid, nudge on drop, layout algorithm prop

**Wave:** 13 (Sonnet 5.5). **Implements:** [`../contracts/C08-ui-components.md`](../contracts/C08-ui-components.md) §Additions for the grid layout (flow part).
Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §3 and §4.
**Folder (owns everything inside):** `src/render/flow/`.

Read first: your folder's `AGENT.md`, the feature spec, C08 §DiagramView, §Additions for busy nodes and §Additions for
the grid layout, C06 §Additions for the grid layout (`LayoutOptions.algorithm`, `cardBoxes`), and
`spec/sessions/T43.md`. Never edit other folders.

## Goal

Dragging an object moves its whole card; Alt-drag moves one pill; drags snap to a 10 px grid; a card dropped on
another card is nudged to a free spot; the layout algorithm comes from a prop.

## Steps

1. New `drag.ts` with the pure helpers `applyLockedDrag` and `nudgeToFree` exactly as C08; export both from
   `index.ts`. `nudgeToFree` uses `cardBoxes` from `../layout` (T46 adds it in parallel: until it lands, write the
   helper against the C06 signature and mock `../layout` in unit tests).
2. `DiagramView`: new optional props `layoutAlgorithm`, `lockAttributes` (default true), `snapToGrid` (default true),
   `onNodesMoved`.
   - `onNodeDragStart` remembers whether Alt was held.
   - `onNodesChange` position changes go through `applyLockedDrag`, so pills follow live.
   - On drag stop: `nudgeToFree`, apply the delta to the whole card, then one `onNodesMoved(moves)` call, or
     `onNodeMoved` per moved node when `onNodesMoved` is absent.
3. `snapToGrid` → React Flow `snapToGrid` + `snapGrid={[10, 10]}` and `<Background variant="dots" gap={20}>`.
4. Pass `{ algorithm: layoutAlgorithm ?? 'grid' }` to `layoutDiagram`. A change of `layoutAlgorithm` triggers a fresh
   layout and fit view (as `layoutNonce` does).
5. Keep the T43 edge-geometry provider working during group drags (all moved nodes recompute together).

## Tests

- `applyLockedDrag`: owner drag moves owner + all its pills by the same delta; pill drag (lock on) moves the whole
  card; Alt → only that pill; lock off → only the dragged node; non-owner nodes (veza) move alone.
- `nudgeToFree`: overlapping card → delta to a free spot, multiple of 10, ≤ 300 px; already free → null.
- `DiagramView`: drag stop calls `onNodesMoved` once with owner + pills; falls back to `onNodeMoved`; background and
  snap props present when `snapToGrid`; `layoutAlgorithm` change calls `layoutDiagram` with the new algorithm.
- Existing flow tests unchanged and green.

## Definition of done

- [ ] `npx vitest run src/render/flow src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/flow/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T48.md`.

## Status

Done. `drag.ts` (`applyLockedDrag`, `nudgeToFree`, exported from `index.ts`); `DiagramView` has `layoutAlgorithm`,
`lockAttributes`, `snapToGrid`, `onNodesMoved`. Tests: `drag.test.ts` (8), `DiagramView.grid.test.tsx` (2). The drag-stop
wiring itself is not exercised by a DOM test (d3-drag does not run in jsdom); it is covered by the pure helpers.
`npx vitest run src/render/flow src/architecture.test.ts`: 13 files, 46 tests green. Typecheck: only errors are T46's
pending `cardBoxes` / `LayoutOptions.algorithm` exports.

## Contract notes

- Nudge runs only when locking is on and it is not an Alt pill drag; it moves owner + pills by the delta.
- `onNodesMoved` receives every node whose position differs from the drag start (after the nudge); the dragged node is always included.
- Existing tests that mock `../layout` without `cardBoxes` are unaffected (it is only called at drag stop).
