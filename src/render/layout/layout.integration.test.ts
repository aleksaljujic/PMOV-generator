import { describe, expect, it } from 'vitest';
import { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import type { PositionMap } from '../graph/types';
import { layoutDiagram, layoutDiagramSync } from './index';
import { checkLayout, checkSpec } from './layout.test';

describe.each([
  ['MAIN_EXAMPLE_IR', MAIN_EXAMPLE_IR, false],
  ['SPEC_EXAMPLE_IR', SPEC_EXAMPLE_IR, true],
] as const)('layout integration: %s', (_name, ir, hasSpec) => {
  const g = buildDiagramGraph(ir);

  it('positions all nodes without overlaps (sync and ELK)', async () => {
    checkLayout(g, layoutDiagramSync(g));
    checkLayout(g, await layoutDiagram(g));
  });

  it('specialization rows', async () => {
    if (!hasSpec) return;
    checkSpec(g, layoutDiagramSync(g));
    checkSpec(g, await layoutDiagram(g));
  });

  it('saved positions honoured and output deterministic', async () => {
    const first = g.nodes[0]!.id;
    const attr = g.nodes.find((n) => n.layoutRole === 'attribute')?.id;
    const saved: PositionMap = { [first]: { x: 777, y: 888 } };
    if (attr) saved[attr] = { x: -5, y: 5 };
    for (const r of [layoutDiagramSync(g, { saved }), await layoutDiagram(g, { saved })]) {
      for (const [id, p] of Object.entries(saved)) expect(r[id]).toEqual(p);
    }
    expect(layoutDiagramSync(g)).toEqual(layoutDiagramSync(g));
    expect(await layoutDiagram(g)).toEqual(await layoutDiagram(g));
  });
});
