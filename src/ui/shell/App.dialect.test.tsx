// @vitest-environment jsdom
// T32 / C11 §3: the shell keeps the SQL dialect and passes it to SqlTab.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ sql: {} as Record<string, any> }));

vi.mock('../editor', async () => {
  const React = await import('react');
  return {
    Editor: React.forwardRef(function FakeEditor(props: { value: string; onChange(v: string): void }, ref) {
      React.useImperativeHandle(ref, () => ({ jumpTo: vi.fn(), revealRange: vi.fn(), focus: vi.fn() }));
      return <textarea data-testid="editor" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    }),
  };
});
vi.mock('../../render/flow', async () => {
  const React = await import('react');
  return {
    DiagramView: React.forwardRef(function FakeDiagram(_p: unknown, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}), centerOnElement: vi.fn() }));
      return <div data-testid="diagram" />;
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: vi.fn() }));
vi.mock('../tabs', () => ({
  DomainTab: () => <div />,
  RelationalTab: () => <div />,
  ConstraintsTab: () => <div />,
  SqlTab: (p: any) => { h.sql = p; return <div data-testid="tab-sql" />; },
}));

import { App } from './App';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('App SQL dialect (C11 §3)', () => {
  it('defaults to postgres and passes the stored dialect to SqlTab', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'SQL' }));
    await flush();
    expect(h.sql.dialect).toBe('postgres');
    cleanup();
    localStorage.setItem('pmov.sqlDialect.v1', 'oracle');
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'SQL' }));
    await flush();
    expect(h.sql.dialect).toBe('oracle');
  });

  it('onDialectChange updates the prop and saves; example, new diagram and language keep it', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'SQL' }));
    await flush();
    act(() => h.sql.onDialectChange('mssql'));
    expect(h.sql.dialect).toBe('mssql');
    expect(localStorage.getItem('pmov.sqlDialect.v1')).toBe('mssql');

    const examples = screen.getByLabelText('Primeri');
    fireEvent.mouseDown(examples);
    fireEvent.click(screen.getAllByRole('option')[0]!);
    await flush();
    expect(h.sql.dialect).toBe('mssql');

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    await flush();
    expect(h.sql.dialect).toBe('mssql');
    expect(localStorage.getItem('pmov.sqlDialect.v1')).toBe('mssql');
  });
});
