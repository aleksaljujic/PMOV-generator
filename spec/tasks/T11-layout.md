# T11 — Layout (ELK + attribute placement)

**Wave:** 1 (parallel). **Implements:** C06 §Layout. **Consumes:** C05 (graph types; at runtime the T04 graph).
**Folder (owns everything inside):** `src/render/layout/` — read its `AGENT.md`. Public entry:
`src/render/layout/index.ts` (`layoutDiagram`, `layoutDiagramSync`, `placeAttributes`).

## Goal

Compute a readable, deterministic `PositionMap` (top-left corners) for every node in a `DiagramGraph`. Use ELK for the
core nodes and simple geometry to fan the attributes around their owners.

## Steps

1. **Core graph for ELK:** only nodes with `layoutRole === 'core'`, and edges whose two ends are both core nodes.
   Inflate each node's size by the space its attribute fan will need (count the attributes whose `ownerNodeId` is that
   node).
2. **`layoutDiagram`:** `import ELK from 'elkjs/lib/elk.bundled.js'`, with `elk.algorithm: layered`,
   `elk.direction: DOWN`, `elk.edgeRouting: ORTHOGONAL`, and generous `spacing.nodeNode` and
   `layered.spacing.nodeNodeBetweenLayers`. Specialization: supertype → `spec:` → `junction:` → podtipovi in
   successive layers, with the podtipovi in one row. If ELK doesn't guarantee that, post-process: align the podtipovi
   on one y below the junction and center the junction above them.
3. **`layoutDiagramSync`:** longest-path layering, barycenter ordering over a few sweeps, the same sizes and spacing,
   the same specialization post-processing. No ELK. It must be fully synchronous (C07 `renderSvg` depends on it).
4. **`placeAttributes`:** for each owner, choose the side(s) with the fewest incident core edges (direction measured
   from the owner's center to each neighbour's center). Fan the attributes evenly on those sides, 30–50px from the
   outline. Nudge them away from other boxes with a few relaxation passes. Saved positions win.
5. **Saved positions** (`options.saved`) override the computed position of any node id they contain. Output is
   deterministic.

## Working without T04

Unit tests use a hand-written `DiagramGraph` fixture in `src/render/layout/__fixtures__/`: a few objects, a veza,
a slab, an agregacija, a spec with 4 subtypes, a recursive veza, and attributes. Tests that run
`buildDiagramGraph(MAIN_EXAMPLE_IR)` go in `layout.integration.test.ts`.

## Tests

- Every node has a finite position, for both functions.
- Core node boxes don't overlap; attribute boxes don't overlap core boxes (fixture plus both examples).
- Saved positions are honoured exactly; repeated runs give equal output.
- Specialization: the podtipovi share one y, which is greater than the junction's y; the junction is below the
  S diamond, and the S diamond is below the supertype.
- `layoutDiagramSync` returns a plain object, not a Promise.

## Definition of done

- [ ] The C06 layout signatures are exact, the stubs are removed, the tests pass, and the code runs in Node.
- [ ] The spacing constants are documented in Contract notes below (T05 and T06 may want them).

## Status

Done. 20 tests pass (unit + integration on MAIN/SPEC examples), architecture and tsc clean. See spec/sessions/T11.md.

## Contract notes

Spacing constants: NODE_GAP 60 (horizontal between inflated boxes), LAYER_GAP 90 (vertical between layers), attribute gap 36-100
(default 36 from outline), attribute pitch pad 8, MARGIN 20. Nodes in one layer share top y. No contract changes proposed.
