// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { MAIN_EXAMPLE_RM } from '../../fixtures/rm';

vi.mock('../../rm', () => ({
  generateRelationalModel: vi.fn(() => MAIN_EXAMPLE_RM),
  formatModelText: vi.fn(() => 'MODEL TEXT'),
  generateSql: vi.fn(() => 'CREATE TABLE X;'),
  buildDomainTable: vi.fn(() => [{ attribute: 'Mlb', domain: 'long', constraint: 'NotNull' }]),
  dg0ToggleableVezas: vi.fn(() => ['Rukovođenje']),
}));

import { DomainTab, RelationalTab, SqlTab } from './index';
import { en, sr } from './strings';

afterEach(cleanup);

describe('strings', () => {
  it('sr and en have identical keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sr).sort());
  });
});

describe('locale="en"', () => {
  it('DomainTab headers and empty state', () => {
    const { container } = render(<DomainTab ir={MAIN_EXAMPLE_IR} locale="en" />);
    const heads = Array.from(container.querySelectorAll('th')).map((h) => h.textContent);
    expect(heads).toEqual(['ATTRIBUTE', 'DOMAIN', 'CONSTRAINT']);
    cleanup();
    render(<DomainTab ir={null} locale="en" />);
    expect(screen.getByText('No data. Enter a diagram in the editor.')).toBeTruthy();
  });
  it('RelationalTab labels and error state', () => {
    render(
      <RelationalTab ir={MAIN_EXAMPLE_IR} hasErrors={false} dg0Mode="relation" onDg0ModeChange={() => {}} locale="en" />,
    );
    expect(screen.getByText('Copy as text')).toBeTruthy();
    expect(screen.getByText('Relationships with DG=0:')).toBeTruthy();
    expect(screen.getByText('separate relation')).toBeTruthy();
    expect(screen.getByText('foreign key')).toBeTruthy();
    cleanup();
    render(<RelationalTab ir={MAIN_EXAMPLE_IR} hasErrors dg0Mode="relation" onDg0ModeChange={() => {}} locale="en" />);
    expect(screen.getByText('Fix the errors to generate the relational model.')).toBeTruthy();
  });
  it('SqlTab copy button and error state', () => {
    render(<SqlTab ir={MAIN_EXAMPLE_IR} hasErrors={false} dg0Mode="relation" locale="en" />);
    expect(screen.getByText('Copy')).toBeTruthy();
    cleanup();
    render(<SqlTab ir={MAIN_EXAMPLE_IR} hasErrors dg0Mode="relation" locale="en" />);
    expect(screen.getByText('Fix the errors to generate the relational model.')).toBeTruthy();
  });
});
