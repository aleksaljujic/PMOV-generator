# PMOV generator

A web compiler and live editor for PMOV (extended ER, FON notation) diagrams: DSL text on the left, live diagram on
the right. The product spec is `spec/requrement.md`.

## How work is organised

- **One folder = one agent.** Each agent folder has an `AGENT.md`: read it first, and edit only inside that folder.
  The folder map is in `spec/contracts/C00-project.md`.
- **Contracts are the only interface between agents:** `spec/contracts/`. Tasks are in `spec/tasks/`.
- **Frozen files** (written from the contracts; change only via `spec/contracts/CHANGELOG.md`):
  `src/lang/{diagnostics,ast,ir,index}.ts`, `src/rm/types.ts`, `src/render/graph/types.ts`, `src/render/style.ts`,
  `src/examples/`, `src/fixtures/`, `src/main.tsx`, `src/architecture.test.ts`, root config files, every `AGENT.md`.
- Cross-folder imports go only through the other folder's `index.ts` or a frozen file.
  `src/architecture.test.ts` enforces this.
- Unit tests use the golden fixtures in `src/fixtures/`. Tests that need another agent's code are named
  `*.integration.test.ts(x)`.

## Commands

```bash
npm run dev        # Vite dev server
npm test           # all tests (vitest run)
npx vitest run src/rm   # one folder
npm run typecheck
npm run build
```

## Conventions

TypeScript strict and `noUncheckedIndexedAccess`. There is no React in `src/lang`, `src/rm`, or
`src/render/{graph,layout,geometry,svg}`. UI text and diagnostics are in Serbian (Latin script); code, comments and
the README are in English.
