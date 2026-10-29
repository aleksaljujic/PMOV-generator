# C05 — Renderer-neutral diagram graph

Owner: **T04** (`src/render/graph/`). Consumers: T11 (layout), T12 (geometry), T05 (React Flow), T06 (SVG export), T09 (wiring).

The IR is turned into a `DiagramGraph`: a flat list of nodes and edges with **sizes but no positions**.
Both renderers (React Flow and standalone SVG) draw *only* from this graph + a `PositionMap` + the geometry
functions of C06, so the two outputs are guaranteed to look the same.

## Contract code

```ts
// FILE: src/render/graph/types.ts
// CONTRACT C05 — frozen. Change only via spec/contracts/CHANGELOG.md.

export type DiagramNodeType = 'objekat' | 'slab' | 'veza' | 'agregacija' | 'atribut' | 'spec' | 'junction';

/** How the outline is drawn and how edges intersect it (C06). */
export type NodeShape = 'rect' | 'doubleRect' | 'diamond' | 'rectDiamond' | 'pill' | 'circle';

export const NODE_SHAPE: Record<DiagramNodeType, NodeShape> = {
  objekat: 'rect',
  slab: 'doubleRect',
  veza: 'diamond',
  agregacija: 'rectDiamond', // edges attach to the outer rectangle
  atribut: 'pill',
  spec: 'diamond',
  junction: 'circle',
};

export interface Point { x: number; y: number }

/** node id → TOP-LEFT corner (same convention as React Flow `position`). */
export type PositionMap = Record<string, Point>;

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  /** Text drawn inside the shape. '' for junction and unnamed veza, 'S' for spec, 'Mlb#' for identifier attributes. */
  label: string;
  /** IR element this node belongs to — for selection sync and error outlines. Attribute → its owner's element id. */
  elementId: string;
  width: number;
  height: number;
  /** atribut only. */
  isIdentifier?: boolean;
  /** 'core' nodes go through ELK; 'attribute' nodes are placed around their owner (C06). */
  layoutRole: 'core' | 'attribute';
  /** atribut only: node id of the owner node. */
  ownerNodeId?: string;
}

/**
 * straight   – floating straight line between outlines
 * loopTop    – recursive veza, first line: source top-center → up → across → target top vertex
 * loopBottom – recursive veza, second line: bottom → down → across → bottom vertex
 * busDown    – spec junction → podtip: down, horizontal bus, down into podtip top-center
 */
export type EdgeRoute = 'straight' | 'loopTop' | 'loopBottom' | 'busDown';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  /** Always drawn near the SOURCE end (C06 label placement). */
  label: string | null;
  /** Filled arrowhead at the TARGET end. */
  arrow: boolean;
  route: EdgeRoute;
  /** IR element the edge belongs to. */
  elementId: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
```

```ts
// FILE: src/render/style.ts
// CONTRACT C05 — shared visual constants. FON notation: black on white, color only for errors/selection.
export const STROKE = '#000000';
export const FILL = '#ffffff';
export const STROKE_WIDTH = 1.5;
export const ERROR_STROKE = '#d32f2f';
export const ERROR_STROKE_WIDTH = 3;
export const SELECTED_STROKE = '#1565c0';
export const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
export const FONT_SIZE = 13;          // node labels
export const EDGE_FONT_SIZE = 12;     // edge labels
export const ATTR_FONT_SIZE = 12;
export const SLAB_INSET = 4;          // inner rectangle of slab
export const ARROW_LENGTH = 10;
export const ARROW_WIDTH = 7;
```

## Functions

```ts
// src/render/graph/index.ts (barrel)
export function buildDiagramGraph(ir: PmovIR): DiagramGraph;
/** Deterministic text width estimate (no DOM) — used for node sizing AND by both renderers for label boxes. */
export function estimateTextWidth(text: string, fontSize: number): number;
export function attributeNodeId(ownerId: string, attrName: string, occurrence?: number): string;
```

## Mapping rules

### Node ids

| Thing | Node id | type | label | elementId |
|---|---|---|---|---|
| objekat / slab / agregacija / veza | element id (C03) | kind | name (`''` for unnamed veza) | element id |
| specijalizacija | `spec:<specId>` | `spec` | `S` | specId |
| its junction circle | `junction:<specId>` | `junction` | `''` | specId |
| attribute | `attr:<ownerId>:<name>` (2nd duplicate: `attr:<ownerId>:<name>~2`, …) | `atribut` | name + `#` if id | ownerId |

Attributes exist for objekat, slab and agregacija. Node order: IR element order, each element node
immediately followed by its attribute nodes; spec contributes `spec:` then `junction:`.

### Edges

All `straight` with `arrow: false` and no label unless stated.

| From IR | Edge id | source → target | label | arrow | route |
|---|---|---|---|---|---|
| veza participant *i* | `e:<vezaId>:<i>` | participant ref → veza | `(DG,GG)` or `(DG,GG) Mapping` | no | `straight`; if both participants have the same ref: i=0 `loopTop`, i=1 `loopBottom` |
| slab owner | `e:<slabId>:owner` | owner ref → slab | `(DG,GG)` | **yes** | straight |
| agregacija component *i* | `e:<aggId>:<i>` | component ref → agregacija | `(DG,GG)` [+ ` Mapping`] | **yes** | straight |
| spec supertype | `e:<specId>:super` | supertype ref → `spec:<specId>` | `<SpecName> (DG,GG)` | no | straight |
| spec link | `e:<specId>:link` | `spec:<specId>` → `junction:<specId>` | – | no | straight |
| spec subtype *i* | `e:<specId>:sub:<i>` | `junction:<specId>` → subtype ref | – | **yes** | `busDown` |
| attribute | `e:<attrNodeId>` | owner node → attribute node | – | no | straight |

Cardinality text: `(${min},${max})`, max always `1` or `M`. `elementId` of an edge = the veza / slab / agregacija /
spec / attribute owner it was generated from.

### Sizes

Set by `buildDiagramGraph`; renderers must use `node.width/height` and never re-measure.
`w(t, fs) = estimateTextWidth(t, fs)`.

| type | width | height |
|---|---|---|
| objekat, slab | `max(100, w(label,13) + 32)` | 44 |
| veza | `max(100, w(label,13)·1.6 + 30)` (`''` → 70) | `max(56, width·0.5)` |
| agregacija | `max(140, w(label,13)·1.6 + 40)` | `max(72, width·0.5)` |
| atribut | `w(label,12) + 24` | 24 |
| spec | 34 | 34 |
| junction | 12 | 12 |

## Golden counts (T04, T05 and T06 tests)

| Fixture | nodes (by type) | edges |
|---|---|---|
| `MAIN_EXAMPLE_IR` | 28 = objekat 5, veza 3, slab 1, agregacija 1, atribut 18 | 27 = veza 6, slab 1, agregacija 2, atribut 18 (arrows: 3) |
| `SPEC_EXAMPLE_IR` | 19 = objekat 6, spec 1, junction 1, veza 1, atribut 10 | 18 = super 1, link 1, sub 4, veza 2 (`loopTop`+`loopBottom`), atribut 10 (arrows: 4) |
