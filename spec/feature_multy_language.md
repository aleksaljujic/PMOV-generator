# Feature: SQL dialects ("SQL dijalekt": PostgreSQL, Microsoft SQL Server, Oracle)

The **SQL** tab currently generates a single SQL flavour. It is standard SQL with `CREATE DOMAIN`, `"quoted"`
identifiers and `ON UPDATE … ON DELETE …`, which in practice is PostgreSQL. This feature lets the user pick the
target database, and the same relational model is emitted as DDL that runs on that database:

| Dialect | Id | Target version |
|---|---|---|
| PostgreSQL | `postgres` | 12+ |
| Microsoft SQL Server | `mssql` | 2016+ (also Azure SQL) |
| Oracle | `oracle` | 19c+ |

This document extends [`requrement.md`](requrement.md) and [`feature_domain_strucutre.md`](feature_domain_strucutre.md)
(§ *Outputs → SQL*). Everything in them still applies. The rules below say only what **differs** per dialect.

## Core principles

- **The dialect is an output option, not part of the model.** It works like `dg0Mode`: it is not written in the DSL,
  it does not change the AST, IR or relational model, and it only affects the text of the SQL tab. Other tabs and the
  diagram are unaffected.
- **PostgreSQL output is exactly today's output.** `generateSql(rm, ir, locale)` with no dialect, or with
  `'postgres'`, returns byte-for-byte the same string as now. Every existing SQL golden test stays green unchanged.
- **Same structure for every dialect.** The section order (domains → `CREATE TABLE` → foreign keys → general
  constraints), the relation and attribute order, constraint names (`fk_<Dete>_<Roditelj>[_n]` or the block name), and
  the comment lines for things SQL cannot express are the same in all three. Only types, quoting, domains and
  referential actions differ.
- **Never emit SQL the target database would reject.** If a dialect cannot express something, the generator writes the
  closest valid statement and adds a `--` comment saying what is missing. This is how unsupported child-side actions
  (`(zahteva okidač)`) are already handled.

## UI

### SQL tab

The tab toolbar gets a dialect dropdown in front of the existing **Kopiraj** button:

```
Dijalekt: [ PostgreSQL ▾ ]   [Kopiraj]
          ├ PostgreSQL
          ├ Microsoft SQL Server
          └ Oracle
```

- Label: *"Dijalekt:"* / *"Dialect:"*. The option labels are product names and are the same in both locales.
- Changing the dialect regenerates the SQL right away. **Kopiraj** copies the SQL of the selected dialect.
- When the model has errors, or there is nothing to show, the tab shows its current hint and no dropdown.

### Persistence

The selected dialect is kept in `localStorage` under `pmov.sqlDialect.v1`, the same way as `pmov.dg0Mode.v1`. A
missing or unknown value means `postgres`. Loading an example or creating a new diagram does not reset it.

## Mapping per dialect

### Identifiers

| | PostgreSQL | SQL Server | Oracle |
|---|---|---|---|
| Quoting | `"Name"` (`"` doubled) | `[Name]` (`]` doubled) | `"Name"` (`"` doubled) |

Identifiers are always quoted, so Serbian letters (`ŠifraNast`) and case are kept as written. In Oracle, quoted names
are case-sensitive. That is intended, and it matches the relational model shown in the other tabs. Quoting also applies
inside comments that name tables (`-- "Radnik" INSERT: …` becomes `-- [Radnik] INSERT: …` on SQL Server).

### Built-in types

| PMOV | PostgreSQL | SQL Server | Oracle |
|---|---|---|---|
| `long` | `BIGINT` | `BIGINT` | `NUMBER(19)` |
| `short` | `SMALLINT` | `SMALLINT` | `NUMBER(5)` |
| `date` | `DATE` | `DATE` | `DATE` |
| `string(n)` | `VARCHAR(n)` | `NVARCHAR(n)`, or `NVARCHAR(MAX)` when n > 4000 | `VARCHAR2(n CHAR)` |
| `string`, or no type | `VARCHAR(255)` | `NVARCHAR(255)` | `VARCHAR2(255 CHAR)` |

SQL Server uses `NVARCHAR` and Oracle uses `CHAR` length semantics, so `n` counts characters and Serbian letters
(č ć š ž đ) fit.

### Domains

- **PostgreSQL:** `CREATE DOMAIN` exactly as today.
- **SQL Server and Oracle 19c** have no `CREATE DOMAIN` with `CHECK`, so domains are **inlined** into columns:
  - The domain section becomes a comment: a first line saying domains are inlined, then one line per domain in the
    same order as today (parents before children), showing the resolved definition:

    ```sql
    -- SQL Server nema CREATE DOMAIN; domeni su ugrađeni u kolone.
    -- domen Starost: SMALLINT CHECK (VALUE BETWEEN 15 AND 65)
    ```

  - A column whose attribute has a user domain gets:
    - the domain's resolved built-in type and length (`IRDomain.base` / `length`) as its type;
    - `NOT NULL` when the domain's **effective** constraint contains `NotNull`;
    - a column `CHECK` built from the domain's **effective** constraint (`IRDomain.effectiveConstraint`, so a derived
      domain carries its parents' conditions), translated with the same recognised forms as `CREATE DOMAIN`, with
      `VALUE` replaced by the quoted column name.

    Parts that cannot be translated (`Moduo_11`) go into the column's trailing `--` comment, after the attribute's own
    comment text. The comment parts are separated by `; `.
  - Column order is `type [NOT NULL] [CHECK (…)][,] [-- comment]`.
- Oracle 23ai has `CREATE DOMAIN`, but 19c is the target, so domains are inlined there too. A later option could
  target 23ai (see *Out of scope*).

### CHECK literals

Non-numeric values in `In(…)` are quoted as `'x'` on PostgreSQL and Oracle, and as `N'x'` on SQL Server, because the
columns are `NVARCHAR`. Numbers are not quoted, as today.

### Foreign keys: referential actions

The `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY … REFERENCES …` statement is the same in every dialect. Only the
action clauses differ:

| Cell → clause | PostgreSQL | SQL Server | Oracle |
|---|---|---|---|
| parent UPDATE RESTRICTED | `ON UPDATE RESTRICT` | `ON UPDATE NO ACTION` | *(no clause)* |
| parent UPDATE CASCADES | `ON UPDATE CASCADE` | `ON UPDATE CASCADE` | *(no clause)* + comment |
| parent UPDATE NULLIFIES | `ON UPDATE SET NULL` | `ON UPDATE SET NULL` | *(no clause)* + comment |
| parent UPDATE DEFAULT | `ON UPDATE SET DEFAULT` | `ON UPDATE SET DEFAULT` | *(no clause)* + comment |
| parent DELETE RESTRICTED | `ON DELETE RESTRICT` | `ON DELETE NO ACTION` | *(no clause)* |
| parent DELETE CASCADES | `ON DELETE CASCADE` | `ON DELETE CASCADE` | `ON DELETE CASCADE` |
| parent DELETE NULLIFIES | `ON DELETE SET NULL` | `ON DELETE SET NULL` | `ON DELETE SET NULL` |
| parent DELETE DEFAULT | `ON DELETE SET DEFAULT` | `ON DELETE SET DEFAULT` | *(no clause)* + comment |

- The "comment" is a line after the `ALTER TABLE`, in the same format as today's child-side comments:
  `-- "Odeljenje" UPDATE: CASCADES (zahteva okidač)`. Oracle has no `ON UPDATE`, and every default FK has parent
  UPDATE = CASCADES, so on Oracle **every** foreign key gets this line. That is expected, and it is accurate.
- Child-side cells (child INSERT / UPDATE other than RESTRICTED) keep today's comment in every dialect.

#### SQL Server: multiple cascade paths

SQL Server rejects a foreign key with a cascading action that would create a cycle or a second cascade path to the
same table (error 1785). The generator detects this deterministically:

1. An FK is *cascading* when its SQL Server ON UPDATE or ON DELETE clause is not `NO ACTION`.
2. Go through the foreign keys in `rm.referential` order, keeping a graph **G** of the cascading FKs accepted so far
   (edge parent → child). For a cascading FK P → C, let `up(X)` be X together with every table that reaches X in G.
3. If `up(P) ∩ up(C)` is non-empty (this covers a self reference, a cycle, and a second path), the FK is
   **downgraded**: both clauses become `NO ACTION`, and each cell that changed gets a comment:
   `-- [Odeljenje] DELETE: CASCADES (SQL Server: višestruke kaskadne putanje, zahteva okidač)`.
   The FK is not added to G.
4. Otherwise the FK keeps its clauses and is added to G.

PostgreSQL and Oracle have no such restriction.

### General constraints

Same as today in every dialect: two comment lines, `-- ograničenje …` and the commented
`-- CREATE ASSERTION … CHECK (…);`, with the dialect's identifier quoting. None of the three databases supports
`CREATE ASSERTION`.

### New comment strings

| Key | sr | en |
|---|---|---|
| inlined domains, SQL Server | `SQL Server nema CREATE DOMAIN; domeni su ugrađeni u kolone.` | `SQL Server has no CREATE DOMAIN; domains are inlined into columns.` |
| inlined domains, Oracle | `Oracle 19c nema CREATE DOMAIN; domeni su ugrađeni u kolone.` | `Oracle 19c has no CREATE DOMAIN; domains are inlined into columns.` |
| domain line | `domen <Naziv>: <definicija>` | `domain <Name>: <definition>` |
| multiple cascade paths | `(SQL Server: višestruke kaskadne putanje, zahteva okidač)` | `(SQL Server: multiple cascade paths, requires a trigger)` |

The trigger comment (`(zahteva okidač)` / `(requires a trigger)`) is reused for Oracle's missing `ON UPDATE` and
`ON DELETE SET DEFAULT`.

## Example (must hold in the golden tests)

Source:

```
domen Starost : short Between 15,65

objekat Odeljenje {
  SifOd# : short
  Naziv  : string(40) NotNull
}

objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string(40)
  Starost : Starost
}

veza Zaposljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zaposljava
}
```

**PostgreSQL** (today's output):

```sql
CREATE DOMAIN "Starost" AS SMALLINT CHECK (VALUE BETWEEN 15 AND 65);

CREATE TABLE "Odeljenje" (
  "SifOd" SMALLINT NOT NULL,
  "Naziv" VARCHAR(40) NOT NULL,
  PRIMARY KEY ("SifOd")
);

CREATE TABLE "Radnik" (
  "Mlb" BIGINT NOT NULL,
  "ImeR" VARCHAR(40),
  "Starost" "Starost",
  "SifOd" SMALLINT NOT NULL,
  PRIMARY KEY ("Mlb")
);

ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE RESTRICT;
```

**Microsoft SQL Server:**

```sql
-- SQL Server nema CREATE DOMAIN; domeni su ugrađeni u kolone.
-- domen Starost: SMALLINT CHECK (VALUE BETWEEN 15 AND 65)

CREATE TABLE [Odeljenje] (
  [SifOd] SMALLINT NOT NULL,
  [Naziv] NVARCHAR(40) NOT NULL,
  PRIMARY KEY ([SifOd])
);

CREATE TABLE [Radnik] (
  [Mlb] BIGINT NOT NULL,
  [ImeR] NVARCHAR(40),
  [Starost] SMALLINT CHECK ([Starost] BETWEEN 15 AND 65),
  [SifOd] SMALLINT NOT NULL,
  PRIMARY KEY ([Mlb])
);

ALTER TABLE [Radnik] ADD CONSTRAINT [fk_Radnik_Odeljenje] FOREIGN KEY ([SifOd]) REFERENCES [Odeljenje] ([SifOd]) ON UPDATE CASCADE ON DELETE NO ACTION;
```

**Oracle:**

```sql
-- Oracle 19c nema CREATE DOMAIN; domeni su ugrađeni u kolone.
-- domen Starost: NUMBER(5) CHECK (VALUE BETWEEN 15 AND 65)

CREATE TABLE "Odeljenje" (
  "SifOd" NUMBER(5) NOT NULL,
  "Naziv" VARCHAR2(40 CHAR) NOT NULL,
  PRIMARY KEY ("SifOd")
);

CREATE TABLE "Radnik" (
  "Mlb" NUMBER(19) NOT NULL,
  "ImeR" VARCHAR2(40 CHAR),
  "Starost" NUMBER(5) CHECK ("Starost" BETWEEN 15 AND 65),
  "SifOd" NUMBER(5) NOT NULL,
  PRIMARY KEY ("Mlb")
);

ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd");
-- "Odeljenje" UPDATE: CASCADES (zahteva okidač)
```

The relation order shown is illustrative. The golden fixture uses whatever order `generateRelationalModel` produces,
and that order is the same in all three dialects.

A second golden case for the SQL Server cascade rule: a diamond `Odeljenje → Radnik`, `Odeljenje → Projekat`,
`Radnik → Angazovanje`, `Projekat → Angazovanje` (default actions). The FK that comes second into `Angazovanje` is
downgraded to `NO ACTION` with the comments. PostgreSQL and Oracle output for the same model has no downgrade.

## Out of scope

- Translating **attribute** constraints (not domain constraints) into `CHECK`. They stay `NOT NULL` + comment, as
  today, in every dialect.
- Generating triggers for actions a dialect cannot express. Only the comment is emitted.
- Other dialects (MySQL/MariaDB, SQLite, Oracle 23ai `CREATE DOMAIN`). The design allows adding them as new
  `SqlDialect` values later.
- A dialect setting in the DSL, a `.sql` file download, and `GO` batch separators.

## Architecture and contract changes

New contract: **`spec/contracts/C11-sql-dialects.md`**. Wave 0 (orchestrator) writes the frozen part. **All changes
are additive.**

| Contract / file | Change (Wave 0) |
|---|---|
| C04 `src/rm/types.ts` | `export type SqlDialect = 'postgres' \| 'mssql' \| 'oracle'`; `SQL_DIALECTS: readonly SqlDialect[]` (in UI order); `DEFAULT_SQL_DIALECT = 'postgres'` |
| C04 `generateSql` | signature `generateSql(rm, ir?, locale?, dialect?: SqlDialect)`. A missing `dialect` means `'postgres'`, which gives today's output |
| C08 `SqlTabProps` | `dialect?: SqlDialect`, `onDialectChange?(d: SqlDialect): void` (no dropdown without `onDialectChange`) |
| `src/fixtures/sql.ts` | `SQL_DIALECT_SAMPLE_SOURCE`, its IR, and the three expected outputs above; `SQL_CASCADE_DIAMOND_RM` with expected SQL Server output |

Wave 8 tasks (parallel, one folder each, on Sonnet 5.5). The orchestrator verifies the result (no separate acceptance task):

| Task | Folder | Part of this spec |
|---|---|---|
| **T30** | `src/rm/` | dialect-aware `generateSql`: quoting, types, inlined domains with column `CHECK`, `N'…'` literals, action mapping, Oracle comments, SQL Server cascade-path rule, sr + en comment strings; PostgreSQL golden tests unchanged |
| **T31** | `src/ui/tabs/` | dialect dropdown in `SqlTab` (sr + en label), pass `dialect` to `generateSql`, copy uses the selected dialect |
| **T32** | `src/ui/shell/` | `sqlDialect` state, `pmov.sqlDialect.v1` load/save in `storage.ts`, wire `dialect` / `onDialectChange` to `SqlTab`, README section |

## Acceptance criteria

1. With no saved setting, the SQL tab shows *PostgreSQL*, and its output is identical to the output before this
   feature for every example.
2. Switching to *Microsoft SQL Server* or *Oracle* updates the SQL at once. The choice survives a page reload, loading
   an example, and switching the UI language.
3. For each of the five examples, the SQL Server and Oracle output contains no `CREATE DOMAIN`, no `RESTRICT`, and,
   on Oracle, no `ON UPDATE`.
4. The `domeni` example on SQL Server and Oracle has a column `CHECK` for every column with a translatable domain
   constraint, including the inherited conditions of derived domains.
5. The cascade-diamond fixture gives exactly one downgraded FK on SQL Server, with its comments.
6. All comments follow the UI language (sr / en).
7. `npm run typecheck`, `npm test` and `npm run build` pass. No other tab, the diagram, or any existing golden fixture
   changes.
