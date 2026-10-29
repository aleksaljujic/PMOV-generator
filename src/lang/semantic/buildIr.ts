// IR builder. Owned by T02. Contract C03 §IR build rules.
import type { BlockAst, ModelAst, ParticipantAst } from '../ast';
import type { IRAttribute, IRElement, IRParticipant, PmovIR } from '../ir';
import { analyze, attributesOf, isUnnamedVeza, parseCard, participantsOf, resolveRef, type Analysis } from './shared';

function attrs(b: BlockAst): IRAttribute[] {
  return attributesOf(b).map((x) => ({
    name: x.name.text,
    isId: x.isId,
    domain: x.domain ? x.domain.value : null,
    constraint: x.constraint ? x.constraint.text : null,
    span: x.span,
  }));
}

function participant(a: Analysis, p: ParticipantAst): IRParticipant | null {
  const ref = resolveRef(a, p.object.text);
  const card = parseCard(p.card);
  if (!ref || !card) return null;
  return { ref: ref.id, card, mapping: p.mapping ? p.mapping.text : null, span: p.span };
}

function survivors(a: Analysis, ps: ParticipantAst[]): IRParticipant[] {
  return ps.map((p) => participant(a, p)).filter((x): x is IRParticipant => x !== null);
}

export function buildIr(ast: ModelAst): PmovIR {
  const a = analyze(ast);
  const elements: IRElement[] = a.entries.map(({ block: b, id }): IRElement => {
    const base = {
      id,
      name: isUnnamedVeza(b) ? '' : b.name.text,
      span: b.span,
      nameSpan: b.name.span,
    };
    const ps = participantsOf(b);
    switch (b.kind) {
      case 'objekat':
        return { ...base, kind: 'objekat', attributes: attrs(b) };
      case 'veza':
        return { ...base, kind: 'veza', participants: survivors(a, ps) };
      case 'slab': {
        const owner = survivors(a, ps.filter((p) => p.role?.value === 'nadređeni'))[0] ?? null;
        return { ...base, kind: 'slab', owner, attributes: attrs(b) };
      }
      case 'agregacija':
        return { ...base, kind: 'agregacija', components: survivors(a, ps), attributes: attrs(b) };
      case 'specijalizacija': {
        const supertype = survivors(a, ps.filter((p) => p.role?.value === 'nadtip'))[0] ?? null;
        const subtypes = ps
          .filter((p) => p.role?.value === 'podtip')
          .flatMap((p) => {
            const r = resolveRef(a, p.object.text);
            return r ? [{ ref: r.id, span: p.span }] : [];
          });
        return { ...base, kind: 'specijalizacija', supertype, subtypes };
      }
    }
  });
  return { elements };
}
