# T28 — Shell: RM diagnostics, Ograničenja tab, tab actions

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §7.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/ui/shell/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

The shell shows RM diagnostics, the new tab, and routes tab edits through `applyBuilderAction` in both modes.

## Steps

1. Merge `rm.diagnostics` into the ErrorPanel/Editor list (not into the `hasErrors` passed to RM tabs).
2. "Ograničenja" / "Constraints" tab between RM and SQL; `highlight` state.
3. `onAction` handler for `DomainTab` and `ConstraintsTab` in both modes (Interaktivno history; Tekst via the
   editor value).
4. Error click on domain/constraint diagnostics → tab + highlight.
5. `generateSql(rm, ir, locale)`; `locale` into `generateRelationalModel`.
6. README: a short "Domains and constraints" section with the `domeni` example (README is owned by this folder).

T24/T25/T26 work in parallel: until they land, `ConstraintsTab` may not exist yet in `src/ui/tabs` (import will
fail typecheck). Do steps that don't depend on them first; finish the wiring last and re-run typecheck. If a
dependency is still missing when you are otherwise done, say so in Status.

## Tests

- RM diagnostic (E18 from a source with a wrong header) appears in the error panel; RM tabs still render.
- Tab action in Tekst mode updates the editor text; in Interaktivno it is one Poništi step.
- Clicking a W05 diagnostic in Interaktivno opens the Domeni tab with the row highlighted.
- en labels for the new tab.

## Definition of done

- [ ] `npx vitest run src/ui/shell` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T28.md`.

## Status

Done except waiting on T25. Steps 1-4 and 6 implemented; all 49 tests in `src/ui/shell` + architecture pass, with the
tabs mocked in `App.domains.test.tsx`. `npm run typecheck`: the only shell errors are `ConstraintsTab` / `TabHighlight`
missing from `src/ui/tabs` (T25 still in progress; also `DomainTab` onAction/highlight props). Not verified against the
real tabs, T24 `rm.diagnostics` or T26 actions (no integration test yet). Re-run typecheck once T25 lands.

## Contract notes

- Step 5: the shell does not call `generateSql` (SqlTab in `src/ui/tabs` does), so passing `ir`/`locale` to it is T25's job.
  The shell passes `locale` to `generateRelationalModel` for the diagnostics.
- RM diagnostics are computed in the shell from `result.ir` (not `lastValidIr`) when `!hasErrors`; they are merged into
  the list sorted by `span.from` and do not affect `hasErrors` for tabs.
- Tekst-mode tab action: `applyBuilderAction` then `setSource` (the Editor's external value change, C10 §6/T27, keeps
  it in CodeMirror history). Interaktivno: the existing `applyAction` (one history step).
- Error click: diagnostics with `elementId: null` inside an `ir.domains[i].span` / `ir.constraints[i].span` switch tab and
  set `highlight`; in Tekst mode jump-to-line also still happens. Highlight is cleared when the user clicks a tab.
- New shell string `tabConstraints` (sr 'Ograničenja', en 'Constraints'). No existing test edited.
