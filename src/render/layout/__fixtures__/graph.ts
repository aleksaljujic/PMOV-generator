import type { DiagramEdge, DiagramGraph, DiagramNode } from '../../graph/types';

const core = (id: string, type: DiagramNode['type'], label: string, width: number, height: number): DiagramNode => ({
  id, type, label, elementId: id, width, height, layoutRole: 'core',
});
const attr = (owner: string, name: string, isId = false): DiagramNode => ({
  id: `${owner}.${name}`, type: 'atribut', label: isId ? `${name}#` : name, elementId: owner,
  width: 12 * name.length + 24, height: 24, layoutRole: 'attribute', ownerNodeId: owner, isIdentifier: isId,
});
const edge = (id: string, source: string, target: string, extra: Partial<DiagramEdge> = {}): DiagramEdge => ({
  id, source, target, label: null, arrow: false, route: 'straight', elementId: id, ...extra,
});

export function makeFixtureGraph(): DiagramGraph {
  const nodes: DiagramNode[] = [
    core('Radnik', 'objekat', 'Radnik', 100, 44),
    core('Projekat', 'objekat', 'Projekat', 110, 44),
    core('Odeljenje', 'objekat', 'Odeljenje', 120, 44),
    core('Dete', 'slab', 'Dete', 100, 44),
    core('Radi', 'veza', 'Radi', 100, 56),
    core('Ima', 'veza', 'Ima', 100, 56),
    core('Rukovodi', 'veza', 'Rukovodi', 100, 56),
    core('Agr', 'agregacija', 'Radi_na', 140, 72),
    core('Angazuje', 'veza', 'Angazuje', 100, 56),
    core('Oprema', 'objekat', 'Oprema', 100, 44),
    { ...core('spec:Z', 'spec', 'S', 34, 34), elementId: 'Z' },
    { ...core('junction:Z', 'junction', '', 12, 12), elementId: 'Z' },
    core('Inzenjer', 'objekat', 'Inzenjer', 100, 44),
    core('Tehnicar', 'objekat', 'Tehnicar', 100, 44),
    core('Admin', 'slab', 'Admin', 100, 44),
    core('Sef', 'objekat', 'Sef', 100, 44),
    core('Osoba', 'objekat', 'Osoba', 100, 44),
    core('Kolega', 'veza', 'Kolega', 100, 56),
    core('Usamljen', 'objekat', 'Usamljen', 100, 44),
  ];
  for (const a of ['Mlb', 'ImeR', 'Adresa', 'Starost']) nodes.push(attr('Radnik', a, a === 'Mlb'));
  for (const a of ['Sifra', 'Naziv']) nodes.push(attr('Projekat', a, a === 'Sifra'));
  for (const a of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) nodes.push(attr('Odeljenje', a, a === 'A1'));
  nodes.push(attr('Radi', 'Sati'));
  nodes.push(attr('Usamljen', 'X'));
  nodes.push(attr('Osoba', 'Id', true));

  const edges: DiagramEdge[] = [
    edge('r1', 'Radnik', 'Radi', { label: '(1,n)' }),
    edge('r2', 'Radi', 'Projekat', { label: '(0,n)' }),
    edge('i1', 'Odeljenje', 'Ima'),
    edge('i2', 'Ima', 'Radnik'),
    edge('a1', 'Radi', 'Agr'),
    edge('a2', 'Agr', 'Angazuje'),
    edge('a3', 'Angazuje', 'Oprema'),
    edge('d1', 'Dete', 'Rukovodi'),
    edge('d2', 'Rukovodi', 'Radnik'),
    edge('s1', 'Sef', 'spec:Z', { label: 'Z (0,1)' }),
    edge('s2', 'spec:Z', 'junction:Z'),
    edge('s3', 'junction:Z', 'Inzenjer', { arrow: true, route: 'busDown' }),
    edge('s4', 'junction:Z', 'Tehnicar', { arrow: true, route: 'busDown' }),
    edge('s5', 'junction:Z', 'Admin', { arrow: true, route: 'busDown' }),
    edge('s6', 'junction:Z', 'Radnik', { arrow: true, route: 'busDown' }),
    edge('k1', 'Osoba', 'Kolega', { route: 'loopTop' }),
    edge('k2', 'Kolega', 'Osoba', { route: 'loopTop' }),
    edge('k3', 'Osoba', 'Osoba', { route: 'loopBottom' }),
  ];
  for (const n of nodes) if (n.layoutRole === 'attribute') edges.push(edge(`e:${n.id}`, n.ownerNodeId!, n.id));
  return { nodes, edges };
}
