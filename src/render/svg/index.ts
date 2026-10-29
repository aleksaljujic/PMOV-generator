// Public entry of src/render/svg — owned by T06. Contract C07.
import { compile, formatDiagnostic } from '../../lang';
import { buildDiagramGraph, estimateTextWidth } from '../graph';
import type { DiagramGraph, PositionMap } from '../graph/types';
import { boxOf, computeEdgeGeometry, type Box } from '../geometry';
import { layoutDiagram, layoutDiagramSync } from '../layout';
import { EDGE_FONT_SIZE, ERROR_STROKE, ERROR_STROKE_WIDTH, FONT_FAMILY, STROKE, STROKE_WIDTH } from '../style';
import { drawNode, paintFor } from './shapes';
import { el, escapeXml, num } from './xml';

export interface SvgOptions {
  errorElementIds?: ReadonlySet<string>;
  padding?: number;
  background?: string | null;
}

const XMLNS = 'http://www.w3.org/2000/svg';

/** Edge/node labels: text y is the vertical center (dy="0.35em" + central baseline approximation). */
function svgDoc(width: number, height: number, vbX: number, vbY: number, body: string[]): string {
  return el(
    'svg',
    {
      xmlns: XMLNS,
      width,
      height,
      viewBox: `${num(vbX)} ${num(vbY)} ${num(width)} ${num(height)}`,
    },
    body,
  );
}

export function graphToSvg(graph: DiagramGraph, positions: PositionMap, options: SvgOptions = {}): string {
  const padding = options.padding ?? 20;
  const background = options.background === undefined ? '#ffffff' : options.background;
  const errors = options.errorElementIds ?? new Set<string>();

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const boxes = new Map<string, Box>();
  for (const n of graph.nodes) {
    const p = positions[n.id] ?? { x: 0, y: 0 };
    boxes.set(n.id, boxOf(n, p));
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number): void => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  for (const b of boxes.values()) grow(b.x, b.y, b.x + b.width, b.y + b.height);

  const edgeParts: string[] = [];
  const labelParts: string[] = [];
  for (const e of graph.edges) {
    const sn = nodeById.get(e.source);
    const tn = nodeById.get(e.target);
    const sb = boxes.get(e.source);
    const tb = boxes.get(e.target);
    if (!sn || !tn || !sb || !tb) continue;
    const g = computeEdgeGeometry(e, { node: sn, box: sb }, { node: tn, box: tb });
    const { stroke, strokeWidth } = paintFor(errors.has(e.elementId));
    for (const p of g.points) grow(p.x, p.y, p.x, p.y);
    const parts = [
      el('path', { d: g.path, fill: 'none', stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' }),
    ];
    if (g.arrow) {
      parts.push(el('polygon', { points: g.arrow.polygon, fill: stroke, stroke, 'stroke-width': 1, 'stroke-linejoin': 'miter' }));
    }
    edgeParts.push(el('g', { 'data-edge-id': e.id }, parts));
    if (g.label && e.label) {
      const w = estimateTextWidth(e.label, EDGE_FONT_SIZE);
      const lx = g.label.anchor === 'start' ? g.label.x : g.label.anchor === 'end' ? g.label.x - w : g.label.x - w / 2;
      grow(lx, g.label.y - EDGE_FONT_SIZE / 2, lx + w, g.label.y + EDGE_FONT_SIZE / 2);
      labelParts.push(
        el(
          'text',
          {
            x: g.label.x,
            y: g.label.y,
            dy: '0.35em',
            'text-anchor': g.label.anchor,
            'font-family': FONT_FAMILY,
            'font-size': EDGE_FONT_SIZE,
            fill: STROKE,
            stroke: '#ffffff',
            'stroke-width': 3,
            'paint-order': 'stroke',
            'stroke-linejoin': 'round',
          },
          escapeXml(e.label),
        ),
      );
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const width = Math.ceil(maxX - minX + 2 * padding);
  const height = Math.ceil(maxY - minY + 2 * padding);
  const vbX = minX - padding;
  const vbY = minY - padding;

  const body: string[] = [];
  if (background !== null) body.push(el('rect', { 'data-layer': 'background', x: vbX, y: vbY, width, height, fill: background }));
  body.push(el('g', { 'data-layer': 'edges' }, edgeParts));
  body.push(
    el(
      'g',
      { 'data-layer': 'nodes' },
      graph.nodes.map((n) => drawNode(n, positions[n.id] ?? { x: 0, y: 0 }, errors.has(n.elementId))),
    ),
  );
  body.push(el('g', { 'data-layer': 'labels' }, labelParts));
  return svgDoc(width, height, vbX, vbY, body);
}

/** Small SVG showing an error message. */
function errorSvg(message: string): string {
  const fs = 13;
  const pad = 12;
  const width = Math.ceil(Math.max(160, estimateTextWidth(message, fs) + 2 * pad));
  const height = 2 * pad + fs + 6;
  return svgDoc(width, height, 0, 0, [
    el('rect', { x: 0, y: 0, width, height, fill: '#ffffff' }),
    el('rect', {
      x: 1,
      y: 1,
      width: width - 2,
      height: height - 2,
      fill: 'none',
      stroke: ERROR_STROKE,
      'stroke-width': Math.min(ERROR_STROKE_WIDTH, STROKE_WIDTH * 2),
    }),
    el(
      'text',
      { x: pad, y: height / 2, dy: '0.35em', 'font-family': FONT_FAMILY, 'font-size': fs, fill: ERROR_STROKE },
      escapeXml(message),
    ),
  ]);
}

function prepare(source: string): { graph: DiagramGraph } | { error: string } {
  const result = compile(source);
  if (result.ir === null) {
    const first = result.diagnostics.find((d) => d.severity === 'error') ?? result.diagnostics[0];
    return { error: first ? formatDiagnostic(first) : 'Greška: dijagram nije moguće prikazati' };
  }
  return { graph: buildDiagramGraph(result.ir) };
}

function messageOf(e: unknown): string {
  return `Greška pri crtanju: ${e instanceof Error ? e.message : String(e)}`;
}

export function renderSvg(source: string): string {
  try {
    const p = prepare(source);
    if ('error' in p) return errorSvg(p.error);
    return graphToSvg(p.graph, layoutDiagramSync(p.graph));
  } catch (e) {
    return errorSvg(messageOf(e));
  }
}

export async function renderSvgAsync(source: string): Promise<string> {
  try {
    const p = prepare(source);
    if ('error' in p) return errorSvg(p.error);
    return graphToSvg(p.graph, await layoutDiagram(p.graph));
  } catch (e) {
    return errorSvg(messageOf(e));
  }
}

function svgSize(svg: string): { w: number; h: number } {
  const w = /<svg[^>]*?\swidth="([\d.]+)"/.exec(svg);
  const h = /<svg[^>]*?\sheight="([\d.]+)"/.exec(svg);
  return { w: w?.[1] ? parseFloat(w[1]) : 300, h: h?.[1] ? parseFloat(h[1]) : 150 };
}

export function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const { w, h } = svgSize(svg);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          if (b) resolve(b);
          else reject(new Error('PNG encoding failed'));
        }, 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG could not be loaded as an image'));
    };
    img.src = url;
  });
}
