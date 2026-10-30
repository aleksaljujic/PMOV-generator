import type { ConstraintAction, IRDomain, Locale, PmovIR } from '../lang';
import { collectFkGroups, fkKindOf } from './constraints';
import { childTrigger, generalTriggers } from './triggers';
import { DEFAULT_REF_ACTIONS } from './types';
import { DEFAULT_SQL_DIALECT } from './types';
import type { RefCell, ReferentialConstraint, RelAttribute, RelationalModel, SqlDialect } from './types';

const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;
const qMs = (s: string): string => `[${s.replace(/]/g, ']]')}]`;
const quoteOf = (d: SqlDialect): ((s: string) => string) => (d === 'mssql' ? qMs : q);
const strip = (s: string): string => s.replace(/\s+/g, '');

function builtinType(
  domain: RelAttribute['domain'], length: number | null | undefined, dialect: SqlDialect = 'postgres',
): string {
  const n = length != null ? length : 255;
  switch (domain) {
    case 'long': return dialect === 'oracle' ? 'NUMBER(19)' : 'BIGINT';
    case 'short': return dialect === 'oracle' ? 'NUMBER(5)' : 'SMALLINT';
    case 'date': return 'DATE';
    default:
      if (dialect === 'mssql') return n > 4000 ? 'NVARCHAR(MAX)' : `NVARCHAR(${n})`;
      if (dialect === 'oracle') return `VARCHAR2(${n} CHAR)`;
      return `VARCHAR(${n})`;
  }
}

function sqlType(a: RelAttribute, dialect: SqlDialect = 'postgres'): string {
  if (a.userDomain != null) return q(strip(a.userDomain));
  return builtinType(a.domain, a.domain === 'string' ? a.length : null, dialect);
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

const NUM = /^-?\d+(\.\d+)?$/;
const lit = (x: string, prefix = ''): string =>
  (NUM.test(x) ? x : `${prefix}'${x.replace(/^'|'$/g, '').replace(/'/g, "''")}'`);

interface Translated { notNull: boolean; checks: string[]; rest: string[] }

/** C10 §3 CHECK translation of a domain constraint text. */
export function translateConstraint(text: string | null, valueRef = 'VALUE', strPrefix = ''): Translated {
  const out: Translated = { notNull: false, checks: [], rest: [] };
  if (!text) return out;
  for (const raw of text.split(/\s+And\s+/i)) {
    const part = raw.trim();
    if (part === '') continue;
    let m: RegExpMatchArray | null;
    if (/^NotNull$/i.test(part)) out.notNull = true;
    else if ((m = part.match(/^Between\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/i))) out.checks.push(`${valueRef} BETWEEN ${m[1]} AND ${m[2]}`);
    else if ((m = part.match(/^In\s*\((.*)\)$/i)) && m[1]!.trim() !== '') {
      out.checks.push(`${valueRef} IN (${m[1]!.split(',').map((x) => lit(x.trim(), strPrefix)).join(', ')})`);
    } else if ((m = part.match(/^(>=|<=|<>|>|<|=)\s*(-?\d+(?:\.\d+)?)$/))) out.checks.push(`${valueRef} ${m[1]} ${m[2]}`);
    else out.rest.push(part);
  }
  return out;
}

function orderDomains(domains: IRDomain[]): { ordered: IRDomain[]; byName: Map<string, IRDomain> } {
  const byName = new Map<string, IRDomain>();
  for (const d of domains) if (!byName.has(d.name)) byName.set(d.name, d);
  const ordered: IRDomain[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (d: IRDomain): void => {
    if (state.has(d.name)) return;
    state.set(d.name, 1);
    const p = d.parent !== null ? byName.get(d.parent) : undefined;
    if (p) visit(p);
    state.set(d.name, 2);
    ordered.push(d);
  };
  for (const d of byName.values()) visit(d);
  return { ordered, byName };
}

function domainStatements(domains: IRDomain[]): string[] {
  const { ordered, byName } = orderDomains(domains);
  return ordered.map((d) => {
    const t = translateConstraint(d.constraint);
    const hasParent = d.parent !== null && byName.has(d.parent);
    const type = hasParent ? q(strip(d.parent!)) : builtinType(d.base, d.length);
    let s = `CREATE DOMAIN ${q(strip(d.name))} AS ${type}`;
    if (t.notNull) s += ' NOT NULL';
    if (t.checks.length > 0) s += ` CHECK (${t.checks.join(' AND ')})`;
    s += ';';
    if (t.rest.length > 0) s += `\n-- ${t.rest.join(' And ')}`;
    return s;
  });
}

const SQL_ACTION: Record<ConstraintAction, string> = {
  restricted: 'RESTRICT', cascades: 'CASCADE', nullifies: 'SET NULL', default: 'SET DEFAULT',
};
const MSSQL_ACTION: Record<ConstraintAction, string> = { ...SQL_ACTION, restricted: 'NO ACTION' };

/** Inlined-domain description of a column for mssql / oracle. */
interface InlineDomain { type: string; notNull: boolean; checks: string[]; rest: string[] }

function inlineDomain(d: IRDomain, dialect: SqlDialect, col: string | null): InlineDomain {
  const t = translateConstraint(d.effectiveConstraint, col ?? 'VALUE', dialect === 'mssql' ? 'N' : '');
  return { type: builtinType(d.base, d.length, dialect), notNull: t.notNull, checks: t.checks, rest: t.rest };
}

/** Domain section for the inlining dialects: a comment block. */
function inlinedDomainComment(domains: IRDomain[], dialect: SqlDialect, en: boolean): string {
  const head = dialect === 'mssql'
    ? (en ? 'SQL Server has no CREATE DOMAIN; domains are inlined into columns.' : 'SQL Server nema CREATE DOMAIN; domeni su ugrađeni u kolone.')
    : (en ? 'Oracle 19c has no CREATE DOMAIN; domains are inlined into columns.' : 'Oracle 19c nema CREATE DOMAIN; domeni su ugrađeni u kolone.');
  const lines = [`-- ${head}`];
  for (const d of orderDomains(domains).ordered) {
    const i = inlineDomain(d, dialect, null);
    let def = i.type;
    if (i.notNull) def += ' NOT NULL';
    if (i.checks.length > 0) def += ` CHECK (${i.checks.join(' AND ')})`;
    if (i.rest.length > 0) def += `; ${i.rest.join(' And ')}`;
    lines.push(`-- ${en ? 'domain' : 'domen'} ${d.name}: ${def}`);
  }
  return lines.join('\n');
}

interface FkClauses { clauses: string; comments: string[] }

/** Action clauses and comment lines for one FK on mssql / oracle. `downgrade` = mssql multiple-cascade-path. */
function fkActions(
  c: ReferentialConstraint, dialect: SqlDialect, downgrade: boolean, qt: (s: string) => string, en: boolean,
): FkClauses {
  const trigger = en ? '(requires a trigger)' : '(zahteva okidač)';
  const paths = en ? '(SQL Server: multiple cascade paths, requires a trigger)' : '(SQL Server: višestruke kaskadne putanje, zahteva okidač)';
  const comments: string[] = [];
  const cell = (label: string, act: ConstraintAction): string | null => {
    if (dialect === 'mssql') {
      if (downgrade) {
        if (MSSQL_ACTION[act] !== 'NO ACTION') comments.push(`-- ${qt(c.parent)} ${label}: ${act.toUpperCase()} ${paths}`);
        return 'NO ACTION';
      }
      return MSSQL_ACTION[act];
    }
    // oracle
    if (label === 'UPDATE') {
      if (act !== 'restricted') comments.push(`-- ${qt(c.parent)} UPDATE: ${act.toUpperCase()} ${trigger}`);
      return null;
    }
    if (act === 'restricted') return null;
    if (act === 'default') { comments.push(`-- ${qt(c.parent)} DELETE: DEFAULT ${trigger}`); return null; }
    return SQL_ACTION[act];
  };
  const u = cell('UPDATE', c.actions.parentUpdate);
  const d = cell('DELETE', c.actions.parentDelete);
  const clauses = (u ? ` ON UPDATE ${u}` : '') + (d ? ` ON DELETE ${d}` : '');
  return { clauses, comments };
}

/** SQL Server: names of the FKs that must be downgraded (see feature spec, multiple cascade paths). */
function mssqlDowngraded(refs: ReferentialConstraint[]): Set<ReferentialConstraint> {
  const out = new Set<ReferentialConstraint>();
  const edges: [string, string][] = [];
  const up = (x: string): Set<string> => {
    const seen = new Set<string>([x]);
    const stack = [x];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const [p, ch] of edges) if (ch === cur && !seen.has(p)) { seen.add(p); stack.push(p); }
    }
    return seen;
  };
  for (const c of refs) {
    const cascading = MSSQL_ACTION[c.actions.parentUpdate] !== 'NO ACTION' || MSSQL_ACTION[c.actions.parentDelete] !== 'NO ACTION';
    if (!cascading) continue;
    const a = up(c.parent);
    const b = up(c.child);
    if ([...a].some((x) => b.has(x))) out.add(c);
    else edges.push([c.parent, c.child]);
  }
  return out;
}

/** Derived constraints for an RM built without `referential` (hand-written models). */
function fallbackReferential(rm: RelationalModel): ReferentialConstraint[] {
  const counts = new Map<string, number>();
  return collectFkGroups(rm.relations).map((g) => {
    const kind = fkKindOf(g.attrs, false);
    const base = `fk_${g.child}_${g.parent}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return {
      name: n === 1 ? base : `${base}_${n}`, constraintId: null, child: g.child, parent: g.parent,
      attributes: g.attrs.map((a) => a.name), referenced: g.attrs.map((a) => a.references!.attribute),
      group: g.group, fkKind: kind, actions: { ...DEFAULT_REF_ACTIONS[kind] }, explicitCells: [],
    };
  });
}

export function generateSql(
  rm: RelationalModel,
  ir?: PmovIR,
  locale: Locale = 'sr',
  dialect: SqlDialect = DEFAULT_SQL_DIALECT,
): string {
  const en = locale === 'en';
  const qt = quoteOf(dialect);
  const inline = dialect !== 'postgres';
  const sections: string[] = [];
  const domains = ir?.domains ?? [];
  if (domains.length > 0) {
    sections.push(inline ? inlinedDomainComment(domains, dialect, en) : domainStatements(domains).join('\n'));
  }
  const domainByName = new Map<string, IRDomain>();
  for (const d of domains) if (!domainByName.has(d.name)) domainByName.set(d.name, d);

  const blocks: string[] = [];
  for (const r of rm.relations) {
    const pk = r.attributes.filter((a) => a.pk);
    const lines: string[] = [];
    r.attributes.forEach((a, i) => {
      let notNull = a.pk || (a.fk && !a.nullable) || (a.constraint !== null && NOT_NULL.test(a.constraint));
      const last = i === r.attributes.length - 1 && pk.length === 0;
      const parts: string[] = [];
      const own = commentOf(a.constraint);
      if (own) parts.push(own);
      let type: string;
      let check = '';
      const dom = inline && a.userDomain != null ? domainByName.get(strip(a.userDomain)) : undefined;
      if (dom) {
        const inl = inlineDomain(dom, dialect, qt(a.name));
        type = inl.type;
        if (inl.notNull) notNull = true;
        if (inl.checks.length > 0) check = ` CHECK (${inl.checks.join(' AND ')})`;
        if (inl.rest.length > 0) parts.push(inl.rest.join(' And '));
      } else if (inline && a.userDomain != null) {
        type = builtinType(a.domain, a.domain === 'string' ? a.length : null, dialect);
      } else {
        type = sqlType(a, dialect);
      }
      const comment = parts.join('; ');
      lines.push(`  ${qt(a.name)} ${type}${notNull ? ' NOT NULL' : ''}${check}${last ? '' : ','}${comment ? ` -- ${comment}` : ''}`);
    });
    if (pk.length > 0) lines.push(`  PRIMARY KEY (${pk.map((a) => qt(a.name)).join(', ')})`);
    blocks.push(`CREATE TABLE ${qt(r.name)} (\n${lines.join('\n')}\n);`);
  }
  if (blocks.length > 0) sections.push(blocks.join('\n\n'));

  const trigger = en ? '(requires a trigger)' : '(zahteva okidač)';
  const alters: string[] = [];
  const refs = rm.referential ?? fallbackReferential(rm);
  const downgraded = dialect === 'mssql' ? mssqlDowngraded(refs) : new Set<ReferentialConstraint>();
  for (const c of refs) {
    let actions: FkClauses;
    if (dialect === 'postgres') {
      actions = { clauses: ` ON UPDATE ${SQL_ACTION[c.actions.parentUpdate]} ON DELETE ${SQL_ACTION[c.actions.parentDelete]}`, comments: [] };
    } else {
      actions = fkActions(c, dialect, downgraded.has(c), qt, en);
    }
    alters.push(
      `ALTER TABLE ${qt(c.child)} ADD CONSTRAINT ${qt(c.name)} FOREIGN KEY (${c.attributes.map(qt).join(', ')}) ` +
      `REFERENCES ${qt(c.parent)} (${c.referenced.map(qt).join(', ')})${actions.clauses};`,
    );
    alters.push(...actions.comments);
    const childCells: [RefCell, string][] = [['childInsert', 'INSERT'], ['childUpdate', 'UPDATE']];
    for (const [cell, label] of childCells) {
      const act = c.actions[cell];
      if (act === 'restricted') continue;
      if (dialect === 'postgres' && (act === 'nullifies' || act === 'default')) alters.push(childTrigger(c, cell as 'childInsert' | 'childUpdate', locale));
      else alters.push(`-- ${qt(c.child)} ${label}: ${act.toUpperCase()} ${trigger}`);
    }
  }
  if (alters.length > 0) sections.push(alters.join('\n'));

  const asserts: string[] = [];
  for (const g of rm.general ?? []) {
    const where = g.checks.map((ch) => `${ch.relation} ${ch.ops.map((o) => o.toUpperCase()).join(', ')}`).join('; ');
    asserts.push(en ? `-- constraint ${g.name} (checked on: ${where})` : `-- ograničenje ${g.name} (proverava se: ${where})`);
    asserts.push(`-- CREATE ASSERTION ${qt(g.name)} CHECK (${g.condition});`);
    if (dialect === 'postgres') {
      const tr = generalTriggers(g, rm, locale);
      if (tr) asserts.push(tr);
    }
  }
  if (asserts.length > 0) sections.push(asserts.join('\n'));

  return sections.join('\n\n') + '\n';
}
