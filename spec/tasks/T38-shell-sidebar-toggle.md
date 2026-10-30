# T38 — Shell: one ☰ sidebar toggle instead of "Tekst | Interaktivno"

**Wave:** 11 (one agent, Sonnet 5.5). **Implements:** [`../contracts/C08-ui-components.md`](../contracts/C08-ui-components.md) §Additions for the sidebar toggle.
Feature spec: [`../feature_text2interactive.md`](../feature_text2interactive.md) (read all of it).
**Folder (owns everything inside):** `src/ui/shell/` (plus the root `README.md`, if it mentions the mode switch).

Read first: your folder's `AGENT.md`, then the feature spec, then C08 §Additions for the sidebar toggle and C09
(mode behaviour). No frozen files change for this task. Never edit other folders.

## Goal

Replace the segmented "Tekst | Interaktivno" switch with one ☰ button that opens (Tekst) and closes (Interaktivno)
the editor as a left sidebar. Mode behaviour itself is unchanged.

## Steps

1. `Toolbar.tsx`: ☰ toggle button at the far left (before the title), `aria-expanded`, `aria-controls`, sr/en
   label + title, `is-active` when open. Remove the segmented switch. Keep the `mode` / `onModeChange` props.
2. `SplitPane.tsx`: optional `collapsed?: boolean`: left pane and divider hidden, `width` unchanged; give the left
   pane an `id` for `aria-controls`.
3. `App.tsx`:
   - pass `collapsed={interactive}`; keep the editor mounted while the close animation runs, unmount it on
     `transitionend` (or right away when there is no transition, e.g. reduced motion or jsdom), so the editor's
     history still starts from the current text when the sidebar is opened;
   - Ctrl+B / Cmd+B toggles the mode app-wide (also from the CodeMirror editor; not from builder inline
     `input`/`textarea` fields); `preventDefault` when handled;
   - focus: after closing → the diagram panel; after opening → the editor;
   - "Otvori tekst" (syntax banner) opens, "Novi dijagram" closes (already true through `changeMode`; keep it).
4. `styles.css`: width transition (150–200 ms, ease-out) for the left pane, none under
   `prefers-reduced-motion: reduce`; the button style. Keep the <900 px stacked layout (closed = diagram only).
   The diagram must not re-fit or re-layout when the pane width changes.
5. `strings.ts`: `showText` / `hideText` (sr + en, spec §UI strings). Remove `modeText` / `modeInteractive` only if
   nothing uses them any more.
6. README: update any sentence that describes the "Tekst | Interaktivno" switch.

## Tests

- Toolbar: one button with `aria-expanded`, no "Tekst" / "Interaktivno" buttons; click calls `onModeChange` with
  the other mode; labels in sr and en.
- App: default → open, editor visible; ☰ → closed, builder controls on, `pmov.mode.v1 = 'interaktivno'`; ☰ again →
  open, `'tekst'`; Ctrl+B both ways (also with focus in the editor); "Otvori tekst" opens; "Novi dijagram" closes;
  source shared across toggles; Poništi / Ponovi only when closed.
- SplitPane: `collapsed` hides left pane + divider and keeps `width`.
- **Allowed edit of existing tests:** `App.interactive.test.tsx`, `App.domains.test.tsx`, `App.json.test.tsx`,
  `App.lang.test.tsx` (and any other shell test) may change only how they switch modes (click the ☰ button instead
  of "Tekst" / "Interaktivno"). Do not change what they assert.

## Definition of done

- [ ] `npx vitest run src/ui/shell src/architecture.test.ts` green; `npm run typecheck` clean; `npm run build` OK.
- [ ] Only files in `src/ui/shell/` (and `README.md`) changed.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T38.md`.

## Status

Done. `npx vitest run src/ui/shell src/architecture.test.ts` 74/74 green (19 files); typecheck and build OK.

## Contract notes

- `SplitPane` also has an optional `onLeftTransitionEnd?()` and exports `SIDEBAR_ID` (left pane id, used by the toggle's `aria-controls`). The divider gets `hidden` when collapsed; the left pane gets `aria-hidden`.
- The editor unmounts on `transitionend` of the left pane, with a 400 ms timer fallback; with no `matchMedia` (jsdom) or `prefers-reduced-motion: reduce` it unmounts at once.
- Existing `App.lang.test.tsx` asserted the "Interactive" button exists; it now asserts the EN toggle label `Hide text (Ctrl+B)` (same check, the control was replaced). `App.interactive.test.tsx` asserts `aria-expanded` instead of `aria-pressed` on the toggle.
- `modeText` / `modeInteractive` / `mode` strings removed (unused).
- The diagram is not told to re-fit; `DiagramView` (other folder) is untouched, so any resize behaviour there is as before.
