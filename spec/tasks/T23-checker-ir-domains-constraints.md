# T23 — Checker and IR: domains and constraints

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §2.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/lang/semantic/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

`compile` reports E13–E17 and W05 (sr + en) and builds `PmovIR.domains` / `constraints` and attribute
`userDomain` / `length` exactly as C10 §2 says.

## Steps

1. Domain table: declarations, E14, resolution through parents, E13, E15 (cycle), W05, `effectiveConstraint`.
2. Attributes: `userDomain` resolution, `domain` = resolved base, `length`; W02 suppressed when `userDomain` is set.
3. Constraints: E16 (relation lookup by name without spaces), E17 variants, cell mapping (child == parent rule),
   IR build with valid rules only, `refs` extraction with spans.
4. sr + en message tables for every new code (keep the "same keys in both" test pattern used in this folder).

## Tests

- One passing and one failing case per code E13–E17, W05, for every E17 variant listed in C10 §2.
- `compile(EXAMPLES domeni .source).ir` deep-equals `DOMAIN_EXAMPLE_IR` modulo spans (`stripSpans`), zero
  diagnostics; `sourceEn` compiles with zero diagnostics and the same IR shape.
- `DOMAIN_CHAIN_SOURCE`: `Oznaka` resolves to `string`, length 40, effective constraint
  `NotNull And Like '[A-Z]%'`.
- The other four examples give exactly the old IR (golden fixtures unchanged).

## Definition of done

- [ ] `npx vitest run src/lang` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T23.md`.

## Status

Done. E13–E17 and W05 (sr + en) and the `domains` / `constraints` / `userDomain` / `length` IR are implemented.
`npx vitest run src/lang src/architecture.test.ts`: all green. `npm run typecheck`: no errors in `src/lang`.
Parser (T22) had landed: `domains.integration.test.ts` is green against it.

## Contract notes

- New files: `domains.ts` (domain table, E13/E14/E15/W05), `constraints.ts` (E16/E17 + IR), tests `domains.test.ts`
  (hand-built ASTs) and `domains.integration.test.ts`. `check.ts`, `buildIr.ts`, `messages.ts` extended.
- Lang cannot import `src/rm`, so the `ALLOWED_REF_ACTIONS` table is duplicated in `constraints.ts`.
- Not-in-table rule: a domain named like a built-in (E14b) or a duplicate (E14a) is not entered into the table.
- E17 spans: no header / no rules -> constraint name; second header line -> that line; empty `uslov` -> the text span;
  unknown op, `/` cell, repeated op -> the op token; missing action -> the item; unknown/disallowed action -> the action token;
  foreign relation -> the relation name; duplicate constraint name -> the name.
- A general constraint without a rule line is dropped from the IR (same as a missing header). A referential constraint
  with no rule lines is valid. For general constraints any relation may carry any op (only `restricted` allowed).
- E14c on a user-domain attribute with `length` is reported only when the resolved base is known and not `string`.
  The attribute's own `length` is kept in the IR even when E14c is reported.
- E15: domains inside a cycle get `base: null`; domains leading into it also resolve to null.
- E13 on an attribute is tested both with hand-built ASTs and from source (`objekat A { X# : Nepostojeci }`, sr + en).
- Golden-output issues (not changed, frozen/unedited): `stripSpans` in `src/fixtures/ir.ts` strips only `span` and
  `nameSpan`, not `headerSpan` / `conditionSpan`; my integration test uses a local stripper. The existing
  `compile.integration.test.ts` "sourceEn examples" shape helper was extended (approved by the orchestrator) to blank the
  C10 name-carrying keys; checks for the older examples are unchanged.
- `buildIr` messages: it builds with the `sr` table because it emits no diagnostics.
