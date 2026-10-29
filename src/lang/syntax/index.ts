// Public entry of src/lang/syntax — owned by T01. Contract C02.
import type { LexResult, ParseResult } from '../ast';

export function lex(_source: string): LexResult {
  throw new Error('not implemented: T01');
}

export function parse(_source: string): ParseResult {
  throw new Error('not implemented: T01');
}
