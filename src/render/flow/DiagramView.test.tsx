// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramView, structureSignature } from './DiagramView';
import { FIXTURE_GRAPH } from './__fixtures__/graph';

describe('DiagramView', () => {
  it('shows empty state when graph is null', () => {
    render(
      <DiagramView
        graph={null}
        savedPositions={{}}
        layoutNonce={0}
        errorElementIds={new Set()}
        selectedElementId={null}
        onElementClick={vi.fn()}
        onNodeMoved={vi.fn()}
      />,
    );
    expect(screen.getByText('Nema dijagrama')).toBeTruthy();
  });

  it('structure signature ignores labels but not sizes', () => {
    const relabeled = {
      ...FIXTURE_GRAPH,
      nodes: FIXTURE_GRAPH.nodes.map((n) => ({ ...n, label: n.label + 'x' })),
      edges: FIXTURE_GRAPH.edges.map((e) => (e.label ? { ...e, label: '(9,9)' } : e)),
    };
    expect(structureSignature(relabeled)).toBe(structureSignature(FIXTURE_GRAPH));
    const resized = { ...FIXTURE_GRAPH, nodes: FIXTURE_GRAPH.nodes.map((n, i) => (i ? n : { ...n, width: 999 })) };
    expect(structureSignature(resized)).not.toBe(structureSignature(FIXTURE_GRAPH));
  });
});
