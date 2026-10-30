// Owned by T07. Contract C08 §Editor.
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
} from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Diagnostic, Locale } from "../../lang";
import {
  diagnosticsTransaction,
  editorTheme,
  highlightField,
  setHighlightRange,
} from "./extensions";
import { pmovHighlighting, pmovLanguage } from "./pmovLanguage";
import { PHRASES } from "./strings";

/** Tab inserts one indent unit at the cursor (or indents the selected lines); Shift+Tab dedents.
 *  Esc, Tab (CodeMirror default: Tab is unbound after Esc) is not overridden here. */
const tabKeymap = [
  {
    key: "Tab",
    run: (v: EditorView) => {
      const sel = v.state.selection;
      if (sel.ranges.every((r) => r.empty)) {
        v.dispatch(
          v.state.changeByRange((r) => ({
            changes: { from: r.from, insert: "  " },
            range: EditorSelection.cursor(r.from + 2),
          })),
          {
            userEvent: "input",
            scrollIntoView: true,
          },
        );
        return true;
      }
      return indentMore(v);
    },
    shift: indentLess,
  },
];

export interface EditorHandle {
  jumpTo(line: number, col: number): void;
  revealRange(from: number, to: number): void;
  focus(): void;
}

export interface EditorProps {
  value: string;
  onChange(value: string): void;
  diagnostics: Diagnostic[];
  highlightRange: { from: number; to: number } | null;
  onCursorChange?(offset: number): void;
  /** Language of the lint messages (default 'sr'). */
  locale?: Locale;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(
  function Editor(props, ref) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const latest = useRef(props);
    latest.current = props;
    const phrases = useRef(new Compartment());

    useEffect(() => {
      const v = new EditorView({
        parent: host.current!,
        state: EditorState.create({
          doc: latest.current.value,
          extensions: [
            lineNumbers(),
            lintGutter(),
            history(),
            drawSelection(),
            indentUnit.of("  "),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            search({ top: true }),
            phrases.current.of(
              EditorState.phrases.of(PHRASES[latest.current.locale ?? "sr"]),
            ),
            keymap.of([
              ...closeBracketsKeymap,
              ...defaultKeymap,
              ...searchKeymap,
              ...historyKeymap,
              ...tabKeymap,
            ]),
            pmovLanguage,
            pmovHighlighting,
            highlightField,
            editorTheme,
            EditorView.updateListener.of((u) => {
              if (u.docChanged) latest.current.onChange(u.state.doc.toString());
              if (u.selectionSet)
                latest.current.onCursorChange?.(u.state.selection.main.head);
            }),
          ],
        }),
      });
      view.current = v;
      v.dispatch(
        diagnosticsTransaction(
          v.state,
          latest.current.diagnostics,
          latest.current.locale,
        ),
      );
      v.dispatch({
        effects: setHighlightRange.of(latest.current.highlightRange),
      });
      return () => {
        v.destroy();
        view.current = null;
      };
    }, []);

    // external value changes
    useEffect(() => {
      const v = view.current;
      if (!v) return;
      const cur = v.state.doc.toString();
      if (cur !== props.value) {
        v.dispatch({
          changes: { from: 0, to: cur.length, insert: props.value },
          // one history entry (never merged with typing), so Ctrl+Z restores the previous text
          annotations: Transaction.addToHistory.of(true),
          userEvent: "input.external",
        });
      }
    }, [props.value]);

    // diagnostics (re-applied after value so clamping uses the current doc)
    useEffect(() => {
      const v = view.current;
      if (v)
        v.dispatch(
          diagnosticsTransaction(v.state, props.diagnostics, props.locale),
        );
    }, [props.diagnostics, props.value, props.locale]);

    // search panel language
    useEffect(() => {
      view.current?.dispatch({
        effects: phrases.current.reconfigure(
          EditorState.phrases.of(PHRASES[props.locale ?? "sr"]),
        ),
      });
    }, [props.locale]);

    const hl = props.highlightRange;
    useEffect(() => {
      const v = view.current;
      if (v)
        v.dispatch({
          effects: setHighlightRange.of(
            hl ? { from: hl.from, to: hl.to } : null,
          ),
        });
    }, [hl?.from, hl?.to]);

    useImperativeHandle(
      ref,
      () => ({
        jumpTo(line, col) {
          const v = view.current;
          if (!v) return;
          const ln = Math.max(1, Math.min(line, v.state.doc.lines));
          const l = v.state.doc.line(ln);
          const pos = Math.min(l.from + Math.max(0, col - 1), l.to);
          v.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: "center" }),
          });
          v.focus();
        },
        revealRange(from, _to) {
          const v = view.current;
          if (!v) return;
          const len = v.state.doc.length;
          const f = Math.max(0, Math.min(from, len));

          v.dispatch({
            effects: EditorView.scrollIntoView(f, { y: "nearest" }),
          });
        },
        focus() {
          view.current?.focus();
        },
      }),
      [],
    );

    return (
      <div
        ref={host}
        style={{ height: "100%", width: "100%", overflow: "hidden" }}
        data-testid="pmov-editor"
      />
    );
  },
);
