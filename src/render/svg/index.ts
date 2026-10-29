// Public entry of src/render/svg — owned by T06. Contract C07.
import type { DiagramGraph, PositionMap } from '../graph/types';

export interface SvgOptions {
  errorElementIds?: ReadonlySet<string>;
  padding?: number;
  background?: string | null;
}

export function graphToSvg(_graph: DiagramGraph, _positions: PositionMap, _options?: SvgOptions): string {
  throw new Error('not implemented: T06');
}

export function renderSvg(_source: string): string {
  throw new Error('not implemented: T06');
}

export function renderSvgAsync(_source: string): Promise<string> {
  return Promise.reject(new Error('not implemented: T06'));
}

export function svgToPngBlob(_svg: string, _scale?: number): Promise<Blob> {
  return Promise.reject(new Error('not implemented: T06'));
}
