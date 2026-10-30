# T27 — Editor: highlighting and undoable external edits

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §6.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/ui/editor/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

The new keywords are highlighted, and a source change coming from outside (tab forms in Tekst mode) is one
undoable editor transaction.

## Steps

1. Highlighting per C10 §6 (sr + en keywords, `->`, operations/actions inside `ograničenje` blocks).
2. Check how `Editor` applies an external `value` change; make it a single transaction kept in history.

## Tests

- Token classes for every new keyword and for `->`; `update` in an attribute block is **not** highlighted as an
  operation.
- External `value` change, then undo → previous text.

## Definition of done

- [ ] `npx vitest run src/ui/editor` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T27.md`.

## Status

done (2026-10-30)

## Contract notes

No contract changes. External value changes were already one undoable transaction; now explicit (addToHistory). New tests in `domains.test.tsx`; no golden outputs changed.
