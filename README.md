# PMOV editor

A browser-based compiler and live editor for **PMOV** diagrams, "Mermaid Live Editor for PMOV". Type a small textual DSL on the
left and see the diagram in FON notation on the right, plus a domain table, the generated relational model and SQL.
Everything runs in the browser; there is no backend. The UI is in Serbian (Latin script).

## What is PMOV

PMOV (prošireni model objekti-veze) is the extended entity-relationship model taught at FON, University of Belgrade.
It has objects (`objekat`), weak objects (`slab`), relationships (`veza`), aggregations (`agregacija`) and
specializations (`specijalizacija`). Each participant of a relationship carries a cardinality `(DG,GG)`.

## The DSL

Full syntax reference for students: [docs/syntax.md](docs/syntax.md).

Every construct is a block:

```
<kind> <Name> {
  <line>
}
```

Main example (the default content of the editor):

```
// ---------- objekti ----------
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string
  Adresa  : string
  Starost : short Between 15,65
}

objekat Odeljenje {
  SifOd# : short Moduo_11
  Naziv  : string
}

objekat Student   { BrojInd#, Ime, Smer }
objekat Predmet   { SifPred#, NazivPred }
objekat Nastavnik { ŠifraNast#, ImeNast, Zvanje }

// ---------- veze ----------
veza Zapošljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zapošljava
}

veza Rukovođenje {
  Radnik    (0,1) Rukovodi
  Odeljenje (1,1) Rukovođeno
}

// ---------- slab objekat ----------
slab Isplata {
  nadređeni Radnik (0,M)
  Datum# : date
  Iznos  : long
}

// ---------- agregacija ----------
agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  DatumPol : date
  Ocena    : short Between 5,10
}

veza Overe {
  Prijava   (1,1)
  Nastavnik (0,M)
}
```

| Kind | Allowed lines |
| --- | --- |
| `objekat` | attributes only; at least one `#` identifier unless it is a `podtip` |
| `veza` | exactly 2 participants with cardinalities, no roles, no attributes; name `_` = unnamed diamond |
| `slab` | exactly one `nadređeni X (DG,GG)`, attributes with at least one `#` (partial identifier) |
| `specijalizacija` | exactly one `nadtip X (DG,GG)` and at least 2 `podtip Y` (no cardinality), no attributes |
| `agregacija` | at least 2 participants with cardinalities, optional attributes |

| Line form | Example |
| --- | --- |
| Attribute | `Name[#] [: domain [constraint]]`, e.g. `Starost : short Between 15,65` |
| Several attributes | `Mlb#, Dodatak` (comma separated) |
| Participant | `[role] ObjectName [(DG,GG)] [MappingName]`, e.g. `Radnik (1,1) Radi` |

Domains: `long`, `short`, `string`, `date`. Roles: `nadređeni`, `nadtip`, `podtip`. DG is 0 or 1, GG is 1 or M, DG <= GG.
Names with spaces use double quotes; `//` starts a comment. A line is a participant if it has a cardinality or starts
with a role keyword; otherwise it is an attribute.

**Cardinality rule:** the cardinality on a line always belongs to the object on that line. `Radnik (1,1) Radi` is drawn
next to Radnik.

## Architecture

```
text -> lexer -> parser -> AST -> semantic checks -> PMOV IR (plain JSON, no coordinates)
                                                      |-> React Flow nodes/edges (+ ELK layout)
                                                      |-> standalone SVG export
                                                      |-> domain table
                                                      `-> relational model
```

Module map (one folder per owner; folders talk only through their `index.ts` and the frozen contract files):

| Folder | Role |
| --- | --- |
| `src/lang/syntax`, `src/lang/semantic` | lexer, parser, semantic checks, IR, `compile()` |
| `src/rm` | relational model, SQL, domain table |
| `src/render/graph` | IR to framework-free diagram graph |
| `src/render/layout`, `src/render/geometry` | ELK layout, outline intersections and routing |
| `src/render/flow` | React Flow `DiagramView` |
| `src/render/svg` | standalone SVG/PNG export, `renderSvg` |
| `src/ui/editor` | CodeMirror 6 editor |
| `src/ui/tabs` | Domeni / Relacioni model / SQL tabs |
| `src/ui/shell` | app shell: toolbar, split pane, error panel, persistence, sync |
| `src/examples`, `src/fixtures` | example sources, golden test fixtures |

Contracts live in `spec/contracts/`. `src/lang`, `src/rm` and the pure render folders contain no React.

## Diagnostics

Messages are in Serbian, with line and column, e.g. `greška E04 (red 12, kol 1): veza 'Overe' ima 3 učesnika, ...`.

| Code | Meaning |
| --- | --- |
| S01-S06 | syntax errors (unexpected token, unterminated quote, unknown character / block kind / domain, missing `}`) |
| E01 | duplicate name |
| E02 | undeclared object referenced |
| E03 | invalid cardinality |
| E04 / E05 | `veza` with wrong participant count or roles / with attributes |
| E06 | `slab` shape or missing partial identifier |
| E07 | bad `specijalizacija` shape |
| E08 | `agregacija` with fewer than 2 components |
| E09 | cyclic specialization |
| E10 / E11 | object without identifier / subtype repeats supertype identifier |
| E12 | line not allowed in this block kind |
| W01-W04 | warnings: recursive veza without mapping names, attribute without domain, object in no relationship, duplicate attribute |

On a syntax error the last valid diagram stays on screen. Layout drags are stored in `localStorage` (never in the DSL);
"Ponovo rasporedi" clears them.

## Running

```bash
npm install
npm run dev        # Vite dev server
npm test           # all tests (vitest)
npm run build      # typecheck + production build
```

## Using the SVG renderer as a function

```ts
import { renderSvg } from './src/render/svg';

const svg: string = renderSvg('objekat A { Id# : long }\n'); // standalone SVG markup, no DOM needed
// renderSvgAsync(source) does the same with the ELK layout.
```

## Domains and constraints

Named domains are declared once and used as attribute types; the "Domeni" tab shows the domain structure, and the
"Ograničenja" tab shows referential actions (INSERT / UPDATE / DELETE per foreign key) and general cross-table
conditions. Both tabs can be edited in Tekst and Interaktivno mode. See the `domeni` example.

```
domen Starost : short Between 15,65
domen Naziv   : string(40)

objekat Radnik { Mlb# : long NotNull, ImeR : Naziv, Starost : Starost }

ograničenje RadnikUOdeljenju {
  Radnik(SifOd) -> Odeljenje
  Odeljenje : update cascades, delete restricted
}

ograničenje PlataUOpsegu {
  uslov: Radnik.Plata <= 10000
  Radnik : insert restricted, update restricted
}
```

Unlisted foreign key cells keep their defaults. Diagnostics E13-E20, W05 and W06 appear in the error panel; clicking
one opens the matching tab.

## Interactive mode

Next to the text editor ("Tekst") there is a click-based builder ("Interaktivno"), chosen with the **☰** button at the
far left of the toolbar (or Ctrl+B / Cmd+B) and remembered in `pmov.mode.v1`. The button opens and closes the editor
as a left sidebar: open = Tekst, closed = Interaktivno. In Interaktivno mode the editor is hidden: hover or select an object, slab
or agregacija and use the **+** button (objekat, veza, slab, agregacija, specijalizacija), "+ atribut", double-click
to rename, click an edge label to change cardinality or mapping name, Delete to remove. "Novi dijagram" starts with
one placeholder object; Poništi / Ponovi (Ctrl+Z / Ctrl+Shift+Z) undo actions. Every action is a text edit on the
same DSL source, so switching to Tekst shows the generated DSL. Contract: `spec/contracts/C09-interactive-builder.md`.

## Language

The toolbar has an **SR | EN** switch. It changes every text the program shows (toolbar, tabs, error panel,
diagnostics, builder) and is remembered in localStorage (`pmov.lang.v1`, default `sr`). It never changes the DSL
source. The examples menu loads the English version of an example in EN.

The DSL accepts English keywords in both UI languages, and they can be mixed with Serbian ones:

| Serbian | English |
|---|---|
| `objekat` | `object` |
| `veza` | `relationship` |
| `slab` | `weak` |
| `specijalizacija` | `specialization` |
| `agregacija` | `aggregation` |
| `nadređeni` / `nadredjeni` | `owner` |
| `nadtip` | `supertype` |
| `podtip` | `subtype` |

`nadredjeni` (without diacritics) is accepted everywhere `nadređeni` is. The builder writes new blocks with the
keywords of the selected UI language and leaves existing lines as they are.

## SQL dialects

The SQL tab has a **Dijalekt / Dialect** dropdown (PostgreSQL, Microsoft SQL Server, Oracle). The choice is
remembered in localStorage (`pmov.sqlDialect.v1`, default `postgres`) and is not reset by loading an example,
"Novi dijagram", or switching mode or language. **Kopiraj** copies the SQL of the selected dialect.

| | PostgreSQL | SQL Server | Oracle |
|---|---|---|---|
| Identifier quoting | `"Name"` | `[Name]` | `"Name"` (case-sensitive) |
| `long` / `short` | `BIGINT` / `SMALLINT` | `BIGINT` / `SMALLINT` | `NUMBER(19)` / `NUMBER(5)` |
| `string(n)`, no type | `VARCHAR(n)`, `VARCHAR(255)` | `NVARCHAR(n)` (`MAX` above 4000), `NVARCHAR(255)` | `VARCHAR2(n CHAR)`, `VARCHAR2(255 CHAR)` |
| Domains | `CREATE DOMAIN` | inlined into columns with a `CHECK` | inlined into columns with a `CHECK` |

Limitations are written into the output as `--` comments, so the SQL stays valid for the target database: SQL Server
and Oracle have no `CREATE DOMAIN`; unsupported child-side referential actions are marked "requires a trigger";
SQL Server marks foreign keys that would create multiple cascade paths; Oracle has no `ON UPDATE`. Contract:
`spec/contracts/C11-sql-dialects.md`.

## JSON import / export

**Izvezi JSON / Export JSON** downloads `pmov-dijagram.json` (`pmov-diagram.json` in English): the DSL `source`, the
saved node `positions`, the options (`dg0Mode`, `sqlDialect`), the model (IR without spans) and the diagram
(nodes with coordinates, edges) for external readers. It works even when the source has errors.
**Uvezi JSON / Import JSON** loads such a file: an invalid or too large (over 5 MB) file shows an error and changes
nothing; a valid one asks before replacing a different non-empty source, then sets the source, replaces the saved
positions and applies the options. In Interaktivno mode the import is one history step (Poništi restores the previous
diagram and positions). A file without `source` is imported from `model`, and the DSL text is generated from it.
Contract: `spec/contracts/C13-json-interchange.md`.
# PMOV-generator
# PMOV-generator
# PMOV-generator
