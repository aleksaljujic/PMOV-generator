# C13 — JSON import / export

Owner of the frozen code: orchestrator (Wave 0, CHANGELOG 2026-10-30). Implemented by T35 (`src/interchange/`) and
T36 (`src/ui/shell/`), accepted by T37 (`e2e/`).
Feature spec: [`../feature_json_import_export.md`](../feature_json_import_export.md). The spec says **what** the user
sees. This contract says **who produces what, in which shape**. Where they differ, this contract wins; report the
difference in your task's Contract notes.

## 0. Frozen code (already written; read it, don't change it)

| File | What C13 added |
|---|---|
| `src/interchange/types.ts` | `PMOV_JSON_FORMAT`, `PMOV_JSON_VERSION`, `PMOV_JSON_GENERATOR`, `PMOV_JSON_MAX_BYTES`, `WithoutSpans<T>`, `PmovJsonModel`, `PmovJsonOptions`, `PmovJsonDiagramNode`, `PmovJsonDiagram`, `PmovJsonFile`, `ExportJsonInput`, `JsonImportError`, `JsonImportResult` |
| `src/interchange/index.ts` | stubs of the four functions below (T35 replaces the bodies; keep the signatures) |
| `src/fixtures/json.ts` | golden data: `JSON_TINY_*` (source, model, graph, positions, options, exact export text), `JSON_MODEL_SOURCE` / `JSON_MODEL` (every construct `modelToSource` prints), `JSON_MODEL_ONLY_FILE_TEXT`, `JSON_INVALID_FILES` (text → expected error), `JSON_LENIENT_FILE_TEXT` / `_EXPECTED` |
| `src/architecture.test.ts` | `interchange` is an agent folder, React-free; `interchange/types` is importable directly |

`src/interchange` is a new **React-free** agent folder. It may import `src/lang` (index / frozen files),
`src/render/graph/types.ts`, `src/rm/types.ts`, `src/fixtures`, `src/examples`. Nothing else.

**No change** to the DSL, AST, IR, RM, graph, layout, or any tab.

## 1. `src/interchange` (T35)

```ts
export function exportDiagramJson(input: ExportJsonInput): string;
export function parseDiagramJson(text: string): JsonImportResult;   // never throws
export function modelToSource(model: PmovJsonModel, locale: Locale): string;
export function formatJsonImportError(error: JsonImportError, locale: Locale): string;
```

### `exportDiagramJson`

- Builds a `PmovJsonFile` with keys in the order of the interface: `format`, `version`, `generator` (=
  `PMOV_JSON_GENERATOR`), `exportedAt` (= `now.toISOString()`), `locale`, `source`, `positions`, `options`
  (`dg0Mode`, `sqlDialect`), `model`, `diagram`.
- `model` = the IR with every `span` / `*Span` key removed, IR key order kept (exactly what `stripSpans` from
  `src/fixtures/ir.ts` produces; you may use it or reimplement it). `null` when `ir` is null.
- `diagram` = `{ nodes, edges }` from `graph`: each node is the `DiagramNode` with `x`, `y` appended when `positions`
  has an entry for its id (no keys otherwise); edges as given. `null` when `graph` is null.
- `positions` written as given.
- Output = `JSON.stringify(file, null, 2) + '\n'`. With the `JSON_TINY_*` inputs it equals `JSON_TINY_FILE_TEXT`
  byte for byte.

### `parseDiagramJson`

Checks in this order and returns the **first** failure (codes and paths as in `JSON_INVALID_FILES`):

1. `JSON.parse` throws → `notJson`.
2. Top level not a plain object → `missingField`, field `''`.
3. `format` missing → `missingField 'format'`; not `PMOV_JSON_FORMAT` → `wrongFormat` (value = `String(format)`).
4. `version` missing → `missingField 'version'`; not an integer → `badField 'version'`; `> PMOV_JSON_VERSION` →
   `newerVersion`. (A version `< 1` is `badField 'version'`.)
5. `source` present and not a string → `badField 'source'`.
6. `positions` present and not a plain object → `badField 'positions'`.
7. No `source`: `model` missing or `null` → `missingField 'model'`; otherwise structural validation, failing with
   `badModel` and the path of the first bad value (`model.elements`, `model.elements[i].kind`, `.id`, `.name`,
   `.attributes`, `.attributes[j].name`, `.attributes[j].isId`, `.participants`, `.participants[k].ref`,
   `.participants[k].card`, `.owner`, `.components`, `.supertype`, `.subtypes`, `.subtypes[k].ref`, `model.domains`,
   `model.constraints`, …). Structural only: an unknown `ref`, a missing identifier or a cycle is **not** an error.

On success:

- `source` = `file.source` when present (verbatim); otherwise `modelToSource(file.model, locale)` with `locale` =
  `file.locale` if it is `'sr' | 'en'`, else `'sr'`; `fromModel` accordingly.
- `positions` = entries whose value is an object with finite numeric `x` and `y` (others dropped); `{}` when absent.
- `options` = only `dg0Mode` ∈ `{'fk','relation'}` and `sqlDialect` ∈ `SQL_DIALECTS` (from `src/rm/types.ts`);
  other values are dropped. Unknown top-level keys and `diagram` are ignored.

### `modelToSource`

- Order: `domains`, then `elements` (array order), then `constraints`. One blank line between blocks (domain lines
  may be grouped without blank lines). Formatting like `src/examples` (2-space indent, one attribute per line,
  aligned `:` within a block). Ends with exactly one `\n`.
- Keywords from the C02 / C10 keyword tables in `locale` (`objekat`/`object`, `nadređeni`/…, `domen`/`domain`,
  `ograničenje`/`constraint`, `uslov`/`condition`, the action words, …).
- A name that is not a plain identifier is quoted. A veza with `name === ''` is written `_`. `ref`s are element ids
  (= names), quoted the same way.
- Attribute type: `userDomain` when present, else `domain` (+ `(length)` for a `string` with a `length` that is not
  inherited from the user domain); then the constraint. Derived fields (`IRDomain.base`, `effectiveConstraint`, a
  resolved `domain` under a `userDomain`) are not written.
- **Normative:** for `JSON_MODEL` and for every example in `src/examples` (sr source, and en source with locale
  `'en'`), `stripSpans(compile(modelToSource(stripSpans(ir), locale)).ir)` deep-equals `stripSpans(ir)`. The text
  itself is not pinned.

### `formatJsonImportError`

`<prefix>: <detail>` with prefix `Uvoz nije uspeo` / `Import failed` and the detail strings of the feature spec's
*UI strings* table (`badField` → `neispravno polje {path}` / `invalid field {path}`; `missingField` with field `''` →
`datoteka nije ispravan PMOV JSON` / `the file is not a valid PMOV JSON`). `newerVersion` is the full sentence without
the prefix. Strings live in `src/interchange/strings.ts`.

## 2. Shell (T36, `src/ui/shell/`)

- Toolbar: optional props `onExportJson?(): void`, `onImportJson?(file: File): void`. Buttons **Izvezi JSON** /
  **Export JSON** and **Uvezi JSON** / **Import JSON** (the latter clicks a hidden
  `<input type="file" accept=".json,application/json">`) after the PNG button, in both modes; no buttons without the
  props.
- Export: `exportDiagramJson({ source, ir: <current compile ir>, graph: <current graph or null>, positions:
  <same currentPositions() the SVG export uses>, options: { dg0Mode, sqlDialect }, locale, now: new Date() })` →
  `downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), 'pmov-dijagram.json' | 'pmov-diagram.json')`.
  Works with errors in the source. Failure → the existing `exportFailed` alert.
- Import: `file.size > PMOV_JSON_MAX_BYTES` → error `tooLarge`; read failure → `readError`; else
  `parseDiagramJson(text)`. On `ok: false` → `window.alert(formatJsonImportError(error, locale))`, nothing changes.
  On success: if the current source is non-empty (after trim) and differs from the result, `window.confirm` with
  the spec's text; Cancel changes nothing. Then set source, **replace** saved positions with the result's
  (`savePositions`), apply `options` keys present (state + storage), keep mode and language. In Interaktivno mode it
  is one history step (Poništi restores the previous source **and** positions). If `fromModel`, show the notice (an
  `alert`, or the existing toast if the shell has one). Clear the input's value so the same file can be picked again.
- Strings in the shell's `strings.ts` (sr + en). README: a short "JSON import / export" section.
- Drag-and-drop is optional (spec Decision 5); not required by tests.

## 3. Acceptance (T37, `e2e/`)

`e2e/` has no Playwright. T37 adds `e2e/vitest.config.ts` (jsdom, includes `e2e/**/*.test.ts(x)`, same React plugin
as the root config) and acceptance tests run with `npx vitest run --config e2e/vitest.config.ts`. It covers the
feature spec's *Done when* through the public entry points (`src/interchange`, `src/lang`, `src/render/graph`,
`src/ui/shell` `App` with the same mocks the shell's own App tests use). It reports bugs in its task file; it does not
fix other folders.

## 4. Who implements what

| Task | Folder | Sections |
|---|---|---|
| T35 | `src/interchange/` | §1 |
| T36 | `src/ui/shell/` (+ root `README.md` section) | §2 |
| T37 | `e2e/` | §3 (after T35, T36) |
