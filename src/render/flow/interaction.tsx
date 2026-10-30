// Added by T13 (contract C09, additive to C08). Optional interaction hooks for DiagramView, delivered to node and
// edge components through a context that is `null` when no interactive prop is passed (behaviour unchanged).
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { DiagramEdge, DiagramNode } from '../graph/types';

export interface InteractionProps {
  /** Rendered inside every node's box. The wrapper is absolutely positioned over the node; pointer-events: none. */
  renderNodeOverlay?(node: DiagramNode, state: { selected: boolean; hasError: boolean }): ReactNode;
  /** Rendered next to an edge label (inside the label's anchor), for pickers. */
  renderEdgeOverlay?(edge: DiagramEdge): ReactNode;
  /** Makes edge labels clickable. */
  onEdgeLabelClick?(edgeId: string): void;
  onNodeDoubleClick?(node: DiagramNode): void;
  /** Click on empty canvas. */
  onCanvasClick?(): void;
  /** Pick mode: nodes whose elementId is in validIds are highlighted, all others dimmed. */
  pickMode?: { validIds: ReadonlySet<string> } | null;
  /** Element ids drawn with grey italic names (objekat, slab, agregacija nodes only). */
  placeholderIds?: ReadonlySet<string>;
}

export const INTERACTION_KEYS: (keyof InteractionProps)[] = [
  'renderNodeOverlay',
  'renderEdgeOverlay',
  'onEdgeLabelClick',
  'onNodeDoubleClick',
  'onCanvasClick',
  'pickMode',
  'placeholderIds',
];

export const InteractionContext = createContext<InteractionProps | null>(null);
export const useInteraction = (): InteractionProps | null => useContext(InteractionContext);

export const PLACEHOLDER_FILL = '#8a8f98';
