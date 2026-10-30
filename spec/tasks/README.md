# Tasks

The product is described in [`../requrement.md`](../requrement.md). It is split into tasks that run **in parallel**
and communicate **only through the contracts** in [`../contracts/`](../contracts/README.md).

## Schedule

```
Wave 0 (serial, DONE)    T00 bootstrap: contract code, stubs, fixtures, deps, AGENT.md per folder
                              │
Wave 1 (all parallel — one agent per folder)
  T01 src/lang/syntax      T02 src/lang/semantic    T03 src/rm
  T04 src/render/graph     T11 src/render/layout    T12 src/render/geometry
  T05 src/render/flow      T06 src/render/svg
  T07 src/ui/editor        T08 src/ui/tabs          T09 src/ui/shell (+ README.md)
                              │
Wave 2 (serial)          T10 e2e/ — integration & acceptance
                              │
Wave 3 (one agent)       T13 src/builder + src/ui/builder (+ additive edits in src/ui/shell, src/render/flow)
                              — interactive builder, spec: ../feature_interactive_pmov.md
                              │
Wave 4 (parallel)        editor fix + English option, spec: ../fix_editor.md
  (Wave 0 for it DONE: contracts, frozen lang code, English examples)
  T14 src/ui/editor        T15 src/lang/syntax      T16 src/lang/semantic
  T17 src/ui/tabs          T18 src/builder + src/ui/builder
  T19 src/ui/shell (+ additive edits in src/render/flow, README.md)
                              │
Wave 5 (serial)          T20 e2e/ — acceptance of the editor fix and the English option
```

Every Wave‑1 task can start immediately after T00 because it codes against contracts and tests against the golden
fixtures in `src/fixtures/`. Runtime dependencies (e.g. T05 needs T12's geometry to draw correct edges) only
affect `*.integration.test.ts` files and manual checks — never the task's own unit tests.

| Task | Title | Implements contract | Consumes contracts | Runtime deps (for integration only) |
|---|---|---|---|---|
| [T00](T00-bootstrap.md) | Bootstrap: scaffold, contract code, stubs, fixtures (**done**) | C00, contract code of C01–C08 | – | – |
| [T01](T01-lexer-parser.md) | Lexer and parser | C02 (+ S-codes of C01) | C01 | – |
| [T02](T02-checker-ir-compile.md) | Checker, IR builder, `compile()` | C03 (+ E/W-codes of C01) | C01 C02 | T01 |
| [T03](T03-relational-model.md) | Relational model, SQL, domain table | C04 | C03 | – (fixtures) |
| [T04](T04-graph.md) | Diagram graph (IR → nodes/edges) | C05 | C03 | – (fixtures) |
| [T11](T11-layout.md) | ELK layout + attribute placement | C06 §Layout | C05 | T04 |
| [T12](T12-geometry.md) | Edge geometry: intersections, routes, labels, arrows | C06 §Geometry | C05 | T04 (`estimateTextWidth`) |
| [T05](T05-react-flow-view.md) | React Flow nodes, floating edge, DiagramView | C08 §DiagramView | C05 C06 | T04 T11 T12 |
| [T06](T06-svg-png-export.md) | Standalone SVG / PNG export | C07 | C03 C05 C06 | T02 T04 T11 T12 |
| [T07](T07-editor.md) | CodeMirror editor | C08 §Editor | C01 C02 | T01 |
| [T08](T08-output-tabs.md) | Domeni / Relacioni model / SQL tabs | C08 §Output tabs | C03 C04 | T03 |
| [T09](T09-app-shell.md) | App shell, wiring, persistence, README | C08 §App | all | all |
| [T10](T10-integration-acceptance.md) | Integration & acceptance | – | all | all |
| [T13](T13-interactive-builder.md) | Interactive builder (Tekst / Interaktivno mode) | C09 (new) + additive C08 | C02 C03 C05 C08 | all |
| [T14](T14-editor-tab-and-locale.md) | Editor: Tab indentation, keyword aliases, locale | C08 §Additions (editor) | C01 C02 | – |
| [T15](T15-parser-aliases-and-messages.md) | Parser: keyword aliases, English S-messages | C02 §Keyword aliases, C01 §English messages | C01 C02 | – |
| [T16](T16-semantic-english-messages.md) | Checker / compile: English E/W messages | C01 §English messages, C03 `compile` options | C01 C02 C03 | T15 |
| [T17](T17-tabs-locale.md) | Output tabs in English | C08 §Additions (tabs) | C01 C04 C08 | – |
| [T18](T18-builder-locale.md) | Interactive builder in English | C09 §Additions | C01 C02 C03 C09 | T15 |
| [T19](T19-shell-language-switch.md) | Shell: SR \| EN switch and wiring | C08 §Additions (shell, DiagramView) | all | T14–T18 |
| [T20](T20-acceptance-editor-and-english.md) | Acceptance: editor fix and English option | – | all | all |
| [T22](T22-parser-domains-constraints.md) | Parser: `domen`, `ograničenje`, user domains | C10 §1 | C01 C02 | – |
| [T23](T23-checker-ir-domains-constraints.md) | Checker + IR: E13–E17, W05, domains, constraints | C10 §2 | C01 C02 C03 | T22 |
| [T24](T24-rm-constraints-sql.md) | RM: referential/general constraints, E18–E20/W06, domain structure, SQL | C10 §3 | C03 C04 | – (fixtures) |
| [T25](T25-tabs-domains-constraints.md) | Tabs: Struktura domena, Ograničenja, edit forms | C10 §4 | C04 C08 C09 | T24 |
| [T26](T26-builder-domains-constraints.md) | Builder: domain/constraint actions, attribute form | C10 §5 | C02 C03 C09 | T22 T23 |
| [T27](T27-editor-domains-constraints.md) | Editor: highlighting, undoable external edits | C10 §6 | C02 C08 | – |
| [T28](T28-shell-domains-constraints.md) | Shell: RM diagnostics, Ograničenja tab, tab actions | C10 §7 | all | T24 T25 T26 |
| [T29](T29-acceptance-domains-constraints.md) | Acceptance: domains and constraints | – | all | T22–T28 |
| [T30](T30-rm-sql-dialects.md) | RM: SQL dialects (PostgreSQL, SQL Server, Oracle) | C11 §1 | C03 C04 | – (fixtures) |
| [T31](T31-tabs-sql-dialect.md) | Tabs: SQL dialect dropdown | C11 §2 | C04 C08 | T30 |
| [T32](T32-shell-sql-dialect.md) | Shell: SQL dialect state and persistence | C11 §3 | C04 C08 | T31 |
| [T34](T34-rm-triggers.md) | RM: PostgreSQL triggers for child-side actions and general constraints (Wave 9, after T30) | C12 §1 | C04 C10 C11 | T30 (same folder) |
| [T35](T35-interchange-json.md) | Interchange: JSON export / import, model → DSL (Wave 10) | C13 §1 | C02 C03 C05 C10 | – (fixtures) |
| [T36](T36-shell-json.md) | Shell: JSON export / import buttons and wiring (Wave 10) | C13 §2 | C08 C13 | T35 |
| [T37](T37-acceptance-json.md) | Acceptance: JSON import / export (Wave 10, after T35 T36) | C13 §3 | all | T35 T36 |

## Working agreement for every task

1. Read `../requrement.md`, `../contracts/README.md`, `../contracts/C00-project.md`, then the contracts your task lists.
2. Edit **only** files inside your folder (C00 §One folder = one agent). Read the folder's `AGENT.md` first.
3. Replace the stubs T00 left for you; keep exported signatures exactly as in the contract.
4. Before finishing: `npm run typecheck` and `npm test` — your own tests green; note any red `*.integration.test.ts`
   and which dependency is still a stub.
5. Fill in the **Status** and **Contract notes** sections at the bottom of your task file (that is how other tasks
   learn about clarifications without talking to you).
6. Need a contract change? Follow `../contracts/README.md` rule 5. Never "just fix" another task's file.
| [T38](T38-shell-sidebar-toggle.md) | Shell: one ☰ sidebar toggle instead of "Tekst \| Interaktivno" (Wave 11) | C08 §Additions for the sidebar toggle | C08 C09 | – |
