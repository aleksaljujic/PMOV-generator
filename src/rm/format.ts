import type { Locale } from '../lang';
import type { ConstraintOp } from '../lang';
import type { ReferentialConstraint, Relation, RelationalModel } from './types';

export function formatRelation(rel: Relation): string {
  return `${rel.name}(${rel.attributes.map((a) => a.name).join(', ')})`;
}

export function formatModelText(rm: RelationalModel): string {
  return rm.relations
    .map((r) => {
      const key = r.attributes.filter((a) => a.pk).map((a) => a.name).join(', ');
      const fks = r.attributes.filter((a) => a.fk && !a.pk).map((a) => a.name).join(', ');
      return `${formatRelation(r)}  key: ${key}${fks ? `; FK: ${fks}` : ''}`;
    })
    .join('\n');
}

const OPS: ConstraintOp[] = ['insert', 'update', 'delete'];
const HEAD = ['INSERT', 'UPDATE', 'DELETE'];

/** Left-aligned table, columns separated by two spaces, trailing spaces trimmed. */
function table(rows: string[][]): string[] {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd());
}

const fkTitle = (c: ReferentialConstraint): string => {
  if (c.attributes.length === 1) return `${c.child}.${c.attributes[0]} ⊆ ${c.parent}.${c.referenced[0]}`;
  return `${c.child}(${c.attributes.join(', ')}) ⊆ ${c.parent}(${c.referenced.join(', ')})`;
};

/**
 * Plain-text cards (feature spec §Ograničenja), referential first, then general; cards separated by a blank line.
 * Referential: `[<name>  ]<title>[ (podrazumevano)]`, then a table whose header row is `INSERT UPDATE DELETE`, a row
 * for the child and one for the parent (`/` = not applicable). The name is omitted for derived constraints.
 * General: `<name>`, `  Uslov: <condition>`, then a table with a row per checked relation (`RESTRICTED` where checked).
 */
export function formatConstraintsText(rm: RelationalModel, locale: Locale = 'sr'): string {
  const cards: string[] = [];
  const dflt = locale === 'en' ? 'default' : 'podrazumevano';
  const cond = locale === 'en' ? 'Condition' : 'Uslov';
  for (const c of rm.referential ?? []) {
    const title = c.constraintId === null ? `${fkTitle(c)} (${dflt})` : `${c.name}  ${fkTitle(c)}`;
    const a = c.actions;
    const up = (s: string): string => s.toUpperCase();
    const rows = [
      ['', ...HEAD],
      [c.child, up(a.childInsert), up(a.childUpdate), '/'],
      [c.parent, '/', up(a.parentUpdate), up(a.parentDelete)],
    ];
    cards.push([title, ...table(rows)].join('\n'));
  }
  for (const g of rm.general ?? []) {
    const rows = [
      ['', ...HEAD],
      ...g.checks.map((ch) => [ch.relation, ...OPS.map((op) => (ch.ops.includes(op) ? 'RESTRICTED' : '/'))]),
    ];
    cards.push([g.name, `  ${cond}: ${g.condition}`, ...table(rows)].join('\n'));
  }
  return cards.join('\n\n');
}
