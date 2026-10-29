import type { Relation, RelationalModel } from './types';

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
