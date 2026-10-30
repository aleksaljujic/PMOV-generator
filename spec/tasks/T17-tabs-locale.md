# T17 — Output tabs in English

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §3 (tabs); C08 §Additions (output tabs,
UI strings table).
**Consumes:** C01 (`Locale`), C04, C08.
**Folder (owns everything inside):** `src/ui/tabs/`.

## Goal

`DomainTab`, `RelationalTab` and `SqlTab` take an optional `locale` and show all their text in that language.

## Steps

1. Create `strings.ts` with `sr` and `en` tables (same keys) for every visible string and aria label in this
   folder. The Serbian values are exactly today's strings.
2. Add `locale?: Locale` (default `'sr'`) to the three tab components and use the tables.
3. The generated content does not change with the locale: relation names, attribute names and SQL come from the
   user's model. Only labels, headers, buttons, the DG=0 toggle and empty and error states are translated.

## Tests

- `sr` and `en` tables have identical key sets.
- With `locale="en"`: headers `ATTRIBUTE | DOMAIN | CONSTRAINT`, "Copy as text", "Copy", the DG=0 toggle labels, the
  empty state and "Fix the errors to generate the relational model.".
- Without `locale`, the output is identical to today (existing tests unedited and green).

## Definition of done

- [ ] `npx vitest run src/ui/tabs` and `src/architecture.test.ts` green; `npm run typecheck` green.
- [ ] Any string not in the C08 table is recorded under Contract notes.
- [ ] Session log `spec/sessions/T17.md`.

## Status

Done. `strings.ts` (sr/en), `locale?` on the three tabs, new `strings.test.tsx` (4 tests). Tabs 15 tests, architecture 6, all green; no typecheck errors in `src/ui/tabs`.

## Contract notes

Strings translated that are not in the C08 table: `Kopirano` -> `Copied`, tooltip `može biti NULL` -> `can be NULL`.
Generated content (relation/attribute names, SQL, domain table values such as `–`) is not translated.
