# T26 — Builder: domain and constraint actions

**Wave:** 7 (parallel, Sonnet 5.5). **Implements:** [`../contracts/C10-domains-and-constraints.md`](../contracts/C10-domains-and-constraints.md) §5.
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md).
**Folder (owns everything inside):** `src/builder/` and `src/ui/builder/`.

Read first: your folder's `AGENT.md`, then C10 (all of it, especially §0 and the omit-when-empty rule), then the
feature spec. Frozen files (C10 §0) are already written; never edit them or other folders. Golden data:
`src/fixtures/domains.ts`. Other Wave-7 agents work in parallel in the same working tree, so failures in
**other** folders while you work are expected; ignore them.

## Goal

`applyBuilderAction` implements the nine C10 actions (the bootstrap left `throw new Error('not implemented: T26')`
in `apply.ts`), existing actions keep constraints consistent, and the attribute form supports user domains.

## Steps

1. Pure actions in `src/builder/` with the text formats of C10 §5, keywords per locale (`DECL_KEYWORDS`).
2. `rename`, attribute rename, `deleteElement`, `deleteAttribute` effects on `ograničenje` blocks.
3. `AttributeSpec.userDomain` / `length` in add/edit attribute.
4. `src/ui/builder/`: Domen dropdown with *Korisnički domeni* and *Novi domen…*, inline domain form, effective
   constraint placeholder.
5. sr + en messages for every new rejection.

Until T22/T23 land, sources with `domen` / `ograničenje` will not parse; write golden in → golden out tests for
them in `*.integration.test.ts` and keep pure unit tests (format helpers, name generation) in normal test files.

## Tests

- Golden source in → out for each new action (sr and en keywords), including: addDomain first/after existing,
  rename domain with users, deleteDomain with/without replace, extractDomain with a name collision,
  setReferentialAction create/edit/append, resetReferential, add/edit/deleteConstraint.
- rename element updates header, rules and `uslov` refs; deleteElement lists constraints in
  `needsConfirmation.constraints`.
- Round trip: building the `domeni` example with actions gives the example's IR (integration).
- UI: dropdown lists user domains; "Novi domen…" dispatches `addDomain`.

## Definition of done

- [ ] `npx vitest run src/builder src/ui/builder` and `src/architecture.test.ts` green; `npm run typecheck` has no errors in your folder.
- [ ] Existing tests in your folder unedited and green, except where C10 says a golden output changes on purpose
      (say which in Contract notes).
- [ ] No `not implemented` stub left for your task.
- [ ] **Status** and **Contract notes** below filled in; session log `spec/sessions/T26.md`.

## Status

Done. `npx vitest run src/builder src/ui/builder src/architecture.test.ts`: 137 tests green (builder 96, ui/builder 32,
architecture 9). The golden source-in/out tests in `src/builder/domains.integration.test.ts` (29) ran green against the
landed T22 parser and the partial T23 IR; the round trip with the exact `DOMAIN_EXAMPLE_IR` comparison covers domain
names, base, length and constraint only (full IR equality belongs to T23's fixture test). `npm run typecheck`: no errors
in `src/builder` or `src/ui/builder`. No `not implemented: T26` left.

## Contract notes

Deviations / additions (all additive):

- `BuilderAction.deleteAttribute` gained optional `withDependents?: boolean` (C10 §5 requires the confirmation flow but the
  variant had no flag). Without it, referencing `ograničenje` blocks give `ok:false` + `needsConfirmation.constraints`.
- `deleteElement` / `removePodtip` / `deleteAttribute` with constraint dependents but no hard dependents return
  `needsConfirmation: { dependents: [], constraints }` and the message `Obrisati i ograničenja ({n})?`. With hard dependents
  the message stays `confirmDeps` and `constraints` is added. When there are no constraints the result is unchanged.
- `MESSAGES` (sr + en) gained keys `domainTaken`, `domainCycle`, `domainUsed`, `noDomain`, `unknownDomain`,
  `constraintTaken`, `badCondition`, `cellNotSettable`, `actionNotAllowed`, `noConstraint`, `confirmConstraints`.
  `BUILDER_MESSAGES` (sr, the old `MSG`) is unchanged.
- `addDomain` position: when the file starts with a comment block that is separated from the first block by a blank line,
  the line goes below that blank line. A comment directly attached to the first block is treated as that block's comment,
  so the domain goes at the top of the file (C10 says "after a leading comment block"). Alignment copies the `:` column
  of the last domain line; existing lines are not re-aligned when the new name is longer.
- Built-in domain names and invalid names give `badName` (`Neispravno ime.`); a `base` that is neither a built-in nor a
  declared domain gives `unknownDomain`; a `base` equal to the domain itself gives `domainCycle`.
- Attribute `length` is written only for `domain: 'string'`; with `userDomain` it is ignored (the domain's length applies).
- `editDomain` keeps the keyword spelling of the line it rewrites; `editConstraint` keeps the block and `uslov` keywords.
  Comments inside an edited general constraint block are lost (the block is rewritten).
- `deleteDomain` with `replace: true` also fixes domains derived from the deleted one (their base becomes the deleted
  domain's base). `extractDomain` also rejects attributes that already use a user domain (`Atribut nema domen.`).
- `rename` also updates every relation reference in constraints, matching on the name with spaces removed. The new name is
  written quoted when needed in headers/rules and space-free in `uslov` refs. Attribute rename uses `generateRelationalModel`
  (both `dg0Mode`s) to find FK attributes that borrow the name; borrowed attributes with a collision suffix are not touched.
- UI: `AttributeForm` gets optional `userDomains` / `onAddDomain`; select values for user domains are `u:<name>`; a length
  field appears for `string`; the constraint placeholder is the domain's `effectiveConstraint`. The confirm dialog also
  lists `constraints`; confirming repeats `deleteAttribute` with `withDependents: true` or `deleteDomain` with `replace: true`.
  `BuilderController.confirm` gained optional `constraints?: string[]`.
- No existing test was edited; no golden output changed.
