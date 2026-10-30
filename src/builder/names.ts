// Placeholder names and name formatting/validation. No React.
import { BLOCK_KINDS, ROLES } from '../lang';
import type { Locale, PmovIR } from '../lang';
import { BLOCK_KIND_ALIASES, ROLE_ALIASES } from '../lang';
import type { PlaceholderKind } from './types';

const PREFIX: Record<Locale, Record<PlaceholderKind, string>> = {
  sr: { objekat: 'Objekat', slab: 'Slab', agregacija: 'Agregacija', specijalizacija: 'Vrsta', podtip: 'Podtip' },
  en: { objekat: 'Object', slab: 'Weak', agregacija: 'Aggregation', specijalizacija: 'Kind', podtip: 'Subtype' },
};

/** Next free placeholder name of the locale's prefix (`Objekat1` taken → `Object1` in EN; `Object1` taken → `Object2`). */
export function placeholderName(
  ir: PmovIR | null,
  kind: PlaceholderKind,
  alsoTaken: Iterable<string> = [],
  locale: Locale = 'sr',
): string {
  const taken = new Set<string>(alsoTaken);
  for (const e of ir?.elements ?? []) taken.add(e.id);
  const prefix = PREFIX[locale][kind];
  let n = 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Recognises placeholders of both languages. */
export function isPlaceholderName(name: string): boolean {
  return /^(Objekat|Slab|Agregacija|Vrsta|Podtip|Object|Weak|Aggregation|Kind|Subtype)\d+$/.test(name);
}

const PLAIN = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const RESERVED = new Set<string>([
  ...BLOCK_KINDS,
  ...ROLES,
  ...Object.keys(BLOCK_KIND_ALIASES),
  ...Object.keys(ROLE_ALIASES),
]);

/** Name as written in the DSL: bare when it is a plain non-reserved identifier, otherwise in quotes. */
export function formatName(name: string): string {
  return PLAIN.test(name) && !RESERVED.has(name) ? name : `"${name}"`;
}

/** Trimmed name when it can be written in the DSL, else null. */
export function cleanName(raw: string): string | null {
  const n = raw.trim();
  if (n === '' || /["\r\n\t\u0000-\u001f]/.test(n)) return null;
  return n;
}
