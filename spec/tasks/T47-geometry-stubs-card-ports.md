# T47 — Geometry: 90° attribute stubs, relationship ports on top/bottom of cards

**Wave:** 13 (Sonnet 5.5). **Implements:** [`../contracts/C06-layout-and-geometry.md`](../contracts/C06-layout-and-geometry.md) §Additions for the grid layout → Geometry.
Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §1.
**Folder (owns everything inside):** `src/render/geometry/`.

Read first: your folder's `AGENT.md`, the feature spec, C06 §Geometry, §Additions for busy nodes and §Additions for
the grid layout, and `spec/sessions/T40.md`. Never edit other folders.

## Goal

In `computeDiagramGeometry`: attribute lines beside the box are exactly horizontal (90° to the side), and
relationship lines on a card leave through the top/bottom so they never cross the attribute columns.

## Steps

1. Attribute stub rule (C06): `owner → atribut` with the pill centre y inside the owner's y-range and the pill fully
   left/right of the box → one horizontal segment at the pill centre y, from the box side to the pill outline.
   Exclude those edges from the port distribution. Anything else: as today.
2. Card ports (C06): on a rectangle node with stub edges on its left/right side, relationship `straight` edges use
   top or bottom by the sign of dy, unless |dy| < height / 2; then they keep left/right and their endpoint moves to
   the nearest free gap between stub rows (midway between two stub y values, or above/below the outermost).
3. `computeEdgeGeometry` (single edge) stays as it is.

## Tests

- Card fixture (box + 6 pills in two columns, positions as C06 cards): every stub has 2 points with equal y, starts
  on the box side and ends on the pill outline.
- A pill above the box (not beside it) → old behaviour.
- Card with 5 relationship neighbours above/below → all endpoints on the top/bottom side, ≥ 8 px apart; a neighbour
  level with the box → endpoint on the side, in a gap (≥ 4 px from every stub y).
- Old geometry tests unchanged and green; deterministic.

## Definition of done

- [ ] `npx vitest run src/render/geometry src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/geometry/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T47.md`.

## Status

Done (2026-11-04). `npx vitest run src/render/geometry src/architecture.test.ts`: 32 passed (3 files; 3 new card tests).
`npm run typecheck`: no errors in geometry; 3 errors in `src/render/flow` (other agent's in-progress work: `cardBoxes`, `LayoutOptions.algorithm`).

## Contract notes

- New `stubs.ts` (`findStubs`): stub = edge from a rectangle node to an `atribut` whose pill centre y is within the owner's
  y-range and which is fully left/right of the box; points = `[box side, pill side]` at the pill centre y. Either side
  hit by pill edge x (not an ellipse cap intersection), which is where the pill's horizontal tangent meets its outline.
- Stub edges are skipped by `computePorts` (new optional 4th arg `stubs`). `computeEdgeGeometry` unchanged.
- Card ports: only on nodes with stubs. A relationship end whose natural side is left/right goes to top/bottom when
  |dy| >= height/2. Otherwise, if that side has stubs, it goes to the nearest gap between stub rows (box edge counts
  as a row boundary); several ends in one gap are spread 8 px apart, kept >= 4 px from stubs while room allows.
  If that side has no stubs it uses the normal port distribution.
- Edge direction `atribut -> owner` is not treated as a stub (contract says owner -> atribut).
- Label fix round: if none of the 6 primary candidates (18/28/38 %, both sides) is free, `computeDiagramGeometry` tries
  48 % and 58 % (path clamp raised to 60 %), then, with perpendicular offset LABEL_GAP + 8 and + 16, the fractions
  18/28/38/48/58 %, both sides; least overlap wins if none is free. All node boxes (the source included) and earlier
  labels are obstacles. `labelAt` got optional `extraGap` / `maxFraction` args; `computeEdgeGeometry` unchanged.
- Loop/bus end vs stub: in `computeDiagramGeometry` only, a loop/bus end on a left/right side within 8 px of a stub row
  moves to the nearest stub gap (same gap rule as card ports); a horizontal first/last segment stays horizontal.
