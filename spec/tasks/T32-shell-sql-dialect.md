# T32 — Shell: SQL dialect state and persistence

**Wave:** 8 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C11-sql-dialects.md`](../contracts/C11-sql-dialects.md) §3.
Feature spec: [`../feature_multy_language.md`](../feature_multy_language.md) (§ *UI → Persistence*).
**Folder (owns everything inside):** `src/ui/shell/` (plus the root `README.md` section, as in earlier shell tasks).

Read first: your folder's `AGENT.md`, then C11, then the feature spec. Frozen files (C11 §0) are already written;
never edit them or other folders. Other Wave-8 agents (T30 `src/rm/`, T31 `src/ui/tabs/`) work in parallel in the
same working tree. T31 adds `dialect` / `onDialectChange` to `SqlTabProps`; until it lands, passing them may not
typecheck. That is expected; mock the tabs in your tests as earlier shell tasks did.

## Goal

The app remembers the chosen SQL dialect and passes it to the SQL tab.

## Steps

1. `storage.ts`: `STORAGE_KEYS.sqlDialect = 'pmov.sqlDialect.v1'`, `loadSqlDialect()`, `saveSqlDialect()`
   (validate against `SQL_DIALECTS`).
2. `App.tsx`: `sqlDialect` state, saved on change, passed to `SqlTab` as `dialect` / `onDialectChange`. Not reset
   by examples, **Novi dijagram**, mode or language switches.
3. README: short "SQL dialects" section (en, like the rest of the README).

## Tests

- `loadSqlDialect`: missing → `postgres`, unknown → `postgres`, valid values round-trip, storage throwing → `postgres`.
- App passes the stored dialect to `SqlTab`; `onDialectChange` updates the prop and saves; loading an example keeps it.

## Definition of done

- [ ] `npx vitest run src/ui/shell src/architecture.test.ts` green.
- [ ] Existing tests in your folder unedited and green.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T32.md`.

## Status

Done. `storage.ts` (`sqlDialect` key, `loadSqlDialect`, `saveSqlDialect`), `App.tsx` (state, save on change, props to `SqlTab`), README section. Tests: `storage.dialect.test.ts` (3), `App.dialect.test.tsx` (2). Existing tests unedited. Typecheck of `App.tsx` waits for T31 adding `dialect` / `onDialectChange` to `SqlTabProps`.

## Contract notes

No deviation from C11 §3. The README section is in English, as the rest of the README (the contract names it "SQL dijalekt" / "SQL dialects"; the task file says en).
