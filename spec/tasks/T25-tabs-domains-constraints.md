# T25 — Tabs: Struktura domena and Ograničenja

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §4.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/ui/tabs/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

The Domeni tab shows "Struktura domena" + "Atributi"; a new `ConstraintsTab` shows FON-style constraint tables;
with `onAction` both tabs become editable (forms, dropdowns, buttons), without it they are read-only.

## Steps

1. `DomainTab`: domain structure table (`buildDomainStructure` from `src/rm`), `inherited:` line, empty hint;
   with `onAction`: "+ domen" form, row click → edit form with "Obriši", "Izdvoj u domen" per attribute row with a
   built-in type. Naddomen choices exclude ones that would create a cycle.
2. `ConstraintsTab`: cards for `rm.referential` then `rm.general`; badge "podrazumevano", bold explicit cells;
   with `onAction`: dropdown per configurable cell (disallowed actions disabled with a tooltip: not nullable / in
   PK), "Vrati podrazumevano", "+ ograničenje" form (name, condition with `Relacija.Atribut` autocomplete,
   INSERT/UPDATE/DELETE checkboxes per relation found in the condition), "Obriši". "Kopiraj kao tekst" uses
   `formatConstraintsText`.
3. Result handling and `highlight` per C10 §4. sr + en strings in `strings.ts`.
4. Record the final props in C08 §Additions + CHANGELOG line.

Until T24 lands, `src/rm` returns no `referential`; write unit tests that render from hand-made `RelationalModel`
data where possible (e.g. accept an optional `rm` prop for tests, or test pure helpers), and keep end-to-end ones
in `*.integration.test.tsx`.

## Tests

- Read-only without `onAction` (no buttons/selects except copy); existing tab tests unedited and green.
- Struktura domena rows for `DOMAIN_EXAMPLE_IR`; inherited line for a derived domain.
- Changing a cell sends `setReferentialAction` with `attrs` and `constraint` from the RM entry; disabled
  NULLIFIES on a non-nullable FK; confirm dialog flow for `deleteDomain` with `usages`.
- en strings; key sets equal.

## Definition of done

- [ ] `npx vitest run src/ui/tabs` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T25.md`.

## Status

Done. `npx vitest run src/ui/tabs src/architecture.test.ts` green: 45 tab tests green (incl. 2 integration tests against real lang + rm, which now pass because T22-T24 landed). `tsc` has no errors in `src/ui/tabs`.

## Contract notes

- Exports as C10 §4: `DomainTab`, `ConstraintsTab`, `TabAction`, `TabHighlight`, `DomainTabProps`, `ConstraintsTabProps` from `index.ts`. Without `onAction` both tabs are read-only (only "Kopiraj kao tekst").
- **SqlTab** now calls `generateSql(rm, ir, locale)` (orchestrator note; C10 §7).
- `ConstraintsView` (exported from `ConstraintsTab.tsx`, not from `index.ts`) renders from a hand-made `RelationalModel`; used by unit tests.
- Bold cell = action differs from `DEFAULT_REF_ACTIONS[fkKind]` (not merely explicit), per the feature spec example.
- Disabled NULLIFIES: option disabled with `title` (not optional / part of PK) unless it is already the current value. Reason is chosen from `fkKind` (identifying/component = PK).
- Added beyond the spec: "Izmeni" button on general cards (sends `editConstraint`); `fkKind`-based reasons; `Da`/`Ne` confirm dialog (`role="alertdialog"`), re-sends with `replace: true` / `withDependents: true`.
- "Izdvoj u domen" maps Atributi rows to (owner element id, index) by walking `ir.elements` attributes; shown only when row count matches `buildDomainTable`.
- Condition autocomplete = clickable `Relacija.Atribut` suggestions under the input. Checkbox defaults for a newly found relation: INSERT + UPDATE.
- `Tabs.tsx` no longer contains `DomainTab` (moved to `DomainTab.tsx`); existing tests unedited.
