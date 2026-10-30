// Structural validation of the `model` section (contract C13 §1, step 7). Returns the path of the first bad value.
import { CONSTRAINT_ACTIONS, CONSTRAINT_OPS, DOMAINS } from '../lang';

type Obj = Record<string, unknown>;

export const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNullOrString = (v: unknown): boolean => v === undefined || v === null || isString(v);
const oneOf = (list: readonly string[], v: unknown): boolean => isString(v) && list.includes(v);

const ELEMENT_KINDS = ['objekat', 'slab', 'veza', 'specijalizacija', 'agregacija'];

function checkCard(c: unknown): boolean {
  return isObject(c) && (c.min === 0 || c.min === 1) && (c.max === 1 || c.max === 'M');
}

/** A participant-like value `{ ref, card, mapping }`. */
function checkParticipant(v: unknown, path: string): string | null {
  if (!isObject(v)) return path;
  if (!isString(v.ref)) return `${path}.ref`;
  if (!checkCard(v.card)) return `${path}.card`;
  if (!isNullOrString(v.mapping)) return `${path}.mapping`;
  return null;
}

function checkAttributes(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return path;
  for (let j = 0; j < v.length; j++) {
    const a: unknown = v[j];
    const ap = `${path}[${j}]`;
    if (!isObject(a)) return ap;
    if (!isString(a.name)) return `${ap}.name`;
    if (typeof a.isId !== 'boolean') return `${ap}.isId`;
    if (!(a.domain === undefined || a.domain === null || oneOf(DOMAINS, a.domain))) return `${ap}.domain`;
    if (!isNullOrString(a.constraint)) return `${ap}.constraint`;
    if (!isNullOrString(a.userDomain)) return `${ap}.userDomain`;
    const len = a.length;
    if (!(len === undefined || len === null || (typeof len === 'number' && Number.isInteger(len) && len >= 0))) return `${ap}.length`;
  }
  return null;
}

function checkParticipantList(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return path;
  for (let k = 0; k < v.length; k++) {
    const bad = checkParticipant(v[k], `${path}[${k}]`);
    if (bad) return bad;
  }
  return null;
}

function checkElement(e: unknown, path: string): string | null {
  if (!isObject(e)) return path;
  if (!oneOf(ELEMENT_KINDS, e.kind)) return `${path}.kind`;
  if (!isString(e.id)) return `${path}.id`;
  if (!isString(e.name)) return `${path}.name`;
  let bad: string | null = null;
  switch (e.kind) {
    case 'objekat':
      return checkAttributes(e.attributes, `${path}.attributes`);
    case 'slab':
      if (e.owner !== undefined && e.owner !== null) {
        bad = checkParticipant(e.owner, `${path}.owner`);
        if (bad) return bad;
      }
      return checkAttributes(e.attributes, `${path}.attributes`);
    case 'agregacija':
      bad = checkParticipantList(e.components, `${path}.components`);
      return bad ?? checkAttributes(e.attributes, `${path}.attributes`);
    case 'veza':
      return checkParticipantList(e.participants, `${path}.participants`);
    default: {
      if (e.supertype !== undefined && e.supertype !== null) {
        bad = checkParticipant(e.supertype, `${path}.supertype`);
        if (bad) return bad;
      }
      if (!Array.isArray(e.subtypes)) return `${path}.subtypes`;
      for (let k = 0; k < e.subtypes.length; k++) {
        const s: unknown = e.subtypes[k];
        if (!isObject(s)) return `${path}.subtypes[${k}]`;
        if (!isString(s.ref)) return `${path}.subtypes[${k}].ref`;
      }
      return null;
    }
  }
}

function checkDomains(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return path;
  for (let i = 0; i < v.length; i++) {
    const d: unknown = v[i];
    const dp = `${path}[${i}]`;
    if (!isObject(d)) return dp;
    if (!isString(d.name)) return `${dp}.name`;
    if (!isNullOrString(d.parent)) return `${dp}.parent`;
    if (!(d.base === undefined || d.base === null || oneOf(DOMAINS, d.base))) return `${dp}.base`;
    const len = d.length;
    if (!(len === undefined || len === null || (typeof len === 'number' && Number.isInteger(len) && len >= 0))) return `${dp}.length`;
    if (!isNullOrString(d.constraint)) return `${dp}.constraint`;
  }
  return null;
}

function checkConstraints(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return path;
  for (let i = 0; i < v.length; i++) {
    const c: unknown = v[i];
    const cp = `${path}[${i}]`;
    if (!isObject(c)) return cp;
    if (!oneOf(['referential', 'general'], c.kind)) return `${cp}.kind`;
    if (!isString(c.id)) return `${cp}.id`;
    if (!isString(c.name)) return `${cp}.name`;
    if (c.kind === 'referential') {
      if (!isString(c.child)) return `${cp}.child`;
      if (!isString(c.parent)) return `${cp}.parent`;
      if (c.childAttrs !== undefined && c.childAttrs !== null) {
        if (!Array.isArray(c.childAttrs) || !c.childAttrs.every(isString)) return `${cp}.childAttrs`;
      }
    } else if (!isString(c.condition)) {
      return `${cp}.condition`;
    }
    if (!Array.isArray(c.rules)) return `${cp}.rules`;
    for (let k = 0; k < c.rules.length; k++) {
      const r: unknown = c.rules[k];
      const rp = `${cp}.rules[${k}]`;
      if (!isObject(r)) return rp;
      if (!isString(r.relation)) return `${rp}.relation`;
      if (!oneOf(CONSTRAINT_OPS, r.op)) return `${rp}.op`;
      if (!oneOf(CONSTRAINT_ACTIONS, r.action)) return `${rp}.action`;
    }
  }
  return null;
}

/** Path of the first structural problem in `model`, or null when it is valid. */
export function validateModel(model: unknown): string | null {
  if (!isObject(model)) return 'model';
  if (!Array.isArray(model.elements)) return 'model.elements';
  for (let i = 0; i < model.elements.length; i++) {
    const bad = checkElement(model.elements[i], `model.elements[${i}]`);
    if (bad) return bad;
  }
  if (model.domains !== undefined && model.domains !== null) {
    const bad = checkDomains(model.domains, 'model.domains');
    if (bad) return bad;
  }
  if (model.constraints !== undefined && model.constraints !== null) {
    const bad = checkConstraints(model.constraints, 'model.constraints');
    if (bad) return bad;
  }
  return null;
}
