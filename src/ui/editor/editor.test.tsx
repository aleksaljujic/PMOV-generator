// @vitest-environment jsdom
import { StringStream } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EXAMPLES } from '../../examples';
import { formatDiagnostic, NO_SPAN, type Diagnostic } from '../../lang';
import { Editor, type EditorHandle } from './index';
import { mapDiagnostics } from './extensions';
import { pmovParser } from './pmovLanguage';

// jsdom lacks layout APIs CodeMirror measures with.
const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => rect as DOMRect;

function tokens(line: string): [string, string | null][] {
  const stream = new StringStream(line, 2, 2);
  const out: [string, string | null][] = [];
  while (!stream.eol()) {
    stream.start = stream.pos;
    const tok = pmovParser.token(stream, null);
    if (tok) out.push([stream.current(), tok]);
  }
  return out;
}

const diag = (from: number, to: number, severity: 'error' | 'warning' = 'error'): Diagnostic => ({
  code: severity === 'error' ? 'E04' : 'W01',
  severity,
  message: 'poruka',
  span: { ...NO_SPAN, from, to, line: 1, col: from + 1 },
  elementId: null,
});

describe('tokenizer', () => {
  it('tokenizes the main example constructs', () => {
    expect(tokens('objekat Radnik {')).toContainEqual(['objekat', 'keyword']);
    expect(tokens('  nadređeni Radnik (0,M)')).toEqual(
      expect.arrayContaining([['nadređeni', 'modifier'], ['(0,M)', 'number']]),
    );
    expect(tokens('  Mlb#    : long NotNull')).toEqual(
      expect.arrayContaining([['Mlb', 'variableName'], ['#', 'meta'], ['long', 'typeName']]),
    );
    expect(tokens('// komentar')).toEqual([['// komentar', 'comment']]);
    expect(tokens('objekat "Nalog za nabavku" {')).toContainEqual(['"Nalog za nabavku"', 'string']);
  });

  it('tokenizes every line of the first example without throwing', () => {
    for (const line of EXAMPLES[0]!.source.split('\n')) tokens(line);
  });
});

describe('diagnostics mapping', () => {
  it('clamps spans, widens empty ones, maps severity and message', () => {
    const d = diag(50, 60, 'warning');
    const m = mapDiagnostics([d], 10)[0]!;
    expect(m.from).toBeLessThan(m.to);
    expect(m.to).toBeLessThanOrEqual(10);
    expect(m.severity).toBe('warning');
    expect(m.message).toBe(formatDiagnostic(d));
    const w = mapDiagnostics([diag(3, 3)], 10)[0]!;
    expect([w.from, w.to]).toEqual([3, 4]);
    expect(mapDiagnostics([diag(0, 0)], 0)).toEqual([]);
  });
});

describe('Editor component', () => {
  const base = { onChange: () => {}, diagnostics: [], highlightRange: null };

  it('replaces doc on external value change and reports edits', () => {
    const onChange = vi.fn();
    const onCursorChange = vi.fn();
    const ref = createRef<EditorHandle>();
    const { container, rerender } = render(
      <Editor ref={ref} {...base} value="objekat A { X# }" onChange={onChange} onCursorChange={onCursorChange} />,
    );
    const content = () => container.querySelector('.cm-content')!.textContent;
    expect(content()).toContain('objekat A');
    rerender(<Editor ref={ref} {...base} value="veza B {}" onChange={onChange} onCursorChange={onCursorChange} />);
    expect(content()).toContain('veza B');
    expect(content()).not.toContain('objekat A');

    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement);
    expect(view).toBeTruthy();
    onChange.mockClear();
    act(() => view!.dispatch({ changes: { from: 0, insert: 'x' } }));
    expect(onChange).toHaveBeenCalledWith('xveza B {}');
    act(() => ref.current!.jumpTo(1, 3));
    expect(onCursorChange).toHaveBeenCalledWith(2);
    expect(() => ref.current!.revealRange(0, 1000)).not.toThrow();
  });

  it('shows block highlight and survives stale diagnostics', () => {
    const { container, rerender } = render(
      <Editor {...base} value="a\nb\nc" highlightRange={{ from: 2, to: 3 }} diagnostics={[diag(100, 120)]} />,
    );
    expect(container.querySelectorAll('.cm-pmov-block-line').length).toBeGreaterThan(0);
    rerender(<Editor {...base} value="a\nb\nc" highlightRange={null} diagnostics={[]} />);
    expect(container.querySelectorAll('.cm-pmov-block-line').length).toBe(0);
  });
});
