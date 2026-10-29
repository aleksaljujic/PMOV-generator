// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import { DiagramView } from './DiagramView';

const graph = buildDiagramGraph(MAIN_EXAMPLE_IR);
const positions = Object.fromEntries(graph.nodes.map((n, i) => [n.id, { x: (i % 7) * 160, y: Math.floor(i / 7) * 100 }]));

vi.mock('../layout', () => ({ layoutDiagram: vi.fn(async () => positions) }));

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

describe('DiagramView edges survive prop changes', () => {
  it('keeps all 27 edges across selection and error changes', async () => {
    const el = (sel: string | null, err: Set<string>) => (
      <div style={{ width: 800, height: 600 }}>
        <DiagramView
          graph={graph}
          savedPositions={{}}
          layoutNonce={0}
          errorElementIds={err}
          selectedElementId={sel}
          onElementClick={vi.fn()}
          onNodeMoved={vi.fn()}
        />
      </div>
    );
    const { container, rerender } = render(el(null, new Set()));
    const count = () => container.querySelectorAll('.react-flow__edge').length;
    await waitFor(() => expect(count()).toBe(27));
    const first = graph.nodes[0]!.elementId;
    rerender(el(first, new Set()));
    expect(count()).toBe(27);
    rerender(el(first, new Set([first])));
    expect(count()).toBe(27);
    await new Promise((r) => setTimeout(r, 50));
    expect(count()).toBe(27);
  });
});
