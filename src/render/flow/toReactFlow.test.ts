import { describe, expect, it } from 'vitest';
import { toReactFlow } from './toReactFlow';
import { FIXTURE_GRAPH, FIXTURE_POSITIONS } from './__fixtures__/graph';

describe('toReactFlow (fixture)', () => {
  const { nodes, edges } = toReactFlow(FIXTURE_GRAPH, FIXTURE_POSITIONS, new Set(), null);

  it('maps nodes and edges 1:1 with types', () => {
    expect(nodes).toHaveLength(FIXTURE_GRAPH.nodes.length);
    expect(edges).toHaveLength(FIXTURE_GRAPH.edges.length);
    nodes.forEach((n, i) => {
      const src = FIXTURE_GRAPH.nodes[i]!;
      expect(n.type).toBe(src.type);
      expect(n.width).toBe(src.width);
      expect(n.height).toBe(src.height);
      expect(n.position).toEqual(FIXTURE_POSITIONS[src.id]);
      expect(n.draggable).toBe(true);
      expect(n.connectable).toBe(false);
    });
    expect(edges.every((e) => e.type === 'pmov')).toBe(true);
  });

  it('sets error and selection flags on all nodes of the element', () => {
    const r = toReactFlow(FIXTURE_GRAPH, FIXTURE_POSITIONS, new Set(['Radnik']), 'S1');
    const flagged = (k: 'hasError' | 'selected') => r.nodes.filter((n) => n.data[k]).map((n) => n.id);
    expect(flagged('hasError')).toEqual(['Radnik', 'attr:Radnik:Mlb']);
    expect(flagged('selected')).toEqual(['spec:S1', 'junction:S1']);
  });

  it('falls back to origin for missing positions', () => {
    const r = toReactFlow(FIXTURE_GRAPH, {}, new Set(), null);
    expect(r.nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });
});
