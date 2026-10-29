// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../../examples';

const jumpTo = vi.fn();
vi.mock('../editor', async () => {
  const React = await import('react');
  return {
    Editor: React.forwardRef(function FakeEditor(props: { value: string; onChange(v: string): void }, ref) {
      React.useImperativeHandle(ref, () => ({ jumpTo, revealRange: vi.fn(), focus: vi.fn() }));
      return <textarea data-testid="editor" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    }),
  };
});
vi.mock('../../render/flow', async () => {
  const React = await import('react');
  return {
    DiagramView: React.forwardRef(function FakeDiagram(props: { graph: unknown }, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}) }));
      return <div data-testid="diagram" data-has-graph={props.graph ? 'yes' : 'no'} />;
    }),
  };
});

const downloadBlob = vi.fn();
vi.mock('./download', () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));

import { App } from './App';

beforeEach(() => { localStorage.clear(); jumpTo.mockReset(); downloadBlob.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('App (integration)', () => {
  it('loads the default example and shows the tab bar and toolbar', () => {
    render(<App />);
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(EXAMPLES[0]!.source);
    for (const name of ['Dijagram', 'Domeni', 'Relacioni model', 'SQL', 'Ponovo rasporedi', 'Izvezi SVG', 'Izvezi PNG']) {
      expect(screen.getByRole(name.startsWith('Izvezi') || name.startsWith('Ponovo') ? 'button' : 'tab', { name })).toBeTruthy();
    }
    expect(screen.getByText('Greške i upozorenja')).toBeTruthy();
  });

  it('shows a diagnostic after a broken edit and 300ms; clicking it calls jumpTo; diagram stays mounted', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByTestId('editor'), { target: { value: 'objekat A {\n  X#\n' } });
    act(() => { vi.advanceTimersByTime(300); });
    const item = screen.getAllByRole('button').find((b) => b.className.includes('error-panel__item'));
    expect(item).toBeTruthy();
    fireEvent.click(item!);
    expect(jumpTo).toHaveBeenCalledTimes(1);
    // keeps the last valid graph
    expect(screen.getByTestId('diagram').getAttribute('data-has-graph')).toBe('yes');
    fireEvent.click(screen.getByRole('tab', { name: 'SQL' }));
    expect(screen.getByTestId('diagram')).toBeTruthy();
  });

  it('persists source to localStorage', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.change(screen.getByTestId('editor'), { target: { value: 'objekat B { Y# }\n' } });
    act(() => { vi.advanceTimersByTime(400); });
    expect(localStorage.getItem('pmov.source.v1')).toBe('objekat B { Y# }\n');
  });

  it('default example compiles, builds a graph and exports a real SVG', async () => {
    render(<App />);
    expect(screen.getByTestId('diagram').getAttribute('data-has-graph')).toBe('yes');
    expect(screen.getByTestId('error-count')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Izvezi SVG' }));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toBe('pmov-dijagram.svg');
    const text = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsText(blob);
    });
    expect(text).toContain('<svg');
  });
});
