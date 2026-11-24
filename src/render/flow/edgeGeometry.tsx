// Owned by T43. Whole-diagram edge geometry (C06 §Additions for busy nodes) shared with every `pmov` edge.
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '@xyflow/react';
import type { ReactFlowState } from '@xyflow/react';
import { computeDiagramGeometry } from '../geometry';
import type { Box, EdgeGeometry } from '../geometry';
import type { DiagramGraph } from '../graph/types';
import type { PmovNodeData } from './toReactFlow';

export const EdgeGeometryContext = createContext<Record<string, EdgeGeometry> | null>(null);

/** Geometry of the edge `id` from the nearest provider, or undefined (caller falls back to `computeEdgeGeometry`). */
export function useEdgeGeometry(id: string): EdgeGeometry | undefined {
  return useContext(EdgeGeometryContext)?.[id];
}

type Boxes = Record<string, Box>;

/** Boxes of all nodes: same rule as `PmovEdge`'s `endpoint` (measured size, else the graph node's size). */
function selectBoxes(state: ReactFlowState): Boxes {
  const boxes: Boxes = {};
  for (const [id, internal] of state.nodeLookup) {
    const node = (internal.data as PmovNodeData | undefined)?.node;
    if (!node) continue;
    const pos = internal.internals.positionAbsolute;
    boxes[id] = {
      x: pos.x,
      y: pos.y,
      width: internal.measured.width ?? node.width,
      height: internal.measured.height ?? node.height,
    };
  }
  return boxes;
}

function sameBoxes(a: Boxes, b: Boxes): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    const p = a[k];
    const q = b[k];
    if (!p || !q || p.x !== q.x || p.y !== q.y || p.width !== q.width || p.height !== q.height) return false;
  }
  return true;
}

/** Must be rendered inside the `ReactFlowProvider`. Recomputes only when positions or sizes change. */
export function EdgeGeometryProvider({ graph, children }: { graph: DiagramGraph; children: ReactNode }) {
  const boxes = useStore(selectBoxes, sameBoxes);
  const geometry = useMemo(() => computeDiagramGeometry(graph, boxes), [graph, boxes]);
  return <EdgeGeometryContext.Provider value={geometry}>{children}</EdgeGeometryContext.Provider>;
}
