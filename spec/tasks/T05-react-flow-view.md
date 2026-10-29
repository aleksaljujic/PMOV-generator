# T05 — React Flow nodes, floating edge, DiagramView

**Wave:** 1 (parallel). **Implements:** C08 §DiagramView (incl. `toReactFlow`). **Consumes:** C05, C06 (T04 graph, T11 layout, T12 geometry).
**Folder (owns everything inside):** `src/render/flow/` — read its `AGENT.md`. Public entry: `src/render/flow/index.ts`.

## Goal

The interactive diagram: custom node components drawing FON shapes with inline SVG, one custom `pmov` edge using the
shared geometry (floating edges), and the `DiagramView` component with layout, drag persistence callbacks, selection
and error outlines.

## Steps

1. **`toReactFlow`** (pure): `DiagramGraph` + positions → React Flow `nodes`/`edges` with `type = node.type` /
   `'pmov'`, `data` per C08, `width/height` from the graph node, `draggable: true`, `connectable: false`.
2. **Node components** — `objekat`, `slab`, `veza`, `agregacija`, `atribut`, `spec`, `junction`. Each draws an `<svg>`
   of exactly `node.width × node.height` with the shape from C07 §Drawing rules and C05 style constants (black on white).
   `hasError` → `ERROR_STROKE`/`ERROR_STROKE_WIDTH` outline; `selected` → `SELECTED_STROKE`. Hidden source/target
   `Handle`s (React Flow needs one) — edges don't use them for geometry.
3. **`PmovEdge`** (floating): read both nodes with `useInternalNode`, build `Box`es from
   `internals.positionAbsolute` + measured size, call `computeEdgeGeometry`, render `<BaseEdge path>`, the arrow
   `<polygon>`, and the label through `EdgeLabelRenderer` at `geometry.label` (white halo, `anchor` respected).
   This follows the official React Flow "floating edges" example, but with the C06 geometry instead of the bounding box.
4. **`DiagramView`** — props/handle exactly as C08:
   - Wrap `ReactFlowProvider`; `nodeTypes`/`edgeTypes` defined at module scope.
   - When the graph *structure* changes (ids/sizes signature) or `layoutNonce` changes: run `layoutDiagram(graph,
     { saved: savedPositions })`, ignore stale async results, then `fitView` on the first layout and after
     `layoutNonce` bumps. Label-only changes update data without re-layout.
   - `onNodeDragStop` → `onNodeMoved(id, position)`; node click → `onElementClick(node.elementId)`.
   - `<Background>` off or plain white, `<Controls>`, `<MiniMap>`; `fitView` in the handle; `getPositions()` returns
     current node positions.
   - Empty state "Nema dijagrama" when `graph` is null.

## Working without T04 / T11 / T12

Build a hand-written `DiagramGraph` test fixture (a few nodes of each type, one recursive veza, one spec) inside
`src/render/flow/__fixtures__/`. Until T12's geometry exists, edges render nothing — that is expected; the unit tests
below don't depend on it.

## Tests

- `toReactFlow(buildDiagramGraph(MAIN_EXAMPLE_IR), …)` → 28 nodes / 27 edges with the C05 type distribution, every
  edge type `pmov` (`toReactFlow.integration.test.ts`; plus a unit test on your own fixture).
- Error/selection flags land on all nodes whose `elementId` matches.
- `// @vitest-environment jsdom`: render each node component; the slab renders two `<rect>`s, agregacija a rect + a
  polygon, atribut has `rx`, spec contains text `S`.
- Manual (record in Status): drag a node → `onNodeMoved` fires; recursive veza edges take different paths; labels sit
  near the participant object; arrows on slab/agregacija/podtip edges.

## Definition of done

- [ ] C08 §DiagramView signatures exact; stubs removed; tests green.
- [ ] No styling colors besides C05 style constants.

## Status

Implemented and integrated (layout/geometry real). Bug fix applied: static handles on nodes + stable edges memo so edges no longer disappear; regression tests added. Full suite 199 green, tsc and build OK. Manual checks pending (see spec/sessions/T05.md).

## Contract notes

No proposals.
