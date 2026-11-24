# T49 — Shell: layout select, lock and snap toggles, one undo step per drag

**Wave:** 13 (Sonnet 5.5). **Implements:** [`../contracts/C08-ui-components.md`](../contracts/C08-ui-components.md) §Additions for the grid layout (shell part).
Feature spec: [`../feature_grid_layout.md`](../feature_grid_layout.md) §2–§4.
**Folder (owns everything inside):** `src/ui/shell/` (plus the root `README.md` where it describes layout or dragging).

Read first: your folder's `AGENT.md`, the feature spec, C08 §Additions for the grid layout. Never edit other folders.

## Goal

The user can pick the layout (Mreža / Slobodan), turn attribute locking and snapping on or off, and undo a whole
card drag in one step.

## Steps

1. `storage.ts`: `STORAGE_KEYS.layout` / `attrLock` / `snap` with `loadLayout`/`saveLayout` (`'grid' | 'free'`,
   default `'grid'`, invalid → default), `loadAttrLock`/`saveAttrLock`, `loadSnap`/`saveSnap` (default true).
2. `Toolbar.tsx`: a "Raspored: Mreža | Slobodan" / "Layout: Grid | Free" control (native select or two-button
   segment; few fixed options) and two toggle buttons with `aria-pressed`: "Atributi prate objekat" /
   "Attributes follow object" and "Poravnaj na mrežu" / "Snap to grid". New optional props; existing props unchanged.
3. `App.tsx`: state + persistence for the three settings. Pass `layoutAlgorithm`, `lockAttributes`, `snapToGrid`
   and `onNodesMoved` to `DiagramView`. `onNodesMoved` merges all moves into the saved positions in **one** history
   step (Poništi undoes the whole card drag). Changing the layout clears saved positions like "Ponovo rasporedi"
   (one history step) and forces a fresh layout.
4. `strings.ts`: sr + en strings for the new controls (titles explain the Alt-drag: "Alt + prevuci: pomeri samo
   atribut" / "Alt + drag: move only the attribute").
5. README: a short section on layout choice, locked attributes, Alt-drag and snapping.

## Tests

- Storage: defaults, round trip, invalid values.
- Toolbar: controls render in sr and en, `aria-pressed` reflects state, callbacks fire.
- App (mock `../../render/flow` as existing shell tests do): settings are passed to `DiagramView` and persisted;
  `onNodesMoved` with three nodes → one undo step restores all three; layout change → positions cleared, one undo
  step.
- Existing shell tests unchanged and green.

## Definition of done

- [ ] `npx vitest run src/ui/shell src/architecture.test.ts` green; `npm run typecheck` clean; `npm run build` OK.
- [ ] Only files in `src/ui/shell/` (and `README.md`) changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T49.md`.

## Status

Done (2026-11-04). Storage keys + load/save, Toolbar controls (native select + two `aria-pressed` toggles, shown only
when their callbacks are passed), App state/persistence, `onNodesMoved` (one history step), layout change (clears
positions + new nonce, one history step), sr/en strings, README section. New tests: `storage.layout.test.ts`,
`Toolbar.layout.test.tsx`, `App.layout.test.tsx`. Existing shell tests unchanged.

## Contract notes

- Matches C08 §Additions for the grid layout; no contract change needed.
- `onNodesMoved` pushes a history step in both modes (history is only shown/used in Interaktivno; switching to Tekst resets it).
- Changing the layout to the already selected value is a no-op. `onNodeMoved` is still passed (flow falls back to it).
- Snap/lock toggles do not touch positions or history.
