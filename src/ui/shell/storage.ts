// Owned by T09. Contract C08 §App-level pieces.
import type { PositionMap } from '../../render/graph/types';
import type { Dg0Mode } from '../../rm/types';

export const STORAGE_KEYS = {
  source: 'pmov.source.v1',
  positions: 'pmov.positions.v1',
  dg0Mode: 'pmov.dg0Mode.v1',
  editorWidth: 'pmov.editorWidth.v1',
} as const;

export function loadSource(): string | null {
  throw new Error('not implemented: T09');
}
export function saveSource(_source: string): void {
  throw new Error('not implemented: T09');
}
export function loadPositions(): PositionMap {
  throw new Error('not implemented: T09');
}
export function savePositions(_p: PositionMap): void {
  throw new Error('not implemented: T09');
}
export function clearPositions(): void {
  throw new Error('not implemented: T09');
}
export function loadDg0Mode(): Dg0Mode {
  throw new Error('not implemented: T09');
}
export function saveDg0Mode(_m: Dg0Mode): void {
  throw new Error('not implemented: T09');
}
