# T10 — Integration and acceptance

**Wave:** 2 (after all Wave-1 tasks — T01–T09, T11, T12 — report done). **Implements:** nothing new. **Consumes:** all contracts.
**Folder:** `e2e/` (plus `spec/tasks/T10-acceptance-report.md`). Bugs found in other tasks' files are fixed by **reopening
that task** (append to its Status), not by editing here — unless the owner is no longer active, in which case T10 may
fix it and records the change in that task's Status.

## Goal

Verify the whole product against the "Done when" list and the FON notation rules in `requrement.md`.

## Checklist

### Build & tests
- [ ] Clean clone: `npm install && npm run build` — no TypeScript errors.
- [ ] `npm test` — everything green, including all `*.integration.test.ts`; no remaining `not implemented` stubs
      (`grep -r "not implemented" src` is empty).
- [ ] Architecture test green (no React in `lang`, `rm`, `render/{graph,layout,geometry,svg}`).

### Language
- [ ] Main example: zero errors; second example: zero errors.
- [ ] Every `ERROR_FIXTURES` entry produces its code; messages Serbian with `(red X, kol Y)`.

### Rendering (screenshots with Playwright if available — save to `e2e/screenshots/`; otherwise inspect the DOM)
- [ ] objekat rect; slab double rect with arrow from Radnik into Isplata, `(0,M)` near Radnik.
- [ ] veza diamonds; labels `(1,1) Radi` near Radnik, `(0,M) Zapošljava` near Odeljenje — not mid-line.
- [ ] agregacija rect+inscribed diamond; arrows from Student and Predmet into Prijava; Overe connects Prijava ↔ Nastavnik.
- [ ] Spec example: Građanin → S diamond → circle → orthogonal bus → arrows into 4 podtipovi in a row; label
      `Vrsta (0,M)` near Građanin.
- [ ] Recursive Struktura: two visibly different paths (top/bottom).
- [ ] Attributes as pills, `Mlb#` shown, fanned without overlapping core nodes.
- [ ] Black on white only; red outline appears on the node of an element with an error.

### Interaction
- [ ] Typing re-renders after ~300 ms; a syntax error keeps the last diagram and shows the error panel + squiggle.
- [ ] Clicking an error jumps to the line; clicking a node highlights its block; moving the cursor into a block
      highlights its node.
- [ ] Drag → reload → position kept; `Ponovo rasporedi` resets.
- [ ] Domeni / Relacioni model / SQL tabs match C04 for the main example; DG=0 toggle switches variants; copy works.
- [ ] `Izvezi SVG` file opens in a browser and matches the on-screen diagram; `Izvezi PNG` downloads.
- [ ] `renderSvg(source)` works from a Node script (no DOM).

### Docs
- [ ] README explains the DSL with the example, the architecture and how to run.

## Output

Write `spec/tasks/T10-acceptance-report.md`: each checklist item with pass/fail, evidence (test name, screenshot path),
and the tasks reopened for failures.

## Status

_not started_
