# Feature: JSON import and export ("Izvezi JSON" / "Uvezi JSON")

The user can save the whole diagram to a `.json` file and load it back later, on another computer, or in another
browser. The file holds everything needed to restore the diagram exactly: the DSL text, the node positions the user
dragged, and the output options. It also holds a structured, span-free **model** of the graph (elements, attributes,
cardinalities, domains, constraints) and the laid-out **diagram** (nodes and edges with coordinates), so other tools
and scripts can read a PMOV without parsing the DSL.

This document extends [`requrement.md`](requrement.md) (§ *Other outputs → Export*),
[`feature_interactive_pmov.md`](feature_interactive_pmov.md) and
[`feature_domain_strucutre.md`](feature_domain_strucutre.md). Everything in them still applies.

## Core principles

- **The DSL text stays the source of truth.** Import never keeps a separate model. It produces a DSL source and a
  `PositionMap`, puts them into the app the same way loading an example does, and the normal pipeline
  (`compile` → graph → layout → tabs) runs unchanged.
- **Export → import is lossless.** Importing a file the app exported gives the same source (byte for byte), the same
  positions and the same options. The diagram looks exactly as it did when it was exported.
- **`source` wins over `model`.** If a file has a `source` string, import uses it and ignores `model` and `diagram`.
  Only a file **without** `source` (written by hand or by another tool) is imported from `model`. The DSL is then
  generated from the model.
- **`diagram` is export-only.** It is there for external readers and is never read on import. Only `positions` is
  used to place nodes.
- **Import never breaks the current work silently.** An invalid file changes nothing and shows an error. A valid file
  replaces the current diagram only after the user confirms (the same rule as "Novi dijagram"), and the replacement is
  one undo step.
- **Export works with errors.** A source with E-codes or W-codes is exported as it is. A source with syntax errors
  (S-codes, no IR) is exported with `source` and `positions` only: `model` and `diagram` are `null`.

## UI

### Toolbar

Two new buttons next to "Izvezi SVG" / "Izvezi PNG", visible in both modes (Tekst and Interaktivno):

| Button (sr / en) | Action |
|---|---|
| **Izvezi JSON** / **Export JSON** | Downloads `pmov-dijagram.json` (en: `pmov-diagram.json`). Never disabled. |
| **Uvezi JSON** / **Import JSON** | Opens a file picker (`accept=".json,application/json"`), reads the file and imports it. |

### Import flow

1. The user picks a file. A file larger than **5 MB** is rejected before it is read.
2. The file is parsed and validated (see *Validation*). If it is invalid, nothing changes and an alert says why, for
   example *"Uvoz nije uspeo: datoteka nije ispravan PMOV JSON (nedostaje polje „format”)."*
3. If the current source is not empty and differs from the imported one, the user is asked:
   *"Trenutni dijagram će biti zamenjen uvezenim. Nastaviti?"* Cancel changes nothing.
4. The app sets the source, replaces the saved positions with the file's `positions` (stored positions for other ids
   are dropped), and applies `options` (see *Options*). The mode (Tekst / Interaktivno) does not change.
5. In Interaktivno mode the import is one history step, so Poništi / Ctrl+Z restores the previous diagram and its
   positions. In Tekst mode the editor's own undo restores the previous text, as with loading an example.
6. If the file was imported from `model` (no `source`), a short notice says
   *"Dijagram je uvezen iz modela; DSL tekst je generisan."*
7. If the imported source has errors, they show in the error panel as usual. Import does not refuse a file because
   of E-codes or S-codes in its `source`.

Dragging a `.json` file onto the editor or the diagram does the same as "Uvezi JSON". This is optional for the first
version (see *Decisions*).

## File format (version 1)

One UTF-8 JSON object, pretty-printed with 2-space indentation, keys in the order below:

```json
{
  "format": "pmov-diagram",
  "version": 1,
  "generator": "PMOV editor",
  "exportedAt": "2026-10-30T14:05:00.000Z",
  "locale": "sr",
  "source": "objekat Radnik {\n  Mlb#  : long\n  ImeR  : string NotNull\n}\n",
  "positions": {
    "Radnik": { "x": 120, "y": 80 }
  },
  "options": {
    "dg0Mode": "fk",
    "sqlDialect": "postgres"
  },
  "model": {
    "elements": [
      {
        "id": "Radnik",
        "name": "Radnik",
        "kind": "objekat",
        "attributes": [
          { "name": "Mlb", "isId": true, "domain": "long", "constraint": null },
          { "name": "ImeR", "isId": false, "domain": "string", "constraint": "NotNull" }
        ]
      }
    ]
  },
  "diagram": {
    "nodes": [
      { "id": "Radnik", "type": "objekat", "label": "Radnik", "elementId": "Radnik", "width": 100, "height": 44, "layoutRole": "core", "x": 120, "y": 80 }
    ],
    "edges": [
      { "id": "e:attr:Radnik:Mlb", "source": "Radnik", "target": "attr:Radnik:Mlb", "label": null, "arrow": false, "route": "straight", "elementId": "Radnik" }
    ]
  }
}
```

### Fields

| Field | Type | Export | Import |
|---|---|---|---|
| `format` | `"pmov-diagram"` | always | **required**, must match exactly |
| `version` | integer | always `1` | **required**. `1` is accepted. A higher number is rejected with *"Datoteka je iz novije verzije aplikacije (verzija N)."* |
| `generator` | string | `"PMOV editor"` | ignored |
| `exportedAt` | ISO 8601 string | the export time | ignored |
| `locale` | `"sr"` \| `"en"` | the UI language at export time | used only when importing from `model` (keyword language of the generated DSL). Otherwise ignored. The UI language does not change. |
| `source` | string \| absent | always | if present, this is the imported source |
| `positions` | `PositionMap` | `DiagramView.getPositions()` (the current positions of all nodes, dragged or laid out) | optional. Entries with a non-finite `x`/`y` are dropped. Missing → `{}` (full ELK layout). |
| `options.dg0Mode` | `"fk"` \| `"relation"` | current value | optional. An unknown value is ignored. |
| `options.sqlDialect` | `"postgres"` \| `"mssql"` \| `"oracle"` | current value ([`feature_multy_language.md`](feature_multy_language.md)) | optional. An unknown value is ignored. |
| `model` | `PmovJsonModel` \| `null` | the IR without spans, or `null` when there is no IR | used only when `source` is absent |
| `diagram` | `{ nodes, edges }` \| `null` | the `DiagramGraph` with each node's `x`/`y` (top-left) appended when it has a position, or `null` | ignored |

Unknown top-level keys are ignored on import (so later versions can add fields without breaking version 1 readers).

### The `model` section

`model` is the C03 `PmovIR` with **every `*Span` key removed** (`span`, `nameSpan`, `headerSpan`, `conditionSpan`,
and the `span` of participants, subtypes, rules and refs). It uses the same omit-when-empty rule as the IR: `domains`,
`constraints`, `userDomain` and `length` are present only when non-empty / non-null. Concretely:

```ts
type PmovJsonModel = {
  elements: JsonElement[];
  domains?: JsonDomain[];          // IRDomain minus spans
  constraints?: JsonConstraint[];  // IRConstraint minus spans
};
// JsonElement = IRElement minus spans:
//   { kind: 'objekat', id, name, attributes }
//   { kind: 'slab', id, name, owner: { ref, card, mapping } | null, attributes }
//   { kind: 'agregacija', id, name, components: { ref, card, mapping }[], attributes }
//   { kind: 'veza', id, name, participants: { ref, card, mapping }[] }       // name '' = unnamed (id `_#1`, …)
//   { kind: 'specijalizacija', id, name, supertype: { ref, card, mapping } | null, subtypes: { ref }[] }
// card = { min: 0 | 1, max: 1 | 'M' }
```

The existing `stripSpans` helper (`src/fixtures/ir.ts`) defines exactly this shape and is reused for the golden tests.

**Importing from `model`** (no `source`): a pure printer `modelToSource(model, locale)` writes DSL that compiles back
to the same model.

- Block order = `domains` first, then `elements` in array order, then `constraints`. Blocks are separated by one blank
  line, and the layout follows the examples (one attribute per line, aligned `:` columns, 2-space indent).
- Keywords are Serbian for `locale: "sr"` (or a missing locale) and English for `"en"`, using the keyword tables of
  C02 / C10.
- An unnamed veza (`name: ""`) is written as `veza _`. A name that is not a plain identifier (it has spaces) is
  quoted.
- Derived fields are **not** written back: `IRDomain.base` / `effectiveConstraint` and an attribute's resolved
  `domain` when it has a `userDomain` (the `userDomain` name is written instead).
- Validation of the model is structural only (see below). Semantic problems (an unknown `ref`, a missing identifier,
  a cycle) are not rejected: the generated DSL shows them as normal E-codes, so the user can fix them.
- **Round trip:** for every example, `compile(modelToSource(stripSpans(ir), locale)).ir`, with spans stripped, equals
  `stripSpans(ir)`.

### Validation

Import fails, and nothing changes, when:

- the file is not valid JSON or its top level is not an object;
- `format` is missing or not `"pmov-diagram"`, or `version` is missing, not an integer, or greater than `1`;
- `source` is present but not a string;
- `source` is absent and `model` is missing, `null`, or not structurally valid: `elements` is not an array, an element
  has an unknown `kind`, a missing / non-string `id` or `name`, a `card` that is not `{min: 0|1, max: 1|'M'}`, or an
  attribute without a string `name` and boolean `isId`;
- `positions` is present but not an object. Single bad entries in it are dropped and do not fail the import.

Each failure has its own message (sr + en, see *UI strings*). The first problem found is reported, with its JSON path
when that helps, for example `model.elements[3].participants[0].card`.

## Options

- `dg0Mode` is applied on import (state plus `pmov.dg0Mode.v1`), so the Relacioni model and SQL tabs look the same
  as at export time.
- `sqlDialect` is applied the same way (state plus `pmov.sqlDialect.v1`).
- The UI language, the working mode and the editor width are **not** part of the file. They are per-user settings,
  not part of the diagram.

## Architecture and contract changes

Following C00 (one folder = one agent):

| Folder | Content | React? |
|---|---|---|
| `src/interchange/` (new) | Pure functions: `exportDiagramJson(input) → string`, `parseDiagramJson(text) → { ok: true, source, positions, options, fromModel } \| { ok: false, error }`, `modelToSource(model, locale) → string`, the `PmovJsonFile` / `PmovJsonModel` types, sr + en messages in `strings.ts`. Unit tests with the golden fixtures. | **No React** |
| `src/ui/shell/` | Toolbar buttons "Izvezi JSON" / "Uvezi JSON", the hidden file input, confirm dialog, applying source + positions + options (one history step in Interaktivno), the "imported from model" notice, sr + en strings, README section. Reuses `downloadBlob`. | React |

- `exportDiagramJson` takes `{ source, ir, graph, positions, options, locale, now }`. `now` is passed in so the output
  is deterministic in tests.
- New contract **[C13-json-interchange.md](contracts/C13-json-interchange.md)** (C11 and C12 are the SQL-dialect and trigger contracts): the file format above, the
  signatures, and the validation messages. Wave 0 (orchestrator) adds the frozen part: the types, a fixture
  `src/fixtures/json.ts` (an exported file for the main example and for the `domeni` example, and one model-only
  file), the `src/interchange` row in C00, and the architecture-test entry that keeps `src/interchange` React-free.
  All changes are additive.
- `src/interchange` imports only `src/lang` (types, `compile` for tests), `src/render/graph/types.ts` and
  `src/fixtures`. The shell imports it through `src/interchange/index.ts`.
- **Tasks (Wave 10, Sonnet 5.5):** [T35](tasks/T35-interchange-json.md) `src/interchange/` and
  [T36](tasks/T36-shell-json.md) `src/ui/shell/` in parallel, then [T37](tasks/T37-acceptance-json.md) `e2e/`.

## UI strings

| Key | sr | en |
|---|---|---|
| export button | `Izvezi JSON` | `Export JSON` |
| import button | `Uvezi JSON` | `Import JSON` |
| confirm replace | `Trenutni dijagram će biti zamenjen uvezenim. Nastaviti?` | `The current diagram will be replaced by the imported one. Continue?` |
| imported from model | `Dijagram je uvezen iz modela; DSL tekst je generisan.` | `The diagram was imported from the model; the DSL text was generated.` |
| failure prefix | `Uvoz nije uspeo` | `Import failed` |
| not JSON | `datoteka nije ispravan JSON` | `the file is not valid JSON` |
| not PMOV | `datoteka nije ispravan PMOV JSON (nedostaje polje „{field}”)` | `the file is not a valid PMOV JSON (missing field "{field}")` |
| wrong format | `nepoznat format „{value}”` | `unknown format "{value}"` |
| newer version | `Datoteka je iz novije verzije aplikacije (verzija {n}).` | `The file comes from a newer version of the app (version {n}).` |
| bad field | `neispravno polje {path}` | `invalid field {path}` |
| bad model | `neispravan model na putanji {path}` | `invalid model at {path}` |
| too large | `datoteka je veća od 5 MB` | `the file is larger than 5 MB` |
| read error | `datoteka ne može da se pročita` | `the file cannot be read` |
| export failed | (existing `exportFailed`) | (existing `exportFailed`) |

## Tests

- `src/interchange` unit tests:
  - export of the main example matches the golden file in `src/fixtures/json.ts` (fixed `now`), and the key order is
    as specified;
  - a source with syntax errors exports `model: null` and `diagram: null` but keeps `source` and `positions`;
  - export → parse round trip returns the same source, positions and options, for every example;
  - `modelToSource` round trip (IR equality without spans) for every example, in `sr` and in `en`, including unnamed
    veze, quoted names, slab, agregacija, specijalizacija, domains with a parent chain and both constraint kinds;
  - a model with an unknown `ref` imports successfully and the compiled source reports the normal E-code;
  - every validation failure gives its own message, with the JSON path for model errors;
  - `version: 2` is rejected; unknown top-level keys are ignored; bad position entries are dropped.
- `src/ui/shell` tests: "Izvezi JSON" calls `downloadBlob` with an `application/json` blob and the right file name;
  "Uvezi JSON" with a valid file asks before replacing a non-empty source and then sets source, positions and
  `dg0Mode`; Cancel changes nothing; an invalid file shows the alert and changes nothing; in Interaktivno mode one
  Poništi restores the previous diagram and its positions.
- e2e: export the main example after dragging two nodes, clear storage, import the file. The source, the two dragged
  positions and all tabs are the same as before.

## Done when

- "Izvezi JSON" downloads a file that a person can read and an external script can use without a DSL parser (the
  `model` and `diagram` sections).
- "Uvezi JSON" on that file, in a fresh browser, restores the same text, the same diagram layout (including dragged
  nodes) and the same Relacioni model / SQL options.
- A hand-written model-only file (no `source`) imports into readable DSL that compiles to the same model.
- Invalid files never change the current diagram, and they show a clear message in the current UI language.
- `npm test`, `npm run typecheck` and `npm run build` pass. No existing golden fixture changes.

## Out of scope (for now)

- Importing other tools' formats (draw.io, Mermaid, ERDPlus, …) and exporting to them.
- Merging an imported diagram into the current one. Import always replaces.
- Several diagrams in one file, and a project/workspace file.
- Reading `diagram` on import (for example to reconstruct a model from nodes and edges alone).
- A JSON Schema file for the format. It can be generated from the C13 types later.

## Decisions (defaults accepted by the user, 2026-10-30)

1. The file contains **both** `source` and `model`; `source` wins on import, `model` is used only when `source` is
   missing.
2. Import replaces the current diagram after a confirm, and it is one undo step in Interaktivno mode.
3. Exported positions are the **current** positions of all nodes (not only the dragged ones), so the diagram looks the
   same after import even if a later ELK version lays it out differently.
4. The UI language and the working mode are not stored in the file.
5. Drag-and-drop of a `.json` file is optional in the first version.
