// C12 §1: PostgreSQL triggers for child-side referential actions and general constraints.
import type { Locale } from '../lang';
import type { GeneralConstraint, ReferentialConstraint, RelationalModel } from './types';

const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;
const lq = (s: string): string => s.replace(/'/g, "''");

const STR = {
  sr: {
    noDefault: '-- DEFAULT: kolona nema podrazumevanu vrednost, koristi se NULL',
    violated: (n: string) => `ograničenje ${n} je narušeno`,
    prefix: '-- okidač nije generisan: ',
    noRefs: 'uslov ne navodi nijedan atribut',
    missing: (r: string, a: string) => `'${r}.${a}' ne postoji u relacionom modelu`,
    unknown: (t: string) => `nepoznat deo uslova: '${t}'`,
    notConnected: (l: string) => `relacije ${l} nisu povezane stranim ključem`,
    several: (a: string, b: string) => `između '${a}' i '${b}' postoji više stranih ključeva`,
    noRelation: (r: string) => `relacija '${r}' ne postoji u relacionom modelu`,
  },
  en: {
    noDefault: '-- DEFAULT: the column has no default value, NULL is used',
    violated: (n: string) => `constraint ${n} is violated`,
    prefix: '-- trigger not generated: ',
    noRefs: 'the condition names no attribute',
    missing: (r: string, a: string) => `'${r}.${a}' does not exist in the relational model`,
    unknown: (t: string) => `unknown part of the condition: '${t}'`,
    notConnected: (l: string) => `relations ${l} are not connected by a foreign key`,
    several: (a: string, b: string) => `there are several foreign keys between '${a}' and '${b}'`,
    noRelation: (r: string) => `relation '${r}' does not exist in the relational model`,
  },
} as const;

/** Function + BEFORE ROW trigger for one non-restricted child cell. */
export function childTrigger(
  c: ReferentialConstraint, cell: 'childInsert' | 'childUpdate', locale: Locale = 'sr',
): string {
  const ins = cell === 'childInsert';
  const sfx = ins ? 'ins' : 'upd';
  const fn = q(`${c.name}_${sfx}_fn`);
  const notNull = c.attributes.map((a) => `NEW.${q(a)} IS NOT NULL`).join(' AND ');
  const match = c.attributes.map((a, i) => `${q(c.parent)}.${q(c.referenced[i]!)} = NEW.${q(a)}`).join(' AND ');
  const lines = [
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$`,
    'BEGIN',
    `  IF ${notNull}`,
    `     AND NOT EXISTS (SELECT 1 FROM ${q(c.parent)} WHERE ${match}) THEN`,
  ];
  if (c.actions[cell] === 'default') lines.push(`    ${STR[locale].noDefault}`);
  for (const a of c.attributes) lines.push(`    NEW.${q(a)} := NULL;`);
  lines.push(
    '  END IF;', '  RETURN NEW;', 'END;', '$$;',
    `CREATE TRIGGER ${q(`${c.name}_${sfx}`)} BEFORE ${ins ? 'INSERT' : `UPDATE OF ${c.attributes.map(q).join(', ')}`} ON ${q(c.child)}`,
    `  FOR EACH ROW EXECUTE FUNCTION ${fn}();`,
  );
  return lines.join('\n');
}

export type Translation = { ok: true; from: string; where: string } | { ok: false; reason: string };

const REF = /^([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)/u;
const WORD = /^[\p{L}_][\p{L}\p{N}_]*/u;
const NUMBER = /^\d+(?:\.\d+)?/;
const OP = /^(?:<=|>=|<>|!=|=|<|>|\+|-|\*|\/|\(|\)|,)/;
const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'BETWEEN', 'IN', 'IS', 'NULL', 'TRUE', 'FALSE']);

export function translateCondition(condition: string, rm: RelationalModel, locale: Locale = 'sr'): Translation {
  const s = STR[locale];
  const fail = (reason: string): Translation => ({ ok: false, reason });
  const attrsOf = new Map(rm.relations.map((r) => [r.name, new Set(r.attributes.map((a) => a.name))]));
  const refs: [string, string][] = [];
  let out = '';
  let unknown: string | null = null;
  let i = 0;
  while (i < condition.length) {
    const rest = condition.slice(i);
    let m: RegExpMatchArray | null;
    if (/^\s/.test(rest)) { out += rest[0]; i++; continue; }
    if ((m = rest.match(/^'(?:[^']|'')*'/))) out += m[0];
    else if ((m = rest.match(REF))) { refs.push([m[1]!, m[2]!]); out += `${q(m[1]!)}.${q(m[2]!)}`; }
    else if ((m = rest.match(NUMBER))) out += m[0];
    else if ((m = rest.match(OP))) out += m[0] === '!=' ? '<>' : m[0];
    else if ((m = rest.match(WORD)) && KEYWORDS.has(m[0].toUpperCase())) out += m[0].toUpperCase();
    else {
      m = rest.match(/^'[^]*|^[\p{L}_][\p{L}\p{N}_]*|^\S/u);
      unknown ??= m![0];
      break;
    }
    i += m[0].length;
  }
  if (refs.length === 0) return fail(s.noRefs);
  for (const [r, a] of refs) if (!attrsOf.get(r)?.has(a)) return fail(s.missing(r, a));
  if (unknown !== null) return fail(s.unknown(unknown));

  const rels = [...new Set(refs.map(([r]) => r))];
  const fks = rm.referential ?? [];
  const between = (a: string, b: string): ReferentialConstraint[] =>
    fks.filter((f) => (f.child === a && f.parent === b) || (f.child === b && f.parent === a));
  for (let x = 0; x < rels.length; x++) {
    for (let y = x + 1; y < rels.length; y++) {
      if (between(rels[x]!, rels[y]!).length > 1) return fail(s.several(rels[x]!, rels[y]!));
    }
  }
  const joined = [rels[0]!];
  const joins: string[] = [];
  const pending = rels.slice(1);
  while (pending.length > 0) {
    let progress = false;
    for (const p of pending) {
      const fk = joined.map((j) => between(j, p)[0]).find((f) => f !== undefined);
      if (!fk) continue;
      const on = fk.attributes.map((a, k) => `${q(fk.child)}.${q(a)} = ${q(fk.parent)}.${q(fk.referenced[k]!)}`).join(' AND ');
      joins.push(`JOIN ${q(p)} ON ${on}`);
      joined.push(p);
      pending.splice(pending.indexOf(p), 1);
      progress = true;
      break;
    }
    if (!progress) return fail(s.notConnected(rels.map((r) => `'${r}'`).join(', ')));
  }
  return { ok: true, from: [`FROM ${q(rels[0]!)}`, ...joins].join('\n    '), where: out.trim() };
}

const OP_ORDER = ['insert', 'update', 'delete'] as const;

/** Function + one AFTER STATEMENT trigger per check, or the reason line. */
export function generalTriggers(g: GeneralConstraint, rm: RelationalModel, locale: Locale = 'sr'): string {
  const s = STR[locale];
  const t = translateCondition(g.condition, rm, locale);
  if (!t.ok) return s.prefix + t.reason;
  const known = new Set(rm.relations.map((r) => r.name));
  const missing = g.checks.find((c) => !known.has(c.relation));
  if (missing) return s.prefix + s.noRelation(missing.relation);
  if (g.checks.length === 0) return '';
  const fn = q(`${g.name}_fn`);
  const lines = [
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$`,
    'BEGIN',
    '  IF EXISTS (',
    '    SELECT 1',
    `    ${t.from}`,
    `    WHERE NOT (${t.where})`,
    '  ) THEN',
    `    RAISE EXCEPTION '${lq(s.violated(g.name))}' USING ERRCODE = 'check_violation';`,
    '  END IF;',
    '  RETURN NULL;',
    'END;',
    '$$;',
  ];
  for (const c of g.checks) {
    const ops = OP_ORDER.filter((o) => c.ops.includes(o)).map((o) => o.toUpperCase()).join(' OR ');
    lines.push(
      `CREATE TRIGGER ${q(`${g.name}_${c.relation}`)} AFTER ${ops} ON ${q(c.relation)}`,
      `  FOR EACH STATEMENT EXECUTE FUNCTION ${fn}();`,
    );
  }
  return lines.join('\n');
}
