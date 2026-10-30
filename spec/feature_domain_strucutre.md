# Feature: domain structure and cross-table constraints ("Struktura domena" i "Međurelaciona ograničenja")

Two additions to the language, the relational model and the UI:

1. **Struktura domena**: user-defined, named domains (`domen Starost : short Between 15,65`) that attributes use
   instead of a built-in type. A domain can be derived from another domain (naddomen).
2. **Međurelaciona ograničenja** (cross-table constraints), in FON style:
   - **referential** constraints for every foreign key of the relational model, with an action per operation
     (INSERT / UPDATE / DELETE on the child and the parent relation: RESTRICTED, CASCADES, NULLIFIES, DEFAULT);
   - **general** constraints, a condition over attributes of several relations
     (`Isplata.Iznos <= Radnik.Plata`), plus the operations that must be checked.

Both are written in the DSL, so they work in **Tekst** mode. In **Interaktivno** mode they are edited through
forms in the *Domeni* and *Ograničenja* tabs. These forms produce text edits, following the same principle as
[`feature_interactive_pmov.md`](feature_interactive_pmov.md).

This document extends [`requrement.md`](requrement.md) and [`feature_interactive_pmov.md`](feature_interactive_pmov.md).
Everything in them still applies. Sources without `domen` / `ograničenje` compile and render exactly as today.

## Core principles

- **The DSL text is still the only source of truth.** Domains and constraints live in the source. Tab forms are
  builder actions (`source + action → new source`), as in C09.
- **Referential constraints are derived and need no text by default.** Every foreign key in the relational model
  automatically gets a referential constraint with default actions (see *Defaults*). An `ograničenje` block is
  written only to **override** defaults or to name the constraint.
- **The PMOV diagram does not change.** Domains and constraints belong to the relational level and have no
  diagram nodes.
- **Layering stays as it is.** `src/lang` checks what it can know from the source (syntax, names, domain
  references, block shape). `src/rm` checks what depends on the relational model (does the foreign key exist,
  is the action allowed for it).

## DSL

### Domains

A new top-level line (not a block):

```
domen <Ime> : <tip> [ograničenje]
```

- `<tip>` is a built-in type (`long`, `short`, `string`, `date`) or the name of another domain (**naddomen**).
  `string` may have a length: `string(40)`.
- `[ograničenje]` is free text to end of line, the same as an attribute constraint (`NotNull`, `Between 15,65`,
  `In(Srpski, Ruski)`, `>= 0`, `Moduo_11`, combined with `And`).
- A derived domain inherits the base type, the length and the constraint of its naddomen. Its own constraint is
  **added** to the inherited one (effective constraint = parent's `And` own).
- Domain names have their **own namespace**: a domain may have the same name as an attribute or an element
  (`Naziv : Naziv` is valid). Names follow the identifier rules. A quoted name is allowed, and spaces are removed
  in SQL.
- `domen` lines may appear anywhere at the top level, before or after their use. Forward references are allowed.

An attribute's domain may now be a user domain, and `string` may have a length:

```
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : Naziv
  Starost : Starost
  Plata   : Iznos NotNull     // own constraint is added to the domain's constraint
}
```

### Cross-table constraints

A new block kind `ograničenje`, with the usual `vrsta ime { red }` shape. Its first line decides what kind it is.

**Referential**: the first line is `Dete[(atributi)] -> Roditelj`:

```
ograničenje RadnikUOdeljenju {
  Radnik(SifOd) -> Odeljenje
  Radnik    : insert restricted, update restricted
  Odeljenje : update cascades, delete restricted
}
```

- `Dete` and `Roditelj` are **relation names** (as in the *Relacioni model* tab: the element name with spaces
  removed. A quoted name with spaces is also accepted).
- `(atributi)` is the comma-separated list of the child's foreign key attributes. It may be left out when there is
  exactly one foreign key from `Dete` to `Roditelj`. It is required when there are several (for example a
  recursive veza that became a relation).
- Rule lines: `Relacija : operacija akcija {, operacija akcija}`. `Relacija` must be the child or the parent.
  Operations not listed keep their default.
- Allowed cells (others are `/` = not applicable):

  | | INSERT | UPDATE | DELETE |
  |---|---|---|---|
  | **child** (`Dete`) | `restricted`, `nullifies`, `default` | `restricted`, `nullifies`, `default` | `/` |
  | **parent** (`Roditelj`) | `/` | `restricted`, `cascades`, `nullifies`, `default` | `restricted`, `cascades`, `nullifies`, `default` |

  `nullifies` is allowed only for a **nullable** foreign key that is not part of the primary key.

**General**: the first line is `uslov: <izraz>`:

```
ograničenje IsplataDoPlate {
  uslov: Isplata.Iznos <= Radnik.Plata
  Isplata : insert restricted, update restricted
  Radnik  : update restricted
}
```

- `<izraz>` is free text to end of line. It is not evaluated. References of the form `Relacija.Atribut` are
  extracted from it and checked (W06). They are also updated when an element or attribute is renamed.
- Rule lines have the same form. In this version the only action is `restricted` (the operation is rejected if the
  condition would be broken). Operations not listed are `/` (not checked). At least one rule line is required.

Keywords (`insert`, `update`, `delete`, `restricted`, `cascades`, `nullifies`, `default`, `uslov`) are
case-insensitive. The tabs show actions in upper case (FON style). `ograničenje` and `domen` are reserved only at
the start of a top-level line.

### Grammar changes (EBNF)

```
model       = { blok | domen_dekl } ;
domen_dekl  = "domen" ime ":" tip [ ograničenje ] kraj ;
tip         = osnovni [ "(" broj ")" ] | ime ;        (* length only for string *)
osnovni     = "long" | "short" | "string" | "date" ;
atribut     = ime [ "#" ] [ ":" tip [ ograničenje ] ] ;
vrsta       = … | "ograničenje" ;
(* inside an ograničenje block *)
ref_zaglavlje = ime [ "(" ime { "," ime } ")" ] "->" ime kraj ;
uslov_red     = "uslov" ":" tekst kraj ;
pravilo       = ime ":" operacija akcija { "," operacija akcija } kraj ;
operacija     = "insert" | "update" | "delete" ;
akcija        = "restricted" | "cascades" | "nullifies" | "default" ;
```

New token: `->` (`arrow`). The `uslov` text and constraint text are taken raw to end of line, as today, so `.`, `<=`
and similar characters need no tokens. As today, block-shape rules stay in the checker, not the grammar.

### Keywords in English

The DSL accepts these English aliases **in both UI languages**, the same mechanism as
[`fix_editor.md`](fix_editor.md) §3. The AST and IR always hold the canonical form, and the source is never rewritten.

| Serbian (canonical) | Also accepted |
|---|---|
| `domen` | `domain` |
| `ograničenje` | `ogranicenje`, `constraint` |
| `uslov` | `condition` |

Operations and actions (`insert`, `update`, `delete`, `restricted`, `cascades`, `nullifies`, `default`) are the
same in both languages. The builder writes the keywords of the selected UI language (`DECL_KEYWORDS`). All new
diagnostics and UI strings exist in Serbian and English. Each folder keeps them in its own `strings.ts`, as in
fix_editor.

## Checks

New codes, continuing the existing ones (E12 is already taken). Messages are in Serbian, with line and column.

**In `src/lang` (checker):**

| Code | When | Example message |
|---|---|---|
| E13 | Attribute or domain uses an undeclared domain | `domen 'Starostt' nije deklarisan.` |
| E14 | Duplicate domain name, a domain named like a built-in type, or a length on a type other than `string` | `domen 'Naziv' je već deklarisan (red 3).` |
| E15 | Cyclic domain derivation | `domeni 'A' → 'B' → 'A' čine ciklus.` |
| E16 | `ograničenje` names a relation that matches no element | `relacija 'Radnici' ne postoji.` |
| E17 | Bad `ograničenje` shape: no header / both header kinds, missing or empty `uslov`, no rule lines in a general constraint, unknown operation or action, a cell that is `/` in the table above, an operation repeated, a rule line for a relation that is neither child nor parent, a non-`restricted` action in a general constraint | `ograničenje 'X': DELETE nije dozvoljen za relaciju-dete.` |
| W05 | Domain declared but never used | `domen 'Ocena' se ne koristi.` |

**In `src/rm` (on the generated relational model; runs only when `compile` has no errors):**

| Code | When | Example message |
|---|---|---|
| E18 | Referential: no foreign key from child to parent, ambiguous without `(atributi)`, or the listed attributes are not exactly one foreign key | `ne postoji strani ključ iz 'Odeljenje' u 'Isplata'.` |
| E19 | Action not allowed for this foreign key (`nullifies` on a non-nullable foreign key or one in the primary key) | `NULLIFIES nije moguć: 'Isplata.Mlb' je deo primarnog ključa.` |
| E20 | Two `ograničenje` blocks for the same foreign key | `strani ključ 'Radnik(SifOd) → Odeljenje' već ima ograničenje (red 40).` |
| W06 | `uslov` references a `Relacija.Atribut` that does not exist in the relational model | `'Radnik.Plt' ne postoji u relacionom modelu.` |

- Every message has a Serbian and an English version (`LangOptions.locale` / `RmOptions.locale`).
- Diagnostics for domains and constraints have `elementId: null` (there is no diagram node). Those for E13 on an
  attribute keep the owner's `elementId` as usual.
- E18–W06 can change when the user flips the "Veze sa DG=0" toggle (it changes which foreign keys exist). That is
  expected.
- The shell merges the RM diagnostics into the same list as the `compile` diagnostics: error panel, editor squiggles,
  and the `hasErrors` state.

## Defaults for referential constraints

Applied to every foreign key that has no `ograničenje` block, and to every cell a block does not list:

| Foreign key | child INSERT | child UPDATE | parent UPDATE | parent DELETE |
|---|---|---|---|---|
| regular | RESTRICTED | RESTRICTED | CASCADES | RESTRICTED |
| nullable (holder side has DG = 0, `dg0Mode = fk`) | RESTRICTED | RESTRICTED | CASCADES | NULLIFIES |
| identifying for **slab** and **podtip** (foreign key ⊆ primary key) | RESTRICTED | RESTRICTED | CASCADES | CASCADES |
| component of an **agregacija** / veza-relation | RESTRICTED | RESTRICTED | CASCADES | RESTRICTED |

## Outputs

### Tab "Domeni"

Two sections:

1. **Struktura domena**: `DOMEN | TIP / NADDOMEN | DUŽINA | OGRANIČENJE`, one row per `domen` in source order. For a
   derived domain, the OGRANIČENJE cell shows its own constraint and, below it in grey, `nasleđeno: <effective
   constraint of the parent>`. The table is hidden, with the hint *"Nema korisničkih domena."*, when there are
   none.
2. **Atributi**: the existing table `ATRIBUT | DOMEN | OGRANIČENJE`. DOMEN now shows the user domain name (or the
   built-in type, with the length, e.g. `string(40)`).

### New tab "Ograničenja"

Placed between *Relacioni model* and *SQL*. One card per constraint, referential ones first (in relational-model
order), then general ones (in source order):

```
RadnikUOdeljenju      Radnik.SifOd ⊆ Odeljenje.SifOd
              INSERT       UPDATE       DELETE
Radnik        RESTRICTED   RESTRICTED   /
Odeljenje     /            CASCADES     RESTRICTED
```

- A referential constraint without a block is titled with its foreign key and has the badge *"podrazumevano"*.
  Cells that differ from the default are shown in bold.
- General constraint: title = name, then the `uslov` in monospace, then the same table with a row per relation
  from its rules.
- **"Kopiraj kao tekst"** copies all cards as plain text (the format above).
- When the model has errors, the tab shows the hint used by the other RM tabs.

### SQL

Order: `CREATE DOMAIN` (parents before children) → `CREATE TABLE` → foreign keys → general constraints.

- `CREATE DOMAIN "Starost" AS SMALLINT CHECK (VALUE BETWEEN 15 AND 65);`. A derived domain uses `AS "Naddomen"`.
  `string(n)` → `VARCHAR(n)`. Columns whose attribute has a user domain use the domain name as their type.
- Constraint text is translated to `CHECK` only for these recognized forms, combined with `And` → `AND`:
  `NotNull` → `NOT NULL`, `Between a,b`, `In(a, b, …)` (non-numeric values quoted), `>= n`, `> n`, `<= n`,
  `< n`, `<> n`. Anything else (`Moduo_11`) stays a `--` comment, as today.
- Foreign keys: `ALTER TABLE "Radnik" ADD CONSTRAINT "RadnikUOdeljenju" FOREIGN KEY ("SifOd") REFERENCES
  "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;`. A constraint without a block gets the name
  `fk_<Dete>_<Roditelj>[_n]`. Mapping: RESTRICTED → `RESTRICT`, CASCADES → `CASCADE`, NULLIFIES → `SET NULL`,
  DEFAULT → `SET DEFAULT`. Child-side actions other than RESTRICTED have no SQL equivalent. They are emitted as
  `-- <relacija> INSERT/UPDATE: NULLIFIES (zahteva okidač)`.
- General constraints are emitted as a commented SQL-92 assertion:

  ```sql
  -- ograničenje IsplataDoPlate (proverava se: Isplata INSERT, UPDATE; Radnik UPDATE)
  -- CREATE ASSERTION "IsplataDoPlate" CHECK (Isplata.Iznos <= Radnik.Plata);
  ```

- Attribute constraints in `CREATE TABLE` keep today's behaviour (`NOT NULL` + comment).

## Editing

### Tekst mode

- The editor highlights `domen`, `ograničenje`, `uslov`, operations, actions and `->`, and shows the new
  diagnostics as squiggles.
- The forms in the *Domeni* and *Ograničenja* tabs also work in Tekst mode. Each form action replaces the source
  in **one editor transaction**, so Ctrl+Z in the editor undoes it.

### Interaktivno mode

- **Attribute form** (from C09): the **Domen** dropdown lists `–`, the built-in types, then the user domains
  (group *"Korisnički domeni"*), and finally **"Novi domen…"**, which opens the domain form and selects the new
  domain on save. When a user domain is selected, the Ograničenje field shows the domain's effective constraint
  as a grey placeholder.
- **Tab "Domeni"**: **"+ domen"** opens a form: *Naziv*, *Tip / naddomen* (built-in types + other domains, minus
  choices that would create a cycle), *Dužina* (only for `string`), *Ograničenje*. Clicking a row opens the same
  form, filled in, with **"Obriši"**.
  - Renaming a domain updates every attribute and every domain that uses it.
  - Deleting a domain that is used asks *"Domen se koristi u N atributa/domena. Zameniti ga osnovnim tipom?"*.
    On confirmation, users get the deleted domain's own type (base type or naddomen). Its constraint is not
    copied.
  - In the *Atributi* table, each row with a built-in type has **"Izdvoj u domen"**. It creates
    `domen <Atribut> : <tip> <ograničenje>` (with a free placeholder name if taken) and changes the attribute to
    `<Atribut> : <Domen>`.
- **Tab "Ograničenja"**: every non-`/` cell is a dropdown with the allowed actions. Disallowed ones are disabled,
  with the reason as a tooltip (for example *"Strani ključ nije opcioni."*).
  - Changing a cell on a default constraint creates the `ograničenje` block, named `<Dete><Roditelj>` (made unique),
    listing only the changed cells. Changing it on an existing block edits or adds that rule.
  - **"Vrati podrazumevano"** on a block removes it.
  - **"+ ograničenje"** opens the general-constraint form: *Naziv*, *Uslov* (text with autocomplete for
    `Relacija.Atribut`), and checkboxes INSERT / UPDATE / DELETE per relation found in the uslov. **"Obriši"** is
    on existing cards.
- **Error panel**: clicking a diagnostic with `elementId: null` that belongs to a `domen` or `ograničenje`
  switches to the matching tab and highlights the row or card.
- Every action is one undo step in the Interaktivno history (Poništi / Ponovi).

### Effects of existing builder actions

- **Rename element** also updates relation names in `ograničenje` headers, rule lines and `Relacija.` prefixes in
  `uslov` (relation name = new name without spaces).
- **Rename / delete attribute** updates `(atributi)` lists and `Relacija.Atribut` references in `uslov`. Deleting
  an attribute that a general constraint references adds that constraint to the dependents prompt.
- **Delete element** lists `ograničenje` blocks that reference its relation in *"Obrisati i zavisne elemente
  (N)?"* and removes them with it.
- Changing a cardinality may remove a foreign key that an `ograničenje` refers to. It is not blocked: E18
  appears and the user fixes it (or uses "Vrati podrazumevano").

## Architecture and contract changes

The contract is **[C10-domains-and-constraints.md](contracts/C10-domains-and-constraints.md)**. The frozen code was
written in Wave 0 (CHANGELOG 2026-10-30). **All changes are additive.** Sources without `domen` / `ograničenje`
produce exactly the same AST, IR and relational model as before.

| Contract / file | Change (done in Wave 0) |
|---|---|
| C01 `diagnostics.ts` | codes `E13`–`E20`, `W05`, `W06` |
| C02 `ast.ts` | `ModelAst.domains?`, `ModelAst.constraints?` (constraint blocks are **not** in `blocks`, and `BlockKind` is unchanged); `AttributeAst.userDomain?` / `length?` (`domain` stays the built-in type); `DomainDeclAst`, `ConstraintBlockAst`, `RefHeaderAst`, `ConditionLineAst`, `RuleLineAst`; keyword tables and helpers; `ConstraintOp`, `ConstraintAction`; token type `arrow` |
| C03 `ir.ts` | `IRAttribute.userDomain?` / `length?` (`domain` = **resolved built-in type**); `PmovIR.domains?: IRDomain[]`, `PmovIR.constraints?: IRConstraint[]` (an `ograničenje` is not an `IRElement`) |
| C04 `rm/types.ts` | `RmOptions.locale?`; `RelAttribute.userDomain?` / `length?`; `RelationalModel.referential?`, `general?`, `diagnostics?`; `RefCell`, `FkKind`, `DEFAULT_REF_ACTIONS`, `ALLOWED_REF_ACTIONS`, `ReferentialConstraint`, `GeneralConstraint`, `DomainStructureRow` |
| C09 `src/builder/types.ts` | new `BuilderAction` variants (`addDomain`, `editDomain`, `deleteDomain`, `extractDomain`, `setReferentialAction`, `resetReferential`, `addConstraint`, `editConstraint`, `deleteConstraint`), `DomainSpec`, `GeneralConstraintSpec`, `AttributeSpec.userDomain?` / `length?`, `needsConfirmation.usages?` / `constraints?` (stub `not implemented: T26`) |
| `src/examples/` | fifth example `domeni` ("Domeni i ograničenja" / "Domains and constraints", with `sourceEn`) |
| `src/fixtures/domains.ts` | `DOMAIN_EXAMPLE_IR`, `DOMAIN_EXAMPLE_STRUCTURE`, `DOMAIN_EXAMPLE_REFERENTIAL`, `DOMAIN_CHAIN_SOURCE` |

**Omit-when-empty rule:** the new optional keys (`userDomain`, `length`, `domains`, `constraints`, `referential`,
`general`, `diagnostics`) are present **only when non-empty / non-null**. This keeps every existing golden fixture equal.

Wave 7 tasks (parallel, one folder each, all on Sonnet 5.5), then acceptance:

| Task | Folder | Part of this spec |
|---|---|---|
| **T22** | `src/lang/syntax/` | lexer `->`; parser for `domen` lines, `ograničenje` blocks, user domains and `string(n)` on attributes; keywords sr + en |
| **T23** | `src/lang/semantic/` | checker E13–E17, W05 (sr + en messages); IR `domains`, `constraints`, `userDomain`/`length` resolution, effective constraints |
| **T24** | `src/rm/` | referential constraints with defaults, general constraints, E18–E20 / W06, `RelAttribute.userDomain`, `buildDomainStructure`, `formatConstraintsText`, SQL (`CREATE DOMAIN`, `CHECK`, `ON UPDATE/DELETE`, assertions) |
| **T25** | `src/ui/tabs/` | Domeni tab (Struktura domena + Atributi), new `ConstraintsTab`, editing forms through an optional `onAction` |
| **T26** | `src/builder/`, `src/ui/builder/` | the new builder actions; rename/delete effects on constraints; attribute form with user domains and "Novi domen…" |
| **T27** | `src/ui/editor/` | highlighting of the new keywords (sr + en), operations, actions, `->` |
| **T28** | `src/ui/shell/` | merge RM diagnostics; Ograničenja tab; route tab `onAction` through `applyBuilderAction` in both modes; error click → tab; pass `locale` to RM |
| **T29** | `e2e/` | acceptance (after T22–T28) |

## Example `domeni` (must compile with zero errors)

It is in `src/examples/` as `domeni`, with an English version (`sourceEn`, English keywords and names).

```
// ---------- domeni ----------
domen Šifra   : short Moduo_11
domen Naziv   : string(40)
domen Starost : short Between 15,65
domen Iznos   : long >= 0
domen Ocena   : short Between 5,10

// ---------- objekti ----------
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : Naziv
  Adresa  : string
  Starost : Starost
  Plata   : Iznos NotNull
}

objekat Odeljenje {
  SifOd# : Šifra
  Naziv  : Naziv
}

objekat Student   { BrojInd#, Ime, Smer }
objekat Predmet   { SifPred#, NazivPred }
objekat Nastavnik { ŠifraNast#, ImeNast, Zvanje }

veza Zapošljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zapošljava
}

veza Rukovođenje {
  Radnik    (0,1) Rukovodi
  Odeljenje (1,1) Rukovođeno
}

slab Isplata {
  nadređeni Radnik (0,M)
  Datum# : date
  Iznos  : Iznos
}

agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  DatumPol : date
  Ocena    : Ocena
}

veza Overe {
  Prijava   (1,1)
  Nastavnik (0,M)
}

// ---------- ograničenja ----------
ograničenje RadnikUOdeljenju {
  Radnik(SifOd) -> Odeljenje
  Odeljenje : update cascades, delete restricted
}

ograničenje IsplateRadnika {
  Isplata -> Radnik
  Radnik : delete restricted
}

ograničenje IsplataDoPlate {
  uslov: Isplata.Iznos <= Radnik.Plata
  Isplata : insert restricted, update restricted
  Radnik  : update restricted
}
```

Expected *Ograničenja* tab: 6 referential constraints (`Radnik.SifOd → Odeljenje`, `Odeljenje.Mlb → Radnik`,
`Isplata.Mlb → Radnik`, `Prijava.BrojInd → Student`, `Prijava.SifPred → Predmet`, `Prijava.ŠifraNast → Nastavnik`).
Two are explicit: `RadnikUOdeljenju` has no bold cells (it restates the defaults), and `IsplateRadnika` has parent
DELETE RESTRICTED in bold (the slab default is CASCADES). They are followed by 1 general constraint.

## Tests

- **Parser:** `domen` with built-in type, length, naddomen, and constraint; attribute with a user domain and
  `string(n)`; both `ograničenje` kinds; `->` and attribute lists; `uslov` taken raw with `<=`, `.` and commas;
  error positions on a broken header.
- **Checker:** one passing and one failing case per code E13–E17 and W05. Inherited constraint and base type are
  resolved through a chain of 3 domains. A forward reference to a domain is OK.
- **IR:** `IRAttribute.domain` is the resolved built-in type (existing consumers unchanged). The main example
  from `requrement.md` gives an IR equal to today's IR, plus empty `domains` and `constraints`.
- **RM:** defaults for all 4 foreign-key kinds. Explicit actions override only the listed cells. E18 (missing,
  ambiguous, wrong attributes), E19, E20, W06. The DG=0 toggle changes E18 as expected. The `domeni` example
  gives exactly the expected constraints.
- **SQL:** `CREATE DOMAIN` order with a naddomen; each recognized constraint form → `CHECK`, an unrecognized one →
  comment; `ON UPDATE / ON DELETE` mapping; child-side comment; general constraint as commented assertion. SQL for
  sources without domains/constraints changes **only** by gaining `ON UPDATE CASCADE ON DELETE RESTRICT` (etc.)
  on the existing foreign keys. Update the golden SQL once.
- **Builder:** golden source in → golden source out for every new action. Domain rename/delete with replace.
  `extractDomain` with a name collision. `setReferentialAction` on a default constraint (creates block) and on an
  existing one. `resetReferential`. Element and attribute rename updates headers, rule lines and `uslov`. Delete
  element removes dependent `ograničenje` blocks.
- **UI:** the attribute form lists user domains and "Novi domen…". The domain form hides cyclic naddomen choices.
  Constraint cells disable invalid actions, with the tooltip. Clicking a domain diagnostic opens the *Domeni* tab.
  The tabs are read-only without `onAction`.

## Done when

- The `domeni` example compiles with zero errors and shows the expected *Domeni*, *Ograničenja* and SQL output.
- The `domeni` example can be built from "Novi dijagram" in Interaktivno mode without typing DSL, including all
  domains, the two explicit referential constraints and the general one.
- Every form action in Tekst mode updates the editor text and can be undone with Ctrl+Z.
- All existing examples compile and render exactly as before. Their relational model text is unchanged. Their SQL
  differs only by the `ON UPDATE / ON DELETE` clauses.
- `npm test`, `npm run typecheck` and `npm run build` pass.

## Out of scope (for now)

- Tuple constraints (ograničenje torke, a condition within one relation) and dynamic constraints.
- Generating triggers for child-side actions or general constraints.
- Domain default values (DEFAULT uses the column/domain default of the target database).
- Translating **attribute** constraints into `CHECK` inside `CREATE TABLE`.
- Showing domains or constraints on the PMOV diagram.

## Decisions (confirmed by the user, 2026-10-30)

1. One `ograničenje` keyword for both kinds; the first line (`->` or `uslov:`) decides which.
2. Constraints are addressed by **relation names** from the relational model, not by PMOV elements, as FON writes
   them (`Radnik.SifOd ⊆ Odeljenje.SifOd`).
3. Referential constraints exist implicitly for every foreign key. A block only overrides.
4. General constraints support only `restricted` in this version.
5. Defaults as in the *Defaults* table: slab and podtip CASCADES on parent delete, everything else RESTRICTED.
6. SQL target is standard SQL / PostgreSQL (`CREATE DOMAIN`, domain over domain).

## UI strings (Serbian, Latin)

`Ograničenja`, `Struktura domena`, `Atributi`, `Nema korisničkih domena.`, `nasleđeno:`, `+ domen`, `Novi domen…`,
`Korisnički domeni`, `Tip / naddomen`, `Dužina`, `Izdvoj u domen`, `+ ograničenje`, `Uslov`, `podrazumevano`,
`Vrati podrazumevano`, `Kopiraj kao tekst`, `INSERT`, `UPDATE`, `DELETE`, `RESTRICTED`, `CASCADES`, `NULLIFIES`,
`DEFAULT`, `Strani ključ nije opcioni.`, `Strani ključ je deo primarnog ključa.`, `Nije primenljivo.`,
`Domen se koristi u N atributa/domena. Zameniti ga osnovnim tipom?`, `Ime domena je već zauzeto.`,
`Ovo bi napravilo ciklus domena.`
