# C00 — Project conventions

Owner: **T00** (bootstrap). Consumers: every task.

## One folder = one agent

Every agent works in exactly **one** folder. It edits nothing outside it. Inside each folder, `AGENT.md` names the
task file, the contracts to read and the files to replace.

| Folder | Agent / task | Notes |
|---|---|---|
| `src/lang/syntax/` | **T01** lexer + parser | |
| `src/lang/semantic/` | **T02** checker, IR builder, `compile`, query helpers, error fixtures | |
| `src/rm/` | **T03** relational model, SQL, domain table | `src/rm/types.ts` is frozen contract code |
| `src/render/graph/` | **T04** IR → DiagramGraph, text measuring | `src/render/graph/types.ts` is frozen contract code |
| `src/render/layout/` | **T11** ELK layout + attribute placement | |
| `src/render/geometry/` | **T12** outline intersection, edge routes, labels, arrows | |
| `src/render/flow/` | **T05** React Flow nodes/edge, `DiagramView` | |
| `src/render/svg/` | **T06** standalone SVG / PNG export | |
| `src/ui/editor/` | **T07** CodeMirror editor | |
| `src/ui/tabs/` | **T08** Domeni / Relacioni model / SQL tabs | |
| `src/ui/shell/` | **T09** App, toolbar, split pane, error panel, storage, wiring | also owns root `README.md` |
| `e2e/` | **T10** integration & acceptance (runs last) | |

**Frozen (written by T00, changed only via CHANGELOG):** root config files (`package.json`, `tsconfig*.json`,
`vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`), `src/main.tsx`, `src/architecture.test.ts`,
`src/lang/{diagnostics,ast,ir,index}.ts`, `src/rm/types.ts`, `src/render/graph/types.ts`, `src/render/style.ts`,
`src/examples/**`, `src/fixtures/**`, every `AGENT.md`.

## Public entry points (the only cross-folder imports allowed)

| Import from | Gives you |
|---|---|
| `src/lang` (`src/lang/index.ts`) | everything of C01, C02, C03: types, `lex`, `parse`, `compile`, query helpers |
| `src/rm` (`src/rm/index.ts`) + `src/rm/types.ts` | C04 |
| `src/render/graph` (`index.ts`) + `src/render/graph/types.ts` | C05 |
| `src/render/style.ts` | C05 style constants |
| `src/render/layout` (`index.ts`) | C06 layout |
| `src/render/geometry` (`index.ts`) | C06 geometry |
| `src/render/svg` (`index.ts`) | C07 |
| `src/render/flow` (`index.ts`) | C08 DiagramView, `toReactFlow` |
| `src/ui/editor` (`index.ts`) | C08 Editor |
| `src/ui/tabs` (`index.ts`) | C08 tabs |
| `src/ui/shell` (`index.ts`) | `App` (used only by `src/main.tsx`) |
| `src/examples`, `src/fixtures/*` | examples, golden test data |

Inside its own folder an agent may structure files however it likes. It must keep `index.ts` exporting exactly the
contract signatures.

## Stack and dependencies (installed by T00 — no agent adds deps without a CHANGELOG entry)

| Package | Version | Kind |
|---|---|---|
| react, react-dom | ^18.3.1 | dep |
| @xyflow/react | ^12.3.0 | dep |
| elkjs | ^0.9.3 | dep |
| codemirror, @codemirror/{state,view,language,lint,commands} | ^6 | dep |
| @lezer/highlight | ^1.2.0 | dep |
| typescript | ~5.6 | dev |
| vite, @vitejs/plugin-react | ^5 / ^4 | dev |
| vitest | ^2.1 | dev |
| jsdom, @testing-library/react, @testing-library/dom | | dev (UI tests) |
| @types/react, @types/react-dom, @types/node | | dev |

## Scripts

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc -b --noEmit"
}
```

Run one agent's tests: `npx vitest run src/rm`.

## TypeScript

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `jsx: react-jsx`, `moduleResolution: bundler`,
`target: ES2022`. No `any` in exported signatures.

## Import rules (enforced by `src/architecture.test.ts`)

- **No React** in `src/lang/**`, `src/rm/**`, `src/render/{graph,layout,geometry,svg}/**`, `src/examples/**`,
  `src/fixtures/**`: they must not import `react`, `react-dom`, `@xyflow/react`, `codemirror`, `@codemirror/*`.
- `src/lang/**` imports nothing outside `src/lang/`.
- A file never imports another agent's folder except through that folder's `index.ts` or a frozen contract file
  (see the table above). `src/fixtures` and `src/examples` may be imported by anyone.
- `src/render/{graph,layout,geometry,svg}` never import `src/render/flow` or `src/ui`.

## Stubs

T00 creates each agent folder's `index.ts` with the exact contract signatures and bodies
`throw new Error('not implemented: Txx')`. React components render `<div>not implemented: Txx</div>`.
Everything compiles and `npm test` passes from the start.

## Tests

- Vitest, co-located `*.test.ts(x)` inside the agent's folder.
- Default environment `node`; UI tests start with `// @vitest-environment jsdom`.
- Tests that need another agent's implementation are named `*.integration.test.ts(x)`. They may be red only while
  that dependency is still a stub. Everything else uses `src/fixtures/*`.

## Language of text

UI strings and diagnostics: Serbian Latin (č ć ž š đ). Code, comments, README: English.
