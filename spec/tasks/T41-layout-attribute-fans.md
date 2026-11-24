# T41 — Layout: attributes on up to four sides, degree-scaled edge length, red tests green

**Wave:** 12 (Sonnet 5.5). **Implements:** [`../contracts/C06-layout-and-geometry.md`](../contracts/C06-layout-and-geometry.md) §Additions for busy nodes → Layout.
Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md) §C (read all of it).
**Folder (owns everything inside):** `src/render/layout/`.

Read first: your folder's `AGENT.md`, then the feature spec, then all of C06 §Layout and §Additions for busy nodes.
Never edit other folders.

## Goal

Attribute pills of a busy node stay close and do not sit on its relationship lines; busy nodes get more room. The
13 layout tests that are red today are green at the end.

## Before you start

Run `npx vitest run src/render/layout` and write the 13 failures (test name + first assertion) into your session
log. They are in `layout.integration.test.ts` and `layout.test.ts` (overlaps such as `Radnik x Rukovođenje`,
spec rows `expected 2 to be 1`, 2D shape). Find the cause before you change placement code.

## Steps

1. `attributes.ts`: choose one to four sides (fewest incident core edges first), split the attributes over them in
   proportion to each side's free length, keep the current overlap scoring and gap tries.
2. A side with more than 6 pills: two staggered rows (top/bottom) or columns (left/right).
3. `inflate.ts`: reserve the space of the fan that is actually used (per side), so overlap removal leaves room for it.
4. Stress / ELK edge length: for an edge touching a core node of degree `d > 6`,
   `EDGE_LENGTH · min(1.6, 1 + 0.05·(d − 6))` (both the ELK path and the sync fallback).
5. Fix the 13 red tests. Changing an existing assertion is allowed only where the C06 addition changes the expected
   behaviour; list every such change with the reason in **Contract notes**. Do not weaken "no overlaps",
   "spec rows" or "2D shape".
6. Keep `__fixtures__` / `dbg.test.ts` tidy: remove debug-only tests if they are not needed.

## Tests

- All existing layout tests green (sync and ELK, every example).
- New: owner with 17 attributes and 10 core neighbours → attributes on ≥ 3 sides, no side with more than 6 pills in
  one row, no pill overlaps a core box, every pill within 120 px of the owner outline.
- New: the side with the most incident core edges gets no attributes when another side is free.
- Edge length: in a star of degree 12 the median centre distance to neighbours is larger than in a star of degree 4.
- Deterministic; saved positions honoured.

## Definition of done

- [ ] `npx vitest run src/render/layout src/architecture.test.ts` green (0 failures); `npm run typecheck` clean.
- [ ] Only files in `src/render/layout/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T41.md`.

## Status

Done (2026-11-04). `npx vitest run src/render/layout src/architecture.test.ts`: 4 files, 34 tests green; `npm run typecheck` clean.
The 13 red tests were caused by a bug in `post.ts` (`toPositions` added the attribute padding to every node twice) plus
edge lengths derived from inflated sizes; both fixed. Session log: `spec/sessions/T41.md`.

## Contract notes

- New `fan.ts` (side count, capacity, proportional split, fan rectangles, reserved padding); `inflate.ts` uses it, so the
  inflation is the fan that is actually used (first `k` sides in the order right, left, bottom, top).
- Sides: `k = 1` for up to 4 pills, otherwise the smallest `k >= 2` whose single rows hold all pills (a left/right side
  holds 6, a top/bottom side holds fewer when pills are wide, at most 100 px beyond the box); if four sides are not
  enough, all four with two staggered rows/columns. Placement picks the `k` sides with the fewest incident core edges.
- Edge length: `EDGE_LENGTH * min(1.6, 1 + 0.05 * (d - 6))`, `d` = all incident edges of the node (attribute edges
  included, larger of the two ends), in `stress.ts` and as per-edge `desiredEdgeLength` for ELK. Edge lengths are now
  derived from the actual node sizes, not the inflated ones (the overlap removal already keeps the inflated boxes apart).
- `post.ts`: `toPositions` no longer adds the padding to the node position (bug fix); new `pullVeza` moves a
  free-standing veza to the free spot nearest the centre of its participants (10 px grid, only when it gains 20 px).
- Assertion change (`__fixtures__/checks.ts`, `checkShape`, "veza between its participants"): the allowed distance is now
  measured from the inflated box of each participant (the reserved fan) and uses `L = EDGE_LENGTH * busyFactor(max degree)`
  instead of the fixed `EDGE_LENGTH`. Reason: C06 stretches edges of busy nodes and reserves their fan, so a veza can
  legitimately sit further from the node centre. The checks for no overlaps, spec rows and aspect ratio are unchanged.
- `dbg.test.ts` removed. New `fans.test.ts` (17 attrs / 10 neighbours, side with most edges stays free, degree-12 vs
  degree-4 median distance, determinism and saved positions) and `makeStarGraph` fixture.
