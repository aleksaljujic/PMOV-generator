// @vitest-environment jsdom
// End-to-end with the real compiler and src/rm. Needs T22-T24 (domains/constraints in lang + rm).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { compile } from '../../lang';
import { EXAMPLES } from '../../examples';
import { ConstraintsTab, DomainTab } from './index';

afterEach(cleanup);

const example = EXAMPLES.find((e) => e.id === 'domeni')!;
const ir = compile(example.source).ir!;

describe('domeni example through the real pipeline', () => {
  it('Domeni tab lists 5 domains', () => {
    const { container } = render(<DomainTab ir={ir} />);
    expect(container.querySelectorAll('.pmov-tabs-domains tbody tr').length).toBe(5);
  });

  it('Ograničenja tab shows 6 referential cards and 1 general', () => {
    const { container } = render(<ConstraintsTab ir={ir} hasErrors={false} dg0Mode="fk" />);
    expect(container.querySelectorAll('.pmov-tabs-card').length).toBe(7);
    expect(container.querySelectorAll('.pmov-tabs-badge').length).toBe(4);
    expect(screen.getByText('Radnik.SifOd ⊆ Odeljenje.SifOd')).toBeTruthy();
    // IsplateRadnika: parent DELETE RESTRICTED differs from the slab default
    expect(container.querySelectorAll('.pmov-tabs-bold').length).toBe(1);
  });
});
