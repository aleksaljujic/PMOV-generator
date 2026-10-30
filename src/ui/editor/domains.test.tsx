// @vitest-environment jsdom
import { undo } from '@codemirror/commands';
import { StringStream } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Editor } from './index';
import { pmovParser } from './pmovLanguage';

const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => rect as DOMRect;

const run = (lines: string[]) => {
  const state = pmovParser.startState!(2);
  return lines.map((line) => {
    const stream = new StringStream(line, 2, 2);
    const out: [string, string | null][] = [];
    while (!stream.eol()) {
      stream.start = stream.pos;
      const tok = pmovParser.token(stream, state);
      if (tok) out.push([stream.current(), tok]);
    }
    return out;
  });
};

describe('domain and constraint highlighting', () => {
  it('highlights every declaration keyword like block kinds', () => {
    for (const w of ['domen', 'domain', 'ograničenje', 'ogranicenje', 'constraint', 'uslov', 'condition']) {
      expect(run([`${w} X`])[0]![0]).toEqual([w, 'keyword']);
    }
  });

  it('highlights -> as operator', () => {
    expect(run(['A.b -> C.d'])[0]).toContainEqual(['->', 'operator']);
  });

  it('highlights operations and actions (any case) inside constraint blocks only', () => {
    const r = run([
      'ograničenje Veza {',
      '  INSERT: Restricted',
      '  update: cascades nullifies default delete',
      '}',
      'objekat A {',
      '  update : long',
      '}',
    ]);
    expect(r[1]).toEqual(expect.arrayContaining([['INSERT', 'modifier'], ['Restricted', 'modifier']]));
    expect(r[2]).toEqual(
      expect.arrayContaining([['update', 'modifier'], ['cascades', 'modifier'], ['nullifies', 'modifier'], ['default', 'modifier'], ['delete', 'modifier']]),
    );
    expect(r[5]![0]).toEqual(['update', 'variableName']);
  });
});

describe('external value change', () => {
  it('is one undoable transaction', () => {
    const base = { onChange: () => {}, diagnostics: [], highlightRange: null };
    const { container, rerender } = render(<Editor {...base} value="objekat A {}" />);
    rerender(<Editor {...base} value="objekat B {}" />);
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;
    expect(view.state.doc.toString()).toBe('objekat B {}');
    act(() => {
      undo(view);
    });
    expect(view.state.doc.toString()).toBe('objekat A {}');
  });
});
