// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { MAIN_EXAMPLE_RM } from '../../fixtures/rm';

vi.mock('../../rm', () => ({
  generateRelationalModel: vi.fn(() => MAIN_EXAMPLE_RM),
  formatModelText: vi.fn(() => ''),
  generateSql: vi.fn((_rm, _ir, _l, d) => (d === 'mssql' ? 'CREATE TABLE [X];' : 'CREATE TABLE "X";')),
  buildDomainTable: vi.fn(() => []),
  dg0ToggleableVezas: vi.fn(() => []),
}));

import * as rm from '../../rm';
import { SqlTab } from './index';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = { ir: MAIN_EXAMPLE_IR, hasErrors: false, dg0Mode: 'fk' as const };

describe('SqlTab dialect', () => {
  it('has no dropdown without onDialectChange', () => {
    render(<SqlTab {...base} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(vi.mocked(rm.generateSql).mock.calls[0]?.[3]).toBe('postgres');
  });
  it('shows current dialect and reports changes', () => {
    const onChange = vi.fn();
    render(<SqlTab {...base} dialect="oracle" onDialectChange={onChange} />);
    const sel = screen.getByLabelText('Dijalekt:') as HTMLSelectElement;
    expect(sel.value).toBe('oracle');
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual([
      'PostgreSQL',
      'Microsoft SQL Server',
      'Oracle',
    ]);
    fireEvent.change(sel, { target: { value: 'mssql' } });
    expect(onChange).toHaveBeenCalledWith('mssql');
  });
  it('passes the dialect to generateSql', () => {
    const { container } = render(<SqlTab {...base} dialect="mssql" onDialectChange={() => {}} />);
    expect(container.querySelector('pre')?.textContent).toContain('[');
  });
  it('English label', () => {
    render(<SqlTab {...base} locale="en" onDialectChange={() => {}} />);
    expect(screen.getByLabelText('Dialect:')).toBeTruthy();
  });
  it('no dropdown in error and empty states', () => {
    const { rerender } = render(<SqlTab {...base} hasErrors onDialectChange={() => {}} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    rerender(<SqlTab {...base} ir={null} onDialectChange={() => {}} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
