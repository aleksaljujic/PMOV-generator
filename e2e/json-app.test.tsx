// T37 / C13 §3: App-level export -> clear storage -> import. Editor, DiagramView and download are mocked (as in the
// shell's own tests); interchange, compile, rm and the tabs are real.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const h = vi.hoisted(() => ({
  download: vi.fn(),
  positions: {} as Record<string, { x: number; y: number }>,
}));

vi.mock('../src/ui/editor', async () => {
  const React = await import('react');
  return {
    Editor: React.forwardRef(function FakeEditor(props: { value: string; onChange(v: string): void }, ref) {
      React.useImperativeHandle(ref, () => ({ jumpTo: vi.fn(), revealRange: vi.fn(), focus: vi.fn() }));
      return <textarea data-testid="editor" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
    }),
  };
});
vi.mock('../src/render/flow', async () => {
  const React = await import('react');
  return {
    DiagramView: React.forwardRef(function FakeDiagram(_p: unknown, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => h.positions, centerOnElement: vi.fn() }));
      return <div data-testid="diagram" />;
    }),
  };
});
vi.mock('../src/ui/shell/download', () => ({ downloadBlob: h.download }));

import { App } from '../src/ui/shell/App';
import { EXAMPLES } from '../src/examples';

const readBlob = (b: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(b);
  });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });
const editor = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const importFile = async (text: string) => {
  const input = screen.getByTestId('import-json-input') as HTMLInputElement;
  const f = new File([text], 'd.json', { type: 'application/json' });
  await act(async () => { fireEvent.change(input, { target: { files: [f] } }); });
  await flush();
};
const openTab = async (name: RegExp) => {
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name })); });
  await flush();
};
const tabText = () => (document.querySelector('.panel:not(.panel--diagram)') ?? document.body).textContent ?? '';
const SQL_KEYS = ['pmov.source.v1', 'pmov.positions.v1', 'pmov.dg0Mode.v1', 'pmov.sqlDialect.v1'];

let alertSpy: MockInstance<typeof window.alert>;
let confirmSpy: MockInstance<typeof window.confirm>;
beforeEach(() => {
  localStorage.clear();
  h.download.mockClear();
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Differs from the app's default source, so a fresh browser visibly changes after import.
const MAIN = EXAMPLES[0]!.source + '\n// moj dijagram\n';

describe('App JSON export -> import (e2e)', () => {
  it('restores source, dragged positions, options and the Relacioni model in a fresh browser', async () => {
    h.positions = { Radnik: { x: 321.5, y: 45 }, Odeljenje: { x: -10, y: 77.25 } };
    localStorage.setItem('pmov.source.v1', MAIN);
    localStorage.setItem('pmov.dg0Mode.v1', 'relation');
    localStorage.setItem('pmov.sqlDialect.v1', 'oracle');
    const first = render(<App />);
    await flush();
    expect(editor().value).toBe(MAIN);
    await openTab(/Relacioni/);
    const rmBefore = tabText();
    expect(rmBefore.length).toBeGreaterThan(50);
    await openTab(/SQL/);
    const sqlBefore = tabText();

    fireEvent.click(screen.getByRole('button', { name: 'Izvezi JSON' }));
    expect(h.download).toHaveBeenCalledTimes(1);
    const [blob, name] = h.download.mock.calls[0] as unknown as [Blob, string];
    expect(name).toBe('pmov-dijagram.json');
    expect(blob.type).toContain('application/json');
    const text = await readBlob(blob);
    const file = JSON.parse(text);
    expect(file.source).toBe(MAIN);
    expect(file.positions).toEqual(h.positions);
    expect(file.options).toEqual({ dg0Mode: 'relation', sqlDialect: 'oracle' });
    expect(file.model.elements.length).toBeGreaterThan(0);
    expect(file.diagram.nodes.length).toBeGreaterThan(0);

    first.unmount();
    localStorage.clear();
    h.positions = {};
    render(<App />);
    await flush();
    expect(editor().value).not.toBe(MAIN);
    await importFile(text);

    expect(editor().value).toBe(MAIN);
    const stored = JSON.parse(localStorage.getItem('pmov.positions.v1') ?? '{}');
    expect(stored).toEqual(file.positions);
    expect(localStorage.getItem('pmov.dg0Mode.v1')).toBe('relation');
    expect(localStorage.getItem('pmov.sqlDialect.v1')).toBe('oracle');
    await openTab(/Relacioni/);
    expect(tabText()).toBe(rmBefore);
    await openTab(/SQL/);
    expect(tabText()).toBe(sqlBefore);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('invalid file: alert, nothing changes', async () => {
    localStorage.setItem('pmov.source.v1', MAIN);
    render(<App />);
    await flush();
    const before = Object.fromEntries(SQL_KEYS.map((k) => [k, localStorage.getItem(k)]));
    for (const bad of ['not json', '{"format":"other","version":1}', '{"format":"pmov-diagram","version":9,"source":"x"}', '[]']) {
      alertSpy.mockClear();
      await importFile(bad);
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(String(alertSpy.mock.calls[0]![0])).toMatch(/^Uvoz nije uspeo|Datoteka je iz novije/);
      expect(editor().value).toBe(MAIN);
      expect(Object.fromEntries(SQL_KEYS.map((k) => [k, localStorage.getItem(k)]))).toEqual(before);
    }
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Cancel on the confirm changes nothing', async () => {
    localStorage.setItem('pmov.source.v1', MAIN);
    render(<App />);
    await flush();
    confirmSpy.mockReturnValue(false);
    const text = JSON.stringify({ format: 'pmov-diagram', version: 1, source: 'objekat B {\n  Id# : long\n}\n', positions: { B: { x: 1, y: 2 } } });
    await importFile(text);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(editor().value).toBe(MAIN);
    expect(localStorage.getItem('pmov.positions.v1') ?? '{}').not.toContain('"B"');
  });

  it('model-only file imports as generated DSL', async () => {
    localStorage.setItem('pmov.source.v1', MAIN);
    render(<App />);
    await flush();
    const text = JSON.stringify({
      format: 'pmov-diagram', version: 1, locale: 'sr',
      model: { elements: [{ kind: 'objekat', id: 'Radnik', name: 'Radnik', attributes: [{ name: 'Mlb', isId: true, domain: 'long', constraint: null }] }] },
    });
    await importFile(text);
    expect(editor().value).toMatch(/objekat Radnik/);
    expect(editor().value).not.toBe(MAIN);
  });
});
