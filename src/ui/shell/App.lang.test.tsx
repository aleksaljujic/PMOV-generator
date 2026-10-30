// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../../examples';

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
    DiagramView: React.forwardRef(function FakeDiagram(props: { graph: unknown; locale?: string }, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}), centerOnElement: vi.fn() }));
      return <div data-testid="diagram" data-locale={props.locale ?? ''} />;
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

import { App } from './App';

const editor = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const langBtn = (l: 'SR' | 'EN') => screen.getByRole('button', { name: l });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
});
afterEach(cleanup);

describe('App language switch', () => {
  it('defaults to Serbian with no stored key', () => {
    render(<App />);
    expect(langBtn('SR').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Domeni' })).toBeTruthy();
    expect(screen.getByTestId('diagram').getAttribute('data-locale')).toBe('sr');
    expect(document.documentElement.lang).toBe('sr');
    expect(localStorage.getItem('pmov.lang.v1')).toBeNull();
  });

  it('EN changes toolbar, tabs, error panel, diagram locale; source is unchanged', () => {
    render(<App />);
    const before = editor().value;
    fireEvent.click(langBtn('EN'));
    expect(screen.getByRole('tab', { name: 'Domains' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Relational model' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-layout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export SVG' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hide text (Ctrl+B)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New diagram' })).toBeTruthy();
    expect(screen.getByText('Errors and warnings')).toBeTruthy();
    expect(screen.getByLabelText('Examples')).toBeTruthy();
    expect(screen.getByTestId('diagram').getAttribute('data-locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(editor().value).toBe(before);
    fireEvent.click(langBtn('SR'));
    expect(screen.getByRole('tab', { name: 'Domeni' })).toBeTruthy();
  });

  it('is restored after a remount', () => {
    const first = render(<App />);
    fireEvent.click(langBtn('EN'));
    expect(localStorage.getItem('pmov.lang.v1')).toBe('en');
    first.unmount();
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Domains' })).toBeTruthy();
    expect(langBtn('EN').getAttribute('aria-pressed')).toBe('true');
  });

  it('picking an example in EN loads the English source and title', () => {
    render(<App />);
    fireEvent.click(langBtn('EN'));
    const ex = EXAMPLES.find((e) => e.sourceEn)!;
    fireEvent.mouseDown(screen.getByLabelText('Examples'));
    fireEvent.click(screen.getByRole('option', { name: ex.titleEn }));
    expect(editor().value).toBe(ex.sourceEn);
    expect((screen.getByLabelText('Examples') as HTMLInputElement).value).toBe(ex.titleEn);
  });
});
