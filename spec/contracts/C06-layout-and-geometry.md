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

/** ELK (layered, direction DOWN, orthogonal routing) on layoutRole==='core' nodes, then attribute placement. */
export function layoutDiagram(graph: DiagramGraph, options?: LayoutOptions): Promise<PositionMap>;

/** Same contract, no ELK: deterministic layered fallback (longest-path ranks, barycenter ordering). Synchronous —
 *  needed by renderSvg(source): string (C07). */
export function layoutDiagramSync(graph: DiagramGraph, options?: LayoutOptions): PositionMap;

/** Places every attribute node around its owner; used by both functions above. Attributes with a saved
 *  position keep it. Returns positions for attribute nodes only. */
export function placeAttributes(graph: DiagramGraph, core: PositionMap, saved?: PositionMap): PositionMap;
```

Guarantees:

- Result contains a position for **every** node in the graph (top-left corner), finite numbers, no NaN.
- Saved position for node id N ⇒ result[N] equals it exactly.
- Same input ⇒ same output (deterministic).
- Specialization: podtip nodes end up in one row **below** the junction, the junction below the S diamond,
  the S diamond below the supertype (use ELK layer constraints / ordering as needed).
- Attributes are not fed to ELK. ELK spacing must leave room for them (e.g. inflate each core node's box by the
  space its attribute fan needs).
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
| `busDown` | source bottom-center → down to `midY = (source.bottom + target.top) / 2` → horizontal to target center x → down to target top-center (arrow tip) |

### Label rule (the important FON detail)

The label sits **near the source end** (the participant object), not mid-line:
anchor point at ~18% of the polyline length measured from the source end, but at least
`estimateTextWidth(label)/2 + 10` px from the source outline, then offset ~10px perpendicular to the segment so the
text does not overlap the line. Pick the perpendicular side deterministically (e.g. left of the direction of travel,
flipped if that side points into the source node). `anchor` tells renderers how to align the text.

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
