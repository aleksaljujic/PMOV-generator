// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramView } from './DiagramView';
import { FIXTURE_GRAPH, FIXTURE_POSITIONS } from './__fixtures__/graph';

vi.mock('../layout', () => ({
  layoutDiagram: vi.fn(async () => FIXTURE_POSITIONS),
}));

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

describe('DiagramView with mocked layout', () => {
  it('renders every node after async layout', async () => {
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <DiagramView
          graph={FIXTURE_GRAPH}
          savedPositions={{}}
          layoutNonce={0}
          errorElementIds={new Set()}
          selectedElementId={null}
          onElementClick={vi.fn()}
          onNodeMoved={vi.fn()}
        />
      </div>,
    );
    await waitFor(() =>
      expect(container.querySelectorAll('.react-flow__node').length).toBe(FIXTURE_GRAPH.nodes.length),
    );
  });
});
