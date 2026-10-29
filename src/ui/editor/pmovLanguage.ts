import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { BLOCK_KINDS, DOMAINS, ROLES } from '../../lang';

const kinds: ReadonlySet<string> = new Set(BLOCK_KINDS);
const roles: ReadonlySet<string> = new Set(ROLES);
const domains: ReadonlySet<string> = new Set(DOMAINS);

const WORD = /^[\p{L}\p{N}_]+/u;
const CARD = /^\(\s*[01]\s*,\s*[1mM01]\s*\)/;

/** Token names: keyword (block kinds), modifier (roles), typeName (domains), comment, string,
 *  meta (`#`), number (cardinality), punctuation, variableName (other identifiers). */
export const pmovParser: StreamParser<null> = {
  name: 'pmov',
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(CARD)) return 'number';
    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        const c = stream.next();
        if (c === '"') break;
      }
      return 'string';
    }
    if (stream.eat('#')) return 'meta';
    if (stream.match(WORD)) {
      const w = stream.current();
      if (kinds.has(w)) return 'keyword';
      if (roles.has(w)) return 'modifier';
      if (domains.has(w)) return 'typeName';
      return 'variableName';
    }
    stream.next();
    return /[{}(),:]/.test(stream.current()) ? 'punctuation' : null;
  },
  languageData: {
    commentTokens: { line: '//' },
    closeBrackets: { brackets: ['{', '(', '"'] },
  },
};

export const pmovLanguage = StreamLanguage.define(pmovParser);

export const pmovHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#1e3a8a', fontWeight: 'bold' },
  { tag: t.modifier, color: '#7e22ce' },
  { tag: t.typeName, color: '#0f766e' },
  { tag: t.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: t.string, color: '#166534' },
  { tag: t.meta, color: '#ea580c', fontWeight: 'bold' },
  { tag: t.number, color: '#ea580c' },
  { tag: t.punctuation, color: '#475569' },
]);

export const pmovHighlighting = syntaxHighlighting(pmovHighlightStyle);
