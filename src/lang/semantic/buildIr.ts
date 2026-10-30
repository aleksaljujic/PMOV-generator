// IR builder. Owned by T02. Contract C03 §IR build rules.
import type { BlockAst, ModelAst, ParticipantAst } from '../ast';
import type { IRAttribute, IRElement, IRParticipant, PmovIR } from '../ir';
import { analyzeConstraints } from './constraints';
import { buildDomainTable, type DomainTable } from './domains';
import { messagesFor } from './messages';
import { analyze, attributesOf, isUnnamedVeza, parseCard, participantsOf, resolveRef, type Analysis } from './shared';

function attrs(b: BlockAst, dt: DomainTable): IRAttribute[] {
  return attributesOf(b).map((x) => {
    const dom = x.userDomain ? dt.byName.get(x.userDomain.text)?.ir : undefined;
    const length = x.length ? x.length.value : dom?.length ?? null;
    const out: IRAttribute = {
      name: x.name.text,
      isId: x.isId,
      domain: x.domain ? x.domain.value : dom?.base ?? null,
      constraint: x.constraint ? x.constraint.text : null,
      span: x.span,
    };
    if (x.userDomain) out.userDomain = x.userDomain.text;
    if (length !== null) out.length = length;
    return out;
  });
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
  const m = messagesFor('sr');
  const dt = buildDomainTable(ast, a, m);
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
        return { ...base, kind: 'objekat', attributes: attrs(b, dt) };
      case 'veza':
        return { ...base, kind: 'veza', participants: survivors(a, ps) };
      case 'slab': {
        const owner = survivors(a, ps.filter((p) => p.role?.value === 'nadređeni'))[0] ?? null;
        return { ...base, kind: 'slab', owner, attributes: attrs(b, dt) };
      }
      case 'agregacija':
        return { ...base, kind: 'agregacija', components: survivors(a, ps), attributes: attrs(b, dt) };
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
  const ir: PmovIR = { elements };
  if (dt.list.length > 0) ir.domains = dt.list.map((d) => d.ir);
  const { constraints } = analyzeConstraints(ast, a, m);
  if (constraints.length > 0) ir.constraints = constraints;
  return ir;
}
