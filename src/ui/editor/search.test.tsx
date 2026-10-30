// @vitest-environment jsdom
import { openSearchPanel } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from './index';

// jsdom lacks layout APIs CodeMirror measures with.
const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => rect as DOMRect;

function mount(locale?: 'sr' | 'en') {
  const props = { value: 'objekat Radnik {}', onChange: () => {}, diagnostics: [], highlightRange: null };
  const r = render(<Editor {...props} locale={locale} />);
  const view = EditorView.findFromDOM(r.getByTestId('pmov-editor').querySelector('.cm-editor') as HTMLElement)!;
  return { ...r, view, props };
}

afterEach(cleanup);

describe('search panel', () => {
  it('opens with Serbian labels by default', () => {
    const { view, container } = mount();
    act(() => void openSearchPanel(view));
    expect(container.querySelector<HTMLInputElement>('.cm-search input[name=search]')?.placeholder).toBe('Pronađi');
  });

  it('follows the locale prop', () => {
    const { view, container, rerender, props } = mount('sr');
    rerender(<Editor {...props} locale="en" />);
    act(() => void openSearchPanel(view));
    expect(container.querySelector<HTMLInputElement>('.cm-search input[name=search]')?.placeholder).toBe('Find');
  });
});
