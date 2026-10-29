# T08 — Output tabs: Domeni, Relacioni model, SQL

**Wave:** 1 (parallel). **Implements:** C08 §Output tabs. **Consumes:** C03 (IR type), C04 (RM functions/types).
**Folder (owns everything inside):** `src/ui/tabs/` — read its `AGENT.md`. Public entry: `src/ui/tabs/index.ts`.

## Goal

Three presentational React components that render the domain table, the relational model and the SQL from an IR.

## Steps

1. `DomainTab` — `buildDomainTable(ir)` as a table with headers `ATRIBUT | DOMEN | OGRANIČENJE`; `ir === null` → empty
   state text.
2. `RelationalTab`:
   - `hasErrors` → message `Ispravite greške da bi se generisao relacioni model.`
   - Else `generateRelationalModel(ir, { dg0Mode })` (memoized on `ir`+`dg0Mode`), one line per relation:
     `Name(` attrs `)` with pk in `<u>`, `fk && !pk` in `<i>`, nullable FKs get a subtle `?` suffix title tooltip
     "može biti NULL".
   - Radio group `Veze sa DG=0:` `posebna relacija` / `strani ključ` shown only when `dg0ToggleableVezas(ir).length > 0`,
     calls `onDg0ModeChange`.
   - Button `Kopiraj kao tekst` → `navigator.clipboard.writeText(formatModelText(rm))` with a short "Kopirano" feedback;
     guard when clipboard is unavailable.
3. `SqlTab` — `generateSql(...)` in a monospace `<pre>`, button `Kopiraj`; same error/empty states.
4. Plain CSS module or class names prefixed `pmov-tabs-` (no global styles; T09 owns global CSS).

## Working without T03

Component tests mock `src/rm` (its `index.ts`) with `vi.mock` returning `MAIN_EXAMPLE_RM` / fixed SQL, so they don't depend on
T03. One `tabs.integration.test.tsx` uses the real generator.

## Tests (`// @vitest-environment jsdom`, @testing-library/react)

- DomainTab renders `Mlb`, `long`, `NotNull`, and `–` for missing; no `#` in the table.
- RelationalTab with `MAIN_EXAMPLE_RM` (mocked): `Mlb` is inside `<u>`, `SifOd` inside `<i>`, Prijava's `BrojInd` is
  underlined and not italic; toggle visible; clicking `posebna relacija` calls `onDg0ModeChange('relation')`.
- `hasErrors` → message shown, generator not called.
- Copy button calls `navigator.clipboard.writeText` with `formatModelText` output.

## Definition of done

- [ ] C08 §Output tabs signatures exact; stubs removed; tests green.

## Status

_not started_

## Contract notes

_none_
