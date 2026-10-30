import { type Diagnostic as CmDiagnostic, setDiagnostics } from '@codemirror/lint';
import { type EditorState, StateEffect, StateField, type TransactionSpec } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { type Diagnostic, formatDiagnostic, type Locale } from '../../lang';

/** Map PMOV diagnostics to CodeMirror ones: clamped spans, zero-length widened to 1 char. */
export function mapDiagnostics(diagnostics: readonly Diagnostic[], docLength: number, locale?: Locale): CmDiagnostic[] {
  const out: CmDiagnostic[] = [];
  for (const d of diagnostics) {
    let from = Math.max(0, Math.min(d.span.from, docLength));
    let to = Math.max(from, Math.min(d.span.to, docLength));
    if (to === from) {
      if (from < docLength) to = from + 1;
      else if (from > 0) from = from - 1;
      else continue; // empty document: nothing to underline
    }
    out.push({ from, to, severity: d.severity, message: formatDiagnostic(d, locale) });
  }
  return out;
}

export function diagnosticsTransaction(state: EditorState, diagnostics: readonly Diagnostic[], locale?: Locale): TransactionSpec {
  return setDiagnostics(state, mapDiagnostics(diagnostics, state.doc.length, locale));
}

export const setHighlightRange = StateEffect.define<{ from: number; to: number } | null>();

const blockLine = Decoration.line({ class: 'cm-pmov-block-line' });

export const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightRange)) {
        if (!e.value) return Decoration.none;
        const len = tr.state.doc.length;
        const from = Math.max(0, Math.min(e.value.from, len));
        const to = Math.max(from, Math.min(e.value.to, len));
        const ranges = [];
        const first = tr.state.doc.lineAt(from).number;
        const last = tr.state.doc.lineAt(to).number;
        for (let n = first; n <= last; n++) ranges.push(blockLine.range(tr.state.doc.line(n).from));
        return Decoration.set(ranges, true);
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#ffffff', color: '#111827' },
    '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' },
    '.cm-pmov-block-line': { backgroundColor: 'rgba(250, 204, 21, 0.25)' },
  },
  { dark: false },
);

