import { describe, expect, it } from 'vitest';
import { SHELL_STRINGS } from './strings';

describe('shell strings', () => {
  it('sr and en have the same keys', () => {
    expect(Object.keys(SHELL_STRINGS.en).sort()).toEqual(Object.keys(SHELL_STRINGS.sr).sort());
  });
});
