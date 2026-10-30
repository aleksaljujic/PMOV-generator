# Feature: interactive PMOV builder ("Interaktivni režim")

Build a PMOV diagram from scratch by clicking on the diagram instead of typing DSL. The user starts with one
unnamed object. A **+** button next to an element offers *objekat*, *veza*, *slab*, *agregacija* and
*specijalizacija*. Attributes, names and cardinalities are also edited by clicking. The goal is that a student who
doesn't know the DSL yet can draw a correct PMOV in a few clicks, and later switch to the text editor to see the
DSL it produced.

The app gets two working modes, chosen by the user: **Tekst** (today's text editor + diagram) and
**Interaktivno** (the new click-based builder).

This document extends [`requrement.md`](requrement.md). Everything in it (DSL, checks, FON notation, layout,
outputs) still applies.

## Core principle: the DSL text stays the source of truth

The builder never keeps its own model. Every interactive action is a **text edit on the DSL source**:

```
click → builder operation (pure function: source + action → new source) → source → compile → IR → diagram
```

- The existing pipeline (`compile`, graph, layout, RM, SQL, export) is reused unchanged.
- Both modes share **one** source (the same `pmov.source.v1` storage). Whatever is built interactively shows up
  as DSL in Tekst mode, and whatever is typed in Tekst mode can be edited further in Interaktivno mode.
- The relational model, domain table, SQL and SVG/PNG export work for builder-made diagrams without changes.

## Modes: Tekst / Interaktivno

- A segmented switch **"Tekst | Interaktivno"** sits in the toolbar. The chosen mode is remembered in
  localStorage (`pmov.mode.v1`, default `tekst`, so existing users see no change).
- **Tekst mode** is the app as it is today: editor on the left, diagram on the right, no builder controls.
- **Interaktivno mode:**
  - The text editor is hidden and the diagram takes the full width. The output tabs (Dijagram, Domeni,
    Relacioni model, SQL) stay.
  - Builder controls (+ buttons, "+ atribut", inline editors, pick mode) are active on the diagram.
  - The error panel stays visible under the diagram. Clicking an error selects and centres the element on the
    diagram (there is no editor line to jump to).
  - Undo/redo: toolbar buttons **"Poništi" / "Ponovi"** and Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y). The shell keeps a
    history of sources (one interactive action = one step, at least 100 steps). Switching to Tekst mode keeps the
    text; the editor's own history starts from that text.
- **"Novi dijagram"** (toolbar button, visible in both modes) replaces the source with the starting model and
  switches to Interaktivno mode. If the current source is not empty, the user is asked first:
  *"Trenutni dijagram će biti zamenjen. Nastaviti?"*
- Interaktivno mode works on any existing diagram (for example a loaded example from "Primeri"), as long as the
  source compiles without **syntax** errors. If there are syntax errors, the builder controls are disabled and a
  banner offers to fix them in Tekst mode: *"Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu."*
  with a button **"Otvori tekst"**.

## Starting state

The starting source has exactly one object with a generated placeholder name:

```
objekat Objekat1 {
}
```

- On the diagram it is drawn as a normal rectangle. A placeholder name (`ObjekatN`, `SlabN`, `AgregacijaN`,
  `VrstaN`, `PodtipN`, where N is the first free number) is shown in grey italics until the user renames it.
- The name field opens automatically for editing, so the user can type a real name straight away.
- E10 (object without identifier) is expected at this point. In interactive mode it is shown in the error panel
  as usual, but the node shows a softer hint, *"Dodaj identifikator (#)"*, next to the "+ atribut" control
  instead of only a red outline.

## The + button and the element menu

Every **objekat**, **slab** and **agregacija** node shows a round **+** button on its right side when hovered or
selected (on touch devices: when selected). Clicking it opens a small menu:

| Menu item | What it creates (relative to the clicked element X) |
|---|---|
| **Objekat** | A new standalone object `ObjekatN`, placed to the right of X. Not connected (W03 is expected until the user connects it). |
| **Veza** | A binary `veza` between X and a target. The user picks the target as described below. |
| **Slab objekat** | `slab SlabN { nadređeni X (0,M) }` and one partial identifier attribute `Rb#`, placed to the right of X. |
| **Agregacija** | `agregacija AgregacijaN` with X as the first component `(0,M)`. The user picks the second component as described below. |

| **Specijalizacija** | Only on **objekat** nodes. X becomes the nadtip. Creates two new subtype objects and the specialization (see below), with the subtypes in a row below X. |

### Specijalizacija

Choosing *Specijalizacija* on object X generates:

```
objekat Podtip1 {
}

objekat Podtip2 {
}

specijalizacija VrstaN {
  nadtip X (0,M)
  podtip Podtip1
  podtip Podtip2
}
```

- Subtype objects don't need their own identifier (they inherit it), so they show no E10 and no "Dodaj
  identifikator" hint. Adding a `#` attribute that repeats the supertype's identifier shows E11 as usual.
- The **S diamond** node has its own **+** menu with **"Dodaj podtip"**. It offers "Novi objekat" (creates
  `PodtipN`) or "Postojeći element…" (pick an existing objekat) and appends `podtip Y`.
- Clicking the `Name (DG,GG)` label next to the nadtip lets the user rename the specialization and change its
  cardinality.
- Pick mode for a podtip rejects X itself, objects that are already subtypes of X, and choices that would create
  a cycle (E09). The reason is shown in the status line.
- Removing a podtip so that fewer than 2 remain asks *"Obrisati i zavisne elemente (N)?"*, just like deleting
  elements.
- If X has no identifier yet, the "Dodaj identifikator (#)" hint stays on X (the nadtip), not on the subtypes.

### Picking a target (veza, agregacija)

After the user chooses *Veza* or *Agregacija*, a sub-menu offers:

- **"Novi objekat"** (default): creates a new object `ObjekatN` and connects it.
- **"Postojeći element…"**: enters *pick mode*. The cursor changes, valid targets (objekat, slab, agregacija) are
  highlighted, and the user clicks one. Esc or a click on empty canvas cancels. Clicking X itself creates a
  recursive veza (for agregacija this is not allowed).

Default generated blocks (cardinalities `(1,1)` / `(0,M)` for veza, `(0,M)` for each agregacija component; the
user changes them by clicking the label):

```
veza _ {                 // unnamed diamond
  X        (1,1)
  ObjekatN (0,M)
}

agregacija AgregacijaN {
  X        (0,M)
  ObjekatN (0,M)
}
```

A recursive veza is created with mapping names `Uloga1` / `Uloga2` so that it does not trigger W01.

### Adding more components to an agregacija

An agregacija node has its own **+** menu, which also contains **"Dodaj komponentu"**. It uses the same target
picking and appends `Y (0,M)` to the agregacija.

## Attributes

- Each objekat, slab and agregacija node shows a small **"+ atribut"** control (below the name, visible on hover
  or selection).
- Clicking it opens an inline form next to the node:
  - **Naziv** (required, must be a valid identifier; a name with spaces is written in quotes automatically),
  - **Identifikator (#)** checkbox. It is checked by default for the first attribute of an object that has no
    identifier yet,
  - **Domen** dropdown: `–`, `long`, `short`, `string`, `date`,
  - **Ograničenje** (optional free text, e.g. `NotNull`, `Between 15,65`).
  - Enter = save and open an empty form for the next attribute (fast entry). Esc = close.
- Clicking an existing attribute pill opens the same form, filled in, with an extra **"Obriši"** button.
- Generated line format: `Name[#] [: domain [constraint]]`, one attribute per line, aligned like the examples.

## Editing existing elements

| Action | Interaction | Text effect |
|---|---|---|
| Rename | Double-click the name on any node (objekat, slab, agregacija, veza diamond, attribute) | Renames the block **and every reference to it** (participants in veza / slab / agregacija / specijalizacija). Rejected with an inline message if the name is already used (E01) or not a valid identifier. Typing an empty name for a veza makes it `_`. |
| Change cardinality | Click a cardinality label on an edge, then choose from `(0,1) (1,1) (0,M) (1,M)` | Rewrites `(DG,GG)` on that participant line. |
| Mapping name | Click a label of a veza edge, or the empty spot near the participant end | Sets or clears the mapping name after the cardinality. |
| Delete element | Select a node, then the **Delete** key or the "Obriši" item in the node's context menu | Removes the block. Any veza or specijalizacija that becomes invalid is removed too. A slab whose nadređeni was deleted, or an agregacija left with fewer than 2 components, is **not** removed silently: the user is asked *"Obrisati i zavisne elemente (N)?"* and sees the list. |
| Delete attribute | "Obriši" in the attribute form, or select the pill and press Delete | Removes that attribute (from a comma-separated line too). |

## Text generation rules

- New blocks are appended at the end of the source, separated by one blank line. The user's existing formatting,
  comments and block order are never rewritten. Only the affected lines/blocks are changed.
- Edits operate on spans from the AST/IR (`span` of blocks, participants, attributes). If a span cannot be found
  (for example the source changed meanwhile), the action is aborted with a toast: *"Izmena nije uspela, pokušajte
  ponovo."* The source is never left half-edited.
- Comma-separated attribute lines (`{ Mlb#, Ime }`) are edited in place: adding goes to a new line, deleting
  removes only that item.
- Single-line blocks (`objekat Student { BrojInd#, Ime }`) stay single-line when an attribute is renamed. When an
  attribute is added they are expanded to multi-line form.
- The result of every operation must compile with no **new** errors except the expected ones (E10 for a new
  object without identifier, W03 for a new standalone object).
- Delete element on a podtip object removes its `podtip` line too. Deleting a nadtip removes the whole
  specijalizacija (after the dependents prompt); the subtype objects stay but become core objects (E10 until they
  get an identifier).

## Layout and positions

- A newly created element is placed **to the right of** the element whose + was clicked (same row, next free
  slot). Its position is saved like a dragged position, so the rest of the diagram does not jump when the
  structure changes.
- Elements created by a veza or agregacija (the diamond and the new object) are placed in a row to the right:
  X → diamond → new object.
- Elements created by a specijalizacija are placed **below** X: S diamond, then the junction circle, then the
  subtypes in a row (the org-chart shape from `requrement.md`). An added podtip goes to the right end of that row.
- "Ponovo rasporedi" still does a full ELK layout, as today.
- On rename, the stored position moves with the element (the position key changes from the old name to the new
  name).

## Architecture

Following C00 (one folder = one agent):

| Folder | Content | React? |
|---|---|---|
| `src/builder/` (new) | Pure builder operations: `(source, ir, action) → { source, selection?, newPositions? } \| { error }`. Also placeholder-name generation, rename with references, safe deletion with dependents, line formatting. | **No React**, fully unit tested |
| `src/ui/builder/` (new) | React overlay on the diagram: + buttons, menus, pick mode, inline forms for attributes/names/cardinalities. | React |
| `src/render/flow/` | Only small extension points: a render slot or callbacks so the overlay can attach controls to nodes and edge labels (via a contract change). | |
| `src/ui/shell/` | "Tekst \| Interaktivno" mode switch (+ `pmov.mode.v1` storage key), "Novi dijagram", undo/redo history for Interaktivno mode, full-width diagram layout, wiring builder results into the source + positions. | |

- New contract **C09-interactive-builder.md** defines the `BuilderAction` union and the operation signature, for
  example:

  ```ts
  type BuilderAction =
    | { kind: 'newModel' }
    | { kind: 'addObject'; near: string }
    | { kind: 'addVeza'; from: string; to: string | { newObject: true } }
    | { kind: 'addSlab'; parent: string }
    | { kind: 'addAgregacija'; first: string; second: string | { newObject: true } }
    | { kind: 'addComponent'; agregacija: string; component: string | { newObject: true } }
    | { kind: 'addSpecijalizacija'; nadtip: string }            // + two new PodtipN objects
    | { kind: 'addPodtip'; specijalizacija: string; podtip: string | { newObject: true } }
    | { kind: 'removePodtip'; specijalizacija: string; podtip: string; withDependents: boolean }
    | { kind: 'addAttribute'; owner: string; attr: { name: string; id: boolean; domain?: Domain; constraint?: string } }
    | { kind: 'editAttribute'; owner: string; index: number; attr: /* same */ }
    | { kind: 'deleteAttribute'; owner: string; index: number }
    | { kind: 'rename'; element: string; newName: string }
    | { kind: 'setCardinality'; element: string; participantIndex: number; dg: 0 | 1; gg: '1' | 'M' }
    | { kind: 'setMappingName'; element: string; participantIndex: number; name: string | null }
    | { kind: 'deleteElement'; element: string; withDependents: boolean };

  function applyBuilderAction(source: string, action: BuilderAction): BuilderResult;
  ```
- One agent implements the whole feature: task **T13** ([`tasks/T13-interactive-builder.md`](tasks/T13-interactive-builder.md)).
  It owns `src/builder/` and `src/ui/builder/` and may make additive edits in `src/ui/shell/` and
  `src/render/flow/`, recorded in the CHANGELOG.

## UI strings (Serbian, Latin)

`Tekst`, `Interaktivno`, `Novi dijagram`, `Poništi`, `Ponovi`, `Otvori tekst`, `Dodaj podtip`, `Objekat`, `Veza`, `Slab objekat`, `Agregacija`, `Specijalizacija`,
`Novi objekat`, `Postojeći element…`, `Dodaj komponentu`, `+ atribut`, `Naziv`, `Identifikator (#)`, `Domen`,
`Ograničenje`, `Sačuvaj`, `Otkaži`, `Obriši`, `Dodaj identifikator (#)`,
`Trenutni dijagram će biti zamenjen. Nastaviti?`, `Obrisati i zavisne elemente (N)?`,
`Ime je već zauzeto.`, `Neispravno ime.`, `Izmena nije uspela, pokušajte ponovo.`,
`Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.`,
`Podtip ne može biti sam nadtip.`, `Objekat je već podtip.`, `Ovo bi napravilo ciklus specijalizacije.`, `Izaberite element (Esc za otkazivanje)`.

## Tests

- `src/builder/` unit tests (golden source in → golden source out) for every action, including:
  - newModel → exactly `objekat Objekat1 {\n}\n`;
  - addVeza to a new object, to an existing object, and recursive (with `Uloga1`/`Uloga2`, no W01);
  - addSlab and addAgregacija produce sources that compile with no E-codes except E10 for new objects;
  - rename updates every reference, keeps comments/formatting, and rejects duplicates;
  - deleteElement with and without dependents;
  - attribute add/edit/delete on multi-line, single-line and comma-separated blocks;
  - addSpecijalizacija produces two subtypes with no E10, addPodtip / removePodtip (including the < 2 prompt
    case), and addPodtip rejects self, duplicates and cycles (E09);
  - placeholder numbering skips names already taken (`Objekat1` exists → `Objekat2`).
- Round trip: building both examples from `requrement.md` (main, and specijalizacija + rekurzivna veza) step by
  step with builder actions produces a source whose IR equals the example's IR (ignoring spans and order).
- UI tests (`src/ui/builder/`): + menu opens, pick mode works and Esc cancels, the attribute form validates names,
  Enter adds the next attribute.
- Shell tests: the mode switch hides/shows the editor and is persisted; the source is shared between modes;
  Poništi/Ponovi walk the history; "Novi dijagram" asks before replacing and switches to Interaktivno.

## Done when

- "Novi dijagram" shows one placeholder object, and the main example from `requrement.md` can be built with
  clicks only (objects, veze with cardinalities and mapping names, slab Isplata, agregacija Prijava, veza Overe
  from Prijava, all attributes with domains and constraints) and ends up with **zero errors** and the expected
  relational model.
- The second example (specijalizacija Vrsta with four subtypes, recursive veza Struktura) can also be built with
  clicks only.
- At every step, switching to Tekst mode shows valid, readable DSL that the user can keep editing by hand, and
  switching back to Interaktivno keeps working on that text.
- Poništi / Ctrl+Z reverts the last interactive action.
- With the mode left at Tekst (the default), the app looks and behaves exactly as before.
- `npm test`, `npm run typecheck` and `npm run build` pass.

## Decisions

1. **Specijalizacija** is part of the first version (+ menu on objekat, "Dodaj podtip" on the S diamond).
2. Default cardinalities for a new veza are `(1,1)` on the clicked element and `(0,M)` on the target.
3. The user chooses between two modes, **Tekst** and **Interaktivno**. Interaktivno is diagram-only, with the
   editor hidden. Both modes edit the same source.
