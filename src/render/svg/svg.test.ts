import { describe, expect, it } from 'vitest';
import type { DiagramNode, DiagramNodeType } from '../graph/types';
import { drawNode } from './shapes';
import { el, escapeXml } from './xml';

function node(type: DiagramNodeType, label = 'Ab'): DiagramNode {
  return { id: 'n', type, label, elementId: 'n', width: 100, height: 44, layoutRole: 'core' };
}
const count = (s: string, tag: string) => (s.match(new RegExp(`<${tag}[ />]`, 'g')) ?? []).length;

describe('xml helpers', () => {
  it('escapes the five XML characters and keeps unicode', () => {
    expect(escapeXml(`a&b<c>"d"'e'č`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;č');
  });
  it('builds elements with escaped attributes', () => {
    expect(el('a', { x: 1.234, t: '"' }, 'hi')).toBe('<a x="1.23" t="&quot;">hi</a>');
    expect(el('a')).toBe('<a/>');
  });
});

describe('drawNode', () => {
  it('objekat: one rect + text', () => {
    const s = drawNode(node('objekat'), { x: 0, y: 0 }, false);
    expect(count(s, 'rect')).toBe(1);
    expect(count(s, 'text')).toBe(1);
  });
  it('slab: two rects, inner inset', () => {
    const s = drawNode(node('slab'), { x: 10, y: 10 }, false);
    expect(count(s, 'rect')).toBe(2);
    expect(s).toContain('x="14"');
  });
  it('veza: diamond polygon, no text when label empty', () => {
    const s = drawNode(node('veza', ''), { x: 0, y: 0 }, false);
    expect(count(s, 'polygon')).toBe(1);
    expect(count(s, 'text')).toBe(0);
    expect(s).toContain('points="50,0 100,22 50,44 0,22"');
  });
  it('agregacija: rect + polygon', () => {
    const s = drawNode(node('agregacija'), { x: 0, y: 0 }, false);
    expect(count(s, 'rect')).toBe(1);
    expect(count(s, 'polygon')).toBe(1);
  });
  it('atribut: rect with rx = height/2', () => {
    const s = drawNode({ ...node('atribut', 'Mlb#'), height: 24 }, { x: 0, y: 0 }, false);
    expect(s).toContain('rx="12"');
    expect(s).toContain('Mlb#');
  });
  it('spec: polygon + bold S', () => {
    const s = drawNode(node('spec', 'S'), { x: 0, y: 0 }, false);
    expect(count(s, 'polygon')).toBe(1);
    expect(s).toContain('font-weight="bold"');
    expect(s).toContain('>S</text>');
  });
  it('junction: circle, no text', () => {
    const s = drawNode({ ...node('junction', ''), width: 12, height: 12 }, { x: 0, y: 0 }, false);
    expect(count(s, 'circle')).toBe(1);
    expect(count(s, 'text')).toBe(0);
  });
  it('error nodes use the error stroke; labels are escaped', () => {
    const s = drawNode(node('objekat', 'A&B <x>'), { x: 0, y: 0 }, true);
    expect(s).toContain('#d32f2f');
    expect(s).toContain('A&amp;B &lt;x&gt;');
  });
});
