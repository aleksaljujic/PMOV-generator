# T02 — Semantic checker, IR builder, `compile()`

**Wave:** 1 (parallel). **Implements:** C03, and the E/W-codes of C01. **Consumes:** C01, C02.
**Folder (owns everything inside):** `src/lang/semantic/` — read its `AGENT.md` first. Public entry:
`src/lang/semantic/index.ts` (`compile` + query helpers). Also `src/lang/semantic/errorFixtures.ts`.

## Goal

Turn a `ModelAst` into Serbian diagnostics (E01–E12, W01–W04) and a best-effort `PmovIR`, exposed as
`compile(source): CompileResult`.

## Steps

1. **Symbol table:** collect block names → first declaration (E01 on later duplicates, `elementId` = earlier id).
   Assign ids per C03 (`_#N` for unnamed vezas).
2. **Checker** — one function per rule, each returning `Diagnostic[]` with the span target and `elementId` from the
   C01 table:
   - Cardinality validation (E03): DG∈{0,1}, GG∈{1,M,m}, DG≤GG (`(1,1)` ok, `(1,M)` ok, `(2,M)`, `(1,0)`, `(0,X)` fail).
   - Reference resolution (E02) — only objekat / slab / agregacija are referencable.
   - Block shapes: veza (E04, E05), slab (E06), specijalizacija (E07), agregacija (E08), objekat participant lines
     and agregacija roles (E12).
   - E09 specialization cycles (DFS over podtip → nadtip), E10 missing identifier unless podtip, E11 podtip repeats a
     transitive nadtip identifier.
   - Warnings W01–W04.
3. **IR builder** following C03 §IR build rules exactly (drop unresolved/invalid participants, keep erroneous
   blocks, normalize `m`→`M`).
4. **`compile()`**: `parse` → if any S-code: `{ ast, ir: null, diagnostics, hasErrors: true }`; else run checker +
   builder; sort diagnostics by `span.from`, then code.
5. Keep `src/lang/semantic/index.ts` exporting `compile` and the query helpers (the frozen `src/lang/index.ts`
   re-exports it). Import the parser only via `../syntax`.
6. **`ERROR_FIXTURES`**: one minimal source per E01–E12 and W01–W04 (requirement: "one example per error code as a
   test fixture"). Each E-fixture triggers its own code and no other E-code.

## Working without T01

Until the parser lands, unit-test the checker and builder by constructing `ModelAst` values by hand (write a tiny
AST builder helper in your test folder). Tests that go through `compile()` live in
`src/lang/semantic/compile.integration.test.ts`.

## Tests

- For **every** E/W code: one passing case (code absent) and one failing case (code present, correct `elementId`,
  message contains the quoted names). Failing cases come from `ERROR_FIXTURES`.
- E04 message for a 3-participant veza contains `ima 3 učesnika` and `agregacija`.
- `stripSpans(compile(EXAMPLES[0].source).ir)` deep-equals `stripSpans(MAIN_EXAMPLE_IR)`; same for `SPEC_EXAMPLE_IR`.
- Main example: `hasErrors === false`, only W02 warnings. Spec example: no errors, no W01.
- Syntax error input → `ir === null`, diagnostics contain the S-code.
- IR with errors: a veza with an undeclared participant still appears in `ir.elements` with that participant dropped.
- `findElementAtOffset` returns the block around a cursor offset in the main example.

## Definition of done

- [ ] `compile` matches C03; all codes implemented; stubs removed.
- [ ] Unit tests green; integration tests green once T01 is done.
- [ ] Message wording follows C01 (prefix produced by `formatDiagnostic`, not by you).

## Status

_not started_

## Contract notes

_none_
