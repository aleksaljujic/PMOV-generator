import type { RelAttribute, RelationalModel } from './types';

const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;

function sqlType(a: RelAttribute): string {
  switch (a.domain) {
    case 'long': return 'BIGINT';
    case 'short': return 'SMALLINT';
    case 'date': return 'DATE';
    default: return 'VARCHAR(255)';
  }
}

const NOT_NULL = /\bNotNull\b/i;

/** Constraint text left for the comment once the NotNull token is removed. */
function commentOf(constraint: string | null): string {
  if (!constraint) return '';
  return constraint
    .replace(/\bNotNull\b/gi, '')
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .replace(/\s*[,;]\s*[,;]\s*/g, ', ');
}

export function generateSql(rm: RelationalModel): string {
  const blocks: string[] = [];
  for (const r of rm.relations) {
    const pk = r.attributes.filter((a) => a.pk);
    const lines: string[] = [];
    r.attributes.forEach((a, i) => {
      const notNull = a.pk || (a.fk && !a.nullable) || (a.constraint !== null && NOT_NULL.test(a.constraint));
      const last = i === r.attributes.length - 1 && pk.length === 0;
      const comment = commentOf(a.constraint);
      lines.push(`  ${q(a.name)} ${sqlType(a)}${notNull ? ' NOT NULL' : ''}${last ? '' : ','}${comment ? `${last ? '' : ''} -- ${comment}` : ''}`);
    });
    if (pk.length > 0) lines.push(`  PRIMARY KEY (${pk.map((a) => q(a.name)).join(', ')})`);
    blocks.push(`CREATE TABLE ${q(r.name)} (\n${lines.join('\n')}\n);`);
  }
  const alters: string[] = [];
  for (const r of rm.relations) {
    const groups = new Map<string, RelAttribute[]>();
    for (const a of r.attributes) {
      if (!a.references) continue;
      const list = groups.get(a.references.group) ?? [];
      list.push(a);
      groups.set(a.references.group, list);
    }
    for (const list of groups.values()) {
      const cols = list.map((a) => q(a.name)).join(', ');
      const refs = list.map((a) => q(a.references!.attribute)).join(', ');
      alters.push(`ALTER TABLE ${q(r.name)} ADD FOREIGN KEY (${cols}) REFERENCES ${q(list[0]!.references!.relation)} (${refs});`);
    }
  }
  return [blocks.join('\n\n'), alters.join('\n')].filter((s) => s !== '').join('\n\n') + '\n';
}
