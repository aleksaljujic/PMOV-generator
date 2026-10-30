// @vitest-environment jsdom
// T36 / C13 §2: JSON export / import wiring. `../../interchange` is mocked (T35 lives in parallel).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  parse: vi.fn(),
  exportFn: vi.fn(() => '{"x":1}\n'),
  download: vi.fn(),
  tabs: {} as Record<string, any>,
}));

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
    DiagramView: React.forwardRef(function FakeDiagram(p: any, ref) {
      React.useImperativeHandle(ref, () => ({ fitView: vi.fn(), getPositions: () => ({ A: { x: 1, y: 2 } }), centerOnElement: vi.fn() }));
      return <div data-testid="diagram" data-saved={JSON.stringify(p.savedPositions)} />;
    }),
  };
});
vi.mock('./download', () => ({ downloadBlob: h.download }));
vi.mock('../tabs', () => ({
  DomainTab: () => <div />,
  RelationalTab: () => <div />,
  ConstraintsTab: () => <div />,
  SqlTab: (p: any) => { h.tabs.sql = p; return <div />; },
}));
vi.mock('../../interchange', () => ({
  PMOV_JSON_MAX_BYTES: 100,
  exportDiagramJson: h.exportFn,
  parseDiagramJson: h.parse,
  formatJsonImportError: (e: { code: string }) => `ERR:${e.code}`,
}));

import { App } from './App';

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
const file = (text: string, size?: number) => {
  const f = new File([text], 'd.json', { type: 'application/json' });
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size });
  return f;
};
const pick = async (f: File) => {
  const input = screen.getByTestId('import-json-input') as HTMLInputElement;
  await act(async () => { fireEvent.change(input, { target: { files: [f] } }); });
  await flush();
};
const OK = { ok: true, source: 'objekat B {\n  Id# : long\n}\n', positions: { B: { x: 5, y: 6 } }, options: { dg0Mode: 'relation', sqlDialect: 'oracle' }, fromModel: false };

let alertSpy: any;
let confirmSpy: any;
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  h.parse.mockReturnValue(OK);
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('App JSON export (C13 §2)', () => {
  it('downloads an application/json blob named pmov-dijagram.json (sr) / pmov-diagram.json (en)', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Izvezi JSON' }));
    expect(h.download).toHaveBeenCalledTimes(1);
    const [blob, name] = h.download.mock.calls[0] as unknown as [Blob, string];
    expect(blob.type).toBe('application/json;charset=utf-8');
    expect(name).toBe('pmov-dijagram.json');
    const arg = (h.exportFn.mock.calls[0] as any[])[0];
    expect(arg.positions).toEqual({ A: { x: 1, y: 2 } });
    expect(arg.options).toEqual({ dg0Mode: 'fk', sqlDialect: 'postgres' });
    expect(arg.locale).toBe('sr');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(h.download.mock.calls[1]?.[1]).toBe('pmov-diagram.json');
  });

  it('alerts when the export throws', () => {
    h.exportFn.mockImplementationOnce(() => { throw new Error('boom'); });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Izvezi JSON' }));
    expect(h.download).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Izvoz nije uspeo: boom');
  });
});

describe('App JSON import (C13 §2)', () => {
  it('asks before replacing a non-empty source; OK sets source, positions and options', async () => {
    render(<App />);
    await pick(file('{}'));
    expect(confirmSpy).toHaveBeenCalledWith('Trenutni dijagram će biti zamenjen uvezenim. Nastaviti?');
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(OK.source);
    expect(JSON.parse(localStorage.getItem('pmov.positions.v1') ?? localStorage.getItem('pmov.positions') ?? '{}')).toEqual(OK.positions);
    expect(localStorage.getItem('pmov.dg0Mode.v1')).toBe('relation');
    expect(localStorage.getItem('pmov.sqlDialect.v1')).toBe('oracle');
    expect(screen.getByTestId('diagram').getAttribute('data-saved')).toBe(JSON.stringify(OK.positions));
  });

  it('Cancel changes nothing', async () => {
    confirmSpy.mockReturnValue(false);
    render(<App />);
    const before = (screen.getByTestId('editor') as HTMLTextAreaElement).value;
    await pick(file('{}'));
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(before);
    expect(localStorage.getItem('pmov.sqlDialect.v1')).toBeNull();
  });

  it('an empty source imports without asking', async () => {
    localStorage.setItem('pmov.source.v1', '  ');
    render(<App />);
    fireEvent.change(screen.getByTestId('editor'), { target: { value: '' } });
    await pick(file('{}'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(OK.source);
  });

  it('invalid file: alert, nothing changes', async () => {
    h.parse.mockReturnValue({ ok: false, error: { code: 'notJson' } });
    render(<App />);
    const before = (screen.getByTestId('editor') as HTMLTextAreaElement).value;
    await pick(file('nope'));
    expect(alertSpy).toHaveBeenCalledWith('ERR:notJson');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).value).toBe(before);
  });

  it('oversized file: tooLarge alert, parser not called', async () => {
    render(<App />);
    await pick(file('{}', 101));
    expect(alertSpy).toHaveBeenCalledWith('ERR:tooLarge');
    expect(h.parse).not.toHaveBeenCalled();
  });

  it('shows the notice when imported from a model', async () => {
    h.parse.mockReturnValue({ ...OK, fromModel: true });
    render(<App />);
    await pick(file('{}'));
    expect(alertSpy).toHaveBeenCalledWith('Dijagram je uvezen iz modela; DSL tekst je generisan.');
  });

  it('Interaktivno: one Poništi restores the previous source and positions', async () => {
    localStorage.setItem('pmov.mode.v1', 'interaktivno');
    localStorage.setItem('pmov.source.v1', 'objekat Stari {\n  Id# : long\n}\n');
    localStorage.setItem('pmov.positions.v1', JSON.stringify({ Stari: { x: 9, y: 9 } }));
    render(<App />);
    await flush();
    await pick(file('{}'));
    expect(screen.getByTestId('diagram').getAttribute('data-saved')).toBe(JSON.stringify(OK.positions));
    fireEvent.click(screen.getByRole('button', { name: 'Poništi' }));
    await flush();
    expect(screen.getByTestId('diagram').getAttribute('data-saved')).toBe(JSON.stringify({ Stari: { x: 9, y: 9 } }));
  });
});
