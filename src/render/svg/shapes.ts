// Per-node-type shape drawing (T06). Pure: depends only on the node and its top-left position.
import type { DiagramNode, Point } from '../graph/types';
import {
  ATTR_FONT_SIZE,
  ERROR_STROKE,
  ERROR_STROKE_WIDTH,
  FILL,
  FONT_FAMILY,
  FONT_SIZE,
  SLAB_INSET,
  STROKE,
  STROKE_WIDTH,
} from '../style';
import { el, escapeXml, num } from './xml';

export interface Paint {
  stroke: string;
  strokeWidth: number;
}

export function paintFor(isError: boolean): Paint {
  return isError ? { stroke: ERROR_STROKE, strokeWidth: ERROR_STROKE_WIDTH } : { stroke: STROKE, strokeWidth: STROKE_WIDTH };
}

function textEl(cx: number, cy: number, content: string, fontSize: number, bold = false): string {
  if (content === '') return '';
  return el(
    'text',
    {
      x: cx,
      y: cy,
      dy: '0.35em',
      'text-anchor': 'middle',
      'font-family': FONT_FAMILY,
      'font-size': fontSize,
      'font-weight': bold ? 'bold' : undefined,
      fill: STROKE,
    },
    escapeXml(content),
  );
}

function pts(points: Point[]): string {
  return points.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');
}

export function drawNode(node: DiagramNode, pos: Point, isError: boolean): string {
  const { stroke, strokeWidth } = paintFor(isError);
  const base = { fill: FILL, stroke, 'stroke-width': strokeWidth };
  const { x, y } = pos;
  const w = node.width;
  const h = node.height;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const diamond = (): Point[] => [
    { x: cx, y },
    { x: x + w, y: cy },
    { x: cx, y: y + h },
    { x, y: cy },
  ];
  let shapes: string[];
  let text = '';
  switch (node.type) {
    case 'objekat':
      shapes = [el('rect', { x, y, width: w, height: h, ...base })];
      text = textEl(cx, cy, node.label, FONT_SIZE);
      break;
    case 'slab':
      shapes = [
        el('rect', { x, y, width: w, height: h, ...base }),
        el('rect', {
          x: x + SLAB_INSET,
          y: y + SLAB_INSET,
          width: w - 2 * SLAB_INSET,
          height: h - 2 * SLAB_INSET,
          ...base,
        }),
      ];
      text = textEl(cx, cy, node.label, FONT_SIZE);
      break;
    case 'veza':
      shapes = [el('polygon', { points: pts(diamond()), ...base })];
      text = textEl(cx, cy, node.label, FONT_SIZE);
      break;
    case 'agregacija':
      shapes = [
        el('rect', { x, y, width: w, height: h, ...base }),
        el('polygon', { points: pts(diamond()), ...base }),
      ];
      text = textEl(cx, cy, node.label, FONT_SIZE);
      break;
    case 'atribut':
      shapes = [el('rect', { x, y, width: w, height: h, rx: h / 2, ry: h / 2, ...base })];
      text = textEl(cx, cy, node.label, ATTR_FONT_SIZE);
      break;
    case 'spec':
      shapes = [el('polygon', { points: pts(diamond()), ...base })];
      text = textEl(cx, cy, 'S', FONT_SIZE - 1, true);
      break;
    case 'junction':
      shapes = [el('circle', { cx, cy, r: Math.min(w, h) / 2, ...base })];
      break;
  }
  return el('g', { 'data-node-id': node.id }, [...shapes, text]);
}
