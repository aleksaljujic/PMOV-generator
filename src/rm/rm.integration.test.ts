import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { compile } from '../lang';
import { formatModelText, generateRelationalModel } from './index';

describe('compile -> relational model', () => {
  it('EXAMPLES[0] produces the golden RM text', () => {
    const res = compile(EXAMPLES[0]!.source);
    expect(res.ir).not.toBeNull();
    const text = formatModelText(generateRelationalModel(res.ir!));
    expect(text.split('\n')[0]).toBe('Radnik(Mlb, ImeR, Adresa, Starost, SifOd)  key: Mlb; FK: SifOd');
    expect(text.split('\n')).toHaveLength(7);
  });
});
