Build a web-based compiler and live editor for PMOV diagrams (prošireni model objekti-veze — the extended ER model as taught at FON, University of Belgrade). The user types a textual DSL on the left and sees the PMOV diagram rendered live on the right, in FON notation, plus tabs for the domain table and the generated relational model. Think of it as "Mermaid Live Editor, but for PMOV".

If a file named PMOV_jezik_specifikacija.md exists in the working directory, treat it as the authoritative language spec (it is in Serbian). The essentials are repeated below so you can work without it.

## Tech stack

- Vite + React + TypeScript (strict mode)
- @xyflow/react (React Flow) for the interactive diagram
- elkjs for automatic layout
- CodeMirror 6 for the editor (with simple syntax highlighting for keywords, comments, `#`, cardinalities)
- A hand-written recursive-descent parser (no parser generator) — the grammar is small
- Vitest for tests
- No backend. Everything runs in the browser.

## Architecture (keep these layers strictly separated)

```
text → lexer → parser → AST → semantic checks → PMOV IR (plain JSON, no coordinates)
                                                  ├→ React Flow nodes/edges (+ ELK layout)
                                                  ├→ standalone SVG export
                                                  ├→ domain table
                                                  └→ relational model
```

Folder layout suggestion: `src/lang/` (lexer, parser, ast, checker, ir), `src/render/` (React Flow node/edge components, layout, svg export), `src/rm/` (relational model generator), `src/ui/` (editor, tabs, error panel). The `lang` and `rm` folders must not import React.

## The DSL

Every construct is a block of the same shape:

```
<kind> <Name> {
  <line>
  <line>
}
```

Kinds: `objekat`, `veza`, `slab`, `specijalizacija`, `agregacija`.

Inside a block there are exactly two kinds of lines:

- Attribute: `Name[#] [: domain [constraint]]` — `#` marks an identifier (or partial identifier for `slab`). Domains: `long`, `short`, `string`, `date`. Constraint is free text to end of line (e.g. `NotNull`, `Between 15,65`, `In(Srpski, Ruski)`, `Moduo_11`, combined with `And`). Several short attributes may share a line separated by commas: `objekat Dete { Mlb#, Dodatak }`.
- Participant: `[role] ObjectName [(DG,GG)] [MappingName]` — roles are `nadređeni`, `nadtip`, `podtip`. DG ∈ {0,1}, GG ∈ {1,M,m}, DG ≤ GG.

A line is a participant if it has a cardinality `(DG,GG)` or starts with a role keyword; otherwise it is an attribute.

**Cardinality rule:** the cardinality on a line always belongs to the object on that line. `Radnik (1,1) Radi` means "one Radnik Radi in min 1, max 1 of the other side", and on the diagram it is drawn next to Radnik.

Block rules:
- `objekat`: attributes only. Must have ≥1 `#` unless it is a subtype in some `specijalizacija`.
- `veza`: exactly 2 participants with cardinalities, no roles, no attributes. Name `_` means unnamed diamond. The same object may appear twice (recursive relationship).
- `slab`: exactly one `nadređeni X (DG,GG)` participant (cardinality is nadređeni → slab; slab → nadređeni is implicitly (1,1)), plus attributes, at least one with `#` (partial identifier).
- `specijalizacija`: exactly one `nadtip X (DG,GG)` and ≥2 `podtip Y` lines (podtip lines have no cardinality). No attributes.
- `agregacija`: ≥2 participants with cardinalities (component → aggregation), optional attributes (may include `#`). Its name can be used as an object in other blocks.

Lexical rules: identifiers may contain Serbian letters (č ć ž š đ, upper and lower case), are case-sensitive; names with spaces use double quotes (`objekat "Nalog za nabavku" { ... }`); `//` comments to end of line; newlines separate lines inside blocks.

EBNF:

```
model       = { blok } ;
blok        = vrsta ime "{" { red } "}" ;
vrsta       = "objekat" | "veza" | "slab" | "specijalizacija" | "agregacija" ;
red         = ( učesnik | atributi ) kraj ;
atributi    = atribut { "," atribut } ;
atribut     = ime [ "#" ] [ ":" domen [ ograničenje ] ] ;
domen       = "long" | "short" | "string" | "date" ;
učesnik     = [ uloga ] ime [ kard [ ime ] ] ;
uloga       = "nadređeni" | "nadtip" | "podtip" ;
kard        = "(" DG "," GG ")" ;
DG          = "0" | "1" ;
GG          = "1" | "M" | "m" ;
ime         = slovo { slovo | cifra | "_" } | "_" | '"' tekst '"' ;
```

Keep block-arity rules out of the grammar; enforce them in the checker so error messages are clear.

## Semantic checks (messages in Serbian, with line and column)

Errors: E01 duplicate name; E02 participant references undeclared object/slab/agregacija; E03 invalid cardinality; E04 `veza` not exactly 2 participants or has roles; E05 `veza` has attributes (suggest `agregacija`); E06 `slab` without exactly one `nadređeni` or without `#`; E07 bad `specijalizacija` shape; E08 `agregacija` with <2 components; E09 cyclic specialization; E10 core object without identifier; E11 subtype repeats supertype identifier.
Warnings: W01 recursive `veza` without both mapping names; W02 attribute without domain; W03 object in no relationship; W04 duplicate attribute in block.

Example message: `greška E04 (red 12, kol 1): veza 'Overe' ima 3 učesnika, a veza mora imati tačno 2. Za vezu više objekata koristi 'agregacija'.`

Show errors in a panel under the editor, as CodeMirror lint diagnostics (squiggles), and as a red outline on the corresponding diagram node. Clicking an error jumps to the line. On a parse error, keep showing the last valid diagram.

## FON notation (render exactly like this — black strokes on white, no colors except error highlights)

- objekat: rectangle, name centered.
- slab: double rectangle (inner rectangle inset ~4px). Edge FROM the nadređeni object TO the slab with a filled arrowhead at the slab end. Cardinality label next to the nadređeni end.
- veza: diamond with name inside (empty if `_`). Two plain lines to the participant objects. Each line carries a label like `(1,1) Radi` placed NEAR THE PARTICIPANT OBJECT, not at the middle of the line.
- recursive veza: the two edges between the same object and diamond must take visibly different paths (e.g., one exits the object's top and enters the diamond's top, the other bottom-to-bottom, orthogonal routing).
- agregacija: rectangle with a diamond inscribed touching all four sides, name centered. Edges from each component TO the aggregation with a filled arrowhead at the aggregation end; cardinality near the component. An aggregation can itself be a participant of a `veza` (plain line, label near it).
- specijalizacija: nadtip → plain line → small diamond with bold "S" → plain line → small hollow circle → one line per podtip with a filled arrowhead at the podtip. Label `Name (DG,GG)` next to the nadtip end of the first line. Lay podtipovi out in a row below the circle with orthogonal lines (horizontal bus from the circle, vertical arrows down), like a classic org chart.
- atribut: pill (fully rounded rectangle), connected to its owner by a plain line. Identifiers display their `#` (e.g. `Mlb#`). Attributes of aggregations attach to the aggregation node.

## React Flow implementation notes

- Every diamond (veza, S) and the junction circle are NODES, not edges — a `veza` can connect an `agregacija` node to an `objekat` node, so relationships must be first-class nodes.
- Custom node types: `objekat`, `slab`, `veza`, `agregacija`, `atribut`, `spec` (S diamond), `junction` (circle). Draw shapes with inline SVG inside each node.
- Use floating edges (edges attach to the nearest point on the node's outline, not fixed handles) — follow the official React Flow "floating edges" approach. For diamonds, compute the intersection with the diamond outline, not its bounding box.
- One custom edge type `pmov` with optional label and optional arrowhead. Position the label at ~15–20% of the path length from the source end, offset perpendicular to the line so it doesn't overlap it. Use `EdgeLabelRenderer`.
- Layout: run elkjs (layered, orthogonal edge routing) on objects, slab, veza, agregacija, spec and junction nodes ONLY. Then place attribute nodes around their owner with simple geometry (fan them on the free side(s), avoid overlapping other nodes and edges as far as reasonably possible). Don't feed attributes to ELK — it produces clutter.
- Manual positions: if the user drags a node, store its position in localStorage keyed by node id (element name), and reuse it on the next render instead of the ELK result. Add a "Ponovo rasporedi" (re-layout) button that clears stored positions. Positions never go into the DSL text.
- Debounce re-parsing ~300ms after typing.
- Clicking a node highlights and scrolls to its block in the editor; placing the cursor inside a block highlights its node.

## Other outputs

**Tab "Domeni":** table ATRIBUT | DOMEN | OGRANIČENJE built from all attributes (strip the `#` in this table; show `–` for missing values).

**Tab "Relacioni model":** apply the FON translation rules:
1. Every objekat, slab, agregacija (and every veza that must become a relation, see 4) becomes a relation with the same name (spaces removed).
2. Attributes of a relation: all its own attributes, plus the identifiers of every object toward which it has a mapping with cardinality exactly (1,1) — these are foreign keys.
3. Primary key:
   - core object (not slab, not subtype, not agregacija): its identifier;
   - subtype: the supertype's identifier (subtype relation = supertype id + own attributes);
   - slab: nadređeni's identifier + the slab's partial identifier;
   - agregacija: the identifier of a component whose mapping toward the aggregation has GG = 1; if none, the concatenation of the identifiers of all components with GG = M.
4. A `veza` where both mappings have GG > 1, or where at least one mapping has DG = 0, is treated like an aggregation (its own relation). For the case where the only reason is DG = 0 and the other side is (x,1), offer a toggle "Veze sa DG=0: posebna relacija / strani ključ" — default "strani ključ" (put the FK in the side with GG = 1, nullable).
Render as e.g. `Radnik(<u>Mlb</u>, ImeR, Adresa, Starost, <i>SifOd</i>)` — primary key underlined, foreign keys italic. Also offer "Kopiraj kao tekst" and an optional SQL `CREATE TABLE` view (map long→BIGINT, short→SMALLINT, string→VARCHAR(255), date→DATE; PRIMARY KEY and FOREIGN KEY clauses).

**Export:** "Izvezi SVG" produces a standalone SVG drawn from the IR + current positions (separate renderer, not a DOM screenshot), and "Izvezi PNG". The SVG renderer should also be usable as a pure function `renderSvg(source: string): string` so it can later be used Mermaid-style in Markdown.

## UI

Split view: editor left (resizable), diagram right with zoom/pan/fit-view and minimap. Below/next to the diagram: tabs Dijagram | Domeni | Relacioni model | SQL. UI text in Serbian (Latin script). Include an "Primeri" dropdown with the examples below. Persist the editor text in localStorage.

## Example (must parse with zero errors, render correctly, and be the default content)

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

Expected relational model for it:

```
Radnik(Mlb, ImeR, Adresa, Starost, SifOd)          key: Mlb; FK: SifOd
Odeljenje(SifOd, Naziv, Mlb)                        key: SifOd; FK: Mlb
Isplata(Mlb, Datum, Iznos)                          key: Mlb, Datum
Student(BrojInd, Ime, Smer)                         key: BrojInd
Predmet(SifPred, NazivPred)                         key: SifPred
Nastavnik(ŠifraNast, ImeNast, Zvanje)               key: ŠifraNast
Prijava(BrojInd, SifPred, DatumPol, Ocena, ŠifraNast)   key: BrojInd, SifPred; FK: ŠifraNast
```

Second example for the dropdown (specialization + recursive relationship):

```
objekat Građanin  { Mlb# : long, Ime : string, Starost : short }
objekat Student   { BrojInd : string, Semestar : short }
objekat Radnik    { Plata : long }
objekat Dete      { Dodatak : long }
objekat Penzioner { Penzija : long }
objekat Proizvod  { SifProizvoda#, NazivProizvoda }

specijalizacija Vrsta {
  nadtip Građanin (0,M)
  podtip Student
  podtip Radnik
  podtip Dete
  podtip Penzioner
}

veza Struktura {
  Proizvod (0,M) Sastavljen
  Proizvod (0,M) Ugrađen
}
```

Also add one example per error code as a test fixture.

## Tests (Vitest)

- Lexer/parser: every construct, diacritics, quoted names, comments, comma-separated attributes, error recovery position info.
- Checker: one passing and one failing case per E/W code.
- RM generator: the expected relational model above, the subtype case, the slab case, an aggregation with a GG=1 component (`Radnik (0,1)`, `Sindikat (0,M)` → key Mlb only), and both variants of the DG=0 toggle.
- IR → React Flow mapping: node/edge counts and types for the main example.

## Done when

- `npm install && npm run dev` starts the app with the main example rendered correctly in FON notation.
- `npm test` passes.
- `npm run build` succeeds with no TypeScript errors.
- A short README (English) explains the DSL with the example, the architecture, and how to run it.

Work iteratively: build lang + tests first, then RM generator + tests, then rendering, then UI polish. Run the tests after each stage. When rendering, take screenshots (or inspect the DOM) to verify the notation matches the description above — especially label placement near the participant object, arrowheads on slab/agregacija/podtip edges, and the S + circle structure.