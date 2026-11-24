// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as geometry from '../geometry';
import type { EdgeGeometry } from '../geometry';
import { EdgeGeometryContext, EdgeGeometryProvider, useEdgeGeometry } from './edgeGeometry';
import { PmovEdge } from './PmovEdge';
import { FIXTURE_GRAPH } from './__fixtures__/graph';
import type { PmovNodeData } from './toReactFlow';

vi.mock('../geometry', async (orig) => {
  const actual = (await orig()) as typeof geometry;
  return {
    ...actual,
    computeDiagramGeometry: vi.fn(actual.computeDiagramGeometry),
    computeEdgeGeometry: vi.fn(actual.computeEdgeGeometry),
  };
});

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const graph = FIXTURE_GRAPH;
const edge = graph.edges[0]!; // Radnik -> Radi
const rfNodes: Node<PmovNodeData>[] = graph.nodes.map((node, i) => ({
  id: node.id,
  position: { x: i * 150, y: 0 },
  width: node.width,
  height: node.height,
  data: { node, hasError: false, selected: false },
}));

const KNOWN: EdgeGeometry = { points: [], path: 'M 1 2 L 3 4', label: null, arrow: null };

function edgeProps() {
  return { id: edge.id, source: edge.source, target: edge.target, data: { edge } } as unknown as ComponentProps<typeof PmovEdge>;
}

beforeEach(() => vi.clearAllMocks());

describe('PmovEdge geometry source', () => {
  it('draws the path from the shared geometry when a provider supplies it', () => {
    const { container } = render(
      <ReactFlowProvider initialNodes={rfNodes}>
        <EdgeGeometryContext.Provider value={{ [edge.id]: KNOWN }}>
          <svg>
            <PmovEdge {...edgeProps()} />
          </svg>
        </EdgeGeometryContext.Provider>
      </ReactFlowProvider>,
    );
    expect(container.querySelector('path')?.getAttribute('d')).toBe(KNOWN.path);
    expect(geometry.computeEdgeGeometry).not.toHaveBeenCalled();
  });

  it('falls back to computeEdgeGeometry without a provider', () => {
    const { container } = render(
      <ReactFlowProvider initialNodes={rfNodes}>
        <svg>
          <PmovEdge {...edgeProps()} />
        </svg>
      </ReactFlowProvider>,
    );
    expect(geometry.computeEdgeGeometry).toHaveBeenCalled();
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M/);
  });
});

describe('EdgeGeometryProvider', () => {
  let seen: EdgeGeometry | undefined;
  function Probe() {
    seen = useEdgeGeometry(edge.id);
    return null;
  }
  const el = (nodes: Node<PmovNodeData>[]) => (
    <div style={{ width: 800, height: 600 }}>
      <ReactFlowProvider>
        <EdgeGeometryProvider graph={graph}>
          <Probe />
        </EdgeGeometryProvider>
        <ReactFlow nodes={nodes} edges={[]} />
      </ReactFlowProvider>
    </div>
  );
  const calls = () => vi.mocked(geometry.computeDiagramGeometry).mock.calls.length;

  it('recomputes when a node moves, not when selection changes', () => {
    const { rerender } = render(el(rfNodes));
    const before = calls();
    const pathBefore = seen?.path;
    expect(before).toBeGreaterThan(0);
    expect(pathBefore).toBeDefined();

    rerender(el(rfNodes.map((nd) => ({ ...nd, selected: true }))));
    expect(calls()).toBe(before);

    rerender(el(rfNodes.map((nd) => (nd.id === 'Radi' ? { ...nd, position: { x: 900, y: 400 } } : nd))));
    expect(calls()).toBeGreaterThan(before);
    expect(seen?.path).not.toBe(pathBefore);
  });
});
