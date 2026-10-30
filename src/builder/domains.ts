// C10 §5: domain and cross-table-constraint actions. Pure text edits on the DSL source. No React.
import { DECL_KEYWORDS, DOMAINS } from '../lang';
import type {
  AttributeAst, ConstraintAction, ConstraintBlockAst, ConstraintOp, Domain, DomainDeclAst, IRElement, RefHeaderAst,
  RuleLineAst,
} from '../lang';
import { ALLOWED_REF_ACTIONS } from '../rm/types';
import type { RefCell } from '../rm/types';
import { generateRelationalModel } from '../rm';
import { Fail, addLineEdits, appendEdit, fail, flatAttributes, indentOf, isBlank, lineEnd, lineStart } from './doc';
import type { Doc, Edit } from './doc';
import { cleanName, formatName } from './names';
import type { DomainSpec, GeneralConstraintSpec } from './types';

/** What the planner returns (structurally the `Plan` of apply.ts, which is not imported to avoid a cycle). */
export interface DomainPlan {
  edits: Edit[];
  select?: string;
}

export const relName = (s: string): string => s.replace(/\s+/g, '');
export const isBuiltin = (s: string): s is Domain => (DOMAINS as readonly string[]).includes(s);
const clean1 = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ lookups

function domainDecls(doc: Doc): DomainDeclAst[] {
  const seen = new Set<string>();
  return (doc.ast.domains ?? []).filter((d) => !seen.has(d.name.text) && !!seen.add(d.name.text));
}
const findDomain = (doc: Doc, name: string): DomainDeclAst =>
  domainDecls(doc).find((d) => d.name.text === name) ?? fail('unknownDomain');

function findConstraint(doc: Doc, name: string): ConstraintBlockAst {
  return (doc.ast.constraints ?? []).find((c) => c.name.text === name) ?? fail('noConstraint');
}
const headerOf = (c: ConstraintBlockAst): RefHeaderAst | undefined =>
  c.lines.find((l): l is RefHeaderAst => l.kind === 'refHeader');
const rulesOf = (c: ConstraintBlockAst): RuleLineAst[] => c.lines.filter((l): l is RuleLineAst => l.kind === 'rule');

/** Every attribute of every block, with the AST nodes. */
function allAttributes(doc: Doc): AttributeAst[] {
  return doc.ast.blocks.flatMap(flatAttributes);
}

interface Use {
  /** Span of the type name in the attribute / the domain base. */
  nameSpan: { from: number; to: number };
  /** Own length given right after the name. */
  hasLength: boolean;
}
function usesOf(doc: Doc, name: string): Use[] {
  const out: Use[] = [];
  for (const a of allAttributes(doc)) {
    if (a.userDomain && a.userDomain.text === name) out.push({ nameSpan: a.userDomain.span, hasLength: !!a.length });
  }
  for (const d of doc.ast.domains ?? []) {
    if (d.base?.name && d.base.name.text === name) out.push({ nameSpan: d.base.name.span, hasLength: !!d.base.length });
  }
  return out;
}

function wouldCycle(doc: Doc, selfNames: string[], newBase: string): boolean {
  if (selfNames.includes(newBase)) return true;
  const parent = new Map<string, string>();
  for (const d of domainDecls(doc)) if (d.base?.name) parent.set(d.name.text, d.base.name.text);
  const seen = new Set<string>();
  let cur: string | undefined = newBase;
  while (cur !== undefined && !seen.has(cur)) {
    if (selfNames.includes(cur)) return true;
    seen.add(cur);
    cur = parent.get(cur);
  }
  return false;
}

// ------------------------------------------------------------------ domain lines

/** Width from the name start to the `:` of a domain line (name plus padding). */
function colonWidth(doc: Doc, d: DomainDeclAst): number {
  const idx = doc.source.indexOf(':', d.name.span.to);
  return idx >= 0 && idx < d.span.to ? idx - d.name.span.from : 0;
}

function typeText(spec: DomainSpec): string {
  if (isBuiltin(spec.base)) {
    const len = spec.base === 'string' && spec.length && spec.length > 0 ? `(${Math.floor(spec.length)})` : '';
    return spec.base + len;
  }
  return formatName(cleanName(spec.base) ?? fail('badName'));
}

function domainLine(keyword: string, spec: DomainSpec, padTo: number): string {
  const name = formatName(cleanName(spec.name) ?? fail('badName'));
  const c = clean1(spec.constraint);
  return `${keyword} ${name.padEnd(Math.max(padTo, name.length + 1))}: ${typeText(spec)}${c ? ' ' + c : ''}`;
}

/** Edit that inserts the finished domain line at the C10 §5 position. */
function insertDomainLine(doc: Doc, line: string): Edit {
  const s = doc.source;
  const nl = doc.nl;
  const decls = doc.ast.domains ?? [];
  if (decls.length > 0) {
    const last = decls.reduce((a, b) => (b.span.from > a.span.from ? b : a));
    const at = lineEnd(s, last.span.to);
    const needsNl = at === s.length && !s.endsWith('\n');
    return { from: at, to: at, text: needsNl ? nl + line : line + nl };
  }
  const firsts = [doc.ast.blocks[0]?.span.from, doc.ast.constraints?.[0]?.span.from].filter((x): x is number => x !== undefined);
  if (firsts.length === 0) return appendEdit(doc, [line]);
  const firstLine = lineStart(s, Math.min(...firsts));
  // Leading comment block: stay below it when a blank line separates it from the first block.
  let pos = 0;
  while (pos < firstLine && /^[ \t]*\/\//.test(s.slice(pos, lineEnd(s, pos)))) pos = lineEnd(s, pos);
  let at = 0;
  if (pos > 0 && pos < firstLine) {
    at = pos;
    while (at < firstLine && isBlank(s.slice(at, lineEnd(s, at)))) at = lineEnd(s, at);
  }
  return { from: at, to: at, text: line + nl + nl };
}

function keywordText(doc: Doc, d: DomainDeclAst): string {
  return doc.source.slice(d.keywordSpan.from, d.keywordSpan.to);
}

function padForNewLine(doc: Doc): number {
  const decls = doc.ast.domains ?? [];
  if (decls.length === 0) return 0;
  const last = decls.reduce((a, b) => (b.span.from > a.span.from ? b : a));
  return colonWidth(doc, last);
}

// ------------------------------------------------------------------ domain actions

function checkSpec(doc: Doc, spec: DomainSpec, selfNames: string[], oldName: string | null): string {
  const name = cleanName(spec.name) ?? fail('badName');
  if (isBuiltin(name)) fail('badName');
  if (name !== oldName && domainDecls(doc).some((d) => d.name.text === name)) fail('domainTaken');
  if (!isBuiltin(spec.base)) {
    const base = cleanName(spec.base) ?? fail('badName');
    if (wouldCycle(doc, [...selfNames, name], base)) fail('domainCycle');
    if (!domainDecls(doc).some((d) => d.name.text === base)) fail('unknownDomain');
  }
  return name;
}

export function addDomain(doc: Doc, spec: DomainSpec): DomainPlan {
  checkSpec(doc, spec, [], null);
  const line = domainLine(DECL_KEYWORDS[doc.locale].domain, spec, padForNewLine(doc));
  return { edits: [insertDomainLine(doc, line)] };
}

export function editDomain(doc: Doc, oldName: string, spec: DomainSpec): DomainPlan {
  const d = findDomain(doc, oldName);
  const name = checkSpec(doc, spec, [oldName], oldName);
  const line = domainLine(keywordText(doc, d), spec, colonWidth(doc, d));
  const edits: Edit[] = [{ from: d.span.from, to: d.span.to, text: line }];
  if (name !== oldName) {
    for (const u of usesOf(doc, oldName)) edits.push({ from: u.nameSpan.from, to: u.nameSpan.to, text: formatName(name) });
  }
  return { edits };
}

export function deleteDomain(doc: Doc, name: string, replace: boolean): DomainPlan {
  const d = findDomain(doc, name);
  const uses = usesOf(doc, name);
  const edits: Edit[] = [removalEdit(doc, d.span)];
  if (uses.length === 0) return { edits };
  if (!replace) throw new Fail('domainUsed', { dependents: [], usages: uses.length }, uses.length);
  if (!d.base) fail();
  const base = d.base as NonNullable<DomainDeclAst['base']>;
  const type = base.builtin ?? formatName(base.name?.text ?? fail());
  const len = base.builtin === 'string' && base.length ? `(${base.length.value})` : '';
  for (const u of uses) {
    edits.push({ from: u.nameSpan.from, to: u.nameSpan.to, text: type + (u.hasLength ? '' : len) });
  }
  return { edits };
}

export function extractDomain(doc: Doc, attr: AttributeAst): DomainPlan {
  if (!attr.domain) fail('noDomain');
  const dom = attr.domain as NonNullable<AttributeAst['domain']>;
  const taken = new Set([...domainDecls(doc).map((d) => d.name.text), ...DOMAINS]);
  const base = attr.name.text;
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}${n}`;
  const spec: DomainSpec = {
    name,
    base: dom.value,
    length: attr.length?.value ?? null,
    constraint: attr.constraint?.text ?? null,
  };
  const line = domainLine(DECL_KEYWORDS[doc.locale].domain, spec, padForNewLine(doc));
  return {
    edits: [
      insertDomainLine(doc, line),
      { from: dom.span.from, to: attr.span.to, text: formatName(name) },
    ],
  };
}

// ------------------------------------------------------------------ constraint blocks

/** Removes whole lines of a block plus one adjacent blank line (the following one, else the preceding one at EOF). */
export function removalEdit(doc: Doc, span: { from: number; to: number }): Edit {
  const s = doc.source;
  const ls = lineStart(s, span.from);
  const le = lineEnd(s, Math.max(span.to - 1, span.from));
  if (!isBlank(s.slice(ls, span.from)) || !isBlank(s.slice(span.to, le))) return { from: span.from, to: span.to, text: '' };
  let from = ls;
  let to = le;
  const nextEnd = lineEnd(s, to);
  if (to < s.length && isBlank(s.slice(to, nextEnd))) to = nextEnd;
  else if (to >= s.length && from > 0) {
    const prevStart = lineStart(s, from - 1);
    if (isBlank(s.slice(prevStart, from))) from = prevStart;
  }
  return { from, to, text: '' };
}

const kwOf = (doc: Doc, c: ConstraintBlockAst): string => doc.source.slice(c.kindSpan.from, c.kindSpan.to);

function cellTarget(child: string, parent: string, cell: RefCell): { rel: string; op: ConstraintOp } {
  switch (cell) {
    case 'childInsert': return { rel: child, op: 'insert' };
    case 'childUpdate': return child === parent ? fail('cellNotSettable') : { rel: child, op: 'update' };
    case 'parentUpdate': return { rel: parent, op: 'update' };
    case 'parentDelete': return { rel: parent, op: 'delete' };
  }
}

export function setReferentialAction(
  doc: Doc, child: string, parent: string, attrs: string[], cell: RefCell, action: ConstraintAction, constraint: string | null,
): DomainPlan {
  if (!ALLOWED_REF_ACTIONS[cell].includes(action)) fail('actionNotAllowed');
  const { rel, op } = cellTarget(child, parent, cell);
  const item = `${op} ${action}`;
  if (constraint === null) {
    const taken = new Set((doc.ast.constraints ?? []).map((c) => c.name.text));
    const base = `${child}${parent}`;
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}${n}`;
    const list = attrs.length > 0 ? `(${attrs.map(formatName).join(', ')})` : '';
    const text = [
      `${DECL_KEYWORDS[doc.locale].constraint} ${formatName(name)} {`,
      `  ${formatName(child)}${list} -> ${formatName(parent)}`,
      `  ${formatName(rel)} : ${item}`,
      '}',
    ].join('\n');
    return { edits: [appendEdit(doc, [text])] };
  }
  const block = findConstraint(doc, constraint);
  if (!headerOf(block)) fail('noConstraint');
  const lines = rulesOf(block).filter((r) => relName(r.relation.text) === rel);
  for (const r of lines) {
    const found = r.items.find((i) => i.op.value === op);
    if (found) return { edits: [{ from: found.span.from, to: found.span.to, text: item }] };
  }
  const lastLine = lines[0];
  const lastItem = lastLine?.items.at(-1);
  if (lastItem) return { edits: [{ from: lastItem.span.to, to: lastItem.span.to, text: `, ${item}` }] };
  const all = rulesOf(block);
  let padTo = 0;
  const lastRule = all.at(-1);
  if (lastRule) {
    const idx = doc.source.indexOf(':', lastRule.relation.span.to);
    if (idx >= 0 && idx < lastRule.span.to) padTo = idx - lastRule.relation.span.from;
  }
  const name = formatName(rel);
  const lineText = `${padTo > name.length ? name.padEnd(padTo) : name + ' '}: ${item}`;
  return { edits: addLineEdits(doc, block, lineText, lastRule?.span ?? headerOf(block)?.span) };
}

export function resetReferential(doc: Doc, name: string): DomainPlan {
  const c = findConstraint(doc, name);
  if (!headerOf(c)) fail('noConstraint');
  return { edits: [removalEdit(doc, c.span)] };
}

export function deleteConstraint(doc: Doc, name: string): DomainPlan {
  return { edits: [removalEdit(doc, findConstraint(doc, name).span)] };
}

function constraintText(keyword: string, condKw: string, spec: GeneralConstraintSpec, nl: string, indent: string): string {
  const name = formatName(cleanName(spec.name) ?? fail('badName'));
  const cond = clean1(spec.condition);
  const checks = spec.checks.filter((c) => c.ops.length > 0 && cleanName(c.relation) !== null);
  if (cond === '' || checks.length === 0) fail('badCondition');
  const names = checks.map((c) => formatName(relName(c.relation)));
  const width = Math.max(...names.map((n) => n.length));
  const lines = checks.map((c, i) => {
    const ops = [...new Set(c.ops)].map((o) => `${o} restricted`).join(', ');
    return `  ${(names[i] as string).padEnd(width)} : ${ops}`;
  });
  return [`${keyword} ${name} {`, `  ${condKw}: ${cond}`, ...lines, '}'].join(nl + indent);
}

function ensureFreeName(doc: Doc, name: string, own: string | null): void {
  if (name !== own && (doc.ast.constraints ?? []).some((c) => c.name.text === name)) fail('constraintTaken');
}

export function addConstraint(doc: Doc, spec: GeneralConstraintSpec): DomainPlan {
  ensureFreeName(doc, cleanName(spec.name) ?? fail('badName'), null);
  const kws = DECL_KEYWORDS[doc.locale];
  return { edits: [appendEdit(doc, [constraintText(kws.constraint, kws.condition, spec, '\n', '')])] };
}

export function editConstraint(doc: Doc, name: string, spec: GeneralConstraintSpec): DomainPlan {
  const block = findConstraint(doc, name);
  if (!block.lines.some((l) => l.kind === 'condition')) fail('noConstraint');
  ensureFreeName(doc, cleanName(spec.name) ?? fail('badName'), name);
  const cond = block.lines.find((l) => l.kind === 'condition');
  const condKw = cond && cond.kind === 'condition' ? doc.source.slice(cond.keywordSpan.from, cond.keywordSpan.to) : DECL_KEYWORDS[doc.locale].condition;
  const text = constraintText(kwOf(doc, block), condKw, spec, doc.nl, indentOf(doc.source, block.span.from));
  return { edits: [{ from: block.span.from, to: block.span.to, text }] };
}

// ------------------------------------------------------------------ effects on other actions

const REF_RE = /([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)/gu;

interface CondRef {
  relation: string;
  attribute: string;
  /** Absolute offsets of the relation and attribute parts. */
  relFrom: number;
  attrFrom: number;
}
function condRefs(doc: Doc, c: ConstraintBlockAst): CondRef[] {
  const out: CondRef[] = [];
  for (const l of c.lines) {
    if (l.kind !== 'condition') continue;
    const text = doc.source.slice(l.textSpan.from, l.textSpan.to);
    for (const m of text.matchAll(REF_RE)) {
      const rel = m[1] as string;
      const attr = m[2] as string;
      const at = l.textSpan.from + (m.index ?? 0);
      out.push({ relation: rel, attribute: attr, relFrom: at, attrFrom: at + rel.length + 1 });
    }
  }
  return out;
}

/** `ograničenje` blocks that mention any of the relations (header, rule line or `Rel.` reference). */
export function constraintsMentioning(doc: Doc, rels: Set<string>): ConstraintBlockAst[] {
  if (rels.size === 0) return [];
  return (doc.ast.constraints ?? []).filter((c) => {
    const h = headerOf(c);
    if (h && (rels.has(relName(h.child.text)) || rels.has(relName(h.parent.text)))) return true;
    if (rulesOf(c).some((r) => rels.has(relName(r.relation.text)))) return true;
    return condRefs(doc, c).some((r) => rels.has(r.relation));
  });
}

/** Relation name of an element, or null for elements that are not relations (unnamed veza, specijalizacija). */
export function relationOf(el: IRElement): string | null {
  if (el.kind === 'specijalizacija' || el.id.startsWith('_#')) return null;
  return relName(el.name);
}

export function renameRelationEdits(doc: Doc, oldRel: string, newName: string): Edit[] {
  const newRel = relName(newName);
  if (oldRel === newRel || oldRel === '' ) return [];
  const edits: Edit[] = [];
  const text = formatName(newName);
  for (const c of doc.ast.constraints ?? []) {
    const h = headerOf(c);
    if (h) {
      for (const n of [h.child, h.parent]) {
        if (relName(n.text) === oldRel) edits.push({ from: n.span.from, to: n.span.to, text });
      }
    }
    for (const r of rulesOf(c)) {
      if (relName(r.relation.text) === oldRel) edits.push({ from: r.relation.span.from, to: r.relation.span.to, text });
    }
    for (const r of condRefs(doc, c)) {
      if (r.relation === oldRel) edits.push({ from: r.relFrom, to: r.relFrom + r.relation.length, text: newRel });
    }
  }
  return edits;
}

/** `Rel.attr` keys of the attribute and of every foreign-key attribute that borrows its name from it. */
export function attributeAliases(doc: Doc, rel: string, attr: string): Set<string> {
  const keys = new Set<string>([`${rel}.${attr}`]);
  for (const dg0Mode of ['fk', 'relation'] as const) {
    let model;
    try {
      model = generateRelationalModel(doc.ir, { dg0Mode });
    } catch {
      continue;
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of model.relations) {
        for (const a of r.attributes) {
          const key = `${r.name}.${a.name}`;
          if (a.name === attr && a.references && keys.has(`${a.references.relation}.${a.references.attribute}`) && !keys.has(key)) {
            keys.add(key);
            grew = true;
          }
        }
      }
    }
  }
  return keys;
}

export function renameAttributeEdits(doc: Doc, rel: string, oldName: string, newName: string): Edit[] {
  if (!doc.ast.constraints?.length || oldName === newName) return [];
  const keys = attributeAliases(doc, rel, oldName);
  const edits: Edit[] = [];
  for (const c of doc.ast.constraints) {
    const h = headerOf(c);
    if (h?.attrs && keys.has(`${relName(h.child.text)}.${oldName}`)) {
      for (const a of h.attrs) if (a.text === oldName) edits.push({ from: a.span.from, to: a.span.to, text: formatName(newName) });
    }
    for (const r of condRefs(doc, c)) {
      if (r.attribute === oldName && keys.has(`${r.relation}.${r.attribute}`)) {
        edits.push({ from: r.attrFrom, to: r.attrFrom + r.attribute.length, text: newName });
      }
    }
  }
  return edits;
}

/** Constraint blocks that mention the attribute (header attribute list or `Rel.attr` reference). */
export function constraintsMentioningAttribute(doc: Doc, rel: string, attr: string): ConstraintBlockAst[] {
  if (!doc.ast.constraints?.length) return [];
  const keys = attributeAliases(doc, rel, attr);
  return doc.ast.constraints.filter((c) => {
    const h = headerOf(c);
    if (h?.attrs && keys.has(`${relName(h.child.text)}.${attr}`) && h.attrs.some((a) => a.text === attr)) return true;
    return condRefs(doc, c).some((r) => r.attribute === attr && keys.has(`${r.relation}.${r.attribute}`));
  });
}
