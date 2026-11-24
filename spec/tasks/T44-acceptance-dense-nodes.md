# T44 — Acceptance: readable diagrams around busy nodes

**Wave:** 12, after T39–T43 (Sonnet 5.5). Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md) §Done when.
**Folder (owns everything inside):** `e2e/` (plus your own files in `spec/sessions/`).

Read first: `e2e/AGENT.md`, the feature spec, C05 / C06 / C07 §Additions for busy nodes. Never edit other folders;
report bugs in other folders in your session log and the task's **Status**.

## Goal

Prove the Done-when numbers on every built-in example and leave an "after" SVG for the user to compare.

## Steps

1. `e2e/dense-nodes.test.ts`: for every example in `EXAMPLES` (Serbian source), `compile` → `buildDiagramGraph` →
   `layoutDiagram` (ELK) → `computeDiagramGeometry`. Measure like the Wave 0 baseline script
   `spec/sessions/T44-baseline-metrics.ts.txt` (label box = `estimateTextWidth(label, 12)` × 14; overlap = area > 1;
   close endpoints = two endpoints on the same node < 8 px apart, `spec` / `junction` nodes excluded; count both
   ends of every edge). Assert:
   - label × label = 0 and label × core box = 0;
   - label × attribute: `proizvodnja` ≤ 3, every other example 0;
   - close endpoints = 0.
2. A synthetic model: one objekat with 17 attributes and 10 vezas to 10 other objects → same checks pass, and that
   objekat is larger than 100 × 44.
3. Write `spec/sessions/T44-proizvodnja-after.svg` (`graphToSvg` of the ELK layout) next to the existing
   `T44-proizvodnja-before.svg`; do it in a test guarded by an env var (`PMOV_WRITE_SVG=1`), so normal runs write
   nothing.
4. Put a before/after metrics table in your session log.

## Definition of done

- [ ] `npx vitest run --config e2e/vitest.config.ts` green (old e2e tests too).
- [ ] `npm test` and `npm run typecheck` green; `npm run build` OK.
- [ ] `spec/sessions/T44-proizvodnja-after.svg` written; metrics table in `spec/sessions/T44.md`.
- [ ] **Status** below filled in.

## Status

Superseded (2026-11-04, not run): the user chose the grid layout with attribute cards (Wave 13); acceptance moved
to [T50](T50-acceptance-grid-layout.md). Wave 12 results are in `spec/sessions/MANIFEST.md`.

## Contract notes
