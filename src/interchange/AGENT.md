# Agent T35 — Interchange: JSON export / import, model → DSL

You are the **only** agent working in `src/interchange/`. Other agents work in parallel in their own folders.
You communicate with them **only through the contracts** in `spec/contracts/`.

## Read first (in this order)

1. [`../../spec/tasks/T35-interchange-json.md`](../../spec/tasks/T35-interchange-json.md): your task
2. [`../../spec/contracts/README.md`](../../spec/contracts/README.md) and [`C00-project.md`](../../spec/contracts/C00-project.md): the rules
3. Your contract: [`C13-json-interchange.md`](../../spec/contracts/C13-json-interchange.md); for the DSL: C02, C03, C10
4. [`../../spec/feature_json_import_export.md`](../../spec/feature_json_import_export.md): the feature

## You own

Everything inside `src/interchange/` except the frozen `types.ts` and this file. Create any files you need here.
**Edit nothing outside this folder.**

Public entry point: `index.ts` — `exportDiagramJson`, `parseDiagramJson`, `modelToSource`, `formatJsonImportError`,
and `export * from './types'`.

## You may import

`../lang` (index), frozen contract files (`../lang/*.ts`, `../render/graph/types`, `../rm/types`), `../fixtures/*`,
`../examples`. **No React**, no other folders (enforced by `src/architecture.test.ts`).

## Commands

```bash
npx vitest run src/interchange src/architecture.test.ts
npm run typecheck
```

## When you finish

- Replace every `not implemented: T35` stub.
- Fill in **Status** and **Contract notes** at the bottom of your task file; write `spec/sessions/T35.md`.
- If a contract is wrong or missing something, follow `spec/contracts/README.md` rule 5. Never edit frozen files or other folders.
