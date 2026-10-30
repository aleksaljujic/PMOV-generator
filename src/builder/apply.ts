// applyBuilderAction: contract C09. Pure text edits on the DSL source. No React.
import { BLOCK_KIND_KEYWORDS, ROLE_KEYWORDS, parse } from '../lang';
import type { BlockKind, Locale, Role } from '../lang';
import type { AttributeAst, BlockAst, IRElement, IRParticipant } from '../lang';
import {
  Fail, addLineEdits, applyEdits, appendEdit, blockIds, blockIndex, blockOf, element, fail, flatAttributes,
  isUnnamed, loadDoc, participantAt, participantLines, indentOf, isMultiline, rewriteLines,
} from './doc';
import type { Doc, Edit } from './doc';
import { pickRejectionKey } from './pick';
import { cleanName, formatName, placeholderName } from './names';
import {
  addConstraint, addDomain, constraintsMentioning, constraintsMentioningAttribute, deleteConstraint, deleteDomain, editConstraint,
  editDomain, extractDomain, relationOf, removalEdit, renameAttributeEdits, renameRelationEdits, resetReferential,
  setReferentialAction,
} from './domains';
import { MESSAGES } from './types';
import type { MsgKey } from './types';
import type { AttributeSpec, BuilderOptions, BuilderAction, BuilderResult, NewObject, Placement, PlaceholderKind } from './types';

type Ok = Extract<BuilderResult, { ok: true }>;
export interface Plan {
  edits: Edit[];
  select?: string;
  placeAt?: Placement[];
  /** Maps old block index → new block index (-1 = removed); identity when omitted. */
  blockMap?: number[];
  renames?: { from: string; to: string }[];
}

const isNew = (x: string | NewObject): x is NewObject => typeof x !== 'string';
const CARD_DEFAULT_FIRST = '(1,1)';
const CARD_DEFAULT_OTHER = '(0,M)';

export function applyBuilderAction(source: string, action: BuilderAction, options?: BuilderOptions): BuilderResult {
  const locale: Locale = options?.locale ?? 'sr';
  try {
    if (action.kind === 'newModel') {
      const name = placeholderName(null, 'objekat', [], locale);
      return { ok: true, source: `${kw(locale, 'objekat')} ${name} {\n}\n`, select: name };
    }
    const doc = loadDoc(source, locale);
    const plan = plan_(doc, action);
    const next = applyEdits(source, plan.edits);
    const re = parse(next);
    if (re.diagnostics.some((d) => d.code.startsWith('S'))) return fail();
    const out: Ok = { ok: true, source: next };
    if (plan.select !== undefined) out.select = plan.select;
    if (plan.placeAt) out.placeAt = plan.placeAt;
    const renames = [...computeRenames(doc, blockIds(re.ast), plan.blockMap), ...(plan.renames ?? [])];
    if (renames.length > 0) out.renames = renames;
    if (action.kind === 'rename') {
      const idx = blockIndex(doc, action.element);
      const id = blockIds(re.ast)[idx];
      if (id) out.select = id;
    }
    return out;
  } catch (e) {
    if (e instanceof Fail) {
      const message = MESSAGES[locale][e.key].replace('{n}', String(e.n ?? ''));
      if (!e.extra) return { ok: false, message };
      const nc: NonNullable<Extract<BuilderResult, { ok: false }>['needsConfirmation']> = { dependents: e.extra.dependents };
      if (e.extra.usages !== undefined) nc.usages = e.extra.usages;
      if (e.extra.constraints !== undefined) nc.constraints = e.extra.constraints;
      return { ok: false, message, needsConfirmation: nc };
    }
    return { ok: false, message: MESSAGES[locale].failed };
  }
}

// ------------------------------------------------------------------ helpers

const kw = (locale: Locale, kind: BlockKind): string => BLOCK_KIND_KEYWORDS[locale][kind];
const role = (doc: Doc, r: Role): string => ROLE_KEYWORDS[doc.locale][r];

function fresh(doc: Doc, kind: PlaceholderKind, taken: string[]): string {
  const name = placeholderName(doc.ir, kind, [...doc.names, ...taken], doc.locale);
  taken.push(name);
  return name;
}

function endpoint(doc: Doc, id: string): IRElement {
  const el = element(doc, id);
  return el.kind === 'objekat' || el.kind === 'slab' || el.kind === 'agregacija' ? el : fail();
}

const objectBlock = (doc: Doc, name: string): string => `${kw(doc.locale, 'objekat')} ${formatName(name)} {\n}`;

/** Rows `name (c) [mapping]` with the cardinality column aligned. */
function rows(items: { name: string; rest: string; prefix?: string }[], indent = '  '): string[] {
  const width = Math.max(...items.map((i) => formatName(i.name).length));
  return items.map((i) => `${indent}${i.prefix ?? ''}${formatName(i.name).padEnd(width)} ${i.rest}`.trimEnd());
}

function attrText(a: AttributeSpec, padTo = 0): string {
  const name = (cleanName(a.name) ?? fail('badName')) as string;
  const head = formatName(name) + (a.id ? '#' : '');
  const user = a.userDomain ? formatName(cleanName(a.userDomain) ?? fail('badName')) : null;
  const type = user ?? a.domain;
  if (!type) return head;
  const c = (a.constraint ?? '').replace(/\s+/g, ' ').trim();
  const left = head.length < padTo ? head.padEnd(padTo) + ': ' : head + ' : ';
  const len = !user && a.domain === 'string' && a.length && a.length > 0 ? `(${Math.floor(a.length)})` : '';
  return `${left}${type}${len}${c ? ' ' + c : ''}`;
}

function colonOffset(doc: Doc, a: AttributeAst): number | null {
  const idx = doc.source.indexOf(':', (a.hashSpan ?? a.name.span).to);
  return (a.domain || a.userDomain) && idx >= 0 && idx < a.span.to ? idx - a.span.from : null;
}

function attributeAt(b: BlockAst, index: number): { attr: AttributeAst; line: BlockAst['lines'][number] & { kind: 'attributeLine' }; pos: number } {
  let i = 0;
  for (const l of b.lines) {
    if (l.kind !== 'attributeLine') continue;
    for (let p = 0; p < l.attributes.length; p++) {
      if (i === index) return { attr: l.attributes[p] as AttributeAst, line: l, pos: p };
      i++;
    }
  }
  return fail();
}

function hasAttributes(el: IRElement): boolean {
  return el.kind === 'objekat' || el.kind === 'slab' || el.kind === 'agregacija';
}

/** Node ids (C05) that change when element `from` becomes `to`. */
function nodeRenames(el: IRElement, from: string, to: string): { from: string; to: string }[] {
  const out = [{ from, to }];
  if (el.kind === 'specijalizacija') {
    out.push({ from: `spec:${from}`, to: `spec:${to}` }, { from: `junction:${from}`, to: `junction:${to}` });
  }
  if (hasAttributes(el) && 'attributes' in el) {
    const count = new Map<string, number>();
    for (const a of el.attributes) {
      const n = (count.get(a.name) ?? 0) + 1;
      count.set(a.name, n);
      const sfx = n > 1 ? `~${n}` : '';
      out.push({ from: `attr:${from}:${a.name}${sfx}`, to: `attr:${to}:${a.name}${sfx}` });
    }
  }
  return out;
}

function computeRenames(doc: Doc, newIds: string[], blockMap?: number[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  doc.ids.forEach((oldId, i) => {
    if (oldId === '') return;
    const j = blockMap ? (blockMap[i] ?? -1) : i;
    const nid = j >= 0 ? newIds[j] : undefined;
    if (!nid || nid === oldId) return;
    const el = doc.ir.elements.find((e) => e.id === oldId);
    if (el) out.push(...nodeRenames(el, oldId, nid));
  });
  return out;
}

function participantIn(doc: Doc, el: IRElement, index: number): { block: BlockAst; p: IRParticipant } {
  const block = blockOf(doc, el.id);
  let list: IRParticipant[];
  switch (el.kind) {
    case 'veza': list = el.participants; break;
    case 'agregacija': list = el.components; break;
    case 'slab': list = el.owner ? [el.owner] : []; break;
    case 'specijalizacija': list = el.supertype ? [el.supertype] : []; break;
    default: return fail();
  }
  const p = list[index];
  return p ? { block, p } : fail();
}

// ------------------------------------------------------------------ planner

function plan_(doc: Doc, a: BuilderAction): Plan {
  switch (a.kind) {
    case 'newModel': return fail();
    case 'addObject': return addObject(doc, a.near);
    case 'addVeza': return addVeza(doc, a.from, a.to);
    case 'addSlab': return addSlab(doc, a.parent);
    case 'addAgregacija': return addAgregacija(doc, a.first, a.second);
    case 'addComponent': return addComponent(doc, a.agregacija, a.component);
    case 'addSpecijalizacija': return addSpecijalizacija(doc, a.nadtip);
    case 'addPodtip': return addPodtip(doc, a.specijalizacija, a.podtip);
    case 'removePodtip': return removePodtip(doc, a.specijalizacija, a.podtip, a.withDependents);
    case 'addAttribute': return addAttribute(doc, a.owner, a.attr);
    case 'editAttribute': return editAttribute(doc, a.owner, a.index, a.attr);
    case 'deleteAttribute': return deleteAttribute(doc, a.owner, a.index, a.withDependents ?? false);
    case 'rename': return rename(doc, a.element, a.newName);
    case 'setCardinality': return setCardinality(doc, a.element, a.participantIndex, a.dg, a.gg);
    case 'setMappingName': return setMappingName(doc, a.element, a.participantIndex, a.name);
    case 'deleteElement': return deleteElement(doc, a.element, a.withDependents);
    case 'addDomain': return addDomain(doc, a.domain);
    case 'editDomain': return editDomain(doc, a.name, a.domain);
    case 'deleteDomain': return deleteDomain(doc, a.name, a.replace);
    case 'extractDomain': {
      const el = element(doc, a.owner);
      if (!hasAttributes(el)) return fail();
      return extractDomain(doc, attributeAt(blockOf(doc, a.owner), a.index).attr);
    }
    case 'setReferentialAction':
      return setReferentialAction(doc, a.child, a.parent, a.attrs, a.cell, a.action, a.constraint);
    case 'resetReferential': return resetReferential(doc, a.constraint);
    case 'addConstraint': return addConstraint(doc, a.spec);
    case 'editConstraint': return editConstraint(doc, a.name, a.spec);
    case 'deleteConstraint': return deleteConstraint(doc, a.name);
  }
}

function addObject(doc: Doc, near: string): Plan {
  element(doc, near);
  const name = fresh(doc, 'objekat', []);
  return {
    edits: [appendEdit(doc, [objectBlock(doc, name)])],
    select: name,
    placeAt: [{ id: name, near, dir: 'right' }],
  };
}

function addVeza(doc: Doc, from: string, to: string | NewObject): Plan {
  endpoint(doc, from);
  const taken: string[] = [];
  const blocks: string[] = [];
  let target: string;
  if (isNew(to)) {
    target = fresh(doc, 'objekat', taken);
    blocks.push(objectBlock(doc, target));
  } else {
    endpoint(doc, to);
    target = to;
  }
  const recursive = target === from;
  const lines = rows([
    { name: from, rest: recursive ? `${CARD_DEFAULT_FIRST} Uloga1` : CARD_DEFAULT_FIRST },
    { name: target, rest: recursive ? `${CARD_DEFAULT_OTHER} Uloga2` : CARD_DEFAULT_OTHER },
  ]);
  blocks.push([`${kw(doc.locale, 'veza')} _ {`, ...lines, '}'].join('\n'));
  const vezaId = `_#${doc.ast.blocks.filter(isUnnamed).length + 1}`;
  const placeAt: Placement[] = [{ id: vezaId, near: from, dir: 'right' }];
  if (isNew(to)) placeAt.push({ id: target, near: vezaId, dir: 'right' });
  return { edits: [appendEdit(doc, blocks)], select: vezaId, placeAt };
}

function addSlab(doc: Doc, parent: string): Plan {
  endpoint(doc, parent);
  const name = fresh(doc, 'slab', []);
  const text = [
    `${kw(doc.locale, 'slab')} ${formatName(name)} {`,
    `  ${role(doc, 'nadređeni')} ${formatName(parent)} ${CARD_DEFAULT_OTHER}`,
    doc.locale === 'en' ? '  No#' : '  Rb#',
    '}',
  ].join('\n');
  return { edits: [appendEdit(doc, [text])], select: name, placeAt: [{ id: name, near: parent, dir: 'right' }] };
}

function addAgregacija(doc: Doc, first: string, second: string | NewObject): Plan {
  endpoint(doc, first);
  const taken: string[] = [];
  const blocks: string[] = [];
  let other: string;
  if (isNew(second)) {
    other = fresh(doc, 'objekat', taken);
    blocks.push(objectBlock(doc, other));
  } else {
    endpoint(doc, second);
    other = second;
  }
  if (other === first) fail('distinct');
  const name = fresh(doc, 'agregacija', taken);
  const lines = rows([{ name: first, rest: CARD_DEFAULT_OTHER }, { name: other, rest: CARD_DEFAULT_OTHER }]);
  blocks.push([`${kw(doc.locale, 'agregacija')} ${formatName(name)} {`, ...lines, '}'].join('\n'));
  const placeAt: Placement[] = [{ id: name, near: first, dir: 'right' }];
  if (isNew(second)) placeAt.push({ id: other, near: name, dir: 'right' });
  return { edits: [appendEdit(doc, blocks)], select: name, placeAt };
}

function addComponent(doc: Doc, aggId: string, component: string | NewObject): Plan {
  const agg = element(doc, aggId);
  if (agg.kind !== 'agregacija') return fail();
  const block = blockOf(doc, aggId);
  const edits: Edit[] = [];
  let target: string;
  const placeAt: Placement[] = [];
  if (isNew(component)) {
    target = fresh(doc, 'objekat', []);
    edits.push(appendEdit(doc, [objectBlock(doc, target)]));
    placeAt.push({ id: target, near: aggId, dir: 'right' });
  } else {
    endpoint(doc, component);
    const why = pickRejectionKey(doc.ir, { kind: 'component', agregacija: aggId }, component);
    if (why) fail(why);
    target = component;
  }
  const last = participantLines(block).at(-1);
  let padded = `${formatName(target)} ${CARD_DEFAULT_OTHER}`;
  if (last?.card) {
    const col = last.card.span.from - last.span.from;
    const nm = formatName(target);
    if (nm.length < col) padded = `${nm.padEnd(col)}${CARD_DEFAULT_OTHER}`;
  }
  edits.push(...addLineEdits(doc, block, padded, last?.span));
  return { edits, select: aggId, placeAt };
}

function addSpecijalizacija(doc: Doc, nadtip: string): Plan {
  if (element(doc, nadtip).kind !== 'objekat') return fail();
  const taken: string[] = [];
  const p1 = fresh(doc, 'podtip', taken);
  const p2 = fresh(doc, 'podtip', taken);
  const spec = fresh(doc, 'specijalizacija', taken);
  const text = [
    `${kw(doc.locale, 'specijalizacija')} ${formatName(spec)} {`,
    `  ${role(doc, 'nadtip')} ${formatName(nadtip)} (0,M)`,
    `  ${role(doc, 'podtip')} ${formatName(p1)}`,
    `  ${role(doc, 'podtip')} ${formatName(p2)}`,
    '}',
  ].join('\n');
  return {
    edits: [appendEdit(doc, [objectBlock(doc, p1), objectBlock(doc, p2), text])],
    select: spec,
    placeAt: [
      { id: `spec:${spec}`, near: nadtip, dir: 'below' },
      { id: `junction:${spec}`, near: `spec:${spec}`, dir: 'below' },
      { id: p1, near: `junction:${spec}`, dir: 'below' },
      { id: p2, near: p1, dir: 'right' },
    ],
  };
}

function addPodtip(doc: Doc, specId: string, podtip: string | NewObject): Plan {
  const spec = element(doc, specId);
  if (spec.kind !== 'specijalizacija' || !spec.supertype) return fail();
  const block = blockOf(doc, specId);
  const edits: Edit[] = [];
  let target: string;
  const placeAt: Placement[] = [];
  const lastSub = spec.subtypes.at(-1);
  if (isNew(podtip)) {
    target = fresh(doc, 'podtip', []);
    edits.push(appendEdit(doc, [objectBlock(doc, target)]));
    placeAt.push(
      lastSub
        ? { id: target, near: lastSub.ref, dir: 'right' }
        : { id: target, near: `junction:${specId}`, dir: 'below' },
    );
  } else {
    const why = pickRejectionKey(doc.ir, { kind: 'podtip', specijalizacija: specId }, podtip);
    if (why) fail(why);
    target = podtip;
  }
  const lines = participantLines(block);
  const lastLine = lines.at(-1);
  edits.push(...addLineEdits(doc, block, `${role(doc, 'podtip')} ${formatName(target)}`, lastLine?.span));
  return { edits, select: isNew(podtip) ? target : specId, placeAt };
}

// ------------------------------------------------------------------ attributes

function checkUserDomain(doc: Doc, spec: AttributeSpec): void {
  const u = spec.userDomain;
  if (u && !(doc.ast.domains ?? []).some((d) => d.name.text === u)) fail('unknownDomain');
}

function addAttribute(doc: Doc, owner: string, attr: AttributeSpec): Plan {
  checkUserDomain(doc, attr);
  const el = element(doc, owner);
  if (!hasAttributes(el)) return fail();
  const block = blockOf(doc, owner);
  let padTo = 0;
  for (const l of block.lines) {
    if (l.kind === 'attributeLine' && l.attributes.length === 1) {
      const off = colonOffset(doc, l.attributes[0] as AttributeAst);
      if (off !== null) padTo = off;
    }
  }
  return { edits: addLineEdits(doc, block, attrText(attr, padTo)), select: owner };
}

function editAttribute(doc: Doc, owner: string, index: number, spec: AttributeSpec): Plan {
  checkUserDomain(doc, spec);
  const el = element(doc, owner);
  if (!hasAttributes(el)) return fail();
  const block = blockOf(doc, owner);
  const { attr, line, pos } = attributeAt(block, index);
  const off = colonOffset(doc, attr);
  const text = attrText(spec, off ?? 0);
  const wantsConstraint = !!(spec.userDomain || spec.domain) && !!(spec.constraint ?? '').trim();
  const notLast = pos < line.attributes.length - 1;
  let edits: Edit[];
  if (wantsConstraint && notLast) {
    // A constraint swallows the rest of its line, so give every attribute of the line its own line.
    const parts = line.attributes.map((x, i) => (i === pos ? text : doc.source.slice(x.span.from, x.span.to)));
    if (isMultiline(doc, block)) {
      const indent = indentOf(doc.source, line.span.from);
      edits = [{ from: line.span.from, to: line.span.to, text: parts.join(doc.nl + indent) }];
    } else {
      const lines = block.lines.flatMap((l) => (l === line ? parts : [doc.source.slice(l.span.from, l.span.to).trim()]));
      edits = [rewriteLines(doc, block, lines)];
    }
  } else {
    edits = [{ from: attr.span.from, to: attr.span.to, text }];
  }
  const newName = cleanName(spec.name) as string;
  const plan: Plan = { edits, select: owner };
  if (attr.name.text !== newName) {
    plan.renames = [{ from: `attr:${owner}:${attr.name.text}`, to: `attr:${owner}:${newName}` }];
    const rel = relationOf(el);
    if (rel) plan.edits.push(...renameAttributeEdits(doc, rel, attr.name.text, newName));
  }
  return plan;
}

function deleteAttribute(doc: Doc, owner: string, index: number, withDependents: boolean): Plan {
  const el = element(doc, owner);
  if (!hasAttributes(el)) return fail();
  const { attr, line, pos } = attributeAt(blockOf(doc, owner), index);
  const rel = relationOf(el);
  const touching = rel ? constraintsMentioningAttribute(doc, rel, attr.name.text) : [];
  if (touching.length > 0 && !withDependents) {
    throw new Fail('confirmConstraints', { dependents: [], constraints: touching.map((c) => c.name.text) }, touching.length);
  }
  const extra: Edit[] = touching.map((c) => removalEdit(doc, c.span));
  const n = line.attributes.length;
  let own: Edit;
  if (n === 1) own = { from: attr.span.from, to: attr.span.to, text: '', removeLines: true };
  else if (pos < n - 1) {
    const nextAttr = line.attributes[pos + 1] as AttributeAst;
    own = { from: attr.span.from, to: nextAttr.span.from, text: '' };
  } else {
    const prev = line.attributes[pos - 1] as AttributeAst;
    own = { from: prev.span.to, to: attr.span.to, text: '' };
  }
  return { edits: [own, ...extra], select: owner };
}

// ------------------------------------------------------------------ rename / cardinality / mapping

function rename(doc: Doc, id: string, raw: string): Plan {
  const el = element(doc, id);
  const idx = blockIndex(doc, id);
  const block = blockOf(doc, id);
  let text: string;
  let newName: string;
  if (el.kind === 'veza' && raw.trim() === '') {
    text = '_';
    newName = '_';
  } else {
    newName = cleanName(raw) ?? fail('badName');
    if (newName === '_' && el.kind !== 'veza') fail('badName');
    text = newName === '_' ? '_' : formatName(newName);
  }
  if (newName !== '_' && doc.ast.blocks.some((b, i) => i !== idx && b.name.text === newName && !isUnnamed(b))) {
    fail('nameTaken');
  }
  const edits: Edit[] = [{ from: block.name.span.from, to: block.name.span.to, text }];
  if (el.kind === 'objekat' || el.kind === 'slab' || el.kind === 'agregacija') {
    for (const b of doc.ast.blocks) {
      for (const p of participantLines(b)) {
        if (p.object.text !== el.name) continue;
        // Keep the cardinality column aligned: absorb the length difference into the padding that follows.
        const pad = /^ +/.exec(doc.source.slice(p.object.span.to))?.[0].length ?? 0;
        const diff = p.object.span.to - p.object.span.from - text.length;
        const newPad = pad > 1 ? Math.max(1, pad + diff) : pad;
        edits.push({ from: p.object.span.from, to: p.object.span.to + pad, text: text + ' '.repeat(newPad) });
      }
    }
  }
  const rel = relationOf(el);
  if (rel && newName !== '_') edits.push(...renameRelationEdits(doc, rel, newName));
  return { edits, select: id };
}

function setCardinality(doc: Doc, id: string, index: number, dg: 0 | 1, gg: '1' | 'M'): Plan {
  const { block, p } = participantIn(doc, element(doc, id), index);
  const line = participantAt(block, p.span);
  const text = `(${dg},${gg})`;
  const edit: Edit = line.card
    ? { from: line.card.span.from, to: line.card.span.to, text }
    : { from: line.object.span.to, to: line.object.span.to, text: ` ${text}` };
  return { edits: [edit], select: id };
}

function setMappingName(doc: Doc, id: string, index: number, name: string | null): Plan {
  const { block, p } = participantIn(doc, element(doc, id), index);
  const line = participantAt(block, p.span);
  if (!line.card) return fail();
  const clean = name === null || name.trim() === '' ? null : (cleanName(name) ?? fail('badName'));
  let edit: Edit;
  if (line.mapping) {
    edit = clean === null
      ? { from: line.card.span.to, to: line.mapping.span.to, text: '' }
      : { from: line.mapping.span.from, to: line.mapping.span.to, text: formatName(clean) };
  } else if (clean === null) {
    return { edits: [], select: id };
  } else {
    edit = { from: line.card.span.to, to: line.card.span.to, text: ` ${formatName(clean)}` };
  }
  return { edits: [edit], select: id };
}

// ------------------------------------------------------------------ deletion

interface Removal {
  removed: Set<string>;
  hard: { id: string; kind: IRElement['kind'] }[];
  /** Participant lines (IR spans) to delete inside blocks that stay. */
  lineSpans: { block: BlockAst; from: number; to: number }[];
}

function computeRemoval(doc: Doc, roots: string[], forced: string[] = []): Removal {
  const removed = new Set<string>([...roots, ...forced]);
  const hard: Removal['hard'] = forced.map((id) => ({ id, kind: element(doc, id).kind }));
  const mark = (e: IRElement, isHard: boolean) => {
    removed.add(e.id);
    if (isHard) hard.push({ id: e.id, kind: e.kind });
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of doc.ir.elements) {
      if (removed.has(e.id)) continue;
      let hit = false;
      switch (e.kind) {
        case 'veza':
          if (e.participants.some((p) => removed.has(p.ref))) { mark(e, false); hit = true; }
          break;
        case 'slab':
          if (e.owner && removed.has(e.owner.ref)) { mark(e, true); hit = true; }
          break;
        case 'agregacija': {
          const gone = e.components.filter((c) => removed.has(c.ref)).length;
          if (gone > 0 && e.components.length - gone < 2) { mark(e, true); hit = true; }
          break;
        }
        case 'specijalizacija': {
          const gone = e.subtypes.filter((s) => removed.has(s.ref)).length;
          if ((e.supertype && removed.has(e.supertype.ref)) || (gone > 0 && e.subtypes.length - gone < 2)) {
            mark(e, true);
            hit = true;
          }
          break;
        }
        default:
      }
      if (hit) changed = true;
    }
  }
  const lineSpans: Removal['lineSpans'] = [];
  for (const e of doc.ir.elements) {
    if (removed.has(e.id)) continue;
    if (e.kind === 'agregacija') {
      for (const c of e.components) if (removed.has(c.ref)) lineSpans.push({ block: blockOf(doc, e.id), from: c.span.from, to: c.span.to });
    } else if (e.kind === 'specijalizacija') {
      for (const s of e.subtypes) if (removed.has(s.ref)) lineSpans.push({ block: blockOf(doc, e.id), from: s.span.from, to: s.span.to });
    }
  }
  return { removed, hard, lineSpans };
}

function removalPlan(doc: Doc, r: Removal, withDependents: boolean, select?: string): Plan {
  const rels = new Set<string>();
  for (const id of r.removed) {
    const el = doc.ir.elements.find((e) => e.id === id);
    const rel = el ? relationOf(el) : null;
    if (rel) rels.add(rel);
  }
  const touching = constraintsMentioning(doc, rels);
  const names = touching.map((c) => c.name.text);
  if (!withDependents) {
    if (r.hard.length > 0) {
      throw new Fail('confirmDeps', names.length > 0 ? { dependents: r.hard, constraints: names } : { dependents: r.hard }, r.hard.length);
    }
    if (names.length > 0) throw new Fail('confirmConstraints', { dependents: [], constraints: names }, names.length);
  }
  const edits: Edit[] = [];
  const blockMap: number[] = [];
  let kept = 0;
  doc.ast.blocks.forEach((b, i) => {
    const id = doc.ids[i] ?? '';
    if (id !== '' && r.removed.has(id)) {
      edits.push({ from: b.span.from, to: b.span.to, text: '', removeLines: true });
      blockMap.push(-1);
    } else {
      blockMap.push(kept++);
    }
  });
  for (const l of r.lineSpans) edits.push({ from: l.from, to: l.to, text: '', removeLines: true });
  for (const c of touching) edits.push(removalEdit(doc, c.span));
  const plan: Plan = { edits, blockMap };
  if (select !== undefined) plan.select = select;
  return plan;
}

function deleteElement(doc: Doc, id: string, withDependents: boolean): Plan {
  element(doc, id);
  return removalPlan(doc, computeRemoval(doc, [id]), withDependents);
}

function removePodtip(doc: Doc, specId: string, podtip: string, withDependents: boolean): Plan {
  const spec = element(doc, specId);
  if (spec.kind !== 'specijalizacija') return fail();
  const sub = spec.subtypes.find((s) => s.ref === podtip) ?? fail();
  if (spec.subtypes.length - 1 < 2) {
    return removalPlan(doc, computeRemoval(doc, [], [specId]), withDependents);
  }
  return { edits: [{ from: sub.span.from, to: sub.span.to, text: '', removeLines: true }], select: specId };
}
