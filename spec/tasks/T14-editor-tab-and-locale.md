# T14 — Editor: Tab indentation, keyword aliases, locale

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §1, the editor parts of §2 and §3,
and C08 §Additions for the editor fix.
**Consumes:** C01 (`Locale`, `formatDiagnostic(d, locale)`), C02 (`BLOCK_KIND_ALIASES`, `ROLE_ALIASES`).
**Folder (owns everything inside):** `src/ui/editor/`.

## Goal

Tab indents inside the editor instead of moving the focus. Enter and `}` indent automatically. `nadredjeni` and
the English keywords are highlighted like the Serbian ones, and lint messages follow the UI language.

## Steps

1. **Keys:** add `indentWithTab` and `indentUnit.of('  ')` to the extensions. Tab with no selection inserts
   2 spaces. Tab over a multi-line selection indents every line. Shift+Tab removes up to 2 spaces per line.
   Esc then Tab leaves the editor (CodeMirror default behaviour; make sure it is not overridden).
2. **Indentation rules in `pmovLanguage.ts`:**
   - Give the stream parser an `indent` function: one level per unclosed `{` above, one level less when the line
     starts with `}`.
   - Add `languageData.indentOnInput: /^\s*\}$/`, so `indentOnInput()` dedents a typed `}`.
   - Enter after `objekat X {` gives a 2-space indent; Enter inside a block keeps the indent.
3. **Highlighting:** add `Object.keys(BLOCK_KIND_ALIASES)` to the block-kind set and `Object.keys(ROLE_ALIASES)` to
   the role set (`keyword` / `modifier` tokens).
4. **Locale:** add an optional `locale?: Locale` to `EditorProps`. Lint messages use `formatDiagnostic(d, locale)`.
   A change of `locale` re-applies the diagnostics without touching the document or the cursor.

## Tests (`src/ui/editor/*.test.ts(x)`, jsdom)

- Tab with an empty selection inserts `"  "`, and the focus stays in the editor.
- Tab and Shift+Tab over a 3-line selection indent and dedent all three lines.
- Enter after `objekat Radnik {` → the new line starts with 2 spaces. Typing `}` on an indented empty line → dedented.
- `nadredjeni`, `owner`, `object`, `weak` get the same token type as `nadređeni` / `objekat` / `slab`.
- With `locale="en"` the lint message starts with `error` / `warning`. Without `locale` it starts with `greška`.
- Existing editor tests stay green, unedited.

## Definition of done

- [ ] `npx vitest run src/ui/editor` and `src/architecture.test.ts` green; `npm run typecheck` green.
- [ ] Session log `spec/sessions/T14.md`.

## Status

Done. `npx vitest run src/ui/editor` 12 tests green (5 existing unedited + 7 new in `indent.test.tsx`), architecture test green, typecheck clean for `src/ui/editor`.

## Contract notes

- Tab does not use `indentWithTab` as is: `indentMore` indents the whole line even with an empty selection, but the
  spec says "inserts 2 spaces at the cursor". The editor has its own Tab binding (insert at cursor when no
  selection, else `indentMore`) and `indentLess` for Shift+Tab.
- The stream parser state is now `{ depth }` (brace depth at line start); `token` accepts `null` state so the
  existing tests still work.
