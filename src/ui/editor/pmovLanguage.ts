import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  BLOCK_KIND_ALIASES,
  BLOCK_KINDS,
  CONDITION_KEYWORDS,
  CONSTRAINT_ACTIONS,
  CONSTRAINT_BLOCK_KEYWORDS,
  CONSTRAINT_OPS,
  DOMAIN_DECL_KEYWORDS,
  DOMAINS,
  ROLE_ALIASES,
  ROLES,
} from '../../lang';

const constraintKeywords: ReadonlySet<string> = new Set(Object.keys(CONSTRAINT_BLOCK_KEYWORDS));
const kinds: ReadonlySet<string> = new Set([
  ...BLOCK_KINDS,
  ...Object.keys(BLOCK_KIND_ALIASES),
  ...Object.keys(DOMAIN_DECL_KEYWORDS),
  ...constraintKeywords,
  ...Object.keys(CONDITION_KEYWORDS),
]);
const constraintWords: ReadonlySet<string> = new Set<string>([...CONSTRAINT_OPS, ...CONSTRAINT_ACTIONS]);
const roles: ReadonlySet<string> = new Set([...ROLES, ...Object.keys(ROLE_ALIASES)]);
const domains: ReadonlySet<string> = new Set(DOMAINS);

interface PmovState {
  depth: number;
  /** A constraint keyword was seen and its `{` has not opened yet. */
  pendingConstraint?: boolean;
  /** Brace depth inside the open constraint block (the depth after its `{`), or 0 when outside one. */
  constraintDepth?: number;
}

const WORD = /^[\p{L}\p{N}_]+/u;
const CARD = /^\(\s*[01]\s*,\s*[1mM01]\s*\)/;

/** Token names: keyword (block kinds), modifier (roles), typeName (domains), comment, string,
 *  meta (`#`), number (cardinality), punctuation, variableName (other identifiers). */
export const pmovParser: StreamParser<PmovState | null> = {
  name: 'pmov',
  startState: () => ({ depth: 0 }),
  token(stream, state) {
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
      if (kinds.has(w)) {
        if (state && constraintKeywords.has(w)) state.pendingConstraint = true;
        return 'keyword';
      }
      if (state?.constraintDepth && constraintWords.has(w.toLowerCase())) return 'modifier';
      if (roles.has(w)) return 'modifier';
      if (domains.has(w)) return 'typeName';
      return 'variableName';
    }
    if (stream.match('->')) return 'operator';
    stream.next();
    const ch = stream.current();
    if (state) {
      if (ch === '{') {
        state.depth++;
        if (state.pendingConstraint) {
          state.pendingConstraint = false;
          state.constraintDepth = state.depth;
        }
      } else if (ch === '}') {
        if (state.constraintDepth && state.depth <= state.constraintDepth) state.constraintDepth = 0;
        state.depth = Math.max(0, state.depth - 1);
      }
    }
    return /[{}(),:]/.test(stream.current()) ? 'punctuation' : null;
  },
  indent(state, textAfter, cx) {
    let depth = state?.depth ?? 0;
    if (textAfter.startsWith('}')) depth = Math.max(0, depth - 1);
    return depth * cx.unit;
  },
  languageData: {
    indentOnInput: /^\s*\}$/,
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
  { tag: t.operator, color: '#be185d' },
  { tag: t.punctuation, color: '#475569' },
]);

export const pmovHighlighting = syntaxHighlighting(pmovHighlightStyle);
