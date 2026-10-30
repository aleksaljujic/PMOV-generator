// @vitest-environment jsdom
import { StringStream } from '@codemirror/language';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_SPAN, type Diagnostic } from '../../lang';
import { mapDiagnostics } from './extensions';
import { Editor } from './index';
import { pmovParser } from './pmovLanguage';

const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => rect as DOMRect;

const base = { onChange: () => {}, diagnostics: [], highlightRange: null };

function mount(value: string, extra: Partial<Parameters<typeof Editor>[0]> = {}) {
  const r = render(<Editor {...base} value={value} {...extra} />);
  const view = EditorView.findFromDOM(r.container.querySelector('.cm-editor') as HTMLElement)!;
  return { ...r, view };
}

const key = (view: EditorView, k: string, shiftKey = false) =>
  runScopeHandlers(view, new KeyboardEvent('keydown', { key: k, shiftKey, cancelable: true }), 'editor');

function tok(word: string): string | null {
  const s = new StringStream(word, 2, 2);
  return pmovParser.token(s, null);
}

describe('Tab indentation', () => {
  it('inserts 2 spaces with an empty selection', () => {
    const { view } = mount('ab');
    act(() => view.dispatch({ selection: { anchor: 1 } }));
    let handled = false;
    act(() => {
      handled = key(view, 'Tab');
    });
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe('a  b');
  });

  it('indents and dedents every line of a selection', () => {
    const { view } = mount('a\nb\nc');
    act(() => view.dispatch({ selection: { anchor: 0, head: 5 } }));
    act(() => void key(view, 'Tab'));
    expect(view.state.doc.toString()).toBe('  a\n  b\n  c');
    act(() => void key(view, 'Tab', true));
    expect(view.state.doc.toString()).toBe('a\nb\nc');
  });
});

describe('auto indentation', () => {
  it('Enter after "{" indents by 2 spaces; Enter keeps indentation', () => {
    const src = 'objekat Radnik {';
    const { view } = mount(src);
    act(() => view.dispatch({ selection: { anchor: src.length } }));
    act(() => void insertNewlineAndIndent(view));
    expect(view.state.doc.toString()).toBe(src + '\n  ');
    act(() => void view.dispatch(view.state.replaceSelection('X#')));
    act(() => void insertNewlineAndIndent(view));
    expect(view.state.doc.toString()).toBe(src + '\n  X#\n  ');
  });

  it('typing "}" on an indented empty line dedents it', () => {
    const src = 'objekat A {\n  ';
    const { view } = mount(src);
    act(() =>
      view.dispatch({ changes: { from: src.length, insert: '}' }, selection: { anchor: src.length + 1 }, userEvent: 'input.type' }),
    );
    expect(view.state.doc.toString()).toBe('objekat A {\n}');
  });
});

describe('keyword aliases', () => {
  it('highlights aliases like the canonical keywords', () => {
    expect(tok('nadredjeni')).toBe(tok('nadređeni'));
    expect(tok('owner')).toBe('modifier');
    expect(tok('object')).toBe(tok('objekat'));
    expect(tok('object')).toBe('keyword');
    expect(tok('weak')).toBe(tok('slab'));
    expect(tok('supertype')).toBe('modifier');
  });
});

describe('locale', () => {
  const d: Diagnostic = {
    code: 'E04',
    severity: 'error',
    message: 'x',
    span: { ...NO_SPAN, from: 0, to: 1, line: 1, col: 1 },
    elementId: null,
  };
  it('mapDiagnostics follows the locale', () => {
    expect(mapDiagnostics([d], 5, 'en')[0]!.message.startsWith('error')).toBe(true);
    expect(mapDiagnostics([d], 5)[0]!.message.startsWith('greška')).toBe(true);
  });

  it('re-applies lint messages on locale change without touching doc or cursor', async () => {
    const { view, rerender } = mount('abc', { diagnostics: [d] });
    act(() => view.dispatch({ selection: { anchor: 2 } }));
    const { forEachDiagnostic } = await import('@codemirror/lint');
    const msgs = () => {
      const out: string[] = [];
      forEachDiagnostic(view.state, (x) => out.push(x.message));
      return out;
    };
    expect(msgs()[0]!.startsWith('greška')).toBe(true);
    rerender(<Editor {...base} value="abc" diagnostics={[d]} locale="en" />);
    expect(msgs()[0]!.startsWith('error')).toBe(true);
    expect(view.state.doc.toString()).toBe('abc');
    expect(view.state.selection.main.head).toBe(2);
  });
});
