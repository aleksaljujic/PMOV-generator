import type { DiagramGraph, PositionMap } from '../graph/types';
import { attrCountByOwner, inflation } from './inflate';
import { buildCore, type CoreModel } from './model';
import { postProcess, type State } from './post';
import { stressLayout } from './stress';

export interface Prepared { m: CoreModel; s: State; iw: number[]; ih: number[] }

export function prepare(graph: DiagramGraph): Prepared {
  const m = buildCore(graph);
  const counts = attrCountByOwner(graph);
  const infl = m.nodes.map((nd) => inflation(nd, counts.get(nd.id) ?? 0, graph));
  const w = m.nodes.map((nd) => nd.width);
  const h = m.nodes.map((nd) => nd.height);
  const px = infl.map((i) => i.padX);
  const py = infl.map((i) => i.padY);
  const s: State = { cx: w.map(() => 0), cy: w.map(() => 0), w, h, px, py };
  return { m, s, iw: w.map((v, i) => v + 2 * px[i]!), ih: h.map((v, i) => v + 2 * py[i]!) };
}

export function layoutCoreSync(graph: DiagramGraph): PositionMap {
  const { m, s, iw, ih } = prepare(graph);
  const p = stressLayout(m, iw, ih);
  s.cx = p.x; s.cy = p.y;
  return postProcess(m, s);
}
