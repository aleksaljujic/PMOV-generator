// Public entry of src/lang/syntax — owned by T01. Contract C02.
import type { LangOptions } from '../diagnostics';
import type { LexResult, ParseResult } from '../ast';
import { lex as lexImpl } from './lexer';
import { parseSource } from './parser';

export function lex(source: string, options?: LangOptions): LexResult {
  try {
    return lexImpl(source, options);
  } catch {
    return { tokens: [], diagnostics: [] };
  }
}

export function parse(source: string, options?: LangOptions): ParseResult {
  try {
    return parseSource(source, options);
  } catch {
    return { ast: { blocks: [] }, diagnostics: [] };
  }
}
