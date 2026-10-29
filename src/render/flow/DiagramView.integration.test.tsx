// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import { DiagramView } from './DiagramView';

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

describe('DiagramView with real layout', () => {
  it('renders all nodes after async layout', async () => {
    const graph = buildDiagramGraph(MAIN_EXAMPLE_IR);
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <DiagramView
          graph={graph}
          savedPositions={{}}
          layoutNonce={0}
          errorElementIds={new Set()}
          selectedElementId={null}
          onElementClick={vi.fn()}
          onNodeMoved={vi.fn()}
        />
      </div>,
    );
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(28), { timeout: 5000 });
  });
});
