import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../../examples';
import { compile } from '../../lang';
import { buildDiagramGraph } from '../graph';
import type { PositionMap } from '../graph/types';
import { checkLayout, checkShape, checkSpec } from './__fixtures__/checks';
import { layoutDiagram, layoutDiagramSync } from './index';

const FREE = { algorithm: 'free' as const };

describe.each(EXAMPLES)('layout integration: $id', (ex) => {
  const ir = compile(ex.source).ir!;
  const g = buildDiagramGraph(ir);
  const hasSpec = g.nodes.some((n) => n.type === 'spec');

  it('sync: positions, no overlaps, spec rows, 2D shape', () => {
    const r = layoutDiagramSync(g, FREE);
    checkLayout(g, r);
    if (hasSpec) checkSpec(g, r);
    checkShape(g, r);
  });

  it('ELK: positions, no overlaps, spec rows, 2D shape', async () => {
    const r = await layoutDiagram(g, FREE);
    checkLayout(g, r);
    if (hasSpec) checkSpec(g, r);
    checkShape(g, r);
  });

  it('saved positions honoured and output deterministic', async () => {
    const first = g.nodes[0]!.id;
    const attr = g.nodes.find((n) => n.layoutRole === 'attribute')?.id;
    const saved: PositionMap = { [first]: { x: 777, y: 888 } };
    if (attr) saved[attr] = { x: -5, y: 5 };
    for (const r of [layoutDiagramSync(g, { saved, algorithm: 'free' }), await layoutDiagram(g, { saved, algorithm: 'free' })]) {
      for (const [id, p] of Object.entries(saved)) expect(r[id]).toEqual(p);
    }
    expect(layoutDiagramSync(g, FREE)).toEqual(layoutDiagramSync(g, FREE));
    expect(await layoutDiagram(g, FREE)).toEqual(await layoutDiagram(g, FREE));
  });
});

it('sync layout of a 60-node core graph is fast', () => {
  const g = buildDiagramGraph(compile(EXAMPLES[3]!.source).ir!);
  const t = performance.now();
  layoutDiagramSync(g, FREE);
  expect(performance.now() - t).toBeLessThan(200);
});
