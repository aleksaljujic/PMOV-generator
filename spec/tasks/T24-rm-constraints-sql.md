# T24 — Relational model: constraints, domain structure, SQL

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §3.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/rm/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

The relational model carries referential and general constraints with resolved actions and its own diagnostics
(E18–E20, W06); new `buildDomainStructure` and `formatConstraintsText`; SQL with `CREATE DOMAIN`, `CHECK`,
named FK constraints with `ON UPDATE / ON DELETE`, and assertions.

## Steps

1. `RelAttribute.userDomain` / `length` (own and borrowed).
2. `referential`: FK groups, `fkKind`, block matching, defaults, E18 / E19 / E20, generated names.
3. `general`: `checks`, W06.
4. sr + en messages (`options.locale`).
5. `buildDomainStructure`, `buildDomainTable` DOMEN column, `formatConstraintsText`.
6. SQL per C10 §3: `generateSql(rm, ir?, locale?)`.

## Tests

- `generateRelationalModel(DOMAIN_EXAMPLE_IR).referential` equals `DOMAIN_EXAMPLE_REFERENTIAL` (groups compared
  only same/different); `general` has `IsplataDoPlate` with checks `Isplata [insert, update]`, `Radnik [update]`;
  no diagnostics.
- `MAIN_EXAMPLE_IR` → relations still equal `MAIN_EXAMPLE_RM` (no `userDomain`/`length` keys).
- Defaults for all four `fkKind`s (use the spec example for `identifying` podtip, a DG=0 veza for `nullable`).
- E18 (missing, ambiguous with two FKs to the same parent, wrong attrs), E19 (both variants), E20, W06; the DG=0
  toggle changes E18 as expected.
- `buildDomainStructure(DOMAIN_EXAMPLE_IR)` equals `DOMAIN_EXAMPLE_STRUCTURE`.
- SQL: `CREATE DOMAIN` order with a parent (use a hand-written IR mirroring `DOMAIN_CHAIN_SOURCE`); each
  recognized constraint form → `CHECK`, unrecognized → comment; ON UPDATE/ON DELETE mapping; child-side comment;
  assertion comment. Update the existing golden SQL once (only the FK lines change) and say so in Contract notes.

## Definition of done

- [ ] `npx vitest run src/rm` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T24.md`.

## Status

Done. `npx vitest run src/rm src/architecture.test.ts`: 46 tests green (22 new in `src/rm/constraints.test.ts`);
`npm run typecheck` has no errors in `src/rm`. New exports: `buildDomainStructure`, `formatConstraintsText`,
`generateSql(rm, ir?, locale?)`. New file `src/rm/constraints.ts` (matching, E18-E20, W06).

## Contract notes

- **Golden change (intended, once):** the three FK assertions in `src/rm/rm.test.ts` (`generateSql` tests) now expect
  `ALTER TABLE "C" ADD CONSTRAINT "fk_C_P" FOREIGN KEY (...) REFERENCES "P" (...) ON UPDATE CASCADE ON DELETE RESTRICT;`.
  Nothing else in existing tests changed.
- **`formatConstraintsText(rm, locale = 'sr')` layout.** Cards separated by one blank line, referential first, then general.
  Tables are left-aligned, columns separated by two spaces, trailing spaces trimmed; the first column holds relation names
  (header cell empty).
  ```
  RadnikUOdeljenju  Radnik.SifOd ⊆ Odeljenje.SifOd
             INSERT      UPDATE      DELETE
  Radnik     RESTRICTED  RESTRICTED  /
  Odeljenje  /           CASCADES    RESTRICTED
  ```
  A derived constraint has no name: its title line is `Odeljenje.Mlb ⊆ Radnik.Mlb (podrazumevano)` (en `(default)`).
  A block constraint's title is `<name>  <fk title>`. General: `<name>`, `  Uslov: <condition>` (en `Condition:`), then a
  table with a row per relation in `checks`, `RESTRICTED` where the op is checked and `/` elsewhere. Bold cells
  (differs from default) cannot be shown in plain text, so they are not marked. Empty model gives `''`.
- Cell mapping for block rules: child != parent: child insert/update, parent update/delete; child == parent: insert ->
  childInsert, update -> parentUpdate, delete -> parentDelete. Rules for non-applicable (relation, op) pairs are ignored
  (the checker already reports E17).
- E18 spans the block's `headerSpan`; E20 too (line = first block's `span.line`); E19 spans the offending rule.
  E19 for a nullifies rule skips only that cell (default kept, not in `explicitCells`). E18 ambiguous lists candidates as
  `Child(a, b); Child(c)`.
- `explicitCells` is in `REF_CELLS` order. A derived name counter (`_2`, `_3`) counts only unnamed FKs.
- `identifying` = FK all-pk and child element is a slab or a podtip (objekat that is a subtype of a specijalizacija);
  otherwise all-pk -> `component`.
- `generateSql` also works for an RM without `referential` (hand-built models): FKs are derived from `references`
  groups with default names/actions. `CHECK` forms accept numeric operands only for `Between` and comparisons;
  anything else (including non-numeric comparisons) goes into the `-- ...` comment. Domain/column names have spaces
  removed. `NotNull` inside a domain constraint gives `NOT NULL` and is not repeated in the comment.
- `buildDomainStructure`: `base` is the parent name, else the built-in, en dash when unresolved.
- No deviations from C10 §3.
