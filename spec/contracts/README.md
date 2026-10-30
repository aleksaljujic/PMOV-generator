# Contracts

Contracts are the **only** communication channel between parallel tasks (`spec/tasks/`).
A task may rely on anything written in a contract and on nothing else from another task
(no peeking at another task's work-in-progress, no "I'll just call that helper").

Source of truth for the product: [`../requrement.md`](../requrement.md).

## Index

| ID  | File | Code it pins down | Owner (implements) | Consumers |
|-----|------|-------------------|--------------------|-----------|
| C00 | [C00-project.md](C00-project.md) | folder-per-agent layout, deps, scripts, public entry points, import rules | T00 | all |
| C01 | [C01-diagnostics.md](C01-diagnostics.md) | `src/lang/diagnostics.ts` — spans, diagnostic codes, Serbian messages | T00 (file), T01/T02 (emit) | T01 T02 T07 T09 |
| C02 | [C02-ast-and-parser.md](C02-ast-and-parser.md) | `src/lang/ast.ts`, `lex()`, `parse()`, grammar disambiguation | T01 | T02 T07 |
| C03 | [C03-ir-and-compile.md](C03-ir-and-compile.md) | `src/lang/ir.ts`, `compile()`, IR build rules, query helpers, golden IR fixtures | T02 | T03 T04 T06 T08 T09 T11 |
| C04 | [C04-relational-model.md](C04-relational-model.md) | `src/rm/types.ts`, RM generation rules, text/SQL format, domain table | T03 | T08 T09 |
| C05 | [C05-diagram-graph.md](C05-diagram-graph.md) | `src/render/graph/*` — renderer-neutral nodes/edges, ids, labels, style constants | T04 | T05 T06 T09 T11 T12 |
| C06 | [C06-layout-and-geometry.md](C06-layout-and-geometry.md) | `layoutDiagram()` (T11); `computeEdgeGeometry()`, outline intersection (T12) | T11 T12 | T05 T06 T09 |
| C07 | [C07-svg-export.md](C07-svg-export.md) | `graphToSvg()`, `renderSvg()`, PNG export | T06 | T09 |
| C08 | [C08-ui-components.md](C08-ui-components.md) | React component props: Editor, DiagramView, tabs, ErrorPanel; storage; examples | T05 T07 T08 T09 | T09 |
| C10 | [C10-domains-and-constraints.md](C10-domains-and-constraints.md) | domains, cross-table constraints: frozen AST/IR/RM additions, check codes E13–E20/W05/W06, builder actions, tab/shell wiring | orchestrator (frozen), T22–T28 | all |
| C09 | [C09-interactive-builder.md](C09-interactive-builder.md) | `BuilderAction`, `applyBuilderAction`, optional `DiagramViewProps` for the builder, `pmov.mode.v1` | T13 | T13 |
| C11 | [C11-sql-dialects.md](C11-sql-dialects.md) | SQL dialects: `SqlDialect`, `generateSql(…, dialect)`, SqlTab dropdown, `pmov.sqlDialect.v1` | orchestrator (frozen), T30–T32 | T31 T32 |
| C13 | [C13-json-interchange.md](C13-json-interchange.md) | JSON file format, `exportDiagramJson` / `parseDiagramJson` / `modelToSource`, toolbar buttons | orchestrator (frozen), T35–T36 | T36 T37 |
| C12 | [C12-triggers.md](C12-triggers.md) | PostgreSQL triggers in `generateSql`: child-side referential actions, general constraints; no frozen code | orchestrator, T34 | – |

## Rules

1. **Contract files are the spec, the `.ts` files are their mirror.** T00 copies every TypeScript
   block marked `// FILE: <path>` verbatim into the repo. After that, the type files listed as
   "contract code" are frozen.
2. **Only the owner implements.** Every folder has exactly one owning agent (see C00 §One folder = one agent).
   Never edit a file you don't own — this is what lets tasks run in parallel without merge conflicts.
3. **Stubs first.** T00 creates every module from the contract signatures with bodies that
   `throw new Error('not implemented: Txx')`. Everything compiles from minute one; each task replaces
   its own stubs.
4. **Test against contracts, not against other tasks.** If your tests need input produced by another
   task, use the golden fixtures defined in the contracts (`src/fixtures/*`), not the other task's
   implementation. End-to-end tests that do go through other modules are allowed, but they must be in a
   file named `*.integration.test.ts` so it is obvious why they fail while a dependency is still a stub.
5. **Changing a contract.**
   - *Additive* changes (new optional field, new exported helper) — the owner may make them, must update
     the contract `.md` and the mirrored `.ts` together, and append a line to [CHANGELOG.md](CHANGELOG.md).
   - *Breaking* changes (rename, remove, change of meaning) — write the proposal in CHANGELOG.md under
     "Proposed", list affected consumer tasks, and do not merge until every consumer task's file has
     acknowledged it in its "Contract notes" section.
6. **Ambiguity.** If a contract is ambiguous, the owner's interpretation wins; the owner writes it down in
   the contract (additive clarification) so consumers see it.
