# T13 — Interactive PMOV builder (Tekst / Interaktivno)

**Wave:** 3 (after T10; one agent, serial). **Implements:** [`../feature_interactive_pmov.md`](../feature_interactive_pmov.md)
and the new contract C09 (written by this task, step 1).
**Consumes:** C02 (AST + spans), C03 (IR, `compile`, query helpers), C05 (graph ids), C08 (DiagramView, Editor, App).
**Folders (owns everything inside):** `src/builder/` (new, no React) and `src/ui/builder/` (new, React).
**Extra edit rights (only for this feature, see "Ownership exception"):** `src/ui/shell/`, `src/render/flow/`.

## Goal

The user can switch between the existing **Tekst** mode and a new **Interaktivno** mode. In Interaktivno mode the
editor is hidden and a PMOV is built by clicking: + menus (objekat, veza, slab, agregacija, specijalizacija),
"+ atribut" forms, inline rename, cardinality and mapping-name pickers, delete, undo/redo. Every action is a text
edit on the shared DSL source. The rest of the pipeline is reused unchanged.

## Ownership exception (one agent for the whole feature)

The feature touches the shell and the diagram view, and the user chose **one agent** for it. Rules:

- In `src/builder/` and `src/ui/builder/` the agent is the owner, as usual.
- In `src/ui/shell/` and `src/render/flow/` the agent may **add** files and **extend** existing ones. It must not
  change existing behaviour in Tekst mode, must not remove or rename existing exports, and all existing tests in
  those folders must stay green without being edited (new tests may be added).
- `DiagramViewProps` changes must be additive and optional (C08 additive change). With the new props omitted,
  DiagramView behaves exactly as before.
- Frozen files are not edited by the agent. The orchestrator makes the bootstrap changes in step 0 before the
  agent starts.

## Steps

0. **Bootstrap (orchestrator, before the agent starts)**
   - `src/architecture.test.ts`: add `'builder'` and `'ui/builder'` to `AGENT_FOLDERS` and `'builder/'` to
     `NO_REACT_PREFIXES`.
   - Create `src/builder/AGENT.md`, `src/ui/builder/AGENT.md` and stub `index.ts` files (`throw new
     Error('not implemented: T13')`).
   - `spec/contracts/CHANGELOG.md`: an entry for the new folders, the ownership exception, and C09.
   - `spec/contracts/C00-project.md`: rows for the two new folders in the folder map and the entry-point table.
1. **Contract C09** (`spec/contracts/C09-interactive-builder.md`, written by the agent first, before any code):
   the `BuilderAction` union (from the feature spec §Architecture, including the specijalizacija actions),
   `BuilderResult`, `applyBuilderAction(source, action)`, `placeholderName(ir, kind)`, the new optional
   `DiagramViewProps`, the `pmov.mode.v1` storage key, and the UI strings. Add it to the contracts README index.
2. **`src/builder/` (pure, no React).** Implement `applyBuilderAction` on top of `parse` / `compile` and AST spans:
   - Output: `{ ok: true; source: string; select?: string; placeAt?: { id: string; near: string; dir: 'right' | 'below' }[] }`
     or `{ ok: false; message: string }` (Serbian message from the feature spec).
   - Edits are minimal splices on spans. Comments, formatting and block order are kept. New blocks are appended at
     the end with one blank line before them.
   - Covers every rule in the feature spec §Text generation rules: comma-separated and single-line blocks, rename
     with all references, deletion with dependents, podtip rules (no self, no duplicates, no E09 cycle),
     placeholder numbering, quoting names that contain spaces.
   - Refuses to act (`ok: false`) if the source has syntax errors.
3. **`src/render/flow/` extension points (additive):** optional props on `DiagramView`, for example
   `renderNodeOverlay?(node) => ReactNode` (or `nodeDecorations`), `onEdgeLabelClick?(edgeId, which)`,
   `onCanvasClick?()`, `pickMode?: { validIds: ReadonlySet<string> } | null`, `placeholderIds?: ReadonlySet<string>`
   (grey italic names). Keep the API small; record the final shape in C09 and the CHANGELOG.
4. **`src/ui/builder/` (React):** the overlay UI. It contains:
   - the + button and menu per node kind,
   - the "Novi objekat" / "Postojeći element…" sub-menu and pick mode (Esc cancels, status line, rejection reasons),
   - the attribute form (Naziv, Identifikator (#), Domen, Ograničenje; Enter = save + next, Esc = close),
   - inline rename, the cardinality picker, the mapping-name editor, the delete confirmation for dependents,
   - the "Dodaj identifikator (#)" hint.
   All edits go through one callback `onAction(action: BuilderAction)`. The component never edits text itself.
5. **`src/ui/shell/` wiring:**
   - "Tekst | Interaktivno" switch, persisted as `pmov.mode.v1` (default `tekst`).
   - In Interaktivno mode, hide the editor pane and show the diagram full width. The error panel stays; clicking an
     error selects the element.
   - "Novi dijagram" (asks before replacing a non-empty source, then switches to Interaktivno).
   - Poništi / Ponovi with Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: a source history with at least 100 steps.
   - Applying an action means: new source, then `select`, then convert `placeAt` into saved positions next to the
     anchor node, so the new element appears to the right of / below its anchor and nothing else jumps.
   - On rename, move the saved position to the new id.
   - Syntax-error banner with an "Otvori tekst" button.
6. **Manual check in the browser** (`npm run dev`): build both examples from `requrement.md` by clicking only, then
   switch to Tekst and compare. Save screenshots/SVGs to `spec/sessions/T13-*.svg`.

## Tests

- `src/builder/*.test.ts`: golden source in → golden source out for every action. These are the cases listed in
  the feature spec §Tests (newModel, veza new/existing/recursive, slab, agregacija + addComponent,
  specijalizacija + addPodtip/removePodtip incl. rejections, rename with references and comments kept, delete
  with/without dependents, attribute add/edit/delete on multi-line, single-line and comma-separated blocks,
  placeholder numbering, refusing on syntax errors). After each action, assert that `compile()` gives only the
  expected diagnostics.
- `src/builder/roundtrip.integration.test.ts`: both examples built from builder actions alone. The IR must equal
  the example's IR (ignoring spans and order), and the RM must equal `MAIN_EXAMPLE_RM` for the main example.
- `src/ui/builder/*.test.tsx` (jsdom): the + menu shows the right items per node kind, pick mode plus Esc, attribute
  form validation and Enter-for-next, the delete confirmation.
- `src/ui/shell/*.test.tsx` (new files): mode switch and persistence, editor hidden in Interaktivno, shared source,
  undo/redo, the "Novi dijagram" confirm, Tekst mode unchanged (the existing `App.integration.test.tsx` passes
  untouched).
- `src/render/flow/` (new test file): without the new props, the output is identical to before; with them,
  overlays render and callbacks fire.

## Definition of done

- [ ] Everything under "Done when" in `feature_interactive_pmov.md` holds.
- [ ] `npm test`, `npm run typecheck`, `npm run build` are green. `src/architecture.test.ts` is green (including
      no React in `src/builder/`).
- [ ] Existing tests in `src/ui/shell/` and `src/render/flow/` pass unedited.
- [ ] C09 written and indexed, CHANGELOG updated, root `README.md` has a short "Interactive mode" section.
- [ ] Session log written to `spec/sessions/T13.md`.

## Status

Done (steps 1-5; step 6 only as an automated round trip, see `spec/sessions/T13.md`). Tests: builder 52, ui/builder 24,
ui/shell new 15, render/flow new 6. `npm run typecheck` and `npm run build` green.

## Contract notes

- C09 written and indexed. `BuilderResult` has `renames` (node id moves) and `needsConfirmation`; `pickRejection` and
  `isPlaceholderName` are exported helpers.
- C08 additive: optional `DiagramViewProps` (see C09), `DiagramViewHandle.centerOnElement`, `STORAGE_KEYS.mode`.
