# T19 — Shell: SR | EN switch and wiring

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §3 (UI); C08 §Additions (shell,
DiagramView).
**Consumes:** all contracts. Runtime deps: T14 (editor `locale`), T15/T16 (`compile` locale), T17 (tabs), T18 (builder).
**Folder (owns everything inside):** `src/ui/shell/` and the root `README.md`.
**Extra edit rights (additive only):** `src/render/flow/`: the `locale?` prop on `DiagramView` and the empty-state
text. Same rules as the T13 ownership exception: no behaviour change without the prop, no removed or renamed
exports, and existing tests pass unedited.

## Goal

A toolbar switch "SR | EN" changes every text the program shows. It is remembered across reloads and never
changes the DSL source.

## Steps

1. **`storage.ts`:** `STORAGE_KEYS.lang = 'pmov.lang.v1'` with `loadLang()` / `saveLang()`. Default `'sr'`; invalid
   values fall back to `'sr'`.
2. **`strings.ts`** (`sr` / `en`, same keys): the Toolbar, the ErrorPanel, dialogs (the "Novi dijagram" confirm),
   the syntax-error banner and its button, the mode switch, the undo/redo buttons and their titles, aria labels. The
   Serbian values are exactly today's strings.
3. **Toolbar:** optional `locale` / `onLocaleChange` props and the SR | EN segmented switch.
4. **App:**
   - Keep the `locale` state.
   - Pass it to `useCompile`/`compile(src, { locale })` (a change recompiles), to Editor, the tabs, ErrorPanel,
     DiagramView and the builder (`applyBuilderAction(src, a, { locale })`, `useBuilder({ …, locale })`).
   - Set `document.documentElement.lang`.
5. **Examples menu:** shows `titleEn ?? title` in EN and loads `sourceEn ?? source`.
6. **`src/render/flow/`:** `DiagramViewProps.locale?`, used for "Nema dijagrama" / "No diagram" and any aria labels.
7. **`README.md`:** a short "Language" section: the switch, English keywords table, `nadredjeni`.

## Tests (new files only; existing ones pass unedited)

- `storage.lang.test.ts`: default, round trip, invalid value.
- `App.lang.test.tsx` (jsdom):
  - Switching to EN changes the toolbar, tab names, ErrorPanel title and the empty state.
  - The source text is unchanged.
  - The setting is restored after a remount.
  - Picking an example in EN loads the English source.
- `App.lang.integration.test.tsx`: in EN, a source with an error shows an English message in the error panel (needs
  T16).
- `src/render/flow` new test: `locale="en"` shows "No diagram"; without it, the output is unchanged.

## Definition of done

- [ ] `npx vitest run src/ui/shell src/render/flow` and `src/architecture.test.ts` green; `npm run typecheck` and
      `npm run build` green.
- [ ] Manual check with `npm run dev`: switch languages in both modes; Tab works in the editor.
- [ ] Session log `spec/sessions/T19.md`.

## Status

Done. `npx vitest run src/ui/shell src/render/flow` 70 tests green (incl. the 2 integration tests, which needed T16
and T18, now landed); architecture test, `npm run typecheck` and `npm run build` green. Manual browser check with
`npm run dev` is **pending** (not possible here).

## Contract notes

- `useCompile(source, delayMs?, locale?)` (shell-internal): a locale change recompiles immediately, source changes
  stay debounced.
- `SplitPane` got an optional `dividerLabel` (aria-label of the divider); `ErrorPanel` and `Toolbar` get optional
  `locale` (Toolbar's switch shows only with `onLocaleChange`).
- Extra EN strings (not in the C08 table): see `src/ui/shell/strings.ts` (e.g. "Language", "Resize editor",
  "Export failed", "The diagram has syntax errors. Fix them in text mode.", "Open text").
- DiagramView: only `locale?` added; aria labels there are library-provided, so only the empty state is translated.
- The "edited text" check for the example confirm also treats `sourceEn` as an unedited example.
