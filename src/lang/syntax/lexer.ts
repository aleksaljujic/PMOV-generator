import type { LexResult, Token, TokenType } from '../ast';
import type { Diagnostic, LangOptions } from '../diagnostics';
import { syntaxMessages } from './messages';
import { PositionMap } from './positions';

const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;

const PUNCT: Record<string, TokenType> = {
  '{': 'lbrace',
  '}': 'rbrace',
  '(': 'lparen',
  ')': 'rparen',
  ',': 'comma',
  ':': 'colon',
  '#': 'hash',
};

export function lexWith(source: string, pm: PositionMap, options?: LangOptions): LexResult {
  const M = syntaxMessages(options?.locale);
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const n = source.length;
  let i = 0;

  const push = (type: TokenType, from: number, to: number, value?: string) => {
    const text = source.slice(from, to);
    tokens.push({ type, text, value: value ?? text, span: pm.span(from, to) });
  };

  while (i < n) {
    const c = source.charAt(i);
    if (c === '\n') {
      push('newline', i, i + 1);
      i++;
      continue;
    }
    if (c === '\r') {
      if (source.charAt(i + 1) === '\n') {
        push('newline', i, i + 2);
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') {
      i++;
      continue;
    }
    if (c === '/' && source.charAt(i + 1) === '/') {
      while (i < n && source.charAt(i) !== '\n' && !(source.charAt(i) === '\r' && source.charAt(i + 1) === '\n')) i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && source.charAt(j) !== '"' && source.charAt(j) !== '\n' && !(source.charAt(j) === '\r' && source.charAt(j + 1) === '\n')) j++;
      if (j < n && source.charAt(j) === '"') {
        push('quoted', i, j + 1, source.slice(i + 1, j));
        i = j + 1;
      } else {
        const span = pm.span(i, j);
        diagnostics.push({
          code: 'S02',
          severity: 'error',
          message: M.S02,
          span,
          elementId: null,
        });
        push('quoted', i, j, source.slice(i + 1, j));
        i = j;
      }
      continue;
    }
    if (c === '-' && source.charAt(i + 1) === '>') {
      push('arrow', i, i + 2);
      i += 2;
      continue;
    }
    const punct = PUNCT[c];
    if (punct !== undefined) {
      push(punct, i, i + 1);
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && source.charAt(j) >= '0' && source.charAt(j) <= '9') j++;
      push('number', i, j);
      i = j;
      continue;
    }
    const cp = source.codePointAt(i) as number;
    const ch = String.fromCodePoint(cp);
    if (IDENT_START.test(ch)) {
      let j = i + ch.length;
      while (j < n) {
        const cp2 = source.codePointAt(j) as number;
        const ch2 = String.fromCodePoint(cp2);
        if (!IDENT_PART.test(ch2)) break;
        j += ch2.length;
      }
      push('ident', i, j);
      i = j;
      continue;
    }
    push('unknown', i, i + ch.length);
    i += ch.length;
  }
  push('eof', n, n);
  return { tokens, diagnostics };
}

export function lex(source: string, options?: LangOptions): LexResult {
  return lexWith(source, new PositionMap(source), options);
}
