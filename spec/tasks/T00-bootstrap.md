# T00 — Bootstrap: scaffold, contract code, stubs, fixtures

**Wave:** 0. **Status: DONE (2026-10-29).**
**Implements:** C00 completely; writes every `// FILE:` block from C01–C05 verbatim, plus the examples from C08.

## What was created

- Vite + React + TS project in the repo root: `package.json` (scripts per C00), `tsconfig.json` (strict,
  `noUncheckedIndexedAccess`), `vite.config.ts`, `vitest.config.ts` (node env), `index.html`, `.gitignore`.
- Dependencies from C00 installed.
- **Frozen contract code** (extracted from the contract `.md` files by script):
  `src/lang/diagnostics.ts`, `src/lang/ast.ts`, `src/lang/ir.ts`, `src/lang/semantic/query.ts` (T02 owns it now),
  `src/fixtures/ir.ts`, `src/rm/types.ts`, `src/fixtures/rm.ts`, `src/render/graph/types.ts`, `src/render/style.ts`.
- `src/examples/index.ts`: both examples copied verbatim from `requrement.md`.
- `src/lang/index.ts`: the frozen barrel (`diagnostics`, `ast`, `ir`, `./syntax`, `./semantic`).
- **Stubs** with exact contract signatures in every agent folder (`index.ts` plus component files). They throw
  `not implemented: Txx`, or render that text for components.
- `src/main.tsx` (frozen) renders `App` from `src/ui/shell`.
- `src/architecture.test.ts`: checks the no-React layers, keeps `src/lang` self-contained, and allows cross-folder
  imports only through `index.ts` or frozen files.
- `AGENT.md` in each of the 11 agent folders and in `e2e/`. Root `CLAUDE.md`.

## Verified

- [x] `npm run typecheck`: clean
- [x] `npm test`: architecture test green (6 tests)
- [x] `npm run build`: succeeds
- [x] The architecture test fails on a planted React import and on a deep cross-folder import (checked, then removed)

## Contract notes

- C00 was rewritten to use **one folder = one agent**. T04 was split into T04 (graph), T11 (layout) and
  T12 (geometry). Lexer/parser moved to `src/lang/syntax/`, and the checker/compile to `src/lang/semantic/`.
  Error fixtures moved to `src/lang/semantic/errorFixtures.ts`, and the shell to `src/ui/shell/`.
