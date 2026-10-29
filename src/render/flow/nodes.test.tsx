// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ERROR_STROKE, SELECTED_STROKE } from '../style';
import {
  AgregacijaNode,
  AtributNode,
  JunctionNode,
  ObjekatNode,
  SlabNode,
  SpecNode,
  VezaNode,
} from './nodes';
import type { PmovNodeData } from './toReactFlow';
import { FIXTURE_GRAPH } from './__fixtures__/graph';

function draw(Comp: (p: never) => ReactElement | null, nodeId: string, flags: Partial<PmovNodeData> = {}) {
  const node = FIXTURE_GRAPH.nodes.find((n) => n.id === nodeId)!;
  const data: PmovNodeData = { node, hasError: false, selected: false, ...flags };
  const C = Comp as unknown as (p: { data: PmovNodeData }) => ReactElement;
  const { container } = render(
    <ReactFlowProvider>
      <C data={data} />
    </ReactFlowProvider>,
  );
  return container.querySelector('svg')!;
}

describe('node components', () => {
  it('objekat: one rect, svg sized to node', () => {
    const svg = draw(ObjekatNode, 'Radnik');
    expect(svg.getAttribute('width')).toBe('100');
    expect(svg.getAttribute('height')).toBe('44');
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    expect(svg.textContent).toBe('Radnik');
  });
  it('slab: two rects', () => {
    expect(draw(SlabNode, 'Dete').querySelectorAll('rect')).toHaveLength(2);
  });
  it('veza: diamond polygon', () => {
    const svg = draw(VezaNode, 'Radi');
    expect(svg.querySelectorAll('polygon')).toHaveLength(1);
    expect(svg.querySelectorAll('rect')).toHaveLength(0);
  });
  it('agregacija: rect + polygon', () => {
    const svg = draw(AgregacijaNode, 'Tim');
    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    expect(svg.querySelectorAll('polygon')).toHaveLength(1);
  });
  it('atribut: rounded rect', () => {
    const rect = draw(AtributNode, 'attr:Radnik:Mlb').querySelector('rect')!;
    expect(rect.getAttribute('rx')).toBe('12');
  });
  it('spec: contains S', () => {
    expect(draw(SpecNode, 'spec:S1').textContent).toBe('S');
  });
  it('junction: circle, no text', () => {
    const svg = draw(JunctionNode, 'junction:S1');
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelectorAll('text')).toHaveLength(0);
  });
  it('error and selected outlines', () => {
    expect(draw(ObjekatNode, 'Radnik', { hasError: true }).querySelector('rect')!.getAttribute('stroke')).toBe(
      ERROR_STROKE,
    );
    expect(draw(ObjekatNode, 'Radnik', { selected: true }).querySelector('rect')!.getAttribute('stroke')).toBe(
      SELECTED_STROKE,
    );
  });
});
