# T16 — Checker and compile: English E/W messages

**Wave:** 4 (parallel). **Implements:** [`../fix_editor.md`](../fix_editor.md) §3 (diagnostics);
C01 §English messages (E/W codes); C03 `compile(source, options?)`.
**Consumes:** C01, C02, C03.
**Folder (owns everything inside):** `src/lang/semantic/`.

## Goal

`compile(source, { locale: 'en' })` returns the same diagnostics as today, with English message text.

## Steps

1. `compile(source, options?: LangOptions)` passes the locale on to `parse` (T15 implements that side; until then
   the extra argument is ignored at runtime, which is fine) and to the checker.
2. Move the E01–E12 and W01–W04 message text into a per-locale table. Omitted locale gives byte-identical Serbian
   messages, so every existing test and fixture stays green.
3. English messages use English keywords (`relationship`, `weak object`, `owner`, `supertype`, `subtype`,
   `aggregation`, `specialization`). The facts in the message stay the same (quoted names, counts, line numbers,
   the cycle path).
4. Write the English E/W templates into C01 (additive clarification) and add a CHANGELOG line.

## Tests (`src/lang/semantic/*.test.ts`)

- For every entry in `ERROR_FIXTURES`: `compile(src, { locale: 'en' })` gives the same `code`, `severity`, `span`
  and `elementId` as `compile(src)`. The English message contains the same quoted names and contains no Serbian
  keyword.
- Every E/W code has a message in both languages (table completeness test).
- `formatDiagnostic(d, 'en')` on a sample diagnostic gives `error E0x (line …, col …): …`.
- `compile.integration.test.ts`: each example's `sourceEn` compiles with the same diagnostic codes as its Serbian
  `source`, and the IR has the same shape (kinds, cardinalities, attribute flags; names differ). This needs T15's
  aliases, so it is an integration test.

## Definition of done

- [ ] `npx vitest run src/lang` and `src/architecture.test.ts` green; `npm run typecheck` green.
- [ ] C01 English E/W templates written; CHANGELOG line added.
- [ ] Session log `spec/sessions/T16.md`.

## Status

Done. `compile(source, options?)` forwards options to `parse` and `check`; message templates in `src/lang/semantic/messages.ts` (sr byte-identical, en added). `npx vitest run src/lang` 103/103 green (incl. sourceEn integration tests), architecture test green, no typecheck errors in `src/lang/semantic`.

## Contract notes

Additive: English E/W templates in C01 §English messages; CHANGELOG line added. English `ABOUT_CARD` uses `min`/`max` instead of DG/GG. Roles inside E04/E07/E12 messages are rendered with `ROLE_KEYWORDS[locale]`.
