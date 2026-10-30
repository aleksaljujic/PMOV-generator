// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../../examples';

vi.mock('../editor', async () => {
  const React = await import('react');
  return {
    Editor: React.forwardRef(function FakeEditor(props: { value: string; onChange(v: string): void }, ref) {
      React.useImperativeHandle(ref, () => ({ jumpTo: vi.fn(), revealRange: vi.fn(), focus: () => document.querySelector<HTMLElement>('[data-testid="editor"]')?.focus() }));
      return <textarea data-testid="editor" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    }),
  };
});
vi.mock('../../render/flow', async () => {
  const React = await import('react');
  return {
    DiagramView: React.forwardRef(function FakeDiagram(_p: object, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}), centerOnElement: vi.fn() }));
      return <div data-testid="diagram" />;
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

import { App } from './App';

const burger = () => screen.getByRole('button', { name: /Ctrl\+B/ });
const expanded = () => burger().getAttribute('aria-expanded');

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('sidebar toggle (T38)', () => {
  it('default open; burger closes (builder on) and reopens, persisting pmov.mode.v1', () => {
    render(<App />);
    expect(expanded()).toBe('true');
    expect(screen.getByTestId('editor')).toBeTruthy();
    fireEvent.click(burger());
    expect(expanded()).toBe('false');
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByRole('button', { name: 'Poništi' })).toBeTruthy();
    expect(localStorage.getItem('pmov.mode.v1')).toBe('interaktivno');
    fireEvent.click(burger());
    expect(expanded()).toBe('true');
    expect(localStorage.getItem('pmov.mode.v1')).toBe('tekst');
    expect(screen.queryByRole('button', { name: 'Poništi' })).toBeNull();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(EXAMPLES[0]!.source);
  });

  it('Ctrl+B and Cmd+B toggle, also with focus in the editor; focus follows', () => {
    render(<App />);
    screen.getByTestId('editor').focus();
    fireEvent.keyDown(screen.getByTestId('editor'), { key: 'b', ctrlKey: true });
    expect(expanded()).toBe('false');
    expect(document.activeElement).toBe(screen.getByTestId('diagram-panel'));
    fireEvent.keyDown(document.body, { key: 'b', metaKey: true });
    expect(expanded()).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('editor'));
  });

  it('Ctrl+B is ignored in other text fields', () => {
    render(<App />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'b', ctrlKey: true });
    expect(expanded()).toBe('true');
    input.remove();
  });

  it('Novi dijagram closes the sidebar', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novi dijagram' }));
    expect(expanded()).toBe('false');
  });

  it('the editor stays mounted until the close transition ends when animation is on', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<App />);
    fireEvent.click(burger());
    expect(screen.queryByTestId('editor')).toBeTruthy();
    fireEvent.transitionEnd(container.querySelector('.split__left')!);
    expect(screen.queryByTestId('editor')).toBeNull();
    vi.unstubAllGlobals();
  });
});
