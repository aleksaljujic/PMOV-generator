# T37 — Acceptance: JSON import / export

**Wave:** 10, after T35 and T36 (Sonnet 5.5). **Checks:** [`../contracts/C13-json-interchange.md`](../contracts/C13-json-interchange.md) §3.
Feature spec: [`../feature_json_import_export.md`](../feature_json_import_export.md) (§ *Tests → e2e*, *Done when*).
**Folder (owns everything inside):** `e2e/`.

Read first: `e2e/AGENT.md`, C13, the feature spec. Do not edit other folders: report bugs below and the orchestrator
reopens the owning task.

## Steps

1. `e2e/vitest.config.ts`: jsdom, `include: ['e2e/**/*.test.ts', 'e2e/**/*.test.tsx']`, React plugin like the root
   config. Run with `npx vitest run --config e2e/vitest.config.ts`.
2. `e2e/json-pipeline.test.ts`: for every example (sr and en): export (with a positions map from
   `layoutDiagram` or a hand-made one) → `parseDiagramJson` → same source, positions, options; the `model` section
   compiled back via a model-only file gives the same stripped IR; a source with syntax errors exports with
   `model: null` and still imports.
3. `e2e/json-app.test.tsx`: render `App` (mock what the shell's own App tests mock), drag-equivalent: set positions,
   click **Izvezi JSON**, capture the blob; clear localStorage, re-render, import the blob as a `File`; source,
   stored positions and the Relacioni model tab content are the same. Invalid file → alert, nothing changes.
4. Write `spec/tasks/T37-acceptance-report.md`-style results in **Status** below: each *Done when* item ✅ / ❌ with
   evidence.

## Definition of done

- [ ] `npx vitest run --config e2e/vitest.config.ts` green, or every red test explained as a bug in another folder.
- [ ] Root `npm test` unaffected (its include is `src/**`).
- [ ] **Status** filled in; session log `spec/sessions/T37.md`.

## Status

**Done.** `npx vitest run --config e2e/vitest.config.ts`: 2 files, 47 tests green (`e2e/json-pipeline.test.ts` 43, `e2e/json-app.test.tsx` 4).
Root `npm test` unaffected (include is `src/**`; only the 13 known src/render/layout failures).

- ✅ Export is readable and usable without a DSL parser: `model` equals `stripSpans(ir)` and `diagram.nodes` carry x/y (pipeline tests, all examples sr+en).
- ✅ Import in a fresh browser restores text, dragged positions, dg0Mode/sqlDialect, and identical Relacioni and SQL tab content (app test 1).
- ✅ Model-only file (no `source`) imports as readable DSL that compiles to the same stripped IR (pipeline, every example sr+en; app test 4).
- ✅ Invalid files (not JSON, wrong format, version 9, array) -> one alert "Uvoz nije uspeo..." / newer-version message; source and all 4 storage keys unchanged; Cancel on confirm changes nothing.
- Syntax-error source exports `model: null`, `diagram: null` and still imports.

Bugs found: none.

## Contract notes

none
