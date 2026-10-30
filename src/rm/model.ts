import type { Cardinality, IRAttribute, IRElement, IRParticipant, PmovIR } from '../lang';
import { DEFAULT_RM_OPTIONS } from './types';
import { buildConstraints } from './constraints';
import type { Dg0Mode, RelAttribute, Relation, RelationalModel, RmOptions } from './types';

const strip = (s: string): string => s.replace(/\s+/g, '');

export interface Holder {
  /** Index into participants of the holder (receives key(other) as FK). */
  index: number;
  nullable: boolean;
}
export type VezaClass = 'relation' | { holders: Holder[] };

/** Is this veza two-participant (otherwise the model has errors and we skip it). */
const isBinary = (el: IRElement): boolean => el.kind === 'veza' && el.participants.length === 2;

function isToggleable(cp: Cardinality, cq: Cardinality): boolean {
  if (cp.max === 'M' && cq.max === 'M') return false;
  return cp.min === 0 || cq.min === 0;
}

export function classifyVeza(veza: IRElement, dg0Mode: Dg0Mode): VezaClass {
  if (veza.kind !== 'veza' || veza.participants.length !== 2) return { holders: [] };
  const p = veza.participants[0]!;
  const q = veza.participants[1]!;
  const cp = p.card;
  const cq = q.card;
  if (cp.max === 'M' && cq.max === 'M') return 'relation';
  if (cp.min === 0 || cq.min === 0) {
    if (dg0Mode === 'relation') return 'relation';
    let index: number;
    if (cp.max === 1 && cq.max !== 1) index = 0;
    else if (cq.max === 1 && cp.max !== 1) index = 1;
    else if (cp.min === 1 && cq.min !== 1) index = 0;
    else if (cq.min === 1 && cp.min !== 1) index = 1;
    else index = 0;
    const h = veza.participants[index]!;
    return { holders: [{ index, nullable: h.card.min === 0 }] };
  }
  const holders: Holder[] = [];
  veza.participants.forEach((x, index) => {
    if (x.card.min === 1 && x.card.max === 1) holders.push({ index, nullable: false });
  });
  return { holders };
}

export function dg0ToggleableVezas(ir: PmovIR): string[] {
  return ir.elements
    .filter((e) => isBinary(e) && e.kind === 'veza' && isToggleable(e.participants[0]!.card, e.participants[1]!.card))
    .map((e) => e.id);
}

interface Draft extends RelAttribute {
  /** Mapping name of the participant line a borrowed attribute came through. */
  mapping: string | null;
}

const own = (
  name: string, domain: RelAttribute['domain'], constraint: string | null, pk: boolean,
  userDomain?: string | null, length?: number | null,
): Draft => ({
  name: strip(name), domain, constraint, pk, fk: false, nullable: false,
  ...(userDomain != null ? { userDomain } : {}),
  ...(length != null ? { length } : {}),
  references: null, mapping: null,
});

function resolveCollisions(drafts: Draft[]): void {
  const count = new Map<string, number>();
  for (const d of drafts) count.set(d.name, (count.get(d.name) ?? 0) + 1);
  for (const d of drafts) {
    if (d.fk && (count.get(d.name) ?? 0) > 1 && d.mapping) d.name = `${d.name}_${strip(d.mapping)}`;
  }
  const seen = new Map<string, number>();
  for (const d of drafts) {
    const n = (seen.get(d.name) ?? 0) + 1;
    seen.set(d.name, n);
    if (n > 1 && d.fk) {
      let k = n;
      let cand = `${d.name}_${k}`;
      while (drafts.some((x) => x !== d && x.name === cand)) cand = `${d.name}_${++k}`;
      d.name = cand;
    }
  }
}

export function generateRelationalModel(ir: PmovIR, options: RmOptions = DEFAULT_RM_OPTIONS): RelationalModel {
  const byId = new Map<string, IRElement>();
  for (const e of ir.elements) if (!byId.has(e.id)) byId.set(e.id, e);

  // podtip -> supertype id
  const superOf = new Map<string, string>();
  for (const e of ir.elements) {
    if (e.kind === 'specijalizacija' && e.supertype) {
      for (const s of e.subtypes) if (!superOf.has(s.ref)) superOf.set(s.ref, e.supertype.ref);
    }
  }

  const classes = new Map<string, VezaClass>();
  for (const e of ir.elements) if (e.kind === 'veza') classes.set(e.id, classifyVeza(e, options.dg0Mode));

  const relName = (e: IRElement): string => {
    if (e.kind === 'veza' && e.name === '' && e.participants.length >= 2) {
      const nm = (p: IRParticipant) => strip(byId.get(p.ref)?.name ?? p.ref);
      return e.participants.map(nm).join('_');
    }
    return strip(e.name);
  };

  /** Core drafts (key + borrowed + own), excluding FKs from vezas. Memoized. */
  const coreCache = new Map<string, Draft[]>();
  const visiting = new Set<string>();

  function borrow(sourceId: string, index: number, pk: boolean, mapping: string | null, nullable = false): Draft[] {
    const key = keyOf(sourceId);
    const rname = relationNameOf(sourceId);
    const group = `${sourceId}:${index}`;
    return key.map((k) => ({
      name: k.name, domain: k.domain, constraint: k.constraint, pk, fk: true, nullable,
      ...(k.userDomain != null ? { userDomain: k.userDomain } : {}),
      ...(k.length != null ? { length: k.length } : {}),
      references: { relation: rname, attribute: k.name, group }, mapping,
    }));
  }
  function relationNameOf(id: string): string {
    const e = byId.get(id);
    return e ? relName(e) : strip(id);
  }

  /** Borrow with a group id attributed to `groupOwner` (the element that creates the FK). */
  function borrowFor(groupOwner: string, index: number, sourceId: string, pk: boolean, mapping: string | null, nullable = false): Draft[] {
    return borrow(sourceId, index, pk, mapping, nullable).map((d) => ({
      ...d, references: { ...d.references!, group: `${groupOwner}:${index}` },
    }));
  }

  function core(id: string): Draft[] {
    const cached = coreCache.get(id);
    if (cached) return cached;
    const e = byId.get(id);
    if (!e || visiting.has(id)) return [];
    visiting.add(id);
    let out: Draft[] = [];
    const ownAttrs = (attrs: IRAttribute[], idsPk: boolean) =>
      attrs.map((a) => own(a.name, a.domain, a.constraint, idsPk && a.isId, a.userDomain, a.length));
    if (e.kind === 'objekat') {
      const sup = superOf.get(id);
      if (sup !== undefined && byId.has(sup)) {
        out = [...borrowFor(id, 0, sup, true, null), ...ownAttrs(e.attributes, false)];
      } else out = ownAttrs(e.attributes, true);
    } else if (e.kind === 'slab') {
      const head = e.owner && byId.has(e.owner.ref) ? borrowFor(id, 0, e.owner.ref, true, e.owner.mapping) : [];
      out = [...head, ...ownAttrs(e.attributes, true)];
    } else if (e.kind === 'agregacija') {
      out = [...componentDrafts(id, e.components), ...ownAttrs(e.attributes, false)];
    } else if (e.kind === 'veza') {
      out = componentDrafts(id, e.participants);
    }
    resolveCollisions(out);
    visiting.delete(id);
    coreCache.set(id, out);
    return out;
  }

  function componentDrafts(id: string, comps: IRParticipant[]): Draft[] {
    const valid = comps.map((c, i) => ({ c, i })).filter(({ c }) => byId.has(c.ref));
    const firstOne = valid.find(({ c }) => c.card.max === 1);
    const pkSet = firstOne ? [firstOne] : valid;
    const keys: Draft[] = [];
    const others: Draft[] = [];
    for (const v of valid) {
      const isKey = pkSet.includes(v);
      (isKey ? keys : others).push(...borrowFor(id, v.i, v.c.ref, isKey, v.c.mapping));
    }
    return [...keys, ...others];
  }

  function keyOf(id: string): Draft[] {
    return core(id).filter((d) => d.pk);
  }

  // FKs from vezas, per holder element
  const vezaFks = new Map<string, Draft[]>();
  for (const e of ir.elements) {
    if (e.kind !== 'veza') continue;
    const cls = classes.get(e.id)!;
    if (cls === 'relation') continue;
    for (const h of cls.holders) {
      const holder = e.participants[h.index];
      const other = e.participants[1 - h.index];
      if (!holder || !other) continue;
      if (!byId.has(holder.ref) || !byId.has(other.ref)) continue;
      const list = vezaFks.get(holder.ref) ?? [];
      list.push(...borrowFor(e.id, 0, other.ref, false, other.mapping, h.nullable));
      vezaFks.set(holder.ref, list);
    }
  }

  const relations: Relation[] = [];
  for (const e of ir.elements) {
    if (e.kind === 'specijalizacija') continue;
    if (e.kind === 'veza' && classes.get(e.id) !== 'relation') continue;
    const drafts = [...core(e.id).map((d) => ({ ...d })), ...(vezaFks.get(e.id) ?? []).map((d) => ({ ...d }))];
    // Re-resolve collisions only for names clashing with the veza FKs (core names already unique).
    resolveCollisions(drafts);
    relations.push({
      name: relName(e),
      elementId: e.id,
      attributes: drafts.map(({ mapping: _m, ...rest }) => rest),
    });
  }
  const rm: RelationalModel = { relations };
  const identifying = new Set<string>();
  for (const e of ir.elements) if (e.kind === 'slab' || superOf.has(e.id)) identifying.add(e.id);
  const built = buildConstraints(ir, relations, identifying, options.locale ?? 'sr');
  if (built.referential.length > 0) rm.referential = built.referential;
  if (built.general.length > 0) rm.general = built.general;
  if (built.diagnostics.length > 0) rm.diagnostics = built.diagnostics;
  return rm;
}
