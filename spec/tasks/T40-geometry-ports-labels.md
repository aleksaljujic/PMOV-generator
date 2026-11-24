# T40 — Geometry: whole-diagram geometry, spread endpoints, label collisions

**Wave:** 12 (Sonnet 5.5). **Implements:** [`../contracts/C06-layout-and-geometry.md`](../contracts/C06-layout-and-geometry.md) §Additions for busy nodes → Geometry.
Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md) §B and §D (read all of it).
**Folder (owns everything inside):** `src/render/geometry/`.

Read first: your folder's `AGENT.md`, then the feature spec, then all of C06 §Geometry and §Additions for busy nodes.
Never edit other folders.

## Goal

Implement `computeDiagramGeometry(graph, boxes)`. The orchestrator left a working fallback at the end of `index.ts`
(one `computeEdgeGeometry` per edge); replace its body. Two improvements:

1. **Ports:** lines ending on a rectangle node are spread along its sides, not aimed at its centre.
2. **Labels:** each cardinality label avoids node boxes (attribute pills too) and the labels placed before it.

`computeEdgeGeometry` keeps its signature and behaviour (existing tests stay green unchanged).

## Steps

1. Put the new code in new files (for example `ports.ts`, `labels.ts`) and export only `computeDiagramGeometry`
   from `index.ts`. Reuse the existing route, arrow and label helpers; factor them out of `index.ts` where needed
   without changing `computeEdgeGeometry` output.
2. Ports, exactly as C06: rectangle-outlined shapes (`objekat`, `slab`, outer rectangle of `agregacija`); group
   `straight` edges by exit side (centre ray toward the other end's centre); sort per side by the other end's centre
   coordinate, ties by edge id; positions `L·(i+1)/(k+1)`, ≥ 6 px from corners, ≥ 8 px from fixed loop / bus
   endpoints on that side. Rect-to-rect: port to port. Rect-to-other: the other end is
   `outlineIntersection(shape, box, port)`. Self edges and non-`straight` routes: as `computeEdgeGeometry`.
3. Labels, exactly as C06: candidates 18 / 28 / 38 % (clamped), default side then the other; obstacles = all node
   boxes + placed labels; first candidate with no overlap, otherwise the least overlap area. Edge order =
   `graph.edges` order.
4. Keep it fast: `proizvodnja` (≈ 100 edges) under 5 ms in Node. A simple O(edges × (nodes + labels)) scan is fine.
5. Update the header comment in `index.ts` so it describes both functions.

## Tests

Use your own fixture graphs (no layout dependency). Mock `../graph` as today if needed.

- Same output for the same input (deterministic), including key order.
- Star: one 212 × 85 objekat with 27 neighbours around it → every pair of endpoints on it is ≥ 8 px apart, every
  endpoint lies on the rectangle outline, no endpoint closer than 6 px to a corner.
- The other end of a rect → diamond line lies on the diamond outline; arrow tips still lie on the target outline.
- A two-node graph gives the same points as `computeEdgeGeometry` (one line per side → the side centre). Note it
  in **Contract notes** if this is not the case.
- Labels: a crowded fixture where the default label spot overlaps an attribute box → the chosen label does not
  overlap any node box or other label, is within the first 45 % of the path and is not inside the source box.
- Edges whose endpoints have no box are left out; loop and bus routes match `computeEdgeGeometry`.

## Definition of done

- [ ] `npx vitest run src/render/geometry src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Old geometry tests unchanged and green.
- [ ] Only files in `src/render/geometry/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T40.md`.

## Status

Done 2026-11-04. `computeDiagramGeometry` implemented (`diagram.ts`, `ports.ts`); shared helpers moved to `base.ts`.
`npx vitest run src/render/geometry src/architecture.test.ts`: 29 tests green (15 old unchanged, 8 new).
Typecheck: clean in geometry; only `src/render/flow/edgeGeometry.test.tsx` errors (other agent, in progress).

## Contract notes

- Two aligned nodes (centres on one line) give exactly the `computeEdgeGeometry` points. When the centres are offset,
  the ports are still side centres (one line per side), so the line is slightly slanted and differs from the
  centre-aimed line of `computeEdgeGeometry`. That is the intended port behaviour.
- Fixed loop / bus endpoints are detected from `routePoints` of non-straight edges; a port within 8 px of one is moved
  to 8 px away, then clamped to 6 px from the corners. If a side is so crowded that both rules conflict, the 8 px
  rule between a port and a fixed endpoint can win over the even spacing (ports may then get closer than 8 px to
  each other). Not hit by any test.
- Label candidates may coincide when the 45 % / `textW/2+10` clamps collapse 18/28/38 % to one distance; harmless.
- Label obstacle list = all node boxes in `boxes` that belong to `graph.nodes` + labels placed so far (edges without
  a label add nothing).
- `index.ts` now only holds `computeEdgeGeometry` and re-exports; behaviour and output key order unchanged.
