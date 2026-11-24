# T39 — Graph: box size grows with the number of lines

**Wave:** 12 (Sonnet 5.5). **Implements:** [`../contracts/C05-diagram-graph.md`](../contracts/C05-diagram-graph.md) §Additions for busy nodes.
Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md) §A (read all of it).
**Folder (owns everything inside):** `src/render/graph/`.

Read first: your folder's `AGENT.md`, then the feature spec, then C05 §Sizes and §Additions for busy nodes.
`src/render/graph/types.ts` is frozen. Never edit other folders.

## Goal

`objekat`, `slab` and `agregacija` boxes get larger when many lines end on them, so the endpoints have room on the
outline. Small and medium nodes keep today's size.

## Steps

1. `build.ts`: after all nodes and edges are built, count `n` = edges with the node as source or target (attribute
   edges included) for every `objekat` / `slab` / `agregacija` node.
2. Apply the C05 rule: `PORT_PITCH = 22`; if `2·(w0 + h0) < n·22` then `P = n·22`, `h = max(h0, round(P / 7))`,
   `w = max(w0, round(P/2 − h))`. Export nothing new unless you need it in tests; keep `PORT_PITCH` as a named
   constant with a one-line comment.
3. Nothing else changes: node order, ids, labels, edges.

## Tests

- Existing size tests stay as they are and stay green (main example nodes have n ≤ 8).
- New: a generated IR (or fixture variant) with an objekat with 17 attributes and 10 vezas → `n = 27`, size equals
  the formula (about 212 × 85); veza nodes in it keep their size.
- Boundary: the largest `n` that keeps a 100 × 44 box (13) is unchanged; `n = 14` grows.
- `agregacija` and `slab` grow by the same rule; `atribut`, `veza`, `spec`, `junction` never grow.
- `buildDiagramGraph` on `JSON_MODEL` / the tiny JSON fixture still gives the sizes in `src/fixtures/json.ts`.

## Definition of done

- [ ] `npx vitest run src/render/graph src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/graph/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T39.md`.

## Status

Done. `build.ts` counts edges per objekat/slab/agregacija after building and applies `sizeByDegree` (`PORT_PITCH = 22`).
New tests in `graph.test.ts` ("size by degree (T39)"). Graph + architecture tests green, typecheck clean.

## Contract notes

C05 §Additions for busy nodes implemented as written, no deviations. Note the rule keeps `w0`/`h0` as minimums, so
agregacija (base 140 x 72) only grows for n >= 20.
