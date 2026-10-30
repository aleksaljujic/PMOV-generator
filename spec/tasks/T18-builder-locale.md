# T18 — Interactive builder in English

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §3 (builder); C09 §Additions for the
English option.
**Consumes:** C01 (`Locale`), C02 (`BLOCK_KIND_KEYWORDS`, `ROLE_KEYWORDS`, `canonicalBlockKind`), C03, C09.
**Folders (owns everything inside):** `src/builder/` and `src/ui/builder/`.

## Goal

With locale `en` the builder writes English DSL (`object`, `weak`, `owner`, …), uses English placeholder names, and
shows its whole overlay UI in English. With no locale, nothing changes.

## Steps

1. **`src/builder/`:**
   - Add `options?: BuilderOptions` to `applyBuilderAction`, a `locale` parameter to `placeholderName` and
     `pickRejection`, and make `isPlaceholderName` recognise both languages (C09).
   - New text uses `BLOCK_KIND_KEYWORDS[locale]` / `ROLE_KEYWORDS[locale]`. Existing lines keep their keyword
     spelling.
   - Wherever the builder finds blocks or roles by keyword text, it uses the canonical AST values, so sources
     written with English keywords (or `nadredjeni`) can be edited too.
   - English placeholders: `ObjectN`, `WeakN`, `AggregationN`, `KindN`, `SubtypeN`. The new weak object's partial
     id is `No#`. Numbering counts both languages.
   - All `message` / rejection texts are in a per-locale table.
2. **`src/ui/builder/`:**
   - Add `UseBuilderOptions.locale?` and pass it to `pickRejection`.
   - Create a `strings.ts` with `sr` / `en` tables for the + menu, the attribute form, inline editors, hints, the
     confirm dialog and the pick status line.

## Tests

- In EN, "+ → Weak object" on `Employee` inserts `weak Weak1 {\n  owner Employee (0,M)\n  No#\n}`.
- In EN, addSpecijalizacija inserts `specialization Kind1 { supertype X (0,M) subtype Subtype1 subtype Subtype2 }`
  (multi-line).
- Rename, delete, attribute edits and addComponent work on a source written fully in English keywords and on one
  using `nadredjeni` (needs T15's parser, so name these `*.integration.test.ts`).
- `isPlaceholderName('Weak3')` and `isPlaceholderName('Slab3')` are both true. With `Objekat1` taken, the EN
  placeholder is `Object1`.
- `sr` / `en` string tables have identical keys (both folders).
- Every existing builder test passes unedited (default locale).

## Definition of done

- [ ] `npx vitest run src/builder src/ui/builder` and `src/architecture.test.ts` green; `npm run typecheck` green.
- [ ] Final signatures recorded in C09 if they differ; CHANGELOG line if so.
- [ ] Session log `spec/sessions/T18.md`.

## Status

Done. `npx vitest run src/builder src/ui/builder src/architecture.test.ts`: 100 passed. Typecheck clean for both folders. T15's parser had already landed, so the `*.integration.test.ts` tests run and pass.

## Contract notes

Signatures as in C09 Additions. Extras: `BuilderOptions` and `BUILDER_MESSAGES_BY_LOCALE` exported; `BuilderController.locale`; `src/ui/builder/strings.ts` (`BUILDER_STRINGS`). Numbering checks only the requested locale's prefix.
