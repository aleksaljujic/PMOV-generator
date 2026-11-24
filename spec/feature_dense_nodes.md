# Feature: readable diagrams around busy nodes

A node with many attributes and many relationships (for example `RadniNalog` in `proizvodnja`, or a user model with
~17 attributes and ~10 relationships on one objekat) turns into a "starburst": every line ends at nearly the same
point on a small box, attribute pills sit on top of relationship lines, and cardinality labels hide under pills and
other labels.

## Causes (current code)

1. **Every straight line aims at the box centre** (C06 route rule `straight`). On a 100×44 box, 25+ lines leave the
   outline within a few pixels of each other.
2. **Attributes use at most two sides** (`src/render/layout/attributes.ts`): one or two straight rows, pushed further
   out (up to 100 px) when they collide, so attribute lines cross relationship lines.
3. **Cardinality labels are placed without collision checks** (C06 label rule): each label is computed for its own
   edge only.
4. Box size depends only on the label text, not on how many lines end on the box.

## Baseline (2026-11-04, ELK layout, built-in examples)

Measured by the orchestrator with `layoutDiagram` + `computeEdgeGeometry` (label box = `estimateTextWidth(label, 12)`
× 14 px; "close endpoints" = two line endpoints on the same node closer than 8 px, junction/spec excluded):

| example | labels | label×label | label×core box | label×attribute | close endpoints | max degree |
|---|---|---|---|---|---|---|
| osnovni | 9 | 0 | 2 | 0 | 0 | 7 |
| specijalizacija | 3 | 0 | 1 | 0 | 0 | 5 |
| biblioteka | 12 | 0 | 0 | 0 | 1 | 7 |
| proizvodnja | 44 | 5 | 11 | 16 | 11 | 16 |
| domeni | 9 | 0 | 2 | 2 | 1 | 8 |

## Solution (approved by the user, 2026-11-04)

Four parts, in order of impact. Each part lives in one agent folder.

| Part | What | Folder | Task |
|---|---|---|---|
| A | Box grows with the number of lines ending on it | `src/render/graph/` | T39 |
| B + D | Line endpoints spread along each side ("ports"); labels placed with collision checks, for the whole diagram at once | `src/render/geometry/` | T40 |
| C | Attributes on up to four sides, two rows when a side is crowded; edge length grows with degree; fix the 13 red layout tests | `src/render/layout/` | T41 |
| wiring | SVG export and the React Flow view use the new whole-diagram geometry | `src/render/svg/`, `src/render/flow/` | T42, T43 |
| check | Metrics on every example, before/after SVGs | `e2e/` | T44 |

### A. Size by degree (C05)

`n` = number of edges in the graph that have the node as source or target (attribute edges included).
For `objekat`, `slab`, `agregacija`: with base size `w0 × h0` (today's table) and `PORT_PITCH = 22`:
if `2·(w0 + h0) ≥ n·22`, the size is unchanged. Otherwise `P = n·22`, `h = max(h0, round(P / 7))`,
`w = max(w0, round(P/2 − h))`. Example: 27 lines → about 212 × 85. Small and medium nodes (n ≤ 13 for a 100×44 box)
keep today's size, so existing fixtures and tests stay valid. veza, atribut, spec and junction never grow.

### B. Ports (C06)

A new whole-diagram function computes all edge geometry at once, so endpoints on a node can be spread out:

```ts
export function computeDiagramGeometry(
  graph: DiagramGraph,
  boxes: Record<string, Box>,   // node id → box (renderers pass measured or graph sizes)
): Record<string, EdgeGeometry>; // edge id → geometry
```

For rectangle-outlined nodes (`objekat`, `slab`, and the outer rectangle of `agregacija`), the `straight` edges
ending on the node are grouped by the side the centre ray toward the other end leaves through. On each side they are
sorted by the other end's coordinate along that side (ties: edge id) and get evenly spaced endpoints at
`L·(i+1)/(k+1)`, at least 6 px from a corner and at least 8 px from a fixed route endpoint (loop, bus) on that side.
The other end of the line uses its own port if it is also a rectangle node. Otherwise it uses `outlineIntersection`
toward this end's port. Lines stay straight and touch the outline (FON). `loopTop`, `loopBottom` and `busDown` are unchanged.

### D. Labels with collision checks (C06)

`computeDiagramGeometry` places labels in edge order (deterministic). Candidates, in preference order: distances
18 %, 28 %, 38 % of the path from the source end (each at least `textW/2 + 10` from the source outline and at most
45 %), each on the default perpendicular side first, then the other. Obstacles: every node box (attributes included)
and every label already placed. Take the first candidate with no overlap; if none, the one with the least overlap
area. The FON rule (label near the source end) still holds.

`computeEdgeGeometry` (single edge) keeps working as today for any caller that has only one edge.

### C. Attributes (C06 layout)

- Use one to four sides. Prefer sides with the fewest incident core edges, and split attributes in proportion to the
  free length of the chosen sides.
- More than 6 pills on one side: two staggered rows (top/bottom) or columns (left/right), so the fan stays short.
- Inflation (`inflate.ts`) reserves the fan that is actually used.
- Desired edge length (stress) for an edge touching a node of degree `d > 6`: `EDGE_LENGTH · min(1.6, 1 + 0.05·(d − 6))`.
- The 13 layout tests that fail today (overlaps, spec rows, 2D shape) must be green at the end.

### E. Out of scope (later, optional)

A "compact attributes" view (only `#` attributes plus a "+N" badge). Not part of this wave.

## Done when (checked by T44 and the orchestrator)

On every built-in example, with the ELK layout and `computeDiagramGeometry`:

- label × label = 0 and label × core box = 0;
- label × attribute: `proizvodnja` ≤ 3, every other example 0;
- close endpoints (< 8 px, junction/spec excluded) = 0;
- `npm test`, `npm run typecheck`, `npm run build` green; the 13 old layout failures gone;
- `spec/sessions/T44-proizvodnja-after.svg` saved next to `T44-proizvodnja-before.svg` (written by the orchestrator in
  Wave 0 from today's code) for a visual check by the user. The baseline script is
  `spec/sessions/T44-baseline-metrics.ts.txt`.
