import type { PmovIR } from '../lang';
import type { DomainRow, DomainStructureRow } from './types';

const DASH = '–';

export function buildDomainTable(ir: PmovIR): DomainRow[] {
  const rows: DomainRow[] = [];
  const seen = new Set<string>();
  for (const e of ir.elements) {
    if (e.kind !== 'objekat' && e.kind !== 'slab' && e.kind !== 'agregacija') continue;
    for (const a of e.attributes) {
      const builtin = a.domain === null ? DASH : a.length != null ? `${a.domain}(${a.length})` : a.domain;
      const row: DomainRow = {
        attribute: a.name.replace(/^#/, ''),
        domain: a.userDomain != null ? a.userDomain : builtin,
        constraint: a.constraint ?? DASH,
      };
      const k = JSON.stringify([row.attribute, row.domain, row.constraint]);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(row);
    }
  }
  return rows;
}

/** "Struktura domena" table: one row per declared domain, in source order. */
export function buildDomainStructure(ir: PmovIR): DomainStructureRow[] {
  const domains = ir.domains ?? [];
  const byName = new Map(domains.map((d) => [d.name, d]));
  return domains.map((d) => ({
    domain: d.name,
    base: d.parent ?? d.base ?? DASH,
    length: d.length != null ? String(d.length) : DASH,
    constraint: d.constraint ?? DASH,
    inherited: d.parent !== null ? (byName.get(d.parent)?.effectiveConstraint ?? null) : null,
  }));
}
