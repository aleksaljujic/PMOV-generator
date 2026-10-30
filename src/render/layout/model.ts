import type { DiagramGraph, DiagramNode } from '../graph/types';

export interface SpecGroup {
  spec: string;
  junction: string | null;
  supers: string[];
  subs: string[];
}

export interface CoreModel {
  nodes: DiagramNode[];
  index: Map<string, number>;
  /** Oriented, de-duplicated, non-loop core edges (indices). */
  edges: Array<[number, number]>;
  groups: SpecGroup[];
}

/** Core nodes + oriented edges (supertype → S → junction → podtipovi). */
export function buildCore(graph: DiagramGraph): CoreModel {
  const nodes = graph.nodes.filter((n) => n.layoutRole === 'core');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];
  const groups = new Map<string, SpecGroup>();
  const junctionToSpec = new Map<string, string>();

  const live = graph.edges.filter((e) => byId.has(e.source) && byId.has(e.target) && e.source !== e.target);
  // spec <-> junction pairs first
  for (const e of live) {
    const a = byId.get(e.source)!;
    const b = byId.get(e.target)!;
    if ((a.type === 'spec' && b.type === 'junction') || (a.type === 'junction' && b.type === 'spec')) {
      const s = a.type === 'spec' ? a : b;
      const j = a.type === 'junction' ? a : b;
      groups.set(s.id, { spec: s.id, junction: j.id, supers: [], subs: [] });
      junctionToSpec.set(j.id, s.id);
    }
  }
  for (const n of nodes) {
    if (n.type === 'spec' && !groups.has(n.id)) groups.set(n.id, { spec: n.id, junction: null, supers: [], subs: [] });
  }

  const add = (s: string, t: string): void => {
    const key = `${s}\u0000${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push([index.get(s)!, index.get(t)!]);
  };

  for (const e of live) {
    const a = byId.get(e.source)!;
    const b = byId.get(e.target)!;
    if (a.type === 'spec' && b.type === 'junction') add(a.id, b.id);
    else if (a.type === 'junction' && b.type === 'spec') add(b.id, a.id);
    else if (b.type === 'spec') { groups.get(b.id)?.supers.push(a.id); add(a.id, b.id); }
    else if (a.type === 'spec') { groups.get(a.id)?.supers.push(b.id); add(b.id, a.id); }
    else if (a.type === 'junction') { const g = groups.get(junctionToSpec.get(a.id) ?? ''); g?.subs.push(b.id); add(a.id, b.id); }
    else if (b.type === 'junction') { const g = groups.get(junctionToSpec.get(b.id) ?? ''); g?.subs.push(a.id); add(b.id, a.id); }
    else add(a.id, b.id);
  }
  return { nodes, index, edges, groups: [...groups.values()] };
}
