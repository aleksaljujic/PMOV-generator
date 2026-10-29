# T09 — App shell, wiring, persistence, README

**Wave:** 1 (parallel — start against stubs, finish as the others land). **Implements:** C08 §App-level pieces.
**Consumes:** every contract. **Folder (owns everything inside):** `src/ui/shell/` — read its `AGENT.md`. Also owns the
root `README.md`. Public entry: `src/ui/shell/index.ts` exporting `App` (the frozen `src/main.tsx` renders it).
Suggested files: `App.tsx`, `Toolbar.tsx`, `SplitPane.tsx`, `ErrorPanel.tsx`, `storage.ts`, `useCompile.ts`, `styles.css`.

## Goal

The "Mermaid Live Editor for PMOV" page: resizable split view, editor left, diagram + tabs right, error panel, toolbar,
persistence, and all the sync between them — using only the component/function contracts.

## Steps

1. **`storage.ts`** exactly as C08 (try/catch around every access).
2. **`useCompile(source)`** hook: debounce 300 ms → `compile` → returns
   `{ result, lastValidIr, lastValidGraph }` where `lastValid*` only update when `result.ir !== null`
   (requirement: on a parse error keep showing the last valid diagram). `lastValidGraph = buildDiagramGraph(ir)`,
   memoized.
3. **Layout**: top `Toolbar` — title, `Primeri` dropdown (`EXAMPLES`; picking one replaces the source after a
   `confirm` if the text was edited), `Ponovo rasporedi` (clear positions, bump `layoutNonce`), `Izvezi SVG`,
   `Izvezi PNG`. Body: `SplitPane` (draggable divider, width persisted, min widths) with left = `Editor` over
   `ErrorPanel` ("Greške i upozorenja", count badge, `Nema grešaka.` when empty; click → `editor.jumpTo`), right =
   tab bar `Dijagram | Domeni | Relacioni model | SQL` with the active panel. Keep `DiagramView` mounted when switching
   tabs (hide with CSS) so positions survive.
4. **State & sync** per C08 §Selection sync: `selectedElementId`, `highlightRange`, `errorElementIds` (memoized Set),
   `dg0Mode` (persisted), `savedPositions` (persisted on every `onNodeMoved`).
5. **Export**: SVG → `graphToSvg(lastValidGraph, diagramRef.getPositions())` → download `pmov-dijagram.svg`;
   PNG → `svgToPngBlob` → download `pmov-dijagram.png`.
6. **Initial source**: `loadSource() ?? EXAMPLES[0].source`; `saveSource` on change (debounced).
7. **Global CSS**: full-height app, neutral UI chrome, white diagram canvas, monospace editor font. Phone width not a goal
   but nothing should break below 900px (stack panes vertically).
8. **README.md** (English): what PMOV is (one paragraph), the DSL with the main example and a table of block kinds and
   line forms, the cardinality rule, the architecture diagram from the requirement with the module map, error codes
   table (short), how to run (`npm install`, `npm run dev`, `npm test`, `npm run build`), `renderSvg` usage.

## Tests

- `storage.test.ts` — round trips, corrupted JSON → defaults, throwing `localStorage` → defaults.
- `useCompile.test.tsx` (fake timers) — debounce; syntax error keeps `lastValidIr`.
- `App.integration.test.tsx` (jsdom; mock `DiagramView` if React Flow measuring is a problem in jsdom) — default source
  loads, error panel shows a diagnostic after typing a broken line + 300 ms, clicking it calls `jumpTo`.

## Definition of done

- [ ] `npm run dev` shows the main example rendered; all toolbar buttons work; tabs work; persistence works across reload.
- [ ] README written. Tests green (integration ones once deps are done). No edits outside owned files.

## Status

Done. All steps implemented; 10 shell tests pass, full suite 196/196, build OK. Browser-only behaviour unverified (see spec/sessions/T09.md).

## Contract notes

No changes proposed. Additive: storage.ts also exports loadEditorWidth/saveEditorWidth.
