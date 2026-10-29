# T06 — Standalone SVG and PNG export

**Wave:** 1 (parallel). **Implements:** C07. **Consumes:** C03 (`compile`), C05 (graph, style), C06 (layout, geometry).
**Folder (owns everything inside):** `src/render/svg/` — read its `AGENT.md`. Public entry: `src/render/svg/index.ts`.

## Goal

A separate, DOM-free renderer that turns `DiagramGraph + PositionMap` into a standalone SVG string that looks the same
as the React Flow diagram, plus `renderSvg(source)` for Mermaid-style use and PNG rasterization for the export button.

## Steps

1. Tiny XML builder helpers (`el(tag, attrs, children)`, `escapeXml`) — no dependencies.
2. `graphToSvg`: compute boxes with `boxOf`, the content bounding box (nodes **and** edge label boxes, using
   `estimateTextWidth`), set `viewBox`/`width`/`height` with padding; draw edges (via `computeEdgeGeometry`), then nodes,
   then edge labels — exactly the C07 drawing rules and C05 style constants. Embed font settings as attributes (not CSS
   classes) so the file renders the same anywhere.
3. `renderSvg(source)`: `compile` → if `ir === null` return an error SVG with `formatDiagnostic(first)`; else
   `buildDiagramGraph` → `layoutDiagramSync` → `graphToSvg`. Wrap in try/catch: never throws.
4. `renderSvgAsync(source)`: same with `layoutDiagram`.
5. `svgToPngBlob(svg, scale=2)`: `Blob` → object URL → `Image` → canvas (white background) → `toBlob('image/png')`.

## Working without T02 / T04 / T11 / T12

Always use the real C06 geometry. Don't write a local copy of it, because then exports could drift from the app.
Tests of `graphToSvg`/`renderSvg` therefore live in `*.integration.test.ts` and stay red until T02, T04, T11 and T12 land.
Pure helpers (`escapeXml`, bounding box, per-type node shape drawing) get unit tests that don't touch geometry.

## Tests

- All tests in C07 §Required tests.
- Node-shape unit tests: each `DiagramNodeType` produces the right elements (slab: 2 rects; agregacija: rect + polygon;
  atribut: rect with `rx`; junction: circle; spec: polygon + bold `S`).
- `renderSvg` is synchronous (returns a string, not a Promise).

## Definition of done

- [ ] C07 signatures exact; stubs removed; tests green (integration ones once T02, T04, T11, T12 are done).
- [ ] An SVG of the main example saved during development opens correctly in a browser — note it in Status.

## Status

Done. 17 tests pass (10 unit, 7 integration), architecture and tsc clean. Sample output: spec/sessions/T06-main-example.svg. svgToPngBlob not exercised in a real browser. Log: spec/sessions/T06.md.

## Contract notes

No changes proposed. Implementation note: label text uses `dy="0.35em"` with `y` as the vertical centre.
