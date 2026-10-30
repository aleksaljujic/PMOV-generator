# T15 — Parser: keyword aliases and English S-messages

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §2 and the DSL part of §3;
C02 §Keyword aliases; C01 §English messages (S-codes).
**Consumes:** C01, C02.
**Folder (owns everything inside):** `src/lang/syntax/`.

## Goal

`nadredjeni` and the English keywords (`object`, `relationship`, `weak`, `specialization`, `aggregation`, `owner`,
`supertype`, `subtype`) parse exactly like the Serbian ones, and syntax messages can be produced in English.

## Steps

1. Replace every block-kind / role test in the parser (top-level kind, error resync, participant start, role
   parsing, the `_` name rule) with `canonicalBlockKind` / `canonicalRole` from `src/lang`. Store canonical values
   in the AST. Keep `kindSpan` / `role.span` on the word as written.
2. `lex(source, options?)` and `parse(source, options?)` accept `LangOptions`. Move the S01–S06 message text into
   a per-locale table (for example `messages.ts` with `sr` and `en`). Omitted locale gives byte-identical Serbian
   messages.
3. S04 in English lists the English kinds first, then the Serbian ones (template in C01).
4. Write the English S-templates into C01 (additive clarification) and add a CHANGELOG line.

## Tests (`src/lang/syntax/*.test.ts`)

- A slab with `nadredjeni` gives the same AST as with `nadređeni` (apart from spans).
- Each of the four examples parsed from `sourceEn` gives zero diagnostics. Its AST with spans and names stripped
  equals the Serbian example's (same kinds, roles, cardinality text, attribute flags).
- A source that mixes `objekat` and `object`, and `nadtip` and `supertype`, parses.
- `Object` (capitalised) is a name, not a keyword.
- Recovery: an unknown word after a valid English block still resyncs at the next `object` / `objekat`.
- Every S-code has a message in both languages, and `parse(x, { locale: 'en' })` gives the same codes and spans as
  `parse(x)`.
- None of the golden fixtures in `src/fixtures/` uses one of the alias words as a name.
- Existing tests stay green, unedited.

## Definition of done

- [ ] `npx vitest run src/lang` and `src/architecture.test.ts` green; `npm run typecheck` green.
- [ ] C01 English S-templates written; CHANGELOG line added.
- [ ] Session log `spec/sessions/T15.md`.

## Status

Done. `npx vitest run src/lang` and architecture test green (86 tests, 15 new in `aliases.test.ts`); no typecheck errors in `src/lang/syntax`.

## Contract notes

`lex`/`parse` take `options?: LangOptions`. Text lives in `src/lang/syntax/messages.ts`. English S01 also translates `eof`/`newline`/"expected" phrases. Default (no locale) output is byte-identical Serbian. Constraint text differs between sr/en examples (`Moduo_11` vs `Mod_11`), so the example-equivalence test compares constraint presence only.
