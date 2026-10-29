# T07 — CodeMirror editor

**Wave:** 1 (parallel). **Implements:** C08 §Editor. **Consumes:** C01 (diagnostics, `formatDiagnostic`), C02 (keywords).
**Folder (owns everything inside):** `src/ui/editor/` — read its `AGENT.md`. Public entry: `src/ui/editor/index.ts`.

## Goal

A controlled React wrapper around CodeMirror 6 with PMOV syntax highlighting, lint squiggles from `Diagnostic[]`,
block highlighting for diagram → editor sync, and cursor reporting for editor → diagram sync.

## Steps

1. **Language** (`pmovLanguage.ts`): a `StreamLanguage` tokenizer (no Lezer grammar needed): `//` comments, block kinds
   (`objekat veza slab specijalizacija agregacija`), roles (`nadređeni nadtip podtip`), domains (`long short string date`),
   quoted names, `#`, cardinalities `(0,1)` `(1,M)` as a single token, punctuation. Use `BLOCK_KINDS`, `ROLES`, `DOMAINS`
   from `src/lang`. Add a `HighlightStyle` (keywords bold dark blue, roles purple, domains teal, comments grey
   italic, `#` and cardinalities orange). Language data: `commentTokens: { line: '//' }`, close brackets `{ ( "`.
2. **Lint**: a `StateField`/`setDiagnostics` bridge — when the `diagnostics` prop changes, dispatch
   `setDiagnostics(state, mapped)` with `from/to` clamped to `doc.length` (zero-length spans widened to 1 char),
   `severity`, `message: formatDiagnostic(d)`. Also show the lint gutter.
3. **Block highlight**: a `StateEffect` + `StateField` of `Decoration.line`/`Decoration.mark` for `highlightRange`.
4. **`Editor` component** with `forwardRef<EditorHandle>`:
   - Create the `EditorView` once; replace the doc only when `value` differs from the current doc (external change).
   - `updateListener` → `onChange` on doc changes, `onCursorChange` on selection changes.
   - `jumpTo(line,col)` → set selection, `scrollIntoView`, focus. `revealRange` → `scrollIntoView` (+ highlight is the
     prop's job). Basic setup: line numbers, history, bracket matching, default keymap, `lineWrapping` off.
   - Fills its container's height; light theme.

## Tests (`// @vitest-environment jsdom`)

- Tokenizer: feed lines of the main example and assert token classes for `objekat`, `nadređeni`, `long`, `Mlb#`,
  `(0,M)`, `// komentar`, `"Nalog za nabavku"`.
- Diagnostics mapping: a span past the doc end is clamped; severity mapped; message uses `formatDiagnostic`.
- Rendering `Editor` with a value, then a new `value` prop → doc replaced; `onChange` fires on a dispatched edit.

## Definition of done

- [ ] C08 §Editor signature exact; stubs removed; tests green; no `compile()` call inside the editor.
- [ ] Manually checked in the app (or a tiny dev harness page inside `src/ui/editor/`) — note it in Status.

## Status

_not started_

## Contract notes

_none_
