// Owned by T05. Custom React Flow node components drawing FON shapes (C07 §Drawing rules).
import type { ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  ATTR_FONT_SIZE,
  ERROR_STROKE,
  ERROR_STROKE_WIDTH,
  FILL,
  FONT_FAMILY,
  FONT_SIZE,
  SELECTED_STROKE,
  SLAB_INSET,
  STROKE,
  STROKE_WIDTH,
} from '../style';
import { PLACEHOLDER_FILL, useInteraction } from './interaction';
import type { PmovNodeData } from './toReactFlow';

type PmovNodeProps = NodeProps<Node<PmovNodeData>>;

function useStroke(d: PmovNodeData): { stroke: string; strokeWidth: number } {
  if (d.hasError) return { stroke: ERROR_STROKE, strokeWidth: ERROR_STROKE_WIDTH };
  if (d.selected) return { stroke: SELECTED_STROKE, strokeWidth: ERROR_STROKE_WIDTH };
  return { stroke: STROKE, strokeWidth: STROKE_WIDTH };
}

const hiddenHandle = { opacity: 0, pointerEvents: 'none' as const, width: 1, height: 1, minWidth: 0, minHeight: 0 };

const PLACEHOLDER_TYPES = new Set(['objekat', 'slab', 'agregacija']);

function Frame({ d, children }: { d: PmovNodeData; children: ReactNode }) {
  const { width, height } = d.node;
  const ix = useInteraction();
  const pick = ix?.pickMode ?? null;
  const pickValid = pick ? pick.validIds.has(d.node.elementId) && d.node.type !== 'atribut' : false;
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={hiddenHandle} />
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          display: 'block',
          overflow: 'visible',
          ...(pick ? { opacity: pickValid ? 1 : 0.3, cursor: pickValid ? 'pointer' : 'not-allowed' } : {}),
        }}
        data-testid={`node-${d.node.id}`}
      >
        {children}
      </svg>
      {pickValid && (
        <div
          data-testid={`pick-${d.node.id}`}
          style={{
            position: 'absolute',
            inset: -4,
            border: `2px dashed ${SELECTED_STROKE}`,
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}
      {ix?.renderNodeOverlay && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} data-testid={`overlay-${d.node.id}`}>
          {ix.renderNodeOverlay(d.node, { selected: d.selected, hasError: d.hasError })}
        </div>
      )}
    </>
  );
}

function Label({ d, size = FONT_SIZE, bold = false }: { d: PmovNodeData; size?: number; bold?: boolean }) {
  const ix = useInteraction();
  if (d.node.label === '') return null;
  const placeholder = !!ix?.placeholderIds?.has(d.node.elementId) && PLACEHOLDER_TYPES.has(d.node.type);
  return (
    <text
      x={d.node.width / 2}
      y={d.node.height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily={FONT_FAMILY}
      fontSize={size}
      fontWeight={bold ? 'bold' : undefined}
      fontStyle={placeholder ? 'italic' : undefined}
      fill={placeholder ? PLACEHOLDER_FILL : STROKE}
      style={{ userSelect: 'none' }}
    >
      {d.node.label}
    </text>
  );
}

const diamondPoints = (w: number, h: number) => `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;

export function ObjekatNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <rect x={0} y={0} width={width} height={height} fill={FILL} {...s} />
      <Label d={data} />
    </Frame>
  );
}

export function SlabNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <rect x={0} y={0} width={width} height={height} fill={FILL} {...s} />
      <rect
        x={SLAB_INSET}
        y={SLAB_INSET}
        width={width - 2 * SLAB_INSET}
        height={height - 2 * SLAB_INSET}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
      />
      <Label d={data} />
    </Frame>
  );
}

export function VezaNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <polygon points={diamondPoints(width, height)} fill={FILL} {...s} />
      <Label d={data} />
    </Frame>
  );
}

export function AgregacijaNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <rect x={0} y={0} width={width} height={height} fill={FILL} {...s} />
      <polygon points={diamondPoints(width, height)} fill="none" stroke={STROKE} strokeWidth={STROKE_WIDTH} />
      <Label d={data} />
    </Frame>
  );
}

export function AtributNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <rect x={0} y={0} width={width} height={height} rx={height / 2} ry={height / 2} fill={FILL} {...s} />
      <Label d={data} size={ATTR_FONT_SIZE} />
    </Frame>
  );
}

export function SpecNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <polygon points={diamondPoints(width, height)} fill={FILL} {...s} />
      <Label d={data} bold />
    </Frame>
  );
}

export function JunctionNode({ data }: PmovNodeProps) {
  const s = useStroke(data);
  const { width, height } = data.node;
  return (
    <Frame d={data}>
      <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2} fill={FILL} {...s} />
    </Frame>
  );
}
