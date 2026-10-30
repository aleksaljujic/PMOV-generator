# T35 — Interchange: JSON export, import, model → DSL

**Wave:** 10 (parallel with T36, Sonnet 5.5). **Implements:** [`../contracts/C13-json-interchange.md`](../contracts/C13-json-interchange.md) §1.
Feature spec: [`../feature_json_import_export.md`](../feature_json_import_export.md).
**Folder (owns everything inside):** `src/interchange/` (new, React-free).

Read first: `src/interchange/AGENT.md`, then C13, then the feature spec, then C02 / C10 for the DSL grammar and keyword
tables (sr + en). Frozen files (C13 §0) are already written: `src/interchange/types.ts`, `src/fixtures/json.ts`.
Never edit them or other folders. T36 (`src/ui/shell/`) works in parallel and calls your functions through
`src/interchange/index.ts`. Another session's T34 is working in `src/rm/`; it does not affect you.

## Goal

Pure functions to write a diagram as JSON, read it back with validation, and turn a span-free model back into DSL.

## Steps

1. `exportDiagramJson`: key order and shape per C13 §1. Must equal `JSON_TINY_FILE_TEXT` byte for byte.
2. `parseDiagramJson`: the ordered checks of C13 §1, never throws; lenient positions / options / unknown keys.
3. `modelToSource`: printer for domains, all five element kinds and both constraint kinds, sr + en keywords, quoting,
   unnamed veza `_`.
4. `formatJsonImportError` + `strings.ts` (sr + en).
5. Keep `index.ts` exporting exactly the four contract signatures plus `export * from './types'`.

## Tests

- `interchange.test.ts` (fixtures only): tiny export text equality; `ir: null` / `graph: null` give `model: null` /
  `diagram: null`; every `JSON_INVALID_FILES` entry gives its error; `JSON_LENIENT_*`; export → parse round trip
  (source, positions, options); `JSON_MODEL_ONLY_FILE_TEXT` imports with `fromModel: true`; every error code
  formats in sr and en.
- `modelToSource.integration.test.ts` (needs `compile`): `JSON_MODEL` round trip in sr and en; every example in
  `src/examples` (sr source with `'sr'`, `sourceEn` with `'en'`) round trips to equal stripped IR; a model with an
  unknown `ref` prints DSL whose compile reports the usual E-code.

## Definition of done

- [ ] `npx vitest run src/interchange src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] No `not implemented: T35` left.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T35.md`.

## Status

Done. `npx vitest run src/interchange src/architecture.test.ts` green (53 tests); no typecheck errors in `src/interchange`.

## Contract notes

- Files: `index.ts`, `modelToSource.ts`, `validate.ts` (structural model check), `strings.ts`, two test files.
- `newerVersion` is formatted without the prefix (sentence only), as C13 says; all other codes use `<prefix>: <detail>`.
- Validation also checks optional value types (attribute `domain` in DOMAINS, `constraint`/`userDomain` string or null, `length` non-negative integer, rule `op`/`action`, domain and constraint fields), paths like `model.constraints[0].rules[0].action`. Missing optional `mapping`/`owner`/`supertype` are accepted as null.
- `modelToSource`: names that are not plain identifiers or that are DSL keywords are quoted; consecutive rules of one relation share a line; an attribute `length` under a `userDomain` is printed only when it differs from the domain's length; empty model prints a single `\n`.
- `positions` entry `__proto__` is dropped on import.
