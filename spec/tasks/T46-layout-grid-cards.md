# T46 — Layout: grid (ELK layered) with attribute cards

**Wave:** 13 (Sonnet 5.5). **Implements:** [`../contracts/C06-layout-and-geometry.md`](../contracts/C06-layout-and-geometry.md) §Additions for the grid layout → Layout.
Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §1 and §2 (read all of it).
**Folder (owns everything inside):** `src/render/layout/`.

Read first: your folder's `AGENT.md`, the feature spec, all of C06 (§Layout, §Additions for busy nodes, §Additions
for the grid layout), and `spec/sessions/T41.md` (what Wave 12 changed here). Never edit other folders.

## Goal

A new default layout `algorithm: 'grid'`: objects with their attributes are rigid cards (pills at 90° in left/right
columns), laid out by ELK `layered` so that every veza sits between its participants and nothing overlaps. The
Wave 12 layout stays available unchanged as `'free'`.

## Steps

1. New `card.ts`: pill positions relative to the owner box, exactly as C06 (left = first `ceil(a/2)` in source order
   with `#` first, right = rest, rows at pitch 32 centred on the box, stub 24, staggered columns when a side has
   more than 6 rows). Use `ATTR_ROW_PITCH` from `../graph`. Export `cardBoxes(graph, positions)` from `index.ts`.
2. New `grid.ts`: ELK layered input with cards as nodes and the chain edge orientation from C06; all listed options;
   spec blocks as today; round to `GRID = 10`; then place pills by `card.ts`. Saved positions: saved owner → pills
   at card offsets unless the pill is saved too.
3. `layoutDiagramSync` with `grid`: deterministic rank layout (longest-path ranks over the oriented edges, model order
   inside a rank, cards centred per rank, same spacing).
4. `index.ts`: `LayoutOptions.algorithm?: 'grid' | 'free'` (default `'grid'`), `export type LayoutAlgorithm`.
   `'free'` = the current code path, byte-for-byte the same output as today.
5. Rename nothing public; keep `placeAttributes` exported (used by `free`).

## Tests

- `free`: all existing tests pass unchanged (pass `{ algorithm: 'free' }` where the test is about stress; do not
  change what they assert).
- `grid`, every example and the 17-attribute / 10-veza star fixture, both ELK and sync: all nodes positioned and
  finite; no two `cardBoxes` overlap; each veza with two different participants has its centre y strictly between
  theirs (DOWN) or is in the rank between them; spec rows as today; positions are multiples of 10 (owner boxes);
  every pill centre y within its owner's y-range and the pill fully left or right of the box; aspect 1:3 – 3:1.
- Saved owner moves its unsaved pills; saved pills stay; deterministic.
- `cardBoxes` equals the bounding box of owner + pills.

## Definition of done

- [ ] `npx vitest run src/render/layout src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/layout/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T46.md`.

## Status

Done. `npx vitest run src/render/layout src/architecture.test.ts`: 57 passed (5 files); `npm run typecheck` clean.
New: `card.ts`, `grid.ts`, `grid.test.ts`; `index.ts` gains `algorithm`, `LayoutAlgorithm`, `cardBoxes`. Existing tests only
gained `{ algorithm: 'free' }`; fixtures size owner boxes like `graph/build.ts` (`sizeCard`).

## Contract notes

- **Veza orientation:** the first edge of a veza (graph edge order) points into it, every later edge points out of it
  (`orientEdges`); spec chain as in `buildCore`; other edges keep their graph direction; duplicates (same pair) dropped.
- **Ranks are computed by us** (`computeRanks`: longest path, cycles broken by DFS, all podtipovi of a junction on one
  rank) and handed to ELK as `elk.layered.layering.layerChoiceConstraint`. Reason: with the contract's
  `wrapping.strategy = MULTI_EDGE` ELK 0.9.3 ignores the constraint and wraps chains into bands, which put a veza
  outside the y-range of its participants (fixture graph) and broke podtip rows.
- **ELK attempts, in order:** (1) the contract options with `MULTI_EDGE` wrapping, (2) the same without wrapping,
  (3) the deterministic rank layout. The first result that keeps aspect 1:3 - 3:1 and "veza strictly between its
  chain participants" (`acceptable`) wins. All five examples pass on attempt 1; the star (one rank of 10 cards plus a
  17-attribute card, aspect 4:1) ends in attempt 3.
- ELK output goes through `enforceSpec` + `removeOverlaps` (Wave 12 code, card rectangles, no attribute padding) so
  podtipovi share a row and cards keep a 40 px gap, then owner boxes are rounded to `GRID = 10`.
- **Sync rank layout:** one row per rank, top-aligned cards centred; a rank wider than the chosen wrap width is split
  into several rows (rank order stays top to bottom, podtip groups stay in one row). Wrap width is the one whose
  bounding box is closest to 1.6 : 1.
- Pills: first `ceil(a/2)` (identifiers first) left, rest right; rows pitch 32 centred on the box; stub 24; more than 6
  rows on a side: two columns, vertical pitch 16, outer column shifted by inner max width + 24. Pill y is rounded to
  an integer. Pill centres are always inside the owner's y-range when the box height follows the graph's `sizeCard`.
- Saved owner: unsaved pills follow at card offsets; saved pills keep their position. Core positions of a card are
  those of the owner box (top-left); `cardBoxes` returns the bounding box of owner and pills for every core node.
- Core nodes without attributes (veza, spec, junction too) are cards of their own size, so veza attributes
  (fixture only) also get pills.
- **Rank gap grows with labels (fix round):** the gap between ranks is `max(60, 2.3 * (estimateTextWidth(label, 12) / 2 + 10) + 20)`
  over the longest label on a core-to-core edge (`rankGap` in `grid.ts`; 20 = slack for rounding both cards to the 10 px
  grid). Used as ELK `nodeNodeBetweenLayers` and as the row gap of the sync rank layout, so every labelled edge between
  vertically separated boxes has a free span of at least 2.3 * (textW/2 + 10) (tested in `grid.test.ts`, spec nodes excepted:
  their rows keep the Wave 12 `SPEC_GAP` unless ELK spaces them wider). The gap is one global value per diagram.
