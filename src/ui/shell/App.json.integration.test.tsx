// @vitest-environment jsdom
// T36 + T35: real interchange. Export from the shell, import the text back into a fresh shell. Red until T35 lands.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSON_TINY_FILE_TEXT, JSON_TINY_SOURCE, JSON_TINY_POSITIONS } from '../../fixtures/json';

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
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => JSON_TINY_POSITIONS, centerOnElement: vi.fn() }));
      return <div data-testid="diagram" />;
    }),
  };
});
const download = vi.hoisted(() => vi.fn());
vi.mock('./download', () => ({ downloadBlob: download }));

import { App } from './App';

const readBlob = (b: Blob): Promise<string> =>
  typeof b.text === 'function'
    ? b.text()
    : new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result ?? ''));
        fr.onerror = () => reject(fr.error);
        fr.readAsText(b);
      });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
beforeEach(() => { localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('App JSON (integration, needs T35)', () => {
  it('imports a real exported file: source and positions restored', async () => {
    render(<App />);
    const input = screen.getByTestId('import-json-input') as HTMLInputElement;
    const f = new File([JSON_TINY_FILE_TEXT], 'd.json', { type: 'application/json' });
    await act(async () => { fireEvent.change(input, { target: { files: [f] } }); });
    await flush();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(JSON_TINY_SOURCE);
    expect(JSON.parse(localStorage.getItem('pmov.positions.v1') ?? '{}')).toEqual(JSON_TINY_POSITIONS);
  });

  it('exports a parseable file with the current source and positions', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Izvezi JSON' }));
    const blob = (download.mock.calls[0] as unknown as [Blob])[0];
    const parsed = JSON.parse(await readBlob(blob));
    expect(parsed.format).toBe('pmov-diagram');
    expect(parsed.positions).toEqual(JSON_TINY_POSITIONS);
  });
});
