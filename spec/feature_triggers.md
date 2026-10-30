# Feature: triggers ("Okidači")

The SQL output gets real PostgreSQL triggers in the two places where it only writes comments today:

1. **Child-side referential actions.** A child INSERT / UPDATE cell that is not RESTRICTED
   (`Radnik : insert nullifies`) is written today as `-- "Radnik" INSERT: NULLIFIES (zahteva okidač)`.
2. **General constraints.** `ograničenje IsplataDoPlate { uslov: … }` is written today as a commented
   `-- CREATE ASSERTION …`. Almost no database supports `CREATE ASSERTION`, so a trigger is the only way to enforce it.

This document extends [`feature_domain_strucutre.md`](feature_domain_strucutre.md) and contract C10. Everything in
them still applies. It removes "Generating triggers for child-side actions or general constraints" from that
spec's *Out of scope*.

## Core principles

- **No DSL change.** Everything a trigger needs is already in the source: the relations, the operations, the actions
  and the condition. Triggers are an output, like `CREATE DOMAIN`.
- **Only `src/rm` changes.** Triggers are generated inside `generateSql(rm, ir?, locale?, dialect?)` (the
  signature from C11). The signature, the frozen types and the UI stay the same. The SQL tab shows the new output.
- **Generate only what is correct, and say why otherwise.** When a condition cannot be translated safely, the
  output stays as it is today (the comments), plus one comment line giving the reason. It never emits broken SQL.
- **Nothing changes for sources that don't need triggers.** Default actions never need a trigger, because child
  INSERT / UPDATE are RESTRICTED by default and the FK itself enforces them. So all existing examples without
  general constraints get byte-identical SQL.
- **Target: PostgreSQL** (PL/pgSQL, `EXECUTE FUNCTION`, PostgreSQL 11+). Triggers are emitted only when
  `dialect === 'postgres'`, the default. For `mssql` and `oracle`, the output stays exactly what C11 / T30 define
  (the `(zahteva okidač)` comments and the commented assertion). See [`feature_multy_language.md`](feature_multy_language.md).

## Child-side referential triggers

For each `ReferentialConstraint` and each child cell (`childInsert`, `childUpdate`) whose action is not
`restricted`, the generator writes one function and one trigger. They go right after that FK's `ALTER TABLE` line
and **replace** the `-- … (zahteva okidač)` comment.

- **When it fires:** `BEFORE INSERT ON "C"` / `BEFORE UPDATE OF "a1", "a2" ON "C"`, `FOR EACH ROW`. A BEFORE row
  trigger runs before the FK check, so it can change `NEW` and the FK then accepts the row.
- **What counts as a violation:** every FK attribute in `NEW` is non-null (`MATCH SIMPLE`, the same as the FK), and
  no parent row matches.
- **What it does on a violation:**
  - `nullifies`: sets every FK attribute in `NEW` to `NULL`. E19 already guarantees that the FK is nullable and
    not part of the PK.
  - `default`: sets every FK attribute to `NULL`, with the comment `-- DEFAULT: kolona nema podrazumevanu
    vrednost, koristi se NULL` (en: `-- DEFAULT: the column has no default value, NULL is used`). The generated
    schema declares no column or domain defaults (C10 *Out of scope*), so NULL is the default. On a NOT NULL FK
    the insert then fails, which behaves like RESTRICTED.
- **Names:** the function is `"<fk>_ins_fn"` / `"<fk>_upd_fn"`, and the trigger is `"<fk>_ins"` / `"<fk>_upd"`,
  where `<fk>` is `ReferentialConstraint.name`.

Example (`Radnik(SifOd) -> Odeljenje`, nullable, `Radnik : insert nullifies`):

```sql
ALTER TABLE "Radnik" ADD CONSTRAINT "fk_Radnik_Odeljenje" FOREIGN KEY ("SifOd") REFERENCES "Odeljenje" ("SifOd") ON UPDATE CASCADE ON DELETE SET NULL;
CREATE FUNCTION "fk_Radnik_Odeljenje_ins_fn"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."SifOd" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "Odeljenje" WHERE "Odeljenje"."SifOd" = NEW."SifOd") THEN
    NEW."SifOd" := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "fk_Radnik_Odeljenje_ins" BEFORE INSERT ON "Radnik"
  FOR EACH ROW EXECUTE FUNCTION "fk_Radnik_Odeljenje_ins_fn"();
```

A composite FK joins each attribute pair with `AND`, both in the `IS NOT NULL` test and in the `WHERE`.

## General-constraint triggers

For each `GeneralConstraint`, the generator keeps the two existing comment lines (the header and the commented
`CREATE ASSERTION`, which show the standard-SQL meaning), followed by either the triggers or the reason why there
are none.

### Translating the condition

1. **References.** Extract `Rel.Attr` references with the C10 §2 regex
   (`/([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)/gu`). `RelationalModel.general` has no `refs`, so they
   are extracted again from `condition`. Each one becomes `"Rel"."Attr"`. Every reference must exist in the RM.
2. **The rest of the text** is tokenized. Only these tokens are allowed:
   - numbers;
   - string literals in single quotes;
   - the operators `=`, `<>`, `!=` (→ `<>`), `<`, `<=`, `>`, `>=`, `+`, `-`, `*`, `/`;
   - `(`, `)` and `,`;
   - the words `And`, `Or`, `Not`, `Between`, `In`, `Is`, `Null`, `True`, `False` (any case), written upper-case.

   Any other token means the condition cannot be translated.
3. **Join.** Let R be the distinct relations in the references, in order of first appearance.
   - One relation: `FROM "R"` with no join.
   - Several relations: connect them using only **direct** FKs between relations in R, in either direction. Build
     the join tree breadth-first, starting from the first relation and taking the relations in R order. Each new
     relation becomes `JOIN "P" ON "C"."a" = "P"."r" [AND …]`. The translation fails in two cases:
     - two relations in R are joined by more than one FK, so the join is ambiguous;
     - a relation cannot be reached through such FKs. Paths through relations that are not in R are not searched
       in this version.
4. **Check.** `IF EXISTS (SELECT 1 FROM … WHERE NOT (<condition>)) THEN RAISE EXCEPTION … USING ERRCODE =
   'check_violation'`. A condition that evaluates to NULL is not a violation, the same as `CHECK`.

### Triggers

- One function `"<name>_fn"` per constraint. It returns `NULL`.
- One trigger `"<name>_<Relation>"` per `checks` entry: `AFTER <ops> ON "Relation" FOR EACH STATEMENT`, where the
  ops are joined with `OR` in the order INSERT, UPDATE, DELETE.
- The trigger is statement-level and checks the whole join every time. That is simple and always correct, but it
  is slow on large tables, which is fine for a teaching tool.
- The message is `ograničenje <name> je narušeno` (en: `constraint <name> is violated`).

Expected output for the `domeni` example (the only change to its SQL):

```sql
-- ograničenje IsplataDoPlate (proverava se: Isplata INSERT, UPDATE; Radnik UPDATE)
-- CREATE ASSERTION "IsplataDoPlate" CHECK (Isplata.Iznos <= Radnik.Plata);
CREATE FUNCTION "IsplataDoPlate_fn"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Isplata"
    JOIN "Radnik" ON "Isplata"."Mlb" = "Radnik"."Mlb"
    WHERE NOT ("Isplata"."Iznos" <= "Radnik"."Plata")
  ) THEN
    RAISE EXCEPTION 'ograničenje IsplataDoPlate je narušeno' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "IsplataDoPlate_Isplata" AFTER INSERT OR UPDATE ON "Isplata"
  FOR EACH STATEMENT EXECUTE FUNCTION "IsplataDoPlate_fn"();
CREATE TRIGGER "IsplataDoPlate_Radnik" AFTER UPDATE ON "Radnik"
  FOR EACH STATEMENT EXECUTE FUNCTION "IsplataDoPlate_fn"();
```

### When a trigger is not generated

The output is the two existing comment lines plus `-- okidač nije generisan: <reason>` (en:
`-- trigger not generated: <reason>`):

| Situation | sr | en |
|---|---|---|
| empty condition / no references | `uslov ne navodi nijedan atribut` | `the condition names no attribute` |
| reference missing in the RM (W06) | `'{rel}.{attr}' ne postoji u relacionom modelu` | `'{rel}.{attr}' does not exist in the relational model` |
| token that cannot be translated | `nepoznat deo uslova: '{token}'` | `unknown part of the condition: '{token}'` |
| relations not connected | `relacije {list} nisu povezane stranim ključem` | `relations {list} are not connected by a foreign key` |
| several FKs between a pair | `između '{a}' i '{b}' postoji više stranih ključeva` | `there are several foreign keys between '{a}' and '{b}'` |

## Architecture and contract changes

- **Code:** only `src/rm/`. Put the trigger code in a new `src/rm/triggers.ts`, called from `sql.ts`, and keep
  `generateSql`'s signature. Keep the new sr + en SQL strings next to the existing ones in `src/rm/`.
- **Contracts:** new contract [C12](contracts/C12-triggers.md). It amends C10 §3 *SQL* (the child-side comment
  becomes a trigger, and the general-constraint section gains triggers or a reason line) and C11 §1 (PostgreSQL output
  is no longer byte-identical to the pre-C11 output when triggers apply). Add a CHANGELOG entry. No frozen file
  changes.
- **Tasks:** one task, **T34** (Wave 9) in `src/rm/`. It starts **after T30** (SQL dialects, Wave 8), which edits the
  same folder and the same function. No UI, e2e or other folder work is required.

## Tests

- **Child side:** `nullifies` and `default` on insert and on update, single and composite FK. Restricted cells
  produce no trigger. The trigger replaces the comment, at the same position.
- **General:** a single relation (no join); two relations joined child → parent and parent → child; three
  relations in a chain inside R. Each fallback reason has one case. `!=`, `And` / `Or` / `Not`, string literals and
  numbers are translated. INSERT / UPDATE / DELETE combinations go into the `AFTER` clause in the fixed order.
- **Locale:** comments, the reason lines and the `RAISE` message in sr and en.
- **Golden:** every existing example except `domeni` has unchanged SQL. `domeni` differs exactly by the block above.
- **Optional:** run the generated SQL of every example in an in-process PostgreSQL (`@electric-sql/pglite`) and
  check that a violating insert raises. This adds a dev dependency, a root config change via the CHANGELOG, so it
  needs a separate decision.

## Done when

- The `domeni` example's SQL contains the `IsplataDoPlate` function and both triggers, and runs unchanged on
  PostgreSQL 11+.
- A source with `Radnik : insert nullifies` on a nullable FK gets a BEFORE INSERT trigger instead of the comment.
- Untranslatable conditions keep today's comments plus a reason line, and never emit broken SQL.
- `npm test`, `npm run typecheck` and `npm run build` pass.

## Out of scope (for now)

- **Stored procedures** (`procedura` blocks). These need new DSL syntax, at minimum a raw-SQL pass-through block.
  They get a separate feature spec if needed.
- Triggers for SQL Server and Oracle, including the actions those dialects cannot express (Oracle `ON UPDATE`,
  SQL Server multiple cascade paths).
- Joining general constraints through relations that the condition does not mention.
- Row-level, incremental general-constraint triggers (checking only the changed rows).
- Domain and column default values (DEFAULT still means NULL).
- Identifiers longer than 63 bytes. PostgreSQL truncates them, so long constraint names may collide.
- A diagnostic (W-code) in the error panel when a trigger is not generated. For now the reason appears only in the SQL.

## Decisions (defaults chosen, confirm before planning)

1. Target PostgreSQL only.
2. Infer the general-constraint join from direct FKs, and fall back to comments otherwise. The user does not write
   SQL in `uslov`.
3. Triggers only. Procedures are a later feature.
4. General constraints use statement-level AFTER triggers that check the whole join.
5. Child-side DEFAULT means NULL, because the schema has no defaults.
