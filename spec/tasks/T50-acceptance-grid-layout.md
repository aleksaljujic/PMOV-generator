# T50 — Acceptance: grid layout, cards, locked attributes

**Wave:** 13, after T45–T49 (Sonnet 5.5). Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §Done when.
Replaces Wave 12's T44 (superseded). **Folder (owns everything inside):** `e2e/` (plus your own files in `spec/sessions/`).

Read first: `e2e/AGENT.md`, the feature spec, C05 / C06 / C08 §Additions for the grid layout, and the Wave 12 metric
definitions in `spec/feature_dense_nodes.md` (§Baseline, script `spec/sessions/T44-baseline-metrics.ts.txt`).
Never edit other folders; report bugs in other folders in your session log and **Status**.

## Steps

1. `e2e/grid-layout.test.ts`: for every example (sr source) and a synthetic model (one objekat with 17 attributes
   and 10 vezas to 10 objects), `compile` → `buildDiagramGraph` → `layoutDiagram(g, { algorithm: 'grid' })` →
   `computeDiagramGeometry`. Assert:
   - label × label = 0, label × core box = 0, label × pill = 0, close endpoints (< 8 px, spec/junction excluded,
     both edge ends) = 0;
   - no two `cardBoxes` overlap;
   - every attribute stub beside its box is horizontal (first and last point have equal y);
   - every veza with two different participants lies between them (rank / centre y).
   Also run the same metrics with `algorithm: 'free'` and print them (no assertion, for the log).
2. Locked drag (pure helpers from `src/render/flow`): `applyLockedDrag` on the proizvodnja layout moves `RadniNalog`
   and all its pills by the same delta; Alt moves one pill; then `nudgeToFree` on a card dropped onto another
   gives a free spot.
3. Round trip: saved positions after a locked drag → JSON export → import (`src/interchange`) → same positions.
4. Write `spec/sessions/T50-proizvodnja-grid.svg` (`graphToSvg`, grid layout) in a test guarded by
   `PMOV_WRITE_SVG=1`, to compare with `T44-proizvodnja-before.svg`.
5. Session log: before (Wave 12 baseline) / Wave 12 / grid metrics table per example.

## Definition of done

- [ ] `npx vitest run --config e2e/vitest.config.ts` green (old e2e tests too).
- [ ] `npm test`, `npm run typecheck` green; `npm run build` OK.
- [ ] `spec/sessions/T50-proizvodnja-grid.svg` written; metrics table in `spec/sessions/T50.md`.
- [ ] **Status** below filled in.

## Status

Done (2026-11-04). `e2e/grid-layout.test.ts` added; e2e 66/66, `npm test` 716/716, typecheck and build OK; all grid metrics 0 on 5 examples + synthetic model; SVG written. Log: `spec/sessions/T50.md`. No bugs found in other folders.

## Contract notes
