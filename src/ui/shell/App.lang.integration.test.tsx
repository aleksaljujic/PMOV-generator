// @vitest-environment jsdom
// Needs T16 (English diagnostics from compile) and T17/T14 props.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { App } from './App';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('App language (integration)', () => {
  it('shows English diagnostics in the error panel in EN and Serbian after switching back', () => {
    vi.useFakeTimers();
    localStorage.setItem('pmov.lang.v1', 'en');
    render(<App />);
    fireEvent.change(screen.getByTestId('editor'), { target: { value: 'object A {\n  X#\n' } });
    act(() => { vi.advanceTimersByTime(400); });
    const items = () => screen.getAllByRole('button').filter((b) => b.className.includes('error-panel__item'));
    expect(items().length).toBeGreaterThan(0);
    expect(items()[0]!.textContent).toMatch(/^error S\d\d \(line \d+, col \d+\): /);
    fireEvent.click(screen.getByRole('button', { name: 'SR' }));
    act(() => { vi.advanceTimersByTime(50); });
    expect(items()[0]!.textContent).toMatch(/^greška S\d\d \(red \d+, kol \d+\): /);
  });

  it('New diagram in EN writes English keywords and a placeholder name (needs T18)', () => {
    localStorage.setItem('pmov.lang.v1', 'en');
    localStorage.setItem('pmov.source.v1', '');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'New diagram' }));
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ }));
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toMatch(/^object Object\d+ \{/);
  });
});
