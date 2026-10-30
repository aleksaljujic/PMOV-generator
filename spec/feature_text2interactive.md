# Feature: one sidebar toggle instead of the "Tekst | Interaktivno" switch

Replace the two-button segmented switch **"Tekst | Interaktivno"** in the toolbar with **one burger button (☰)**
that opens and closes the text editor as a left sidebar:

- **Sidebar open** → **Tekst mode**: DSL editor on the left, diagram on the right, no builder controls (as today).
- **Sidebar closed** → **Interaktivno mode**: the editor is hidden, the diagram takes the full width and the
  builder controls are active (as today).

The two modes themselves do not change. Only the way the user switches between them changes: the editor panel
is now a sidebar that is "open" or "closed".

This document extends [`requrement.md`](requrement.md) and
[`feature_interactive_pmov.md`](feature_interactive_pmov.md). Everything in them still applies, except the
"Tekst | Interaktivno" switch described in §"Modes" of `feature_interactive_pmov.md`, which this feature replaces.

## Core principles

- **One state, two names.** "Sidebar open" and "Tekst mode" are the same state, and so are "sidebar closed" and
  "Interaktivno mode". There is no third combination (no editor + builder controls together, no full-width
  diagram without builder controls).
- **Same storage key.** The state is still stored in `pmov.mode.v1` (`'tekst'` = open, `'interaktivno'` =
  closed, default `'tekst'`). Existing users keep the mode they had, and new users start with the sidebar open, so
  the app looks as before.
- **Shell-only change.** The builder, editor, tabs, diagram and the compile pipeline are not changed.

## UI

### The burger button

- One icon button **☰** sits at the far left of the toolbar, before the "PMOV editor" title (the usual place
  for a sidebar toggle). The "Tekst | Interaktivno" segmented switch is removed.
- The button is a toggle:
  - `aria-expanded="true"` and `aria-controls` pointing to the sidebar when the sidebar is open;
  - `aria-label` / `title`: **"Sakrij tekst (Ctrl+B)"** when open, **"Prikaži tekst (Ctrl+B)"** when closed
    (EN: *"Hide text (Ctrl+B)"* / *"Show text (Ctrl+B)"*);
  - when open, it has the same "active" look as the active button of today's segmented switch (`is-active`).
- The icon stays ☰ in both states (no switching to ✕), so the button doesn't jump around visually.
- Keyboard shortcut **Ctrl+B** (Cmd+B on macOS) toggles the sidebar from anywhere in the app, including while
  the editor has focus. In builder inline text fields (attribute name, domain, …) Ctrl+B is not intercepted.
- After **closing** with the button or shortcut, focus goes to the diagram. After **opening**, focus goes to the
  editor.

### The sidebar

- **Open:** the left pane is the editor plus the error panel under it, with the draggable divider, exactly as
  today. Its width is the saved editor width (`pmov.editorWidth.v1`), and dragging the divider still resizes it.
- **Closed:** the left pane and the divider are not shown. The diagram, the output tabs and the error panel
  (under the diagram) take the full width, as in today's Interaktivno mode.
- Opening and closing animate the sidebar width (about 150–200 ms, ease-out). With
  `prefers-reduced-motion: reduce` there is no animation. While the sidebar is closing the editor stays mounted;
  it is unmounted when the animation ends, so the existing rule "the editor's own history starts from the current
  text when Tekst mode is entered" keeps working unchanged.
- The diagram keeps its viewport and node positions when the sidebar opens or closes (no automatic re-layout).
  The React Flow viewport is resized to the new pane width; the diagram is not re-fitted.
- **Narrow screens (below 900 px)** keep today's stacked layout: open = editor on top, diagram below; closed =
  diagram only.

### Things that switch modes today, and now open/close the sidebar

| Today | Now |
| --- | --- |
| Click "Tekst" / "Interaktivno" | Click ☰ or press Ctrl+B |
| "Otvori tekst" button in the syntax-error banner | Opens the sidebar (button label unchanged) |
| "Novi dijagram" switches to Interaktivno | Closes the sidebar |
| Undo/redo ("Poništi" / "Ponovi") shown only in Interaktivno | Shown only while the sidebar is closed |

Everything else that depends on the mode (error click → centre element vs. jump to line, builder controls,
history reset when entering Tekst mode) keeps depending on the mode exactly as today.

## Architecture and contract changes

| Folder | Change |
| --- | --- |
| `src/ui/shell/` | `Toolbar`: replace the segmented switch with the burger toggle (same `mode` / `onModeChange` props). `App`: Ctrl+B shortcut, focus handling, keep the editor mounted until the closing animation ends. `SplitPane`: support a collapsed left pane (`collapsed?: boolean`) with the width transition and the divider hidden. `styles.css`: sidebar transition and reduced-motion rule. `strings.ts`: new strings, remove `modeText` / `modeInteractive` if nothing else uses them. |

- **C08** (`spec/contracts/C08-ui-components.md`): change the line "Toolbar gets optional mode switch …" to say
  the mode is shown as a single sidebar toggle button; `mode` / `onModeChange` props and `pmov.mode.v1` stay the
  same. Add the new strings to the SR/EN string table. Record the change in `spec/contracts/CHANGELOG.md`.
- No change to C09 or any frozen file other than the C08 text above.

## UI strings

| SR | EN |
| --- | --- |
| Prikaži tekst (Ctrl+B) | Show text (Ctrl+B) |
| Sakrij tekst (Ctrl+B) | Hide text (Ctrl+B) |

`Tekst`, `Interaktivno` are no longer shown in the toolbar. `Otvori tekst` stays.

## Tests

- Toolbar: there is exactly one mode control, a button with `aria-expanded`; there are no buttons named
  "Tekst" / "Interaktivno"; clicking it calls `onModeChange` with the other mode; label and `aria-expanded`
  follow the mode in SR and EN.
- App:
  - default (no stored mode) → sidebar open, editor visible, no builder controls;
  - clicking ☰ closes the sidebar → editor hidden, builder controls visible, `pmov.mode.v1 = 'interaktivno'`;
    clicking again opens it and stores `'tekst'`;
  - Ctrl+B toggles in both directions, also while the editor has focus;
  - "Otvori tekst" in the syntax-error banner opens the sidebar;
  - "Novi dijagram" closes the sidebar;
  - the source is shared: text typed with the sidebar open is what the builder edits after closing it, and a
    builder action is visible in the editor after opening it;
  - Poništi / Ponovi are visible only while the sidebar is closed.
- SplitPane: `collapsed` hides the left pane and the divider and keeps `width` unchanged for when it is reopened.
- Update existing tests that click the "Tekst" / "Interaktivno" buttons (`App.interactive.test.tsx`,
  `App.domains.test.tsx`, `App.json.test.tsx`, `App.lang.test.tsx`) to use the burger button.

## Done when

- The toolbar has one ☰ button and no "Tekst | Interaktivno" switch.
- Open sidebar = today's Tekst mode; closed sidebar = today's Interaktivno mode, in both SR and EN.
- Ctrl+B toggles the sidebar; the state survives a reload.
- A user who had `pmov.mode.v1 = 'interaktivno'` sees the sidebar closed after the update; everyone else sees it
  open.
- `npm test`, `npm run typecheck` and `npm run build` pass.

## Out of scope (for now)

- Showing the editor and the builder controls at the same time.
- A sidebar on the right side, or an overlay/drawer that floats over the diagram.
- Remembering the sidebar state separately per diagram.

## Decisions (defaults accepted by the user, 2026-10-30)

1. Open = Tekst, closed = Interaktivno; no other combinations.
2. The state reuses `pmov.mode.v1`; no new storage key and no migration.
3. Button at the far left of the toolbar, icon ☰ in both states, `aria-expanded` for the state.
4. Shortcut Ctrl+B (Cmd+B on macOS), like the sidebar toggle in VS Code.
5. Short width animation, off with `prefers-reduced-motion`.
6. Below 900 px the stacked layout stays; no drawer overlay.
