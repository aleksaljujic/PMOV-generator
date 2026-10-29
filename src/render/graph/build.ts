import type { Cardinality, IRAttribute, PmovIR, IRParticipant } from '../../lang';
import { ATTR_FONT_SIZE, FONT_SIZE } from '../style';
import type { DiagramEdge, DiagramGraph, DiagramNode, DiagramNodeType } from './types';
import { attributeNodeId, estimateTextWidth } from './text';

const card = (c: Cardinality): string => `(${c.min},${c.max})`;
const withMap = (p: IRParticipant): string => (p.mapping ? `${card(p.card)} ${p.mapping}` : card(p.card));

function size(type: DiagramNodeType, label: string): { width: number; height: number } {
  const w = estimateTextWidth(label, FONT_SIZE);
  switch (type) {
    case 'objekat':
    case 'slab':
      return { width: Math.max(100, w + 32), height: 44 };
    case 'veza': {
      const width = label === '' ? 70 : Math.max(100, w * 1.6 + 30);
      return { width, height: Math.max(56, width * 0.5) };
    }
    case 'agregacija': {
      const width = Math.max(140, w * 1.6 + 40);
      return { width, height: Math.max(72, width * 0.5) };
    }
    case 'atribut': {
      const label2 = label;
      return { width: estimateTextWidth(label2, ATTR_FONT_SIZE) + 24, height: 24 };
    }
    case 'spec':
      return { width: 34, height: 34 };
    default:
      return { width: 12, height: 12 };
  }
}

export function buildDiagramGraph(ir: PmovIR): DiagramGraph {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const addNode = (id: string, type: DiagramNodeType, label: string, elementId: string, extra: Partial<DiagramNode> = {}) => {
    nodes.push({ id, type, label, elementId, ...size(type, label), layoutRole: 'core', ...extra });
  };
  const addEdge = (id: string, source: string, target: string, elementId: string,
    label: string | null = null, arrow = false, route: DiagramEdge['route'] = 'straight') => {
    edges.push({ id, source, target, label, arrow, route, elementId });
  };
  const addAttrs = (ownerId: string, attrs: IRAttribute[]) => {
    const seen = new Map<string, number>();
    for (const a of attrs) {
      const n = (seen.get(a.name) ?? 0) + 1;
      seen.set(a.name, n);
      const id = attributeNodeId(ownerId, a.name, n);
      addNode(id, 'atribut', a.isId ? `${a.name}#` : a.name, ownerId, {
        isIdentifier: a.isId, layoutRole: 'attribute', ownerNodeId: ownerId,
      });
      addEdge(`e:${id}`, ownerId, id, ownerId);
    }
  };

  for (const el of ir.elements) {
    switch (el.kind) {
      case 'objekat':
        addNode(el.id, 'objekat', el.name, el.id);
        addAttrs(el.id, el.attributes);
        break;
      case 'slab':
        addNode(el.id, 'slab', el.name, el.id);
        addAttrs(el.id, el.attributes);
        if (el.owner) addEdge(`e:${el.id}:owner`, el.owner.ref, el.id, el.id, card(el.owner.card), true);
        break;
      case 'agregacija':
        addNode(el.id, 'agregacija', el.name, el.id);
        addAttrs(el.id, el.attributes);
        el.components.forEach((c, i) => addEdge(`e:${el.id}:${i}`, c.ref, el.id, el.id, withMap(c), true));
        break;
      case 'veza': {
        addNode(el.id, 'veza', el.name, el.id);
        const ps = el.participants;
        const recursive = ps.length === 2 && ps[0]?.ref === ps[1]?.ref;
        ps.forEach((p, i) => {
          const route = recursive ? (i === 0 ? 'loopTop' : 'loopBottom') : 'straight';
          addEdge(`e:${el.id}:${i}`, p.ref, el.id, el.id, withMap(p), false, route);
        });
        break;
      }
      case 'specijalizacija': {
        const spec = `spec:${el.id}`;
        const junction = `junction:${el.id}`;
        addNode(spec, 'spec', 'S', el.id);
        addNode(junction, 'junction', '', el.id);
        if (el.supertype) {
          addEdge(`e:${el.id}:super`, el.supertype.ref, spec, el.id, `${el.name} ${card(el.supertype.card)}`.trim());
        }
        addEdge(`e:${el.id}:link`, spec, junction, el.id);
        el.subtypes.forEach((s, i) => addEdge(`e:${el.id}:sub:${i}`, junction, s.ref, el.id, null, true, 'busDown'));
        break;
      }
    }
  }
  return { nodes, edges };
}
