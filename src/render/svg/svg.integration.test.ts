// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import { layoutDiagramSync } from '../layout';
import { graphToSvg, renderSvg, renderSvgAsync } from './index';

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const parses = (svg: string) => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  return doc;
};

describe('renderSvg (main example)', () => {
  let svg = "";
  beforeAll(() => { svg = renderSvg(EXAMPLES[0]!.source); });
  const graph = buildDiagramGraph(MAIN_EXAMPLE_IR);

  it('is a synchronous string document that parses', () => {
    expect(typeof svg).toBe('string');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    parses(svg);
  });
  it('has one text per labelled node and edge label, three arrows and a slab double rect', () => {
    const doc = parses(svg);
    const labelled = graph.nodes.filter((n) => n.label !== '').length;
    const edgeLabels = graph.edges.filter((e) => e.label).length;
    expect(doc.getElementsByTagName('text').length).toBe(labelled + edgeLabels);
    expect(doc.querySelectorAll('[data-edge-id] polygon').length).toBe(3);
    expect(doc.querySelectorAll('[data-node-id] > rect').length).toBeGreaterThan(5);
    const slab = graph.nodes.find((n) => n.type === 'slab')!;
    expect(doc.querySelectorAll(`[data-node-id="${slab.id}"] > rect`).length).toBe(2);
  });
  it('draws edges before nodes before labels', () => {
    expect(svg.indexOf('data-layer="edges"')).toBeLessThan(svg.indexOf('data-layer="nodes"'));
    expect(svg.indexOf('data-layer="nodes"')).toBeLessThan(svg.indexOf('data-layer="labels"'));
  });
  it('never throws and reports syntax errors as text', () => {
    const bad = renderSvg('objekat {');
    expect(bad.startsWith('<svg')).toBe(true);
    expect(bad).toContain('<text');
    parses(bad);
  });
  it('preserves special characters and č', () => {
    const out = renderSvg('objekat "Čaša & <Co>" { Id# }');
    parses(out);
    expect(out).toContain('Čaša &amp; &lt;Co&gt;');
  });
  it('async variant returns a document too', async () => {
    const out = await renderSvgAsync(EXAMPLES[0]!.source);
    parses(out);
  });
});

describe('graphToSvg', () => {
  const graph = buildDiagramGraph(MAIN_EXAMPLE_IR);
  it('honours errorElementIds and background/padding', () => {
    const pos = layoutDiagramSync(graph);
    expect(count(graphToSvg(graph, pos), /#d32f2f/g)).toBe(0);
    const id = graph.nodes[0]!.elementId;
    expect(count(graphToSvg(graph, pos, { errorElementIds: new Set([id]) }), /#d32f2f/g)).toBeGreaterThan(0);
    const bare = graphToSvg(graph, pos, { background: null, padding: 0 });
    expect(bare).not.toContain('data-layer="background"');
    expect(graphToSvg(graph, pos)).toContain('data-layer="background"');
  });
});
