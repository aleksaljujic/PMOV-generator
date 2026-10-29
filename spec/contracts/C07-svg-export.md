# C07 — Standalone SVG and PNG export

Owner: **T06**. Consumers: T09 (toolbar buttons "Izvezi SVG", "Izvezi PNG"), future Markdown integration.

The exporter draws from the graph + positions (C05/C06), **not** from the DOM.

```ts
// src/render/svg/index.ts
import type { DiagramGraph, PositionMap } from '../graph/types';

export interface SvgOptions {
  /** Element ids drawn with ERROR_STROKE (C05 style). Default: none (exports are clean). */
  errorElementIds?: ReadonlySet<string>;
  /** Margin around the bounding box. Default 20. */
  padding?: number;
  /** Background rect color; null = transparent. Default '#ffffff'. */
  background?: string | null;
}

/** Pure, synchronous, no DOM. Returns a complete document starting with `<svg xmlns="http://www.w3.org/2000/svg"`,
 *  with width/height/viewBox set to the content bounding box + padding. */
export function graphToSvg(graph: DiagramGraph, positions: PositionMap, options?: SvgOptions): string;

/** Mermaid-style one-shot: compile → buildDiagramGraph → layoutDiagramSync → graphToSvg.
 *  Never throws. On syntax errors returns a small SVG containing the formatted first diagnostic as text. */
export function renderSvg(source: string): string;

/** Same as renderSvg but with the ELK layout. */
export function renderSvgAsync(source: string): Promise<string>;

/** Browser only: rasterize an SVG string (via Image + canvas). scale default 2. */
export function svgToPngBlob(svg: string, scale?: number): Promise<Blob>;
```

## Drawing rules (must match T05's React Flow nodes)

| type | SVG |
|---|---|
| objekat | `<rect>` + centered `<text>` |
| slab | outer `<rect>` + inner `<rect>` inset `SLAB_INSET` + text |
| veza | `<polygon>` diamond touching the box midpoints + text (none if label `''`) |
| agregacija | `<rect>` + inscribed `<polygon>` diamond touching all 4 sides + text |
| atribut | `<rect rx=height/2>` + text (`Mlb#` for identifiers) |
| spec | small diamond polygon + bold `S` |
| junction | hollow `<circle>` |
| edge | `<path d=geometry.path fill="none">` + `<polygon>` arrow if any + `<text>` label at `geometry.label` |

All strokes `STROKE`, width `STROKE_WIDTH`, fill `FILL`, font `FONT_FAMILY`. Text must be XML-escaped (`& < > " '`).
Draw order: edges first, then nodes (nodes hide edge ends), then edge labels with a white halo
(`paint-order="stroke" stroke="#fff" stroke-width="3"`).

## Required tests (T06)

- `renderSvg(EXAMPLES[0].source)` contains one `<text>` per node label and per edge label, three arrow polygons,
  a slab double rectangle, and parses with `DOMParser` (`// @vitest-environment jsdom`) without `parsererror`.
- Special characters (`&`, `<`, quotes, č) are escaped / preserved.
- Syntax error input → SVG with the diagnostic text, no throw.
- `graphToSvg` honours `errorElementIds`.
