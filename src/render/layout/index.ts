// Public entry of src/render/layout — owned by T11. Contract C06 §Layout.
import type { DiagramGraph, PositionMap } from '../graph/types';

export interface LayoutOptions {
  /** Positions the user dragged (from localStorage). They override computed positions for those node ids. */
  saved?: PositionMap;
}

export function layoutDiagram(_graph: DiagramGraph, _options?: LayoutOptions): Promise<PositionMap> {
  return Promise.reject(new Error('not implemented: T11'));
}

export function layoutDiagramSync(_graph: DiagramGraph, _options?: LayoutOptions): PositionMap {
  throw new Error('not implemented: T11');
}

export function placeAttributes(_graph: DiagramGraph, _core: PositionMap, _saved?: PositionMap): PositionMap {
  throw new Error('not implemented: T11');
}
