import { describe, expect, it } from 'vitest';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import { toReactFlow } from './toReactFlow';

const count = (xs: { type?: string }[]) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[x.type ?? '?'] = (m[x.type ?? '?'] ?? 0) + 1;
  return m;
};

describe('toReactFlow (real graph)', () => {
  it('MAIN_EXAMPLE_IR: 28 nodes / 27 edges, all pmov', () => {
    const { nodes, edges } = toReactFlow(buildDiagramGraph(MAIN_EXAMPLE_IR), {}, new Set(), null);
    expect(nodes).toHaveLength(28);
    expect(edges).toHaveLength(27);
    expect(count(nodes)).toEqual({ objekat: 5, veza: 3, slab: 1, agregacija: 1, atribut: 18 });
    expect(edges.every((e) => e.type === 'pmov')).toBe(true);
  });
  it('SPEC_EXAMPLE_IR: 19 nodes / 18 edges', () => {
    const { nodes, edges } = toReactFlow(buildDiagramGraph(SPEC_EXAMPLE_IR), {}, new Set(), null);
    expect(nodes).toHaveLength(19);
    expect(edges).toHaveLength(18);
  });
});
