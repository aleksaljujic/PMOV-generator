# T29 — Acceptance: domains and cross-table constraints

**Wave:** 8 (after T22–T28, Sonnet 5.5). **Checks:** [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md)
§Done when, C10.
**Folder (owns everything inside):** `e2e/`.

## Goal

Verify the feature end to end: the `domeni` example (sr and en) compiles with zero diagnostics and gives the
expected Domeni, Ograničenja and SQL output; it can be built in Interaktivno mode without typing DSL; tab edits in
Tekst mode are undoable; existing examples are unchanged except for the FK `ON UPDATE / ON DELETE` clauses.
Report defects per owning task; do not fix other folders.

## Status

_waiting for T22–T27_

## Contract notes

_none yet_
