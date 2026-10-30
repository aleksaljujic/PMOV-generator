// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { buildDiagramGraph } from '../graph';
import { DiagramView } from './DiagramView';
import type { DiagramViewProps } from './DiagramView';

const graph = buildDiagramGraph(MAIN_EXAMPLE_IR);
const positions = Object.fromEntries(graph.nodes.map((n, i) => [n.id, { x: (i % 7) * 160, y: Math.floor(i / 7) * 100 }]));
vi.mock('../layout', () => ({ layoutDiagram: vi.fn(async () => positions) }));

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

afterEach(cleanup);

function view(extra: Partial<DiagramViewProps> = {}) {
  return render(
    <div style={{ width: 800, height: 600 }}>
      <DiagramView
        graph={graph}
        savedPositions={{}}
        layoutNonce={0}
        errorElementIds={new Set()}
        selectedElementId={null}
        onElementClick={vi.fn()}
        onNodeMoved={vi.fn()}
        {...extra}
      />
    </div>,
  );
}

describe('DiagramView interaction props (C09)', () => {
  it('without the new props: no overlays, no clickable labels, no pick markers', async () => {
    const { container } = view();
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(graph.nodes.length));
    expect(container.querySelector('[data-testid^="overlay-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="pick-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="edge-label-btn-"]')).toBeNull();
    expect(container.querySelector('text[font-style="italic"]')).toBeNull();
  });

  it('renderNodeOverlay is called for every node and rendered inside it', async () => {
    const renderNodeOverlay = vi.fn((n: { id: string }, _state: { selected: boolean; hasError: boolean }) => <button data-testid={`plus-${n.id}`}>+</button>);
    const { container, getByTestId } = view({ renderNodeOverlay });
    await waitFor(() => expect(container.querySelectorAll('[data-testid^="overlay-"]').length).toBe(graph.nodes.length));
    expect(getByTestId('plus-Radnik')).toBeTruthy();
    expect(renderNodeOverlay.mock.calls.some(([n, st]) => n.id === 'Radnik' && st.selected === false)).toBe(true);
  });

  it('edge labels become clickable and render an edge overlay', async () => {
    const onEdgeLabelClick = vi.fn();
    const { container, getByTestId } = view({
      onEdgeLabelClick,
      renderEdgeOverlay: (e) => <i data-testid={`eo-${e.id}`} />,
    });
    await waitFor(() => expect(container.querySelectorAll('[data-testid^="edge-label-btn-"]').length).toBeGreaterThan(0));
    fireEvent.click(getByTestId('edge-label-btn-e:Zapošljavanje:0'));
    expect(onEdgeLabelClick).toHaveBeenCalledWith('e:Zapošljavanje:0');
    expect(getByTestId('eo-e:Zapošljavanje:0')).toBeTruthy();
  });

  it('pick mode highlights valid elements and dims the rest', async () => {
    const { container, getByTestId } = view({ pickMode: { validIds: new Set(['Radnik']) } });
    await waitFor(() => expect(container.querySelector('[data-testid="pick-Radnik"]')).toBeTruthy());
    expect(container.querySelectorAll('[data-testid^="pick-"]')).toHaveLength(1);
    expect(getByTestId('node-Odeljenje').style.opacity).toBe('0.3');
    expect(getByTestId('node-Radnik').style.opacity).toBe('1');
  });

  it('placeholder names are grey italic (objekat/slab/agregacija only)', async () => {
    const { container } = view({ placeholderIds: new Set(['Radnik']) });
    await waitFor(() => expect(container.querySelector('text[font-style="italic"]')).toBeTruthy());
    expect(container.querySelectorAll('text[font-style="italic"]')).toHaveLength(1);
  });

  it('canvas click and node double-click callbacks fire', async () => {
    const onCanvasClick = vi.fn();
    const onNodeDoubleClick = vi.fn();
    const { container } = view({ onCanvasClick, onNodeDoubleClick });
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(graph.nodes.length));
    fireEvent.click(container.querySelector('.react-flow__pane') as Element);
    expect(onCanvasClick).toHaveBeenCalled();
    fireEvent.doubleClick(container.querySelector('.react-flow__node[data-id="Radnik"]') as Element);
    expect(onNodeDoubleClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'Radnik' }));
  });
});
