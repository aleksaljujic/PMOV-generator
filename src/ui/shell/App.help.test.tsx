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

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('App syntax help (T51)', () => {
  it('the help button is visible and opens / closes the panel; F1 toggles it; language follows the switch', () => {
    render(<App />);
    expect(screen.queryByRole('complementary', { name: 'Pomoć za sintaksu' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '? Pomoć' }));
    expect(screen.getByRole('complementary', { name: 'Pomoć za sintaksu' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zatvori pomoć' }));
    expect(screen.queryByRole('complementary', { name: 'Pomoć za sintaksu' })).toBeNull();
    fireEvent.keyDown(window, { key: 'F1' });
    expect(screen.getByRole('complementary', { name: 'Pomoć za sintaksu' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('complementary', { name: 'Syntax help' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Syntax help' })).toBeNull();
  });
});
