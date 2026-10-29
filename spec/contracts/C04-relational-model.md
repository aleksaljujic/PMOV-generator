# C04 — Relational model, SQL, domain table

Owner: **T03**. Consumers: T08 (tabs), T09 (copy-as-text, toolbar).
Input is only the IR (C03). The generator assumes a model **without errors** (`CompileResult.hasErrors === false`);
on an erroneous IR it must not throw, but output may be incomplete.

## Contract code

```ts
// FILE: src/rm/types.ts
// CONTRACT C04 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Domain } from '../lang/ir';

/** How a veza with DG=0 (and not M:N) is translated. Default 'fk'. */
export type Dg0Mode = 'fk' | 'relation';

export interface RmOptions {
  dg0Mode: Dg0Mode;
}

export const DEFAULT_RM_OPTIONS: RmOptions = { dg0Mode: 'fk' };

export interface RelAttribute {
  /** Spaces removed. Unique within the relation (see collision rule). */
  name: string;
  domain: Domain | null;
  constraint: string | null;
  /** Part of the primary key. */
  pk: boolean;
  /** Borrowed from another relation (references !== null). */
  fk: boolean;
  /** Only FK attributes can be nullable (holder side has DG = 0). */
  nullable: boolean;
  references: {
    relation: string;
    /** Attribute name in the referenced relation. */
    attribute: string;
    /** Attributes sharing a group form ONE (possibly composite) foreign key. */
    group: string;
  } | null;
}

export interface Relation {
  /** Spaces removed from the element name. */
  name: string;
  /** IR element that produced it. */
  elementId: string;
  attributes: RelAttribute[];
}

export interface RelationalModel {
  relations: Relation[];
}

export interface DomainRow {
  attribute: string;   // without '#'
  domain: string;      // '–' (U+2013) when missing
  constraint: string;  // '–' when missing
}
```

## Functions

```ts
// src/rm/index.ts (barrel)
export function generateRelationalModel(ir: PmovIR, options?: RmOptions): RelationalModel;
/** `Radnik(Mlb, ImeR, Adresa, Starost, SifOd)` — plain text, no markup. */
export function formatRelation(rel: Relation): string;
/** One line per relation: `<formatRelation>  key: Mlb; FK: SifOd` ("; FK: …" omitted when no non-key FK). */
export function formatModelText(rm: RelationalModel): string;
export function generateSql(rm: RelationalModel): string;
export function buildDomainTable(ir: PmovIR): DomainRow[];
/** Element ids of vezas that the DG=0 toggle affects (so the UI can show the toggle only when relevant). */
export function dg0ToggleableVezas(ir: PmovIR): string[];
```

All pure and synchronous.

## Translation rules (authoritative refinement of requrement.md §"Relacioni model")

`key(X)` = the primary-key attributes of X's relation (computed first, recursively; cycles impossible in a valid model).

1. **Which elements become relations:** every `objekat`, `slab`, `agregacija`; every `veza` classified as
   *relation* below. `specijalizacija` never does. Order = IR source order.
2. **Primary keys**
   - core objekat (not a podtip): its `#` attributes.
   - podtip: `key(supertype)` (borrowed, `pk && fk`), then its own attributes (none of which is pk).
   - slab: `key(owner)` (borrowed, `pk && fk`) + own `#` attributes.
   - agregacija: `key(c)` of the **first** component with `card.max === 1`; if none, concatenation of `key(c)`
     for all components (in order). All other components' keys are still included as non-key FK attributes.
   - veza-relation: same rule as agregacija applied to its participants.
3. **Veza classification** for participants P (first) and Q (second) with cards cp, cq:
   1. `cp.max==='M' && cq.max==='M'` → **relation** (always).
   2. else if `cp.min===0 || cq.min===0` → **toggleable** (listed by `dg0ToggleableVezas`):
      - `dg0Mode==='relation'` → **relation**.
      - `dg0Mode==='fk'` → one *holder* gets `key(other)` as FK: the participant with `max===1`; if both have
        `max===1`, the one with `min===1`; if both `min===0`, P. `nullable = holder.card.min === 0`.
   3. else → every participant whose card is exactly (1,1) gets `key(other)` as a non-nullable FK
      (both, if both are (1,1)).
4. **Attribute order** inside a relation: borrowed key attributes (pk) → other borrowed component/participant keys
   (agregacija / veza-relation) → own attributes in declaration order → FKs from vezas in IR order.
5. **Borrowed attributes** copy `domain` and `constraint` from the source attribute; `references.attribute` is the
   name in the referenced relation; `group` = `<sourceElementId>:<index>` (unique per borrowed key).
6. **Name collisions** (two attributes would get the same name in one relation, e.g. recursive veza): every
   *borrowed* attribute involved is renamed `<name>_<mappingName>` using the mapping name of the participant
   line it came through; if that line has no mapping name, append `_2`, `_3`, … to the later ones.
7. Unnamed veza-relation name = `<P>_<Q>` (element names, spaces removed).
8. `nullable` is `false` for everything except FK attributes defined nullable by 3.2.

## SQL format

- One `CREATE TABLE` per relation in model order, then all foreign keys as `ALTER TABLE … ADD FOREIGN KEY`
  (handles cycles such as Radnik ↔ Odeljenje).
- Identifiers always double-quoted. Types: long→`BIGINT`, short→`SMALLINT`, string→`VARCHAR(255)`, date→`DATE`,
  no domain→`VARCHAR(255)`.
- `NOT NULL` when `pk`, or (`fk && !nullable`), or constraint contains `NotNull`. Other constraints become a
  trailing `-- <constraint>` comment on the column line.
- One `FOREIGN KEY (a, b) REFERENCES "R" (x, y)` per `references.group`.

```sql
CREATE TABLE "Radnik" (
  "Mlb" BIGINT NOT NULL,
  "ImeR" VARCHAR(255),
  "Adresa" VARCHAR(255),
  "Starost" SMALLINT, -- Between 15,65
  "SifOd" SMALLINT NOT NULL, -- Moduo_11
  PRIMARY KEY ("Mlb")
);
...
ALTER TABLE "Radnik" ADD FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd");
```

## Domain table

One row per attribute in IR order (all element kinds), `#` stripped, deduplicated on identical
(attribute, domain, constraint) triples (first occurrence kept). Missing values → `–`.

## Golden fixture (T00 writes verbatim)

```ts
// FILE: src/fixtures/rm.ts
import type { Domain } from '../lang/ir';
import type { RelAttribute, RelationalModel } from '../rm/types';

const own = (name: string, domain: Domain | null = null, constraint: string | null = null, pk = false): RelAttribute => ({
  name, domain, constraint, pk, fk: false, nullable: false, references: null,
});
const ref = (
  name: string, relation: string, group: string, pk: boolean,
  domain: Domain | null = null, constraint: string | null = null, nullable = false,
): RelAttribute => ({ name, domain, constraint, pk, fk: true, nullable, references: { relation, attribute: name, group } });

/** generateRelationalModel(MAIN_EXAMPLE_IR) must equal this, ignoring the exact `group` strings
 *  (tests compare groups only for "same / different"). */
export const MAIN_EXAMPLE_RM: RelationalModel = {
  relations: [
    { name: 'Radnik', elementId: 'Radnik', attributes: [
      own('Mlb', 'long', 'NotNull', true), own('ImeR', 'string'), own('Adresa', 'string'),
      own('Starost', 'short', 'Between 15,65'), ref('SifOd', 'Odeljenje', 'Zapošljavanje:0', false, 'short', 'Moduo_11'),
    ] },
    { name: 'Odeljenje', elementId: 'Odeljenje', attributes: [
      own('SifOd', 'short', 'Moduo_11', true), own('Naziv', 'string'), ref('Mlb', 'Radnik', 'Rukovođenje:0', false, 'long', 'NotNull'),
    ] },
    { name: 'Student', elementId: 'Student', attributes: [own('BrojInd', null, null, true), own('Ime'), own('Smer')] },
    { name: 'Predmet', elementId: 'Predmet', attributes: [own('SifPred', null, null, true), own('NazivPred')] },
    { name: 'Nastavnik', elementId: 'Nastavnik', attributes: [own('ŠifraNast', null, null, true), own('ImeNast'), own('Zvanje')] },
    { name: 'Isplata', elementId: 'Isplata', attributes: [
      ref('Mlb', 'Radnik', 'Isplata:0', true, 'long', 'NotNull'), own('Datum', 'date', null, true), own('Iznos', 'long'),
    ] },
    { name: 'Prijava', elementId: 'Prijava', attributes: [
      ref('BrojInd', 'Student', 'Prijava:0', true), ref('SifPred', 'Predmet', 'Prijava:1', true),
      own('DatumPol', 'date'), own('Ocena', 'short', 'Between 5,10'), ref('ŠifraNast', 'Nastavnik', 'Overe:0', false),
    ] },
  ],
};
```

`formatModelText(MAIN_EXAMPLE_RM)`:

```
Radnik(Mlb, ImeR, Adresa, Starost, SifOd)  key: Mlb; FK: SifOd
Odeljenje(SifOd, Naziv, Mlb)  key: SifOd; FK: Mlb
Student(BrojInd, Ime, Smer)  key: BrojInd
Predmet(SifPred, NazivPred)  key: SifPred
Nastavnik(ŠifraNast, ImeNast, Zvanje)  key: ŠifraNast
Isplata(Mlb, Datum, Iznos)  key: Mlb, Datum
Prijava(BrojInd, SifPred, DatumPol, Ocena, ŠifraNast)  key: BrojInd, SifPred; FK: ŠifraNast
```

### Other required cases (T03 tests)

| Input | Expected |
|---|---|
| `SPEC_EXAMPLE_IR` | `Građanin(Mlb, Ime, Starost)` key Mlb; `Student(Mlb, BrojInd, Semestar)` key Mlb (Mlb pk+fk → Građanin); same shape for Radnik, Dete, Penzioner; `Proizvod(SifProizvoda, NazivProizvoda)`; `Struktura(SifProizvoda_Sastavljen, SifProizvoda_Ugrađen)` key both |
| agregacija `Članstvo { Radnik (0,1)  Sindikat (0,M) }` | key = `Mlb` only; `SifSind` present, fk, not pk |
| `MAIN_EXAMPLE_IR`, `dg0Mode:'relation'` | Radnik loses SifOd, Odeljenje loses Mlb, Prijava loses ŠifraNast; new `Zapošljavanje(Mlb, SifOd)` key Mlb, `Rukovođenje(Mlb, SifOd)` key Mlb, `Overe(BrojInd, SifPred, ŠifraNast)` key BrojInd, SifPred |
| `dg0ToggleableVezas(MAIN_EXAMPLE_IR)` | `['Zapošljavanje', 'Rukovođenje', 'Overe']` |
| veza `(0,1)` / `(0,M)`, fk mode | holder = the (0,1) side, FK `nullable: true` |
