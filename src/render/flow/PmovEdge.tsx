// Owned by T05. Floating `pmov` edge using the shared C06 geometry.
import { BaseEdge, EdgeLabelRenderer, useInternalNode } from '@xyflow/react';
import type { Edge, EdgeProps, InternalNode } from '@xyflow/react';
import { computeEdgeGeometry } from '../geometry';
import type { Box } from '../geometry';
import type { DiagramNode } from '../graph/types';
import { EDGE_FONT_SIZE, FILL, FONT_FAMILY, STROKE, STROKE_WIDTH } from '../style';
import { useInteraction } from './interaction';
import type { PmovEdgeData, PmovNodeData } from './toReactFlow';

function endpoint(internal: InternalNode | undefined): { node: DiagramNode; box: Box } | null {
  if (!internal) return null;
  const node = (internal.data as PmovNodeData | undefined)?.node;
  if (!node) return null;
  const pos = internal.internals.positionAbsolute;
  return {
    node,
    box: {
      x: pos.x,
      y: pos.y,
      width: internal.measured.width ?? node.width,
      height: internal.measured.height ?? node.height,
    },
  };
}

export function PmovEdge({ id, source, target, data }: EdgeProps<Edge<PmovEdgeData>>) {
  const ix = useInteraction();
  const src = endpoint(useInternalNode(source));
  const tgt = endpoint(useInternalNode(target));
  if (!src || !tgt || !data) return null;

  const g = computeEdgeGeometry(data.edge, src, tgt);
  const textAlign = g.label?.anchor === 'start' ? '0%' : g.label?.anchor === 'end' ? '-100%' : '-50%';

  return (
    <>
      <BaseEdge id={id} path={g.path} style={{ stroke: STROKE, strokeWidth: STROKE_WIDTH, fill: 'none' }} />
      {g.arrow && <polygon points={g.arrow.polygon} fill={STROKE} stroke={STROKE} strokeWidth={1} />}
      {g.label && data.edge.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            data-testid={`edge-label-${id}`}
            style={{
              position: 'absolute',
              transform: `translate(${textAlign}, -50%) translate(${g.label.x}px, ${g.label.y}px)`,
              fontFamily: FONT_FAMILY,
              fontSize: EDGE_FONT_SIZE,
              color: STROKE,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              ...(ix?.onEdgeLabelClick ? { pointerEvents: 'all', cursor: 'pointer' } : {}),
              textShadow: [`-1.5px 0 ${FILL}`, `1.5px 0 ${FILL}`, `0 -1.5px ${FILL}`, `0 1.5px ${FILL}`].join(', '),
            }}
          >
            {ix?.onEdgeLabelClick ? (
              <span
                role="button"
                data-testid={`edge-label-btn-${id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  ix.onEdgeLabelClick?.(data.edge.id);
                }}
              >
                {data.edge.label}
              </span>
            ) : (
              data.edge.label
            )}
            {ix?.renderEdgeOverlay?.(data.edge)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
