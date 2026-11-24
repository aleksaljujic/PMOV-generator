# T51 — Shell: visible syntax help panel

**Wave:** 14 (done directly by the orchestrator session, no agent). **Implements:** C08 (shell-internal, additive).
**Folder:** `src/ui/shell/` (plus one line in the root `README.md`).

## Goal

The DSL syntax guide (`docs/syntax.md`) was not reachable from the app. A "? Pomoć" / "? Help" toolbar button (and F1)
opens a drawer on the right with a short sr/en syntax reference: block kinds, attributes, participants and
cardinalities, one snippet per block kind, domains and constraints, comments / names / shortcuts, and the SR ↔ EN
keyword table. Esc or × closes it. Snippets use the keywords of the UI language.

## Status

✅ done 2026-11-24. New: `HelpPanel.tsx`, `helpStrings.ts`, `HelpPanel.test.tsx`, `App.help.test.tsx`.
Changed: `Toolbar.tsx` (optional `helpOpen?` / `onHelpToggle?`), `App.tsx` (state, F1, `.app__body` wrapper around
`SplitPane` so the drawer sits below the toolbar), `styles.css`. Every snippet compiles with no syntax (S) diagnostics.
Open state is not persisted.

## Contract notes

`ToolbarProps` gained optional `helpOpen?` / `onHelpToggle?`; without them the toolbar is unchanged.
