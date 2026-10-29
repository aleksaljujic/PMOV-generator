# PMOV editor

A browser-based compiler and live editor for **PMOV** diagrams, "Mermaid Live Editor for PMOV". Type a small textual DSL on the
left and see the diagram in FON notation on the right, plus a domain table, the generated relational model and SQL.
Everything runs in the browser; there is no backend. The UI is in Serbian (Latin script).

## What is PMOV

PMOV (prošireni model objekti-veze) is the extended entity-relationship model taught at FON, University of Belgrade.
It has objects (`objekat`), weak objects (`slab`), relationships (`veza`), aggregations (`agregacija`) and
specializations (`specijalizacija`). Each participant of a relationship carries a cardinality `(DG,GG)`.

## The DSL

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
