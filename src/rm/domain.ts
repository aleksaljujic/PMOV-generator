import type { PmovIR } from '../lang';
import type { DomainRow } from './types';

const DASH = '–';

export function buildDomainTable(ir: PmovIR): DomainRow[] {
  const rows: DomainRow[] = [];
  const seen = new Set<string>();
  for (const e of ir.elements) {
    if (e.kind !== 'objekat' && e.kind !== 'slab' && e.kind !== 'agregacija') continue;
    for (const a of e.attributes) {
      const row: DomainRow = {
        attribute: a.name.replace(/^#/, ''),
        domain: a.domain ?? DASH,
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
