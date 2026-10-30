# T34 — Relational model: PostgreSQL triggers in SQL

**Wave:** 9 (one agent, Sonnet 5.5). **Implements:** [`../contracts/C12-triggers.md`](../contracts/C12-triggers.md) §1.
Feature spec: [`../feature_triggers.md`](../feature_triggers.md).
**Folder (owns everything inside):** `src/rm/`.
**Starts after:** T30 (SQL dialects) is done. It edits the same `generateSql`, so you build on its version.

Read first: your folder's `AGENT.md`, then C12, then the feature spec (all of it, especially the SQL blocks and the
reason table), then C10 §3 and C11 §1 for what the SQL output already does. There are no frozen-file changes for this
task. Never edit frozen files or other folders.

## Goal

For `dialect === 'postgres'`, `generateSql` emits real PL/pgSQL triggers:
- a BEFORE ROW trigger for every child INSERT / UPDATE cell that is not RESTRICTED, replacing the
  `(zahteva okidač)` comment;
- an AFTER STATEMENT trigger set for every general constraint whose condition can be translated, otherwise a
  `-- okidač nije generisan: <reason>` line.

Output for `mssql` / `oracle`, and for PostgreSQL models that need no trigger, is unchanged byte for byte.

## Steps

1. New file `src/rm/triggers.ts` (pure, no React):
   - `childTrigger(c: ReferentialConstraint, cell: 'childInsert' | 'childUpdate', locale)` returns the
     function + trigger text (spec §*Child-side referential triggers*). Composite FKs: every attribute pair is joined
     with `AND`, `MATCH SIMPLE` semantics.
   - `translateCondition(condition, rm)` returns `{ ok: true, from, where }` or `{ ok: false, reason }`. It covers
     reference extraction (C10 §2 regex), the token whitelist, the `!=` → `<>` and keyword upper-casing, and the
     breadth-first join over direct FKs, with the ambiguous / not-connected / missing reasons (spec §*Translating
     the condition*).
   - `generalTriggers(g: GeneralConstraint, rm, locale)` returns the function plus one trigger per `checks`
     entry, or the reason line.
2. `sql.ts`: in the FK section and the general-constraint section, call these when `dialect === 'postgres'`. Keep
   every other line exactly as it is now.
3. sr + en strings: the DEFAULT comment, the `RAISE` messages and the 5 reason texts (spec tables). Put them where
   the folder already keeps its SQL strings.
4. Export nothing new from `index.ts`, unless you need it for tests. If you do, say so in Contract notes.

## Tests (new file `src/rm/triggers.test.ts`, use hand-written RMs or `compile` sources in an integration test)

- **Child side:** `nullifies` and `default` on insert and on update, single and composite FK. The exact text for the
  spec example. A restricted cell has no trigger. The trigger is placed right after its `ALTER TABLE`, and the
  comment is gone.
- **General:**
  - the exact text for `IsplataDoPlate` from the spec (the `domeni` example, in a `*.integration.test.ts`);
  - one relation (no `JOIN`), parent → child and child → parent joins, a 3-relation chain;
  - INSERT / UPDATE / DELETE combinations go into the `AFTER` clause in the fixed order;
  - translation of `!=`, `And` / `Or` / `Not`, `Between … And …`, string literals and numbers.
- **Fallbacks:** one case per reason (no refs, W06 ref, unknown token, not connected, several FKs). Each keeps both
  existing comment lines and adds the reason line.
- **Locale:** an en run of one child trigger and one general constraint (comments, reason, `RAISE` message).
- **Unchanged output:**
  - every example in `src/examples` except `domeni` gives the same PostgreSQL SQL as before your change (compare
    against the output at your starting point, e.g. a snapshot taken first);
  - `mssql` / `oracle` output for `domeni` is unchanged;
  - all `src/fixtures/sql.ts` goldens and existing `src/rm` tests pass **unedited**.

## Definition of done

- [ ] `npx vitest run src/rm` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green.
- [ ] The `domeni` PostgreSQL output contains `IsplataDoPlate_fn` and both triggers, exactly as in the spec.
- [ ] Optional manual check, if you have PostgreSQL available: the `domeni` SQL runs, and an `Isplata` insert with
      `Iznos` > `Plata` raises `check_violation`. Say whether you ran it.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T34.md`.

## Status

Done (code + tests), with ONE open conflict: `src/rm/constraints.test.ts` "FK actions, trigger comments, assertions" fails.
It asserts the old PostgreSQL `-- "A" INSERT: NULLIFIES (zahteva okidač)` comment right after the ALTER TABLE, which C12 says
must be replaced by a trigger. The test was left unedited as instructed; the orchestrator must update that one assertion
(line 221, and the `(requires a trigger)` en check on line 223 for postgres). Everything else in src/rm + architecture is green.

## Contract notes

- Child triggers are generated only for `nullifies` / `default` (the grammar allows no other child actions). A hand-built RM with
  child `cascades` keeps the old comment (an existing `sql.dialects.test.ts` case needs it).
- Check relations of a general constraint missing from the RM: extra reason (not in the spec) `relation 'X' does not exist in the relational model`.
- A general constraint with an empty `checks` list emits nothing after the two comment lines (no spec text for it).
- Several FKs between a pair of relations in R is checked for every pair up front; a relation reachable via two joined relations uses the first FK only.
- `not connected` lists all relations of R, quoted, in order of first appearance.
- The DEFAULT comment is placed inside the `IF ... THEN` block above the `NEW.x := NULL` lines.
- Nothing new exported from index.ts. New files: triggers.ts, triggers.test.ts, triggers.integration.test.ts.
