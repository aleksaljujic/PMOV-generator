// Per-locale text for S01–S06 (contract C01 §English messages). Serbian is the default and byte-identical to Wave 1.
import type { Locale } from '../diagnostics';

/** Phrases used as the "expected ..." part of S01. Keys are the Serbian phrases used in the parser. */
export type Expected =
  | 'attrName'
  | 'domain'
  | 'commaOrEol'
  | 'objectName'
  | 'eol'
  | 'blockName'
  | 'comma'
  | 'rparen'
  | 'lbrace'
  | 'colon'
  | 'domainName'
  | 'type'
  | 'constraintLine'
  | 'ruleItem'
  | 'arrow'
  | 'number';

interface Table {
  eof: string;
  newline: string;
  expected: Record<Expected, string>;
  S01: (found: string, what: string) => string;
  S02: string;
  S03: (ch: string) => string;
  S04: (word: string) => string;
  S05: (name: string) => string;
  S06: (word: string) => string;
}

const sr: Table = {
  eof: 'kraj fajla',
  newline: 'novi red',
  expected: {
    attrName: 'naziv atributa',
    domain: 'domen',
    commaOrEol: "',' ili kraj reda",
    objectName: 'naziv objekta',
    eol: 'kraj reda',
    blockName: 'naziv bloka',
    comma: "','",
    rparen: "')'",
    lbrace: "'{'",
    colon: "':'",
    domainName: 'naziv domena',
    type: 'tip (long, short, string, date ili naziv domena)',
    constraintLine: "'uslov:', 'Relacija : operacija akcija' ili 'Dete -> Roditelj'",
    ruleItem: "operaciju (insert, update ili delete)",
    arrow: "'->'",
    number: 'broj',
  },
  S01: (found, what) => `neočekivan simbol '${found}', očekivano ${what}.`,
  S02: 'nezatvoren naziv pod navodnicima.',
  S03: (ch) => `nepoznat znak '${ch}'.`,
  S04: (w) => `nepoznata vrsta bloka '${w}'. Dozvoljeno: objekat, veza, slab, specijalizacija, agregacija.`,
  S05: (n) => `blok '${n}' nije zatvoren — nedostaje '}'.`,
  S06: (w) => `nepoznat domen '${w}'. Dozvoljeno: long, short, string, date.`,
};

const en: Table = {
  eof: 'end of file',
  newline: 'new line',
  expected: {
    attrName: 'attribute name',
    domain: 'domain',
    commaOrEol: "',' or end of line",
    objectName: 'object name',
    eol: 'end of line',
    blockName: 'block name',
    comma: "','",
    rparen: "')'",
    lbrace: "'{'",
    colon: "':'",
    domainName: 'domain name',
    type: 'type (long, short, string, date or a domain name)',
    constraintLine: "'condition:', 'Relation : operation action' or 'Child -> Parent'",
    ruleItem: 'an operation (insert, update or delete)',
    arrow: "'->'",
    number: 'a number',
  },
  S01: (found, what) => `unexpected symbol '${found}', expected ${what}.`,
  S02: 'unclosed quoted name.',
  S03: (ch) => `unknown character '${ch}'.`,
  S04: (w) =>
    `unknown block kind '${w}'. Allowed: object, relationship, weak, specialization, aggregation (or objekat, veza, slab, specijalizacija, agregacija).`,
  S05: (n) => `block '${n}' is not closed — missing '}'.`,
  S06: (w) => `unknown domain '${w}'. Allowed: long, short, string, date.`,
};

export const SYNTAX_MESSAGES: Readonly<Record<Locale, Table>> = { sr, en };

export function syntaxMessages(locale: Locale | undefined): Table {
  return locale === 'en' ? en : sr;
}
