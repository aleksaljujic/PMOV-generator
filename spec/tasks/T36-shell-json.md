# T36 — Shell: JSON export / import buttons and wiring

**Wave:** 10 (parallel with T35, Sonnet 5.5). **Implements:** [`../contracts/C13-json-interchange.md`](../contracts/C13-json-interchange.md) §2.
Feature spec: [`../feature_json_import_export.md`](../feature_json_import_export.md) (§ *UI*, *Options*, *UI strings*).
**Folder (owns everything inside):** `src/ui/shell/` (plus the root `README.md` section, as in earlier shell tasks).

Read first: your folder's `AGENT.md`, then C13, then the feature spec. Frozen files (C13 §0) are already written;
never edit them or other folders. T35 (`src/interchange/`) works in parallel; until it lands its functions throw
`not implemented: T35`. Mock `../../interchange` in your unit tests (as the shell mocks `./download`); put a real
end-to-end test in an `*.integration.test.tsx` that may be red until T35 is done.

## Goal

Two toolbar buttons: download the diagram as JSON, and load a JSON file back (with confirm, positions, options, undo).

## Steps

1. `Toolbar.tsx`: optional `onExportJson` / `onImportJson(file)` props, buttons + hidden file input, sr/en labels.
2. `App.tsx`: export handler (same positions source as SVG export; works with errors), import handler (size check,
   read, parse, alert on error, confirm, set source + replace positions + apply options, one history step in
   Interaktivno, `fromModel` notice, reset the input).
3. `strings.ts`: new sr + en strings (C13 §2 / spec *UI strings*).
4. README: short "JSON import / export" section (en).

## Tests

- Export: `downloadBlob` called with an `application/json` blob and `pmov-dijagram.json` (sr) / `pmov-diagram.json` (en).
- Import of a valid file into a non-empty source asks first; OK sets source, positions (stored) and `dg0Mode` /
  `sqlDialect`; Cancel changes nothing; an empty source imports without asking.
- Invalid file and an oversized file: alert, nothing changes.
- Interaktivno: one Poništi restores the previous source and positions.

## Definition of done

- [ ] `npx vitest run src/ui/shell src/architecture.test.ts` green (integration test may wait on T35).
- [ ] Existing tests in your folder unedited and green.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T36.md`.

## Status

Done. Toolbar buttons, App export/import handlers, sr+en strings, README section. `App.json.test.tsx` (9 tests, mocks `../../interchange`, `./download`) green; `App.json.integration.test.tsx` (2 tests) is green now that T35 has landed.

## Contract notes

- No deviation from C13 section 2. Import failures `tooLarge` / `readError` use `formatJsonImportError` (no shell strings for them).
- The `fromModel` notice is a `window.alert` (the shell has no toast). The confirm text and notice are shell strings (`confirmImport`, `importedFromModel`, `exportJson`, `importJson`).
- The file input has `data-testid="import-json-input"` and `aria-label` = the import label; tests fire `change` on it. Import also bumps `layoutNonce` so the diagram re-lays out with the new saved positions.
- Export passes `ir: result?.ir ?? null` (current compile, so it works with errors), `graph: lastValidGraph`.
- For App tests (T37): mock `../editor`, `../../render/flow`, `./download` (or the module `downloadBlob` comes from), `../tabs`; do not mock `../../interchange` for acceptance.
