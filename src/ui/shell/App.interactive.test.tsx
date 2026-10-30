// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  type Node = { id: string; elementId: string; type: string; label: string };
  return {
    DiagramView: React.forwardRef(function FakeDiagram(
      props: {
        graph: { nodes: Node[] } | null;
        renderNodeOverlay?(n: Node, s: { selected: boolean; hasError: boolean }): React.ReactNode;
      },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}), centerOnElement: vi.fn() }));
      return (
        <div data-testid="diagram">
          {props.graph?.nodes
            .filter((n) => n.type === 'objekat')
            .map((n) => (
              <div key={n.id} data-testid={`n-${n.id}`}>
                {n.label}
                {props.renderNodeOverlay?.(n, { selected: true, hasError: false })}
              </div>
            ))}
        </div>
      );
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

import { App } from './App';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
// The ☰ toggle: open = Tekst, closed = Interaktivno. Clicking it switches to the other mode.
const burger = () => screen.getByRole('button', { name: /Ctrl\+B/ });
const mode = (name: 'Tekst' | 'Interaktivno') => ({
  click: () => { if ((burger().getAttribute('aria-expanded') === 'true') === (name === 'Interaktivno')) fireEvent.click(burger()); },
  isActive: () => burger().getAttribute('aria-expanded') === (name === 'Tekst' ? 'true' : 'false'),
});
const NEW = 'objekat Objekat1 {\n}\n';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('App mode switch (C09)', () => {
  it('defaults to Tekst: editor visible, nothing stored', () => {
    render(<App />);
    expect(screen.getByTestId('editor')).toBeTruthy();
    expect(mode('Tekst').isActive()).toBe(true);
    expect(localStorage.getItem('pmov.mode.v1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Poništi' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Novi dijagram' })).toBeTruthy();
  });

  it('Interaktivno hides the editor, keeps the error panel and tabs, and persists the mode', () => {
    render(<App />);
    mode('Interaktivno').click();
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByText('Greške i upozorenja')).toBeTruthy();
    expect(screen.getAllByText('Greške i upozorenja')).toHaveLength(1);
    for (const t of ['Dijagram', 'Domeni', 'Relacioni model', 'SQL']) expect(screen.getByRole('tab', { name: t })).toBeTruthy();
    expect(localStorage.getItem('pmov.mode.v1')).toBe('interaktivno');
    mode('Tekst').click();
    expect(screen.getByTestId('editor')).toBeTruthy();
    expect(localStorage.getItem('pmov.mode.v1')).toBe('tekst');
  });

  it('restores the stored mode on load', () => {
    localStorage.setItem('pmov.mode.v1', 'interaktivno');
    render(<App />);
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(mode('Interaktivno').isActive()).toBe(true);
  });

  it('both modes share one source', () => {
    render(<App />);
    mode('Interaktivno').click();
    mode('Tekst').click();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(EXAMPLES[0]!.source);
  });
});

describe('Novi dijagram', () => {
  it('asks before replacing a non-empty source; declining changes nothing', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novi dijagram' }));
    expect(confirm).toHaveBeenCalledWith('Trenutni dijagram će biti zamenjen. Nastaviti?');
    expect(screen.getByTestId('editor')).toBeTruthy();
  });

  it('replaces the source with one placeholder object and switches to Interaktivno', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novi dijagram' }));
    await flush();
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.getByTestId('n-Objekat1')).toBeTruthy();
    // the name field opens automatically
    expect((screen.getByLabelText('Ime') as HTMLInputElement).value).toBe('Objekat1');
    mode('Tekst').click();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(NEW);
  });

  it('does not ask when the source is empty', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<App />);
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Novi dijagram' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(mode('Interaktivno').isActive()).toBe(true);
  });
});

describe('undo / redo', () => {
  async function build() {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Novi dijagram' }));
    await flush();
    fireEvent.keyDown(screen.getByLabelText('Ime'), { key: 'Escape' });
    // + → Objekat on Objekat1
    fireEvent.click(within(screen.getByTestId('n-Objekat1')).getByRole('button', { name: 'Dodaj' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Objekat' }));
    await flush();
  }
  const text = () => {
    mode('Tekst').click();
    const v = (screen.getByTestId('editor') as HTMLTextAreaElement).value;
    mode('Interaktivno').click();
    return v;
  };

  it('Poništi / Ponovi and Ctrl+Z / Ctrl+Shift+Z walk the history', async () => {
    await build();
    expect(screen.getByTestId('n-Objekat2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Poništi' }));
    await flush();
    expect(screen.queryByTestId('n-Objekat2')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ponovi' }));
    await flush();
    expect(screen.getByTestId('n-Objekat2')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await flush();
    expect(screen.queryByTestId('n-Objekat2')).toBeNull();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    await flush();
    expect(screen.getByTestId('n-Objekat2')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    await flush();
    expect(screen.getByTestId('n-Objekat2')).toBeTruthy();
  });

  it('the produced text is the builder output; switching modes clears the history', async () => {
    await build();
    expect(text()).toBe(`${NEW}\nobjekat Objekat2 {\n}\n`);
    mode('Tekst').click();
    mode('Interaktivno').click();
    expect((screen.getByRole('button', { name: 'Poništi' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Undo/Redo are disabled with an empty history', () => {
    localStorage.setItem('pmov.mode.v1', 'interaktivno');
    render(<App />);
    expect((screen.getByRole('button', { name: 'Poništi' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Ponovi' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('syntax errors in Interaktivno', () => {
  it('shows the banner, disables controls and "Otvori tekst" switches to Tekst', async () => {
    localStorage.setItem('pmov.source.v1', 'objekat A {\n  X#\n');
    localStorage.setItem('pmov.mode.v1', 'interaktivno');
    render(<App />);
    await flush();
    expect(screen.getByText('Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dodaj' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Otvori tekst' }));
    expect(screen.getByTestId('editor')).toBeTruthy();
  });
});
