# T12 — Edge geometry (floating edges, routes, labels, arrows)

**Wave:** 1 (parallel). **Implements:** C06 §Geometry. **Consumes:** C05 (types, style constants,
`estimateTextWidth` from the T04 graph index).
**Folder (owns everything inside):** `src/render/geometry/` — read its `AGENT.md`. Public entry:
`src/render/geometry/index.ts`.

## Goal

The single source of truth for how an edge is drawn. React Flow (T05) and SVG export (T06) both call
`computeEdgeGeometry`, so the screen and the exports are identical. This is where the FON details live: labels near
the participant, real diamond intersections, separate paths for a recursive veza, the org-chart bus for podtipovi,
and arrowheads.

## Steps

1. `boxOf`, `centerOf`.
2. `outlineIntersection(shape, box, toward)`:
   - `rect`, `doubleRect` and `rectDiamond` use the outer rectangle.
   - `diamond` uses its true edges: scale the ray so |dx|/hw + |dy|/hh = 1.
   - `pill` uses a rectangle with semicircular ends of radius h/2.
   - `circle` uses radius min(w, h)/2.
   - If `toward` equals the center, return a deterministic point such as the top-center.
3. `computeEdgeGeometry` with the four routes from C06 (`straight`, `loopTop`, `loopBottom`, `busDown`). For `loop*`,
   the edge enters the diamond at its top or bottom vertex.
4. **Arrows:** the tip sits on the target outline. `polygon` holds the three points (`ARROW_LENGTH`, `ARROW_WIDTH`
   from `src/render/style.ts`). `path` stops at the arrow base.
5. **Labels:** follow the C06 label rule. Anchor at ~18% of the polyline length from the source end, but at least
   `estimateTextWidth(label, EDGE_FONT_SIZE)/2 + 10` from the source outline, and never past 45% of the length.
   Then offset 10px perpendicular, on the side that points away from the source box's center. Return `anchor` so
   the text extends away from the line. Put a short comment block at the top of `index.ts` explaining this rule.

## Dependency note

Only `estimateTextWidth` comes from `src/render/graph`. Until T04 lands, the graph `index.ts` stub throws.
Unit tests mock it (`vi.mock('../graph', () => ({ estimateTextWidth: (t: string, fs: number) => t.length * fs * 0.55 }))`).

## Tests

All the geometry tests in C06 §Required tests, plus:
- Diamond intersection at 0°, 45°, 90° and arbitrary angles lies on the outline; the pill's end cap lies on the
  circle.
- `straight` between two boxes: the first point is on the source outline and the last on the target outline.
- Label: inside the first 45% of the path, its estimated text box doesn't intersect the source box or the line.
- `loopTop` and `loopBottom` for the same pair: one stays above both boxes and the other below.
- `busDown`: 4 points, axis-aligned segments, the last one vertical and pointing down, the arrow tip at the
  target's top-center.

## Definition of done

- [ ] The C06 geometry signatures are exact, the stubs are removed, the tests pass, with no DOM and no React.

## Status

Done. 14 tests pass (src/render/geometry/index.test.ts), architecture test passes. See spec/sessions/T12.md.

## Contract notes

C06 could specify label x/y semantics: we return x as the text-anchor x (near-line edge for start/end, center for middle) and y as vertical center.
