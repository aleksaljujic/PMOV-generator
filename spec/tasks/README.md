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

## Working agreement for every task

1. Read `../requrement.md`, `../contracts/README.md`, `../contracts/C00-project.md`, then the contracts your task lists.
2. Edit **only** files inside your folder (C00 §One folder = one agent). Read the folder's `AGENT.md` first.
3. Replace the stubs T00 left for you; keep exported signatures exactly as in the contract.
4. Before finishing: `npm run typecheck` and `npm test` — your own tests green; note any red `*.integration.test.ts`
   and which dependency is still a stub.
5. Fill in the **Status** and **Contract notes** sections at the bottom of your task file (that is how other tasks
   learn about clarifications without talking to you).
6. Need a contract change? Follow `../contracts/README.md` rule 5. Never "just fix" another task's file.
