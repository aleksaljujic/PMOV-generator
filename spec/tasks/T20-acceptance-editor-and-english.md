# T20 — Acceptance: editor fix and English option

**Wave:** 5 (serial, after T14–T19). **Checks:** everything in [`../fix_editor.md`](../fix_editor.md).
**Folder (owns everything inside):** `e2e/`.

## Goal

End-to-end proof that the three changes work together, plus a regression check that the Serbian default is
unchanged.

## Checks (automated where jsdom allows; the rest by hand with `npm run dev`, results in the session log)

1. **Tab:** Tab, Shift+Tab, Enter after `{`, and `}` dedent behave as in fix_editor §1. Esc+Tab leaves the editor.
2. **`nadredjeni`:** the main example with `nadređeni` replaced by `nadredjeni` gives the same IR, graph, RM and SQL
   as the original.
3. **English DSL:** each `sourceEn` compiles without errors, renders, and gives an RM with the same structure as
   the Serbian example (same number of relations, the same key and FK pattern).
4. **Mixed keywords** in one source compile.
5. **SR | EN switch:**
   - Every visible string changes: toolbar, tabs, panels, builder menus, dialogs, diagnostics.
   - The error codes stay the same.
   - The source is untouched.
   - The setting survives a reload.
6. **Builder in EN:** build a small model by clicking only and check that the DSL uses English keywords. Then
   switch to SR, keep editing, and check that the old lines keep their spelling.
7. **Regression:** with no `pmov.lang.v1` key, the app looks and behaves exactly as before. The full `npm test`,
   `npm run typecheck` and `npm run build` are green.

## Definition of done

- [ ] All checks pass or have a written follow-up in the session log.
- [ ] Session log `spec/sessions/T20.md`.

## Status

_not started_

## Contract notes

_none yet_
