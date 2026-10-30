# C10 — Domains and cross-table constraints

Owner of the frozen code: orchestrator (Wave 0, CHANGELOG 2026-10-30). Implemented by T22–T28 (see the table at the end).
Feature spec: [`../feature_domain_strucutre.md`](../feature_domain_strucutre.md). That spec says **what** the user sees.
This contract says **who produces what, in which shape**. Where they differ, this contract wins. Report the
difference in your task's Contract notes.

## 0. Frozen code (already written; read it, don't change it)

| File | What C10 added |
|---|---|
| `src/lang/diagnostics.ts` | codes `E13`–`E20`, `W05`, `W06` |
| `src/lang/ast.ts` | `ModelAst.domains?`, `ModelAst.constraints?`, `AttributeAst.userDomain?` / `length?`, `DomainDeclAst`, `ConstraintBlockAst`, `RefHeaderAst`, `ConditionLineAst`, `RuleLineAst`, `ConstraintLineAst`, `DOMAIN_DECL_KEYWORDS`, `CONSTRAINT_BLOCK_KEYWORDS`, `CONDITION_KEYWORDS`, `isDomainDeclKeyword`, `isConstraintBlockKeyword`, `isConditionKeyword`, `DECL_KEYWORDS`, `ConstraintOp`, `CONSTRAINT_OPS`, `ConstraintAction`, `CONSTRAINT_ACTIONS`, token type `arrow` |
| `src/lang/ir.ts` | `IRAttribute.userDomain?` / `length?`, `PmovIR.domains?` / `constraints?`, `IRDomain`, `IRConstraintRule`, `IRReferentialConstraint`, `IRGeneralConstraint`, `IRConstraint` |
| `src/rm/types.ts` | `RmOptions.locale?`, `RelAttribute.userDomain?` / `length?`, `RelationalModel.referential?` / `general?` / `diagnostics?`, `RefCell`, `REF_CELLS`, `FkKind`, `DEFAULT_REF_ACTIONS`, `ALLOWED_REF_ACTIONS`, `ReferentialConstraint`, `GeneralConstraint`, `DomainStructureRow` |
| `src/builder/types.ts` (bootstrap in T26's folder) | `BuilderAction` variants `addDomain`, `editDomain`, `deleteDomain`, `extractDomain`, `setReferentialAction`, `resetReferential`, `addConstraint`, `editConstraint`, `deleteConstraint`; `DomainSpec`, `GeneralConstraintSpec`; `AttributeSpec.userDomain?` / `length?`; `needsConfirmation.usages?` / `constraints?`. `apply.ts` throws `not implemented: T26` for them. |
| `src/examples/index.ts` | fifth example `domeni` with `sourceEn` |
| `src/fixtures/domains.ts` | `DOMAIN_EXAMPLE_IR`, `DOMAIN_EXAMPLE_STRUCTURE`, `DOMAIN_EXAMPLE_REFERENTIAL`, `DOMAIN_CHAIN_SOURCE` |

**Omit-when-empty (applies to every producer):** `userDomain`, `length`, `ModelAst.domains`,
`ModelAst.constraints`, `PmovIR.domains`, `PmovIR.constraints`, `RelationalModel.referential` / `general` /
`diagnostics` exist as keys **only when non-null / non-empty**. A source without C10 syntax gives exactly the old
AST / IR / RM, so all existing golden fixtures stay equal.

**Relation name** everywhere in C10 = element name with all spaces removed (the same rule as C04). A quoted name
with spaces is accepted in constraint headers and rules and normalized the same way.

## 1. Syntax (T22, `src/lang/syntax/`)

- **Top level.** A line whose first word is a domain keyword (`domen`, `domain`) is a `DomainDeclAst`.
  A first word that is a constraint keyword (`ograničenje`, `ogranicenje`, `constraint`) starts a
  `ConstraintBlockAst` with the usual `name { lines }` shape. Both may appear anywhere between blocks. The keywords
  are case-sensitive, like the block kinds.
- **`domen Name : type [constraint]`**:
  - `type` is a built-in (`long|short|string|date`), optionally followed by `(n)`, giving
    `base.builtin` and `base.length`. Any other identifier gives `base.name`.
  - The constraint is the raw rest of the line, trimmed, exactly like an attribute constraint today.
  - A missing `:` or type reports an existing S-code (pick the closest one and document it) and sets `base: null`.
- **Attribute type.** After `:`, a built-in sets `domain` (as today). Any other identifier sets `userDomain`
  (and `domain: null`). An optional `(n)` right after the type sets `length`.
- **Inside an `ograničenje` block**, each line is one of the following, decided in this order:
  1. a line containing an `arrow` token is a `RefHeaderAst` (`Child [ "(" a {, a} ")" ] -> Parent`);
  2. a line whose first word is a condition keyword (`uslov`, `condition`) followed by `:` is a
     `ConditionLineAst`. `text` is the raw rest of the line, trimmed, and may be `''`;
  3. a line `Name : …` is a `RuleLineAst`. Items are separated by `,`. Each item is `op [action]`, with both
     lower-cased and kept raw even if unknown (the checker reports them). A missing action gives `action: null`;
  4. anything else reports an S-code and skips the line.
- Lexer: `->` becomes token `arrow`. Free-text tails (constraints, `uslov`) keep working for any character
  (`>=`, `.`, `<>`, `'`). Today the lexer already handles constraint tails; keep that behaviour.
- `parse(source, options)` messages for any new S situations exist in `sr` and `en`.
- Omit-when-empty: `domains` / `constraints` keys only when non-empty, and `userDomain` / `length` only when given.

## 2. Checks and IR (T23, `src/lang/semantic/`)

Domains, constraints and element names are **three separate namespaces**. E01 is unchanged.

| Code | Condition | Span | `elementId` |
|---|---|---|---|
| E13 | attribute `userDomain` or domain `base.name` not declared | the name | owner element / null |
| E14 | (a) domain name already declared, first one wins; (b) domain name is a built-in type name; (c) `length` on a type other than `string` (attribute or domain) | the name / the length | owner element / null |
| E15 | cycle in domain derivation. Reported once per cycle, on the domain that is first in source order | that domain's base name | null |
| E16 | a constraint header or rule names a relation that matches no `objekat` / `slab` / `agregacija` / named `veza` | the name | null |
| E17 | constraint shape (variants below) | the offending token | null |
| W05 | a domain used by no attribute and no other domain | the name | null |

E17 variants (each has an sr and an en message):

- no header line;
- more than one header line, or both kinds;
- empty `uslov`;
- general constraint without a rule line;
- unknown operation;
- unknown or missing action;
- cell is `/` (child `delete`, parent `insert`);
- action not in `ALLOWED_REF_ACTIONS` for that cell;
- the same `op` repeated for the same relation;
- a rule relation that is neither the child nor the parent;
- a general constraint with an action other than `restricted`;
- duplicate constraint name (first wins).

When child == parent (recursive FK), `insert` maps to the child cell and `update` / `delete` map to the parent cells.

**Message templates.** Placeholders are in `{}`. The wording may be polished, but keep the meaning and the code.

| Code | sr | en |
|---|---|---|
| E13 | `domen '{name}' nije deklarisan.` | `domain '{name}' is not declared.` |
| E14a | `domen '{name}' je već deklarisan (red {line}).` | `domain '{name}' is already declared (line {line}).` |
| E14b | `domen se ne može zvati '{name}' jer je to ugrađeni tip.` | `a domain cannot be named '{name}' because it is a built-in type.` |
| E14c | `dužina je dozvoljena samo za tip 'string'.` | `a length is allowed only for type 'string'.` |
| E15 | `domeni {chain} čine ciklus.` (`'A' → 'B' → 'A'`) | `domains {chain} form a cycle.` |
| E16 | `relacija '{name}' ne postoji.` | `relation '{name}' does not exist.` |
| E17 | e.g. `ograničenje '{c}': DELETE nije dozvoljen za relaciju-dete '{r}'.` | `constraint '{c}': DELETE is not allowed for the child relation '{r}'.` |
| W05 | `domen '{name}' se ne koristi.` | `domain '{name}' is not used.` |

**IR build:**

- `IRDomain`, one per **first** declaration of a name, in source order.
  - `parent` = `base.name` or null.
  - `base` = built-in resolved through the chain, or null if unresolvable (E13 / E15).
  - `length` = own, else inherited, else null.
  - `constraint` = own.
  - `effectiveConstraint` = `parentEffective + ' And ' + own` when both exist, otherwise whichever exists, otherwise null.
- `IRAttribute` with `userDomain` keeps `userDomain`. `domain` = the resolved base (or null), and `length` = own
  length ?? the domain's length. `constraint` stays the attribute's **own** text.
- **W02** (attribute without domain) is **not** reported when `userDomain` is present.
- `IRConstraint`, one per valid constraint, first name wins. A constraint whose header is missing or broken
  (E17 / E16 in the header) is **dropped**. Invalid rules (E16 / E17) are dropped and valid ones kept.
  - Relation names are normalized: spaces are removed.
  - `childAttrs` are kept as written.
  - `refs` are every match of `/([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)/gu` in the condition, with
    source spans. Quoted names are not supported in `refs`.
- `compile(source, options)` keeps its signature. Messages follow `options.locale`.

## 3. Relational model (T24, `src/rm/`)

The function signatures stay the same: `generateRelationalModel(ir, options)`, `generateSql(rm)` (it now also needs
the IR's domains: use **`generateSql(rm, ir?)`**, an additive optional second parameter), `buildDomainTable(ir)`.
New exports:

```ts
export function buildDomainStructure(ir: PmovIR): DomainStructureRow[];
export function formatConstraintsText(rm: RelationalModel, locale?: Locale): string;
```

- **`RelAttribute.userDomain` / `length`** are copied from the source attribute, both for own attributes and for
  borrowed FK attributes (from the referenced key attribute).
- **`referential`**: one entry per FK group, in relation order and then in first-appearance order of the group
  inside the relation.
  - `fkKind`:
    - all FK attributes are `pk` and the child element is a slab or a podtip → `identifying`;
    - all FK attributes are `pk` and the child is an agregacija or a veza relation → `component`;
    - else, any attribute is `nullable` → `nullable`;
    - else `regular`.
  - **Matching blocks to FKs:** same `child` and `parent`. If `childAttrs` is given, it must equal the FK
    attribute set (order-insensitive). If not given, there must be exactly one FK child → parent. Otherwise
    **E18**: missing, ambiguous (list the candidates), or wrong attributes.
  - A matching block gives `name` = block name, `constraintId` = block id, and its rules fill `explicitCells` /
    `actions`. The rest come from `DEFAULT_REF_ACTIONS[fkKind]`.
  - Unmatched FKs get `name` = `fk_<Child>_<Parent>`, with `_2`, `_3` … for repeats in this order, and
    `constraintId: null`.
  - **E19**: `nullifies` on an FK with a `pk` attribute (variant "deo primarnog ključa") or on an FK that is not
    nullable (variant "nije opcioni"). That cell keeps its default.
  - **E20**: a second block matching the same FK. The first one wins.
- **`general`**: one entry per IR general constraint. `checks` groups rules per relation, in first-appearance
  order. **W06** is reported for each `refs` entry whose relation or attribute is not in the RM (span = the ref).
- **`diagnostics`**: E18–E20 / W06 in `options.locale` (default `sr`), `elementId: null`, sorted by `span.from`.

  | Code | sr | en |
  |---|---|---|
  | E18 | `ne postoji strani ključ iz '{child}' u '{parent}'.` / `iz '{child}' u '{parent}' postoji više stranih ključeva; navedite atribute: {list}.` / `atributi ({attrs}) nisu strani ključ iz '{child}' u '{parent}'.` | `there is no foreign key from '{child}' to '{parent}'.` / `there are several foreign keys from '{child}' to '{parent}'; list the attributes: {list}.` / `attributes ({attrs}) are not a foreign key from '{child}' to '{parent}'.` |
  | E19 | `NULLIFIES nije moguć: '{child}.{attr}' je deo primarnog ključa.` / `NULLIFIES nije moguć: strani ključ '{child}({attrs})' nije opcioni.` | `NULLIFIES is not possible: '{child}.{attr}' is part of the primary key.` / `NULLIFIES is not possible: foreign key '{child}({attrs})' is not optional.` |
  | E20 | `strani ključ '{child}({attrs}) → {parent}' već ima ograničenje (red {line}).` | `foreign key '{child}({attrs}) → {parent}' already has a constraint (line {line}).` |
  | W06 | `'{rel}.{attr}' ne postoji u relacionom modelu.` | `'{rel}.{attr}' does not exist in the relational model.` |

- **`buildDomainStructure(ir)`** → `DOMAIN_EXAMPLE_STRUCTURE` for the fixture.
  - `base` = parent name, or the built-in without the length.
  - `length` = IR length as a string, or `–`.
  - `inherited` = the parent's `effectiveConstraint`, or null.
- **`buildDomainTable(ir)`**: the DOMEN column is `userDomain` when present, else the built-in with `(n)` when it
  has a length (`string(40)`). Unchanged for sources without C10 syntax.
- **`formatConstraintsText(rm, locale)`**: plain-text cards as in the feature spec §Ograničenja. The exact column
  alignment is yours; document it in your task's Contract notes.
  - Title: `R.a ⊆ P.r` for a single attribute, `R(a, b) ⊆ P(r1, r2)` for a composite one.
  - A derived constraint gets the suffix ` (podrazumevano)` / ` (default)`.
  - `/` marks a non-applicable cell.
- **SQL**, in this order:
  - **`CREATE DOMAIN`** (parents first): `CREATE DOMAIN "D" AS <SQLTYPE | "Parent">[ NOT NULL][ CHECK (…)];`,
    then a `-- …` comment with the unrecognized parts of the **own** constraint.
    - `CHECK` translation: split on `\s+And\s+` (case-insensitive). `NotNull` → `NOT NULL`.
      `Between a,b` → `VALUE BETWEEN a AND b`. `In(x, y)` → `VALUE IN (x, y)`, with non-numeric items quoted
      `'x'`. `>= n` / `> n` / `<= n` / `< n` / `<> n` / `= n` → `VALUE <op> n`. Several parts are joined with `AND`.
    - `string(n)` → `VARCHAR(n)`.
  - **`CREATE TABLE`**: a column with `userDomain` uses `"Domain"` as its type, and `string` with a length uses
    `VARCHAR(n)`. Everything else is as today.
  - **Foreign keys**: every FK becomes
    `ALTER TABLE "C" ADD CONSTRAINT "<name>" FOREIGN KEY (…) REFERENCES "P" (…) ON UPDATE <x> ON DELETE <y>;`,
    with RESTRICTED → `RESTRICT`, CASCADES → `CASCADE`, NULLIFIES → `SET NULL`, DEFAULT → `SET DEFAULT`.
    For each child cell that is not `restricted`, a comment follows:
    `-- "C" INSERT: NULLIFIES (zahteva okidač)` (en: `(requires a trigger)`). SQL comments are in Serbian unless
    `locale` is passed. Add the optional `locale` as a third parameter.
  - **General constraints**: `-- ograničenje <name> (proverava se: R INSERT, UPDATE; P UPDATE)` and then
    `-- CREATE ASSERTION "<name>" CHECK (<condition>);`.
  - For sources without C10 syntax, the only SQL change is `ADD CONSTRAINT "fk_…" … ON UPDATE … ON DELETE …` on
    existing FKs. Update the golden SQL tests once.

## 4. Tabs (T25, `src/ui/tabs/`)

The shell composes the tabs. New and extended exports:

```ts
export type TabAction = (action: BuilderAction) => BuilderResult | void;   // BuilderAction/Result from src/builder
export type TabHighlight = { kind: 'domain' | 'constraint'; name: string } | null;

DomainTab(props: { ir: PmovIR | null; locale?: Locale; onAction?: TabAction; highlight?: TabHighlight })
export interface ConstraintsTabProps {
  ir: PmovIR | null; hasErrors: boolean; dg0Mode: Dg0Mode; locale?: Locale;
  onAction?: TabAction; highlight?: TabHighlight;
}
export function ConstraintsTab(props: ConstraintsTabProps): JSX.Element;
```

- Without `onAction` the tabs are **read-only**: no forms, no dropdowns, no buttons except "Kopiraj kao tekst". So
  every existing usage keeps working.
- `ConstraintsTab` computes the RM itself (as `RelationalTab` does). With `hasErrors` it shows the same hint as the
  other RM tabs.
- **Results:**
  - `{ ok: false, needsConfirmation }` → a confirm dialog with the message, then the action is re-sent with
    `replace: true` / `withDependents: true`;
  - other `ok: false` → the message is shown inline next to the form;
  - `ok: true` → the form closes.
- **Actions sent:** `addDomain`, `editDomain`, `deleteDomain`, `extractDomain` (Atributi table: a row → its IR
  `owner` + `index`), `setReferentialAction` (`attrs` = `ReferentialConstraint.attributes`,
  `constraint` = `constraintId`), `resetReferential`, `addConstraint`, `editConstraint`, `deleteConstraint`.
- All strings in `strings.ts`, `sr` + `en` (list in the feature spec §UI strings; English below in §8).
- Record the final props in C08 §Additions and in the CHANGELOG.

## 5. Builder (T26, `src/builder/` + `src/ui/builder/`)

Keywords are written according to `options.locale` (`DECL_KEYWORDS`). Formats of the generated text:

- **`addDomain`** inserts `domen Name : base[(n)][ constraint]`. The position is after the last existing domain
  line, or, when there is none, before the first block (after a leading comment block, if any), followed by one
  blank line. When several domain lines are consecutive, align the `:` the way the examples do.
  Rejections: name taken (`Ime domena je već zauzeto.`), invalid name, built-in name, or a `base` that would
  create a cycle (`Ovo bi napravilo ciklus domena.`).
- **`editDomain`** rewrites that line. On rename it updates every attribute type and every `base` that uses the
  name.
- **`deleteDomain`**:
  - not used → removes the line;
  - used and `replace: false` → `ok: false`, `needsConfirmation: { dependents: [], usages: N }`, and the message
    `Domen se koristi u N atributa/domena. Zameniti ga osnovnim tipom?`;
  - `replace: true` → every user's type becomes the deleted domain's own `base` (with its length), and the
    domain's constraint is not copied.
- **`extractDomain`**: `X : short Between 15,65` becomes `domen X : short Between 15,65` plus `X : X`. If the
  domain name is taken, it becomes `X2`, `X3`, … An attribute without a built-in domain is rejected with
  `Atribut nema domen.`.
- **`setReferentialAction`**:
  - `constraint: null` → appends
    `ograničenje <Child><Parent>[N] {\n  Child(a, b) -> Parent\n  <Rel> : <op> <action>\n}` (the attribute list
    is always written);
  - otherwise it edits the rule line of that relation (replaces the item for that op, or appends `, op action`),
    or adds a rule line before `}`.
  - The cell maps to (relation, op) as in §2. Child == parent: `childUpdate` is not settable (the result is
    `ok: false`).
- **`resetReferential`** / **`deleteConstraint`** remove the block plus one adjacent blank line.
- **`addConstraint`** / **`editConstraint`** write
  `ograničenje Name {\n  uslov: cond\n  Rel : insert restricted, update restricted\n}`, one rule line per `checks`
  entry.
- **Effects on existing actions:**
  - `rename` updates relation names in headers, rule lines and `Rel.` prefixes in `uslov`;
  - an attribute rename (`editAttribute` with a new name) updates `Rel.Attr` refs and header attribute lists. To
    know which relations borrow the attribute as an FK, T26 may use `generateRelationalModel` from `src/rm`
    (index);
  - `deleteElement` / `deleteAttribute` put the referencing constraints into `needsConfirmation.constraints` and
    remove them with `withDependents: true`.
- **`src/ui/builder/` attribute form:** the Domen dropdown shows `–`, the built-ins, the group
  *Korisnički domeni* (`ir.domains`), and *Novi domen…*. *Novi domen…* opens a small domain form, saves it
  immediately as its own `addDomain` action, then selects it. With a user domain selected, the Ograničenje field
  shows the domain's `effectiveConstraint` as a placeholder. The form sends `userDomain` instead of `domain`.

## 6. Editor (T27, `src/ui/editor/`)

- Highlighting:
  - `domen`, `domain`, `ograničenje`, `ogranicenje`, `constraint`, `uslov`, `condition` as keywords (same style
    as the block kinds);
  - `->` as an operator;
  - inside an `ograničenje` block, the operations and actions (case-insensitive) as `modifier`;
  - a user domain name after `:` in the same style as the built-in types is optional.
- An **external `value` change** (the shell replacing the source after a tab action) must be applied as **one
  CodeMirror transaction that stays in the undo history**, so Ctrl+Z undoes it. If the Editor already does this,
  add a test; if it resets the state, fix it, keeping C08's props.

## 7. Shell (T28, `src/ui/shell/`)

- **RM diagnostics:** when `ir && !hasErrors`, compute `generateRelationalModel(ir, { dg0Mode, locale })`. Merge
  its `diagnostics` into the list given to the ErrorPanel and the Editor (sorted by `span.from`).
  - They count as errors in the panel. They do **not** set the `hasErrors` passed to the RM tabs, so the user
    can still see and fix them in the Ograničenja tab.
- **Tabs:** add "Ograničenja" / "Constraints" between "Relacioni model" and "SQL". Pass `highlight`. Pass
  `onAction` in **both** modes. The shell's handler:
  1. calls `applyBuilderAction(source, action, { locale })`;
  2. on `ok`, replaces the source. In Interaktivno this goes through the existing history (one undo step), and in
     Tekst through the editor value (§6);
  3. returns the result to the tab.
- **Error click** on a diagnostic with `elementId: null` whose span lies inside an `ir.domains[i].span` or
  `ir.constraints[i].span` → switch to the Domeni / Ograničenja tab and set `highlight`. In Tekst mode, keep
  today's jump-to-line as well.
- `generateSql(rm, ir, locale)` is called with the IR (for `CREATE DOMAIN`).

## 8. English UI strings (pairs with the Serbian list in the feature spec)

`Constraints`, `Domain structure`, `Attributes`, `No user domains.`, `inherited:`, `+ domain`, `New domain…`,
`User domains`, `Type / parent domain`, `Length`, `Extract to domain`, `+ constraint`, `Condition`, `default`,
`Reset to default`, `Copy as text`, `INSERT`, `UPDATE`, `DELETE`, `RESTRICTED`, `CASCADES`, `NULLIFIES`, `DEFAULT`,
`The foreign key is not optional.`, `The foreign key is part of the primary key.`, `Not applicable.`,
`The domain is used by N attributes/domains. Replace it with its base type?`, `Domain name is already taken.`,
`This would create a domain cycle.`, `The attribute has no domain.`

## 9. Who implements what

| Task | Folder | Sections |
|---|---|---|
| T22 | `src/lang/syntax/` | §1 |
| T23 | `src/lang/semantic/` | §2 |
| T24 | `src/rm/` | §3 |
| T25 | `src/ui/tabs/` | §4 |
| T26 | `src/builder/`, `src/ui/builder/` | §5 |
| T27 | `src/ui/editor/` | §6 |
| T28 | `src/ui/shell/` | §7 |
| T29 | `e2e/` | acceptance, after all of the above |

Test against `src/fixtures/domains.ts` (`DOMAIN_EXAMPLE_IR` etc.), not against other tasks' code. End-to-end tests
go in `*.integration.test.ts(x)`, and they may stay red while a dependency is in progress.
