import type { DiagramEdge, DiagramGraph, DiagramNode, PositionMap } from '../../graph/types';

const n = (
  id: string,
  type: DiagramNode['type'],
  label: string,
  elementId: string,
  width: number,
  height: number,
  extra: Partial<DiagramNode> = {},
): DiagramNode => ({ id, type, label, elementId, width, height, layoutRole: 'core', ...extra });

const e = (
  id: string,
  source: string,
  target: string,
  elementId: string,
  extra: Partial<DiagramEdge> = {},
): DiagramEdge => ({ id, source, target, label: null, arrow: false, route: 'straight', elementId, ...extra });

export const FIXTURE_GRAPH: DiagramGraph = {
  nodes: [
    n('Radnik', 'objekat', 'Radnik', 'Radnik', 100, 44),
    n('attr:Radnik:Mlb', 'atribut', 'Mlb#', 'Radnik', 60, 24, {
      isIdentifier: true,
      layoutRole: 'attribute',
      ownerNodeId: 'Radnik',
    }),
    n('Odeljenje', 'objekat', 'Odeljenje', 'Odeljenje', 110, 44),
    n('Radi', 'veza', 'Radi', 'Radi', 100, 56),
    n('Rukovodi', 'veza', 'Rukovodi', 'Rukovodi', 100, 56),
    n('Dete', 'slab', 'Dete', 'Dete', 100, 44),
    n('Tim', 'agregacija', 'Tim', 'Tim', 140, 72),
    n('spec:S1', 'spec', 'S', 'S1', 34, 34),
    n('junction:S1', 'junction', '', 'S1', 12, 12),
  ],
  edges: [
    e('e:Radi:0', 'Radnik', 'Radi', 'Radi', { label: '(1,M)' }),
    e('e:Radi:1', 'Odeljenje', 'Radi', 'Radi', { label: '(1,1)' }),
    e('e:Rukovodi:0', 'Radnik', 'Rukovodi', 'Rukovodi', { label: '(0,M)', route: 'loopTop' }),
    e('e:Rukovodi:1', 'Radnik', 'Rukovodi', 'Rukovodi', { label: '(0,1)', route: 'loopBottom' }),
    e('e:Dete:owner', 'Radnik', 'Dete', 'Dete', { label: '(1,1)', arrow: true }),
    e('e:Tim:0', 'Radi', 'Tim', 'Tim', { label: '(1,M)', arrow: true }),
    e('e:S1:link', 'spec:S1', 'junction:S1', 'S1'),
    e('e:S1:sub:0', 'junction:S1', 'Dete', 'S1', { arrow: true, route: 'busDown' }),
    e('e:attr:Radnik:Mlb', 'Radnik', 'attr:Radnik:Mlb', 'Radnik'),
  ],
};

export const FIXTURE_POSITIONS: PositionMap = Object.fromEntries(
  FIXTURE_GRAPH.nodes.map((node, i) => [node.id, { x: i * 150, y: (i % 3) * 100 }]),
);
