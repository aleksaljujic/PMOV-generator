// FILE: src/render/graph/types.ts
// CONTRACT C05 — frozen. Change only via spec/contracts/CHANGELOG.md.

export type DiagramNodeType = 'objekat' | 'slab' | 'veza' | 'agregacija' | 'atribut' | 'spec' | 'junction';

/** How the outline is drawn and how edges intersect it (C06). */
export type NodeShape = 'rect' | 'doubleRect' | 'diamond' | 'rectDiamond' | 'pill' | 'circle';

export const NODE_SHAPE: Record<DiagramNodeType, NodeShape> = {
  objekat: 'rect',
  slab: 'doubleRect',
  veza: 'diamond',
  agregacija: 'rectDiamond', // edges attach to the outer rectangle
  atribut: 'pill',
  spec: 'diamond',
  junction: 'circle',
};

export interface Point { x: number; y: number }

/** node id → TOP-LEFT corner (same convention as React Flow `position`). */
export type PositionMap = Record<string, Point>;

export interface DiagramNode {
  id: string;
  type: DiagramNodeType;
  /** Text drawn inside the shape. '' for junction and unnamed veza, 'S' for spec, 'Mlb#' for identifier attributes. */
  label: string;
  /** IR element this node belongs to — for selection sync and error outlines. Attribute → its owner's element id. */
  elementId: string;
  width: number;
  height: number;
  /** atribut only. */
  isIdentifier?: boolean;
  /** 'core' nodes go through ELK; 'attribute' nodes are placed around their owner (C06). */
  layoutRole: 'core' | 'attribute';
  /** atribut only: node id of the owner node. */
  ownerNodeId?: string;
}

/**
 * straight   – floating straight line between outlines
 * loopTop    – recursive veza, first line: source top-center → up → across → target top vertex
 * loopBottom – recursive veza, second line: bottom → down → across → bottom vertex
 * busDown    – spec junction → podtip: down, horizontal bus, down into podtip top-center
 */
export type EdgeRoute = 'straight' | 'loopTop' | 'loopBottom' | 'busDown';

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  /** Always drawn near the SOURCE end (C06 label placement). */
  label: string | null;
  /** Filled arrowhead at the TARGET end. */
  arrow: boolean;
  route: EdgeRoute;
  /** IR element the edge belongs to. */
  elementId: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
