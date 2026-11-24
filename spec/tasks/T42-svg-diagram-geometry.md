# T42 — SVG export: use whole-diagram geometry

**Wave:** 12 (Sonnet 5.5). **Implements:** [`../contracts/C07-svg-export.md`](../contracts/C07-svg-export.md) §Addition (Wave 12).
Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md).
**Folder (owns everything inside):** `src/render/svg/`.

Read first: your folder's `AGENT.md`, then the feature spec, then C06 §Additions for busy nodes and C07.
Never edit other folders.

## Goal

`graphToSvg` gets all edge geometry from one `computeDiagramGeometry(graph, boxes)` call. The function already
exists (Wave 0 fallback, T40 fills it in), so you can do this right away.

## Steps

1. In `graphToSvg`, build `boxes: Record<string, Box>` from the node boxes you already compute, call
   `computeDiagramGeometry` once, and use `geo[e.id]` in the edge loop (skip edges without geometry, as today).
2. Everything else (bounds, paint, error outlines, labels, escaping) stays the same.

## Tests

- Existing SVG tests unchanged and green.
- New: `graphToSvg` calls `computeDiagramGeometry` once per render (spy via `vi.mock('../geometry', …)` keeping the
  real implementation), and the label `<text>` positions equal the geometry it returned.
- `svg.integration.test.ts`: `renderSvg` of every example parses without `parsererror`.

## Definition of done

- [ ] `npx vitest run src/render/svg src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/svg/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T42.md`.

## Status

Done. `graphToSvg` builds `boxes: Record<string, Box>`, calls `computeDiagramGeometry(graph, boxes)` once and reads
`geo[e.id]` in the edge loop (edges without geometry are skipped). Tests: new spy test in `svg.test.ts` (one call,
label `<text>` x/y equal the returned geometry), new all-examples parse test in `svg.integration.test.ts`.
`npx vitest run src/render/svg src/architecture.test.ts`: 25 passed; `npm run typecheck` clean.

## Contract notes

None. C07 §Addition (Wave 12) implemented as written; output format unchanged.
