# T43 — React Flow view: use whole-diagram geometry

**Wave:** 12 (Sonnet 5.5). **Implements:** [`../contracts/C08-ui-components.md`](../contracts/C08-ui-components.md) §Additions for busy nodes.
Feature spec: [`../feature_dense_nodes.md`](../feature_dense_nodes.md).
**Folder (owns everything inside):** `src/render/flow/`.

Read first: your folder's `AGENT.md`, then the feature spec, then C06 §Additions for busy nodes and C08 §DiagramView.
Never edit other folders.

## Goal

Edges in the app look exactly like the SVG export: ports and collision-checked labels from one
`computeDiagramGeometry(graph, boxes)` call, kept live while nodes are dragged. The function already exists
(Wave 0 fallback, T40 fills it in), so you can do this right away.

## Steps

1. Inside the `ReactFlowProvider`, add a small provider (new file, for example `edgeGeometry.tsx`) that reads node
   positions and measured sizes from the React Flow store (`useStore` with a selector over `nodeLookup`, equality by
   positions/sizes), builds `boxes` (same rule as `PmovEdge`'s `endpoint`: measured size, else `node.width/height`),
   and memoises `computeDiagramGeometry(graph, boxes)`. Expose it through a context.
2. `PmovEdge.tsx`: take `geometry[id]` from the context; fall back to the current `computeEdgeGeometry` call when the
   context or the entry is missing (keeps the component usable alone and in existing tests).
3. Recompute while dragging (positions change), but not on unrelated re-renders (selection, hover).
4. `DiagramViewProps`, `toReactFlow`, `PmovNodeData`, `PmovEdgeData` stay unchanged.

## Tests

- Existing flow tests unchanged and green.
- New: with the provider, an edge draws the path from `computeDiagramGeometry` (mocked geometry module returning a
  known path); without the provider it falls back to `computeEdgeGeometry`.
- New: moving a node (update its position in the store) changes the geometry; toggling selection does not call
  `computeDiagramGeometry` again.

## Definition of done

- [ ] `npx vitest run src/render/flow src/architecture.test.ts` green; `npm run typecheck` clean.
- [ ] Only files in `src/render/flow/` changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T43.md`.

## Status

Done. New `src/render/flow/edgeGeometry.tsx`: `EdgeGeometryProvider` (inside `ReactFlowProvider`, wraps `<ReactFlow>` in
`DiagramView`) reads boxes from `nodeLookup` via `useStore(selectBoxes, sameBoxes)` (equality by x/y/width/height) and
memoises `computeDiagramGeometry(graph, boxes)`; `useEdgeGeometry(id)` reads it. `PmovEdge` uses `geometry[id]`, else
falls back to `computeEdgeGeometry`. Tests: `edgeGeometry.test.tsx` (3). Flow 36 tests + architecture green, typecheck clean.

## Contract notes

No contract change. Public flow API unchanged. Selection/hover do not recompute geometry; position or measured-size
changes do (live while dragging).
