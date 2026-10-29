# T03 — Relational model, SQL, domain table

**Wave:** 1 (parallel). **Implements:** C04. **Consumes:** C03 (IR + `query.ts` helpers).
**Folder (owns everything inside):** `src/rm/` — read its `AGENT.md`. `src/rm/types.ts` is frozen contract code.

## Goal

Pure functions that translate a `PmovIR` into the FON relational model, its text form, SQL `CREATE TABLE`s, and the
domain table.

## Steps

1. `computeKeys(ir)` — memoized `key(X)` for every objekat/slab/agregacija/veza-relation per C04 §2 (podtip → supertype
   key recursively, slab → owner key + own `#`, agregacija/veza-relation → first `max===1` component else all).
2. `classifyVeza(veza, dg0Mode)` → `'relation' | { holders: … }` per C04 §3. Export `dg0ToggleableVezas`.
3. `generateRelationalModel` — assemble relations in IR order with the attribute order of C04 §4, borrowed attributes
   per §5, collision renaming per §6, unnamed veza names per §7, spaces stripped from names.
4. `formatRelation`, `formatModelText` — exact format of the C04 example (two spaces before `key:`).
5. `generateSql` — C04 §SQL format (CREATE TABLEs, then `ALTER TABLE … ADD FOREIGN KEY` grouped by `references.group`).
6. `buildDomainTable` — C04 §Domain table.
7. `src/rm/index.ts` barrel.

No React; imports only from `src/lang` (index) and `./types`.

## Tests (all from fixtures — no parser needed)

- `generateRelationalModel(MAIN_EXAMPLE_IR)` equals `MAIN_EXAMPLE_RM` (compare groups only as "same/different").
- `formatModelText` equals the 7-line block in C04.
- Every row of C04 §Other required cases: subtype (SPEC_EXAMPLE_IR), slab, recursive M:N with renamed attributes,
  aggregation with a GG=1 component (`Radnik (0,1)`, `Sindikat (0,M)` → key `Mlb` only — build that IR inline),
  both DG=0 toggle variants, nullable FK for `(0,1)/(0,M)`.
- SQL: contains `PRIMARY KEY ("Mlb", "Datum")` for Isplata, `BIGINT`/`SMALLINT`/`DATE` mapping, in `dg0Mode:'relation'` one composite
  `FOREIGN KEY ("BrojInd", "SifPred") REFERENCES "Prijava"` on Overe, and the ALTER statements for the Radnik↔Odeljenje cycle.
- Domain table for MAIN: first row `Mlb | long | NotNull`, `BrojInd | – | –`, no `#` anywhere.
- One `*.integration.test.ts` running `compile(EXAMPLES[0].source)` → RM text.

## Definition of done

- [ ] Signatures exactly as C04; stubs removed; tests green; typecheck clean.

## Status

Done 2026-10-29. All steps implemented in src/rm; 18 tests green; typecheck clean for src/rm. See spec/sessions/T03.md.

## Contract notes

None. Ambiguity resolved: for collision renaming of a veza FK, the mapping name of the other (referenced) participant line is used.
