// Public entry of src/render/graph — owned by T04. Contract C05.
import type { PmovIR } from '../../lang';
import type { DiagramGraph } from './types';

export * from './types';

export function buildDiagramGraph(_ir: PmovIR): DiagramGraph {
  throw new Error('not implemented: T04');
}

/** Deterministic text width estimate (no DOM). */
export function estimateTextWidth(_text: string, _fontSize: number): number {
  throw new Error('not implemented: T04');
}

export function attributeNodeId(_ownerId: string, _attrName: string, _occurrence?: number): string {
  throw new Error('not implemented: T04');
}
