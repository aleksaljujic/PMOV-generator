// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramView } from './DiagramView';
import { FIXTURE_GRAPH, FIXTURE_POSITIONS } from './__fixtures__/graph';
import { layoutDiagram } from '../layout';

vi.mock('../layout', () => ({
  layoutDiagram: vi.fn(async () => FIXTURE_POSITIONS),
  cardBoxes: vi.fn(() => ({})),
}));

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const view = (extra: Record<string, unknown> = {}) => (
  <div style={{ width: 800, height: 600 }}>
    <DiagramView
      graph={FIXTURE_GRAPH}
      savedPositions={{}}
      layoutNonce={0}
      errorElementIds={new Set()}
      selectedElementId={null}
      onElementClick={vi.fn()}
      onNodeMoved={vi.fn()}
      {...extra}
    />
  </div>
);

describe('DiagramView grid additions', () => {
  it('shows the dot background by default and hides it when snapToGrid is false', async () => {
    const a = render(view());
    await waitFor(() => expect(a.container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
    expect(a.container.querySelector('.react-flow__background')).not.toBeNull();
    a.unmount();
    const b = render(view({ snapToGrid: false }));
    await waitFor(() => expect(b.container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
    expect(b.container.querySelector('.react-flow__background')).toBeNull();
  });

  it('passes the algorithm to layoutDiagram (default grid) and re-lays out on change', async () => {
    const mock = vi.mocked(layoutDiagram);
    mock.mockClear();
    const { rerender } = render(view());
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(mock.mock.calls[0]?.[1]).toMatchObject({ algorithm: 'grid' });
    rerender(view({ layoutAlgorithm: 'free' }));
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
    expect(mock.mock.calls[1]?.[1]).toMatchObject({ algorithm: 'free' });
  });
});
