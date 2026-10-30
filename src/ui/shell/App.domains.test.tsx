// @vitest-environment jsdom
// T28 / C10 §7: RM diagnostics in the error panel, tab actions in both modes, diagnostic routing, EN labels.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const span = (from: number, to: number) => ({ from, to, line: 1, col: from + 1, endLine: 1, endCol: to + 1 });
  return {
    span,
    tabProps: {} as Record<string, any>,
    apply: vi.fn(),
    W05: { code: 'W05', severity: 'warning', message: 'domen nije korišćen', span: span(6, 10), elementId: null },
    E18: { code: 'E18', severity: 'error', message: 'nema stranog ključa', span: span(50, 55), elementId: null },
  };
});

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
  DomainTab: (p: any) => { h.tabProps.domains = p; return <div data-testid="tab-domains" />; },
  RelationalTab: (p: any) => { h.tabProps.rm = p; return <div data-testid="tab-rm" />; },
  ConstraintsTab: (p: any) => { h.tabProps.constraints = p; return <div data-testid="tab-constraints" />; },
  SqlTab: () => <div data-testid="tab-sql" />,
}));
vi.mock('../../rm', () => ({ generateRelationalModel: () => ({ diagnostics: [h.E18] }) }));
vi.mock('../../builder', async (orig) => ({ ...(await orig<typeof import('../../builder')>()), applyBuilderAction: (...a: unknown[]) => h.apply(...a) }));
vi.mock('../../lang', async (orig) => {
  const real = await orig<typeof import('../../lang')>();
  const { DOMAIN_EXAMPLE_IR } = await import('../../fixtures/domains');
  const ir = {
    ...DOMAIN_EXAMPLE_IR,
    domains: [{ name: 'Starost', parent: null, base: 'short', length: null, constraint: null, effectiveConstraint: null, span: h.span(0, 20), nameSpan: h.span(6, 12) }],
    constraints: [{ kind: 'referential', name: 'RC', span: h.span(40, 80), nameSpan: h.span(45, 47) }],
  };
  return { ...real, compile: () => ({ ast: null, ir, diagnostics: [h.W05], hasErrors: false }) };
});

import { App } from './App';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
beforeEach(() => { localStorage.clear(); h.apply.mockReset(); });
afterEach(cleanup);

describe('App domains and constraints (C10 §7)', () => {
  it('merges RM diagnostics into the panel without setting hasErrors for RM tabs', async () => {
    render(<App />);
    await flush();
    expect(screen.getByTestId('error-count').textContent).toBe('2');
    fireEvent.click(screen.getByRole('tab', { name: 'Relacioni model' }));
    expect(h.tabProps.rm.hasErrors).toBe(false);
  });

  it('has the Ograničenja tab between RM and SQL, with en labels', () => {
    render(<App />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Dijagram', 'Domeni', 'Relacioni model', 'Ograničenja', 'SQL']);
    cleanup();
    localStorage.setItem('pmov.lang.v1', 'en');
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Constraints' })).toBeTruthy();
  });

  it('Tekst: tab action replaces the editor value', async () => {
    h.apply.mockReturnValue({ ok: true, source: 'NEW SOURCE' });
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ograničenja' }));
    let r: any;
    act(() => { r = h.tabProps.constraints.onAction({ kind: 'deleteConstraint', name: 'RC' }); });
    expect(r.ok).toBe(true);
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe('NEW SOURCE');
  });

  it('Interaktivno: tab action is one undo step', async () => {
    h.apply.mockReturnValue({ ok: true, source: 'NEW SOURCE' });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Domeni' }));
    act(() => { h.tabProps.domains.onAction({ kind: 'deleteDomain', name: 'Starost' }); });
    h.apply.mockReturnValue({ ok: true, source: 'x' });
    fireEvent.click(screen.getByRole('button', { name: 'Poništi' }));
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ }));
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).not.toBe('NEW SOURCE');
  });

  it('Interaktivno: clicking W05 opens Domeni with the row highlighted', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ }));
    fireEvent.click(screen.getByText(/W05/));
    expect(screen.getByTestId('tab-domains')).toBeTruthy();
    expect(h.tabProps.domains.highlight).toEqual({ kind: 'domain', name: 'Starost' });
  });

  it('a diagnostic inside a constraint opens Ograničenja', async () => {
    render(<App />);
    await flush();
    fireEvent.click(screen.getByText(/E18/));
    expect(screen.getByTestId('tab-constraints')).toBeTruthy();
    expect(h.tabProps.constraints.highlight).toEqual({ kind: 'constraint', name: 'RC' });
  });
});
