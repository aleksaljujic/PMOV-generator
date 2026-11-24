# C06 — Layout and edge geometry

Owners: **T11** (layout, `src/render/layout/`) and **T12** (geometry, `src/render/geometry/`).
Consumers: T05 (React Flow floating edges + DiagramView), T06 (SVG export), T09.

Geometry is shared on purpose: the React Flow edge component and the SVG exporter both call
`computeEdgeGeometry`, so lines, label positions and arrowheads are identical in the app and in exports.

## Layout

```ts
// src/render/layout/index.ts
import type { DiagramGraph, PositionMap } from '../graph/types';  // frozen contract file

export interface LayoutOptions {
  /** Positions the user dragged (from localStorage). They override computed positions for those node ids. */
  saved?: PositionMap;
}

/** ELK 'stress' (undirected 2D layout) on layoutRole==='core' nodes, then overlap removal, specialization
 *  post-processing and attribute placement. */
export function layoutDiagram(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap>;

/** Same contract, no ELK: deterministic stress-majorization fallback with the same post-processing.
 *  Synchronous, needed by renderSvg(source): string (C07). */
export function layoutDiagramSync(graph: DiagramGraph, options?: LayoutOptions): PositionMap;

/** Places every attribute node around its owner; used by both functions above. Attributes with a saved
 *  position keep it. Returns positions for attribute nodes only. */
export function placeAttributes(graph: DiagramGraph, core: PositionMap, saved?: PositionMap): PositionMap;
```

Guarantees:

- Result contains a position for **every** node in the graph (top-left corner), finite numbers, no NaN.
- Saved position for node id N ⇒ result[N] equals it exactly.
- Same input ⇒ same output (deterministic).
- **2D, compact layout (changed 2026-10-29 at the user's request; replaces "layered DOWN").** The layered layout put
  every objekat in one row and every veza in the next, because all edges point object → connector. The graph is now
  laid out as **undirected**: each veza, slab and agregacija ends up between its participants, and the bounding box
  stays roughly balanced (aspect ratio between 1:2.5 and 2.5:1 for every built-in example). Objects must not all
  share one row.
- **No overlaps:** core boxes, inflated by their attribute fan plus a gap, never overlap after the overlap-removal pass.
- Specialization: podtip nodes end up in one row **below** the junction, the junction below the S diamond,
  the S diamond below the supertype. This is a post-processing step after the 2D layout, followed by overlap removal
  that moves the whole spec block together.
- Attributes are not fed to ELK. Leave room for them by inflating each core node's box by the space its
  attribute fan needs.
- Attribute placement: fan attributes on the owner's side(s) with the fewest incident core edges, evenly spaced,
  ~30–50px from the owner outline, avoiding overlap with other nodes' boxes when reasonably possible.
- `layoutDiagram` must work in Node (Vitest) — import `elkjs/lib/elk.bundled.js`.

## Geometry

```ts
// src/render/geometry/index.ts
import type { DiagramEdge, DiagramNode, NodeShape, Point } from '../graph/types';

export interface Box { x: number; y: number; width: number; height: number } // top-left based

export function boxOf(node: DiagramNode, position: Point): Box;
export function centerOf(box: Box): Point;

/** Point where the ray from the box center toward `toward` leaves the shape's outline.
 *  diamond → true diamond edges (not the bounding box); pill → rounded ends; circle → circle;
 *  rect / doubleRect / rectDiamond → outer rectangle. */
export function outlineIntersection(shape: NodeShape, box: Box, toward: Point): Point;

export interface EdgeGeometry {
  /** Polyline from the source outline to the target outline (≥ 2 points). With an arrow, the last point is the arrow TIP. */
  points: Point[];
  /** SVG path `d` for `points` (M … L …). With an arrow, the path stops at the arrow BASE so the line does not poke through. */
  path: string;
  /** Center of the label text, or null when edge.label is null. */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
  /** Filled triangle at the target, or null. `polygon` is ready for <polygon points="…">. */
  arrow: { tip: Point; angle: number; polygon: string } | null;
}

export function computeEdgeGeometry(
  edge: DiagramEdge,
  source: { node: DiagramNode; box: Box },
  target: { node: DiagramNode; box: Box },
): EdgeGeometry;
```

### Route rules

| route | path |
|---|---|
| `straight` | `outlineIntersection(source → target center)` → `outlineIntersection(target → source center)` |
| `loopTop` | source top-center → up to `y = min(source.top, target.top) − 30` → horizontal to target center x → down to target's top vertex |
| `loopBottom` | mirror of `loopTop` using bottoms (`max(bottom) + 30`) |
| `loopTop` / `loopBottom`, **stacked** (source and target x-ranges overlap) | `loopTop` = straight line between the facing outlines; `loopBottom` = source left-center → left to `x = min(source.left, target.left) − 30` → vertical to target center y → target's left vertex |
| `busDown` | source bottom-center → down to `midY = (source.bottom + target.top) / 2` → horizontal to target center x → down to target top-center (arrow tip) |

### Label rule (the important FON detail)

The label sits **near the source end** (the participant object), not mid-line:
anchor point at ~18% of the polyline length measured from the source end, but at least
`estimateTextWidth(label)/2 + 10` px from the source outline, then offset ~10px perpendicular to the segment so the
text does not overlap the line. Pick the perpendicular side deterministically (e.g. left of the direction of travel,
flipped if that side points into the source node). `anchor` tells renderers how to align the text.

**Label coordinates (clarification from T12, additive):** `label.x` is the SVG `text-anchor` position: for
`'start'`/`'end'` it is the text edge nearest the line, and for `'middle'` it is the text center. `label.y` is the
**vertical center** of the text. Renderers must center vertically: SVG `dominant-baseline="central"`. In React Flow /
HTML, use a `translate(-0%/-50%/-100%, -50%)` that matches the anchor.

### Arrow rule

Triangle of `ARROW_LENGTH × ARROW_WIDTH` (C05 style) with its tip exactly on the target outline, pointing along the
last segment; `angle` in radians (atan2 of last segment).

## Required tests (layout tests → T11, geometry tests → T12)

- `outlineIntersection` for each shape: point lies on the outline (diamond: |dx|/hw + |dy|/hh ≈ 1).
- Straight edge between two boxes; label is within the first 35% of the path and not inside the source box.
- loop routes for a recursive veza differ (top vs bottom) and do not overlap.
- busDown has 4 points and the last segment is vertical.
- Arrow tip lies on the target outline.
- Layout of `buildDiagramGraph(MAIN_EXAMPLE_IR)` and `SPEC_EXAMPLE_IR`: all nodes positioned, core node boxes don't
  overlap, saved positions honoured, podtipovi share a row below the junction (`*.integration.test.ts` is fine).

## Additions for busy nodes (Wave 12, `spec/feature_dense_nodes.md`, tasks T40 T41)

### Geometry (T40): whole-diagram geometry, ports, label collisions

```ts
// src/render/geometry/index.ts (new export; computeEdgeGeometry stays as it is)
/** Geometry for every edge in the graph at once: spread endpoints (ports) and collision-checked labels.
 *  `boxes` holds a box for every node (renderers pass measured or graph sizes). Edges whose source or target has
 *  no box are left out. Deterministic: same input → same output. */
export function computeDiagramGeometry(graph: DiagramGraph, boxes: Record<string, Box>): Record<string, EdgeGeometry>;
```

**Ports.** For rectangle-outlined nodes (`objekat`, `slab`, the outer rectangle of `agregacija`): the `straight`
edges ending on the node are grouped by the side the ray from the box centre toward the other end's centre leaves
through. Per side, sort by the other end's centre coordinate along that side (x for top/bottom, y for left/right;
ties by edge id) and place the k endpoints at `L·(i+1)/(k+1)` along the side, clamped to ≥ 6 px from a corner and
≥ 8 px from a fixed `loopTop` / `loopBottom` / `busDown` endpoint on that side. If the other end is also a
rectangle node it uses its own port; otherwise its endpoint is `outlineIntersection(shape, box, <this end's port>)`.
Lines stay straight. Other routes are unchanged. Arrow rule unchanged (tip on the target outline).

**Labels.** Placed in `graph.edges` order. Candidates in preference order: distance 18 %, 28 %, 38 % of the path
length from the source end (each clamped as in the label rule above: ≥ `textW/2 + 10`, ≤ 45 %); for each distance
the default perpendicular side first, then the other. Label box: `estimateTextWidth(label, EDGE_FONT_SIZE)` ×
`EDGE_FONT_SIZE + 2`. Obstacles: every node box (attributes included) and every label already placed. Pick the first
candidate with no overlap; if none, the one with the least total overlap area (ties: earlier candidate). Output
format (`label.x`, `label.y`, `anchor`) as in the clarification above.

### Layout (T41): attribute fans and edge length

Replaces the "Attribute placement" bullet above:

- Attributes may use one to four sides of the owner. Prefer sides with the fewest incident core edges, and split
  the attributes over the chosen sides in proportion to each side's free length.
- More than 6 pills on one side: two staggered rows (top/bottom side) or columns (left/right side).
- The inflation used for overlap removal is the space of the fan that is actually used.
- Desired edge length for an edge touching a core node of degree `d > 6` (all incident edges):
  `EDGE_LENGTH · min(1.6, 1 + 0.05·(d − 6))`.
- The existing guarantees (all positioned, saved honoured, deterministic, no overlaps, spec rows, 2D shape) stay; the
  layout tests that are red today must be green.

## Additions for the grid layout (Wave 13, `spec/feature_grid_layout.md`, tasks T46 T47)

### Layout (T46)

```ts
export interface LayoutOptions {
  saved?: PositionMap;
  /** 'grid' (default): ELK layered with cards. 'free': the Wave 12 stress layout, unchanged. */
  algorithm?: 'grid' | 'free';
}
export type LayoutAlgorithm = 'grid' | 'free';
/** Card rectangles (box + stubs + pills) by owner node id, for the given positions (used by flow for nudging). */
export function cardBoxes(graph: DiagramGraph, positions: PositionMap): Record<string, { x: number; y: number; width: number; height: number }>;
```

**Cards.** Every `objekat` / `slab` / `agregacija` with attributes is laid out as one block. Attributes in source
order, `#` attributes first; the first `ceil(a/2)` go to the left column, the rest to the right. Each pill's vertical
centre is at a row centre: rows evenly spaced with pitch `ATTR_ROW_PITCH = 32` and centred on the box. Left pills
are right-aligned at `box.left − ATTR_STUB (24)`, right pills left-aligned at `box.right + 24`. Staggered (`rows > 6`
for a side): even rows form the inner column (as above), odd rows the outer column, shifted out by the inner
column's max pill width + 24, vertical pitch 16 between consecutive rows (outer stubs pass through the 8 px gaps
between inner pills). Card = bounding box of box and pills.

**Grid algorithm.** ELK `layered`, `elk.direction = DOWN`, nodes = cards (attributes are not ELK nodes), spec blocks
as today. Edge orientation fed to ELK: veza → `participant₁ → veza → participant₂` (both the same object →
object → veza twice); slab: owner → slab; agregacija: component → agregacija; spec: supertype → S → junction →
podtip. Options: `elk.spacing.nodeNode = 40`, `elk.layered.spacing.nodeNodeBetweenLayers = 60`,
`elk.layered.considerModelOrder.strategy = NODES_AND_EDGES`, `elk.aspectRatio = 1.6`,
`elk.layered.wrapping.strategy = MULTI_EDGE`. Final positions rounded to `GRID = 10`. `layoutDiagramSync` with
`grid`: a deterministic rank layout with the same orientation (longest path ranks, model order within a rank,
cards centred per rank, same spacing). Guarantees: no two cards overlap, every veza is ranked between its two
participants (different objects), spec rows as today; the C06 "2D shape" aspect check applies to `free` only, and
to `grid` with bounds 1:3 – 3:1.

**Saved positions.** A saved owner without saved attributes gets its pills at the card offsets; saved attributes
keep their saved position. `free` keeps the Wave 12 behaviour exactly.

### Geometry (T47)

- **Attribute stubs:** an edge `owner → atribut` where the pill's centre y lies within the owner box's y-range and
  the pill is fully left or right of the box is drawn as one horizontal segment at the pill's centre y, from the box
  side to the pill outline (90°). Otherwise as before. These edges are not part of the port distribution.
- **Relationship ports on cards:** on a rectangle node that has attribute stubs on its left/right side, relationship
  (non-attribute `straight`) edges use only the top and bottom sides (by the sign of dy), unless |dy| < box height / 2;
  such an edge keeps its left/right side and its endpoint is moved to the nearest free gap between stub rows.
- Ports, labels and the other routes as in §Additions for busy nodes.
