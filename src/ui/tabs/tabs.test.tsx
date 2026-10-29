// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { MAIN_EXAMPLE_RM } from '../../fixtures/rm';

vi.mock('../../rm', () => ({
  generateRelationalModel: vi.fn(() => MAIN_EXAMPLE_RM),
  formatModelText: vi.fn(() => 'MODEL TEXT'),
  generateSql: vi.fn(() => 'CREATE TABLE X;'),
  buildDomainTable: vi.fn(() => [
    { attribute: 'Mlb', domain: 'long', constraint: 'NotNull' },
    { attribute: 'ImeR', domain: 'string', constraint: '–' },
    { attribute: 'BrojInd', domain: '–', constraint: '–' },
  ]),
  dg0ToggleableVezas: vi.fn(() => ['Rukovođenje']),
}));

import * as rm from '../../rm';
import { DomainTab, RelationalTab, SqlTab } from './index';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('DomainTab', () => {
  it('renders rows without #', () => {
    const { container } = render(<DomainTab ir={MAIN_EXAMPLE_IR} />);
    expect(screen.getByText('ATRIBUT')).toBeTruthy();
    expect(screen.getByText('OGRANIČENJE')).toBeTruthy();
    expect(screen.getByText('Mlb')).toBeTruthy();
    expect(screen.getByText('long')).toBeTruthy();
    expect(screen.getByText('NotNull')).toBeTruthy();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('#');
  });
  it('empty state', () => {
    render(<DomainTab ir={null} />);
    expect(screen.getByText(/Nema podataka/)).toBeTruthy();
  });
});

describe('RelationalTab', () => {
  const props = { ir: MAIN_EXAMPLE_IR, hasErrors: false, dg0Mode: 'fk' as const };
  it('marks pk with u and fk with i', () => {
    const { container } = render(<RelationalTab {...props} onDg0ModeChange={() => {}} />);
    const us = [...container.querySelectorAll('u')].map((e) => e.textContent);
    const is = [...container.querySelectorAll('i')].map((e) => e.textContent);
    expect(us).toContain('Mlb');
    expect(is).toContain('SifOd');
    expect(us).toContain('BrojInd');
    expect(is).not.toContain('BrojInd');
  });
  it('toggle calls handler', () => {
    const fn = vi.fn();
    render(<RelationalTab {...props} onDg0ModeChange={fn} />);
    expect(screen.getByText('Veze sa DG=0:')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('posebna relacija'));
    expect(fn).toHaveBeenCalledWith('relation');
  });
  it('hides toggle when none toggleable', () => {
    vi.mocked(rm.dg0ToggleableVezas).mockReturnValueOnce([]);
    render(<RelationalTab {...props} onDg0ModeChange={() => {}} />);
    expect(screen.queryByText('Veze sa DG=0:')).toBeNull();
  });
  it('hasErrors shows message and skips generator', () => {
    render(<RelationalTab {...props} hasErrors onDg0ModeChange={() => {}} />);
    expect(screen.getByText('Ispravite greške da bi se generisao relacioni model.')).toBeTruthy();
    expect(rm.generateRelationalModel).not.toHaveBeenCalled();
  });
  it('copies model text', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RelationalTab {...props} onDg0ModeChange={() => {}} />);
    fireEvent.click(screen.getByText('Kopiraj kao tekst'));
    expect(writeText).toHaveBeenCalledWith('MODEL TEXT');
    await waitFor(() => expect(screen.getByText('Kopirano')).toBeTruthy());
  });
  it('does not throw without clipboard', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<RelationalTab {...props} onDg0ModeChange={() => {}} />);
    fireEvent.click(screen.getByText('Kopiraj kao tekst'));
  });
});

describe('SqlTab', () => {
  it('renders sql in pre and copies', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(<SqlTab ir={MAIN_EXAMPLE_IR} hasErrors={false} dg0Mode="fk" />);
    expect(container.querySelector('pre')?.textContent).toBe('CREATE TABLE X;');
    fireEvent.click(screen.getByText('Kopiraj'));
    expect(writeText).toHaveBeenCalledWith('CREATE TABLE X;');
  });
  it('error and empty states', () => {
    const { rerender } = render(<SqlTab ir={MAIN_EXAMPLE_IR} hasErrors dg0Mode="fk" />);
    expect(screen.getByText(/Ispravite greške/)).toBeTruthy();
    expect(rm.generateSql).not.toHaveBeenCalled();
    rerender(<SqlTab ir={null} hasErrors={false} dg0Mode="fk" />);
    expect(screen.getByText(/Nema podataka/)).toBeTruthy();
  });
});
