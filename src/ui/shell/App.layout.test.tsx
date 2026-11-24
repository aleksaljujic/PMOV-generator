// @vitest-environment jsdom
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const last: { props: any } = { props: null };
vi.mock('../../render/flow', async () => {
  const React = await import('react');
  return {
    DiagramView: React.forwardRef(function FakeDiagram(props: object, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({}), centerOnElement: vi.fn() }));
      last.props = props;
      return <div data-testid="diagram" />;
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: vi.fn() }));

import { App } from './App';

const positions = () => JSON.parse(localStorage.getItem('pmov.positions.v1') ?? '{}');

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('App layout settings (T49)', () => {
  it('passes defaults to DiagramView and persists changes', () => {
    render(<App />);
    expect(last.props.layoutAlgorithm).toBe('grid');
    expect(last.props.lockAttributes).toBe(true);
    expect(last.props.snapToGrid).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Atributi prate objekat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poravnaj na mrežu' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Raspored' }), { target: { value: 'free' } });
    expect(last.props.layoutAlgorithm).toBe('free');
    expect(last.props.lockAttributes).toBe(false);
    expect(last.props.snapToGrid).toBe(false);
    expect(localStorage.getItem('pmov.layout.v1')).toBe('free');
    expect(localStorage.getItem('pmov.attrLock.v1')).toBe('false');
    expect(localStorage.getItem('pmov.snap.v1')).toBe('false');
  });

  it('reads stored settings on start', () => {
    localStorage.setItem('pmov.layout.v1', 'free');
    localStorage.setItem('pmov.snap.v1', 'false');
    render(<App />);
    expect(last.props.layoutAlgorithm).toBe('free');
    expect(last.props.snapToGrid).toBe(false);
    expect(last.props.lockAttributes).toBe(true);
  });

  it('onNodesMoved with three nodes is one undo step', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ })); // interaktivno: Poništi visible
    act(() => last.props.onNodesMoved({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, c: { x: 5, y: 6 } }));
    expect(positions()).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, c: { x: 5, y: 6 } });
    fireEvent.click(screen.getByRole('button', { name: 'Poništi' }));
    expect(positions()).toEqual({});
    expect((screen.getByRole('button', { name: 'Poništi' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ponovi' }));
    expect(Object.keys(positions())).toHaveLength(3);
  });

  it('layout change clears positions and forces a fresh layout, one undo step', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+B/ }));
    act(() => last.props.onNodesMoved({ a: { x: 1, y: 2 } }));
    const nonce = last.props.layoutNonce;
    fireEvent.change(screen.getByRole('combobox', { name: 'Raspored' }), { target: { value: 'free' } });
    expect(last.props.savedPositions).toEqual({});
    expect(last.props.layoutNonce).toBe(nonce + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Poništi' }));
    expect(last.props.savedPositions).toEqual({ a: { x: 1, y: 2 } });
  });
});
