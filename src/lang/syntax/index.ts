// Public entry of src/lang/syntax — owned by T01. Contract C02.
import type { LexResult, ParseResult } from '../ast';
import { lex as lexImpl } from './lexer';
import { parseSource } from './parser';

export function lex(source: string): LexResult {
  try {
    return lexImpl(source);
  } catch {
    return { tokens: [], diagnostics: [] };
  }
}

export function parse(source: string): ParseResult {
  try {
    return parseSource(source);
  } catch {
    return { ast: { blocks: [] }, diagnostics: [] };
  }
}
