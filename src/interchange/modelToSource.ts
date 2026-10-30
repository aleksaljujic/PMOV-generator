// PmovJsonModel -> DSL text (contract C13 §1). Pure; keywords from the C02 / C10 tables in the given locale.
import {
  BLOCK_KIND_ALIASES,
  BLOCK_KIND_KEYWORDS,
  BLOCK_KINDS,
  CONDITION_KEYWORDS,
  CONSTRAINT_BLOCK_KEYWORDS,
  DECL_KEYWORDS,
  DOMAIN_DECL_KEYWORDS,
  ROLE_ALIASES,
  ROLE_KEYWORDS,
  ROLES,
  type Locale,
} from '../lang';
import type { PmovJsonModel } from './types';

type Model = PmovJsonModel;
type Element = Model['elements'][number];
type Attribute = Extract<Element, { attributes: unknown }>['attributes'][number];
type Participant = { ref: string; card: { min: 0 | 1; max: 1 | 'M' }; mapping?: string | null };

const PLAIN_IDENT = /^[\p{L}_][\p{L}\p{N}_]*$/u;

const RESERVED = new Set<string>([
  ...BLOCK_KINDS,
  ...Object.keys(BLOCK_KIND_ALIASES),
  ...ROLES,
  ...Object.keys(ROLE_ALIASES),
  ...Object.keys(DOMAIN_DECL_KEYWORDS),
  ...Object.keys(CONSTRAINT_BLOCK_KEYWORDS),
  ...Object.keys(CONDITION_KEYWORDS),
]);

/** A plain identifier that is not a keyword is written bare; anything else is quoted. */
function name(text: string): string {
  return PLAIN_IDENT.test(text) && !RESERVED.has(text) ? text : `"${text}"`;
}

const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length));
const widest = (xs: string[]): number => xs.reduce((m, x) => Math.max(m, x.length), 0);

function typeText(a: Attribute, model: Model): string | null {
  const userDomain = a.userDomain ?? null;
  const length = a.length ?? null;
  let type: string;
  if (userDomain !== null) {
    type = name(userDomain);
    const inherited = model.domains?.find((d) => d.name === userDomain)?.length ?? null;
    if (length !== null && length !== inherited) type += `(${length})`;
  } else if (a.domain) {
    type = a.domain;
    if (length !== null) type += `(${length})`;
  } else {
    return null;
  }
  return a.constraint ? `${type} ${a.constraint}` : type;
}

function attributeLines(attrs: Attribute[], model: Model): string[] {
  const labels = attrs.map((a) => name(a.name) + (a.isId ? '#' : ''));
  const typed = attrs.map((a, i) => (typeText(a, model) !== null ? (labels[i] as string) : ''));
  const w = widest(typed);
  return attrs.map((_, i) => {
    const t = typeText(attrs[i] as Attribute, model);
    const label = labels[i] as string;
    return t === null ? `  ${label}` : `  ${pad(label, w)} : ${t}`;
  });
}

function cardText(p: Participant): string {
  return `(${p.card.min},${p.card.max})`;
}

function participantLines(items: { prefix: string; p: Participant }[]): string[] {
  const names = items.map(({ p }) => name(p.ref));
  const w = widest(names);
  return items.map(({ prefix, p }, i) => {
    const base = `${prefix}${names[i] as string}`;
    const withCard = `${base}${' '.repeat(w - (names[i] as string).length)} ${cardText(p)}`;
    return `  ${p.mapping ? `${withCard} ${name(p.mapping)}` : withCard}`;
  });
}

function elementBlock(el: Element, model: Model, locale: Locale): string {
  const kw = BLOCK_KIND_KEYWORDS[locale][el.kind];
  const roles = ROLE_KEYWORDS[locale];
  const head = `${kw} ${el.kind === 'veza' && el.name === '' ? '_' : name(el.name)} {`;
  const body: string[] = [];
  switch (el.kind) {
    case 'objekat':
      body.push(...attributeLines(el.attributes, model));
      break;
    case 'slab':
      if (el.owner) body.push(...participantLines([{ prefix: `${roles.nadređeni} `, p: el.owner }]));
      body.push(...attributeLines(el.attributes, model));
      break;
    case 'agregacija':
      body.push(...participantLines(el.components.map((p) => ({ prefix: '', p }))));
      body.push(...attributeLines(el.attributes, model));
      break;
    case 'veza':
      body.push(...participantLines(el.participants.map((p) => ({ prefix: '', p }))));
      break;
    case 'specijalizacija':
      if (el.supertype) body.push(...participantLines([{ prefix: `${roles.nadtip} `, p: el.supertype }]));
      for (const s of el.subtypes) body.push(`  ${roles.podtip} ${name(s.ref)}`);
      break;
  }
  return [head, ...body, '}'].join('\n');
}

function domainLines(model: Model, locale: Locale): string[] {
  const domains = model.domains ?? [];
  const kw = DECL_KEYWORDS[locale].domain;
  const names = domains.map((d) => name(d.name));
  const w = widest(names);
  return domains.map((d, i) => {
    let line = `${kw} ${pad(names[i] as string, w)}`;
    if (d.parent !== null && d.parent !== undefined) {
      line += ` : ${name(d.parent)}`;
      const inherited = domains.find((x) => x.name === d.parent)?.length ?? null;
      if (d.length !== null && d.length !== undefined && d.length !== inherited) line += `(${d.length})`;
    } else if (d.base) {
      line += ` : ${d.base}`;
      if (d.length !== null && d.length !== undefined) line += `(${d.length})`;
    } else {
      return line.trimEnd();
    }
    return d.constraint ? `${line} ${d.constraint}` : line;
  });
}

function constraintBlock(c: NonNullable<Model['constraints']>[number], locale: Locale): string {
  const kw = DECL_KEYWORDS[locale];
  const lines: string[] = [];
  if (c.kind === 'referential') {
    const attrs = c.childAttrs ? `(${c.childAttrs.map(name).join(', ')})` : '';
    lines.push(`  ${name(c.child)}${attrs} -> ${name(c.parent)}`);
  } else {
    lines.push(c.condition === '' ? `  ${kw.condition}:` : `  ${kw.condition}: ${c.condition}`);
  }
  // Consecutive rules for the same relation share one line; order is preserved.
  let i = 0;
  while (i < c.rules.length) {
    const rel = (c.rules[i] as (typeof c.rules)[number]).relation;
    const items: string[] = [];
    while (i < c.rules.length && (c.rules[i] as (typeof c.rules)[number]).relation === rel) {
      const r = c.rules[i] as (typeof c.rules)[number];
      items.push(`${r.op} ${r.action}`);
      i++;
    }
    lines.push(`  ${name(rel)} : ${items.join(', ')}`);
  }
  return [`${kw.constraint} ${name(c.name)} {`, ...lines, '}'].join('\n');
}

export function modelToSource(model: Model, locale: Locale): string {
  const loc: Locale = locale === 'en' ? 'en' : 'sr';
  const blocks: string[] = [];
  const dl = domainLines(model, loc);
  if (dl.length > 0) blocks.push(dl.join('\n'));
  for (const el of model.elements) blocks.push(elementBlock(el, model, loc));
  for (const c of model.constraints ?? []) blocks.push(constraintBlock(c, loc));
  return blocks.length === 0 ? '\n' : blocks.join('\n\n') + '\n';
}
