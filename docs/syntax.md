# PMOV syntax guide

This page explains how to write a PMOV model in the editor. It assumes you already know PMOV / the extended ER model from the FON course (objects, relationships, weak objects, aggregation, specialization). You do not need to know anything about the program itself.

You type text on the left; the diagram on the right updates as you type.

**Contents**

1. [Quick start](#1-quick-start)
2. [Basics: names, comments, lines](#2-basics-names-comments-lines)
3. [Attributes](#3-attributes)
4. [Participants and cardinalities](#4-participants-and-cardinalities)
5. [Block kinds](#5-block-kinds)
6. [Keywords (Serbian and English)](#6-keywords-serbian-and-english)
7. [Messages: errors and warnings](#7-messages-errors-and-warnings)
8. [Editor tips](#8-editor-tips)
9. [From model to relational model](#9-from-model-to-relational-model)
10. [Full example](#10-full-example)

---

## 1. Quick start

A model is a list of **blocks**. Every block has the same shape: a keyword, a name, and lines between `{` and `}`.

```pmov
objekat Radnik {
  Mlb#   : long
  ImeR   : string
}

objekat Odeljenje {
  SifOd# : short
  Naziv  : string
}

veza Zaposljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zaposljava
}
```

This draws two rectangles (`Radnik`, `Odeljenje`) with their attributes as small rounded "pills", and a diamond `Zaposljavanje` between them. Next to each rectangle you see the cardinality and the mapping name, for example `(1,1) Radi` next to `Radnik`.

There are five kinds of block: `objekat`, `veza`, `slab`, `agregacija` and `specijalizacija`. Each is described in [section 5](#5-block-kinds).

---

## 2. Basics: names, comments, lines

### Names

A name is a word made of letters, digits and underscores, and it cannot start with a digit. Serbian letters work: `č ć ž š đ` and their capitals.

```pmov
objekat Građanin {
  Mlb#   : long
  Prezime: string
}
```

Names are **case-sensitive**: `Radnik` and `radnik` are two different names. Keywords are case-sensitive too (`Objekat` is not a keyword, it is just a name).

If a name needs spaces, put it in double quotes. A quoted name must stay on one line.

```pmov
objekat "Nalog za nabavku" {
  BrojNaloga# : long
}
```

Everywhere you refer to that object you write the quotes again, for example `"Nalog za nabavku" (0,M)`.

A veza may be unnamed: use `_` as its name. The diamond is then drawn empty. (Only a veza can be called `_`.)

```pmov
objekat A { IdA# }
objekat B { IdB# }

veza _ {
  A (0,M)
  B (0,M)
}
```

Every block must have a name that is different from all other blocks (see [E01](#e01)).

### Comments

`//` starts a comment that runs to the end of the line.

```pmov
// Employees
objekat Radnik {
  Mlb#   : long   // personal number
}
```

### Lines

Inside a block, **one line is one attribute or one participant**. The only exception is that several attributes may share a line if you separate them with commas. A whole block may be written on one line:

```pmov
objekat Student { BrojInd#, Ime, Smer }
```

This is the same as writing the three attributes on three separate lines.

---

## 3. Attributes

An attribute line looks like this:

```
Name  [#]  [: domain  [constraint]]
```

Everything after the name is optional.

```pmov
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string
  Adresa
}
```

### The `#` mark

`#` right after the name marks an **identifier**. In a `slab` it marks the **partial identifier**. An identifier is shown with its `#` in the diagram (`Mlb#`).

An object can have several `#` attributes; together they form a composite identifier.

### Domains

After a colon you may give a domain. There are exactly four:

| Domain | Meaning |
|---|---|
| `long` | large integer |
| `short` | small integer |
| `string` | text |
| `date` | date |

Any other word is an error ([S06](#s06)). An attribute without a domain is allowed, but you get a warning ([W02](#w02)).

### Constraint text

After the domain you may write a constraint. It is free text up to the end of the line, and it may contain spaces, commas and parentheses.

```pmov
objekat Radnik {
  Mlb#    : long NotNull
  Starost : short Between 15,65
  Jezik   : string In(Srpski, Ruski)
  Sifra   : short Moduo_11
  Plata   : long NotNull And Between 1,1000000
}
```

The program does not check what the constraint means. It only shows it in the Domains tab and copies it into the SQL as a comment (`NotNull` also makes the SQL column `NOT NULL`).

### Several attributes on one line

Separate attributes with a comma. A comma **right after a domain** starts a new attribute:

```pmov
objekat Građanin { Mlb# : long, Ime : string, Starost : short }
```

But a comma *inside* a constraint belongs to the constraint. This is how the program tells them apart: once a constraint has started (any text after the domain that is not a comma), everything up to the end of the line is the constraint.

```pmov
objekat Radnik { Mlb# : long, Starost : short Between 15,65 }
```

Here `15,65` is one constraint, not a second attribute. So, if you want more attributes after one that has a constraint, put them on the next lines.

If you write the same attribute name twice in one block, you get a warning ([W04](#w04)).

---

## 4. Participants and cardinalities

A **participant** is a line that connects the block to another object. It looks like this:

```
[role]  Name  (DG,GG)  [MappingName]
```

| Part | Meaning |
|---|---|
| `role` | only in `slab` (`nadređeni`) and `specijalizacija` (`nadtip`, `podtip`) |
| `Name` | the object, weak object or aggregation you connect to |
| `(DG,GG)` | the cardinality: lower bound, upper bound |
| `MappingName` | an optional name of the mapping, drawn next to the cardinality |

```pmov
objekat Radnik { Mlb# }
objekat Odeljenje { SifOd# }

veza Zaposljavanje {
  Radnik    (1,1) Radi
  Odeljenje (0,M) Zaposljava
}
```

### Allowed cardinalities

* **DG** (minimum) is `0` or `1`.
* **GG** (maximum) is `1` or `M` (a small `m` also works).
* DG must not be greater than GG. That leaves exactly six cardinalities:

| `(0,1)` | `(1,1)` | `(0,M)` | `(1,M)` |
|---|---|---|---|

Anything else, such as `(2,M)`, `(0,N)` or `(1,0)`, is an error ([E03](#e03)).

```pmov error=E03
objekat Radnik { Mlb# }
objekat Odeljenje { SifOd# }

veza Zaposljavanje {
  Radnik    (2,M) Radi
  Odeljenje (0,M) Zaposljava
}
```

### Which way does the cardinality point?

The cardinality on a line **belongs to the object written on that line**, and it is drawn next to that object. It describes the mapping from that object toward the other side.

`Radnik (1,1) Radi` reads: every Radnik is connected to at least 1 and at most 1 Odeljenje, and the mapping is called *Radi*.

* In a **veza**: each of the two lines describes the mapping from its own object to the other one.
* In a **slab**: the cardinality on the `nadređeni` line goes from the owner to the weak object. The way back (weak object to owner) is always `(1,1)`, so you never write it.
* In a **specijalizacija**: the cardinality on the `nadtip` line goes from the supertype to the subtypes. Subtype lines have no cardinality.
* In an **agregacija**: each component line describes the mapping from the component toward the aggregation.

### Participant or attribute?

Both kinds of line start with a name, so the program needs a rule. A line is a **participant** if:

1. it starts with a role word (`nadređeni`, `nadtip`, `podtip`, or their alternatives from [section 6](#6-keywords-serbian-and-english)), or
2. the name is followed by an opening parenthesis `(`.

Otherwise it is an attribute line. So `Radnik (1,1) Radi` is a participant, and `Starost : short Between 15,65` is an attribute, because the `(` of a constraint comes after the colon, not right after the name.

A common mistake follows from this rule: if you forget the cardinality in a veza, the line `Odeljenje` is read as an attribute, and the program reports that the veza has an attribute ([E05](#e05)), usually together with a wrong participant count ([E04](#e04)). If you also write a mapping name (`Odeljenje Zaposljava`), you get a syntax error ([S01](#s01)). In an `agregacija` the same mistake is reported as [E08](#e08).

---

## 5. Block kinds

### 5.1 `objekat`

An ordinary object. It contains attributes only.

```pmov
objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : string
  Adresa  : string
  Starost : short Between 15,65
}
```

Rules:

* It needs at least one `#` attribute, unless it is a `podtip` in some specialization ([E10](#e10)). A subtype gets its identifier from its supertype.
* No participant lines ([E12](#e12)).
* It should take part in some veza, slab, aggregation or specialization, otherwise you get a warning ([W03](#w03)).

```pmov error=E10
objekat Radnik {
  ImeR : string
}
```

### 5.2 `veza`

A relationship between exactly two things. Each of the two lines is a participant with a cardinality. No roles, no attributes.

```pmov
objekat Radnik { Mlb# }
objekat Odeljenje { SifOd# }

veza Rukovodjenje {
  Radnik    (0,1) Rukovodi
  Odeljenje (1,1) Rukovodjeno
}
```

Rules:

* Exactly two participants, no more, no fewer ([E04](#e04)). To connect three or more things, use an `agregacija`.
* No role words ([E04](#e04)).
* No attributes ([E05](#e05)). A relationship that needs attributes should be written as an `agregacija`.
* Every participant must have a valid cardinality ([E03](#e03)) and must be declared ([E02](#e02)). A line without a cardinality is read as an attribute, see [section 4](#participant-or-attribute).
* A participant can be an `objekat`, a `slab` or an `agregacija`, but not another `veza`.

```pmov error=E04
objekat A { IdA# }
objekat B { IdB# }
objekat C { IdC# }

veza Overe {
  A (0,M)
  B (0,M)
  C (0,M)
}
```

```pmov error=E05
objekat A { IdA# }
objekat B { IdB# }

veza Overe {
  A (0,M)
  B (0,M)
  Datum : date
}
```

**Recursive veza.** The same object may appear twice. Give the two mappings different names, so you can tell them apart in the diagram and in the relational model. If you leave a name out, you get a warning ([W01](#w01)).

```pmov
objekat Proizvod { SifProizvoda#, NazivProizvoda }

veza Struktura {
  Proizvod (0,M) Sastavljen
  Proizvod (0,M) Ugrađen
}
```

```pmov warn=W01
objekat Proizvod { SifProizvoda#, NazivProizvoda }

veza Struktura {
  Proizvod (0,M)
  Proizvod (0,M)
}
```

**Unnamed veza.** Write `_` as the name (see [section 2](#names)).

### 5.3 `slab`

A weak object: its identity depends on an owner. The owner is given by exactly one `nadređeni` line, with the cardinality from the owner to the weak object. Besides that, the block contains attributes, and at least one must be a partial identifier (`#`).

```pmov
objekat Radnik { Mlb# }

slab Isplata {
  nadređeni Radnik (0,M)
  Datum# : date
  Iznos  : long
}
```

You can write `nadredjeni` (with `dj`) instead of `nadređeni`; it means exactly the same. This is handy if your keyboard has no `đ`.

```pmov
objekat Radnik { Mlb# }

slab Dete {
  nadredjeni Radnik (0,M)
  Rb#
}
```

The owner of a weak object may itself be a weak object or an aggregation.

Rules, all reported as [E06](#e06):

* exactly one `nadređeni` line, with a cardinality;
* no other kind of participant line;
* at least one `#` attribute.

```pmov error=E06
objekat Radnik { Mlb# }

slab Isplata {
  nadređeni Radnik (0,M)
  Iznos : long
}
```

### 5.4 `agregacija`

An aggregation treats a relationship between objects as an object of its own. It has **at least two components** (participants with a cardinality, no role), and it may have attributes, including `#`.

```pmov
objekat Student { BrojInd# }
objekat Predmet { SifPred# }

agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  DatumPol : date
  Ocena    : short Between 5,10
}
```

The cardinality of a component describes the mapping from that component to the aggregation.

The name of an aggregation can be used like an object name anywhere a participant is expected, for example as a participant of a veza:

```pmov
objekat Student { BrojInd# }
objekat Predmet { SifPred# }
objekat Nastavnik { SifNast# }

agregacija Prijava {
  Student (0,M)
  Predmet (0,M)
  Ocena : short
}

veza Overe {
  Prijava   (1,1)
  Nastavnik (0,M)
}
```

Fewer than two components is an error ([E08](#e08)). Role words are not allowed here ([E12](#e12)).

```pmov error=E08
objekat Student { BrojInd# }

agregacija Prijava {
  Student (0,M)
}
```

### 5.5 `specijalizacija`

A specialization splits one supertype into two or more subtypes. It has exactly one `nadtip` line with a cardinality and at least two `podtip` lines without a cardinality. No attributes.

```pmov
objekat Građanin { Mlb# : long, Ime : string }
objekat Student  { BrojInd : string }
objekat Radnik   { Plata : long }

specijalizacija Vrsta {
  nadtip Građanin (0,M)
  podtip Student
  podtip Radnik
}
```

Rules, all reported as [E07](#e07):

* exactly one `nadtip X (DG,GG)`;
* at least two `podtip` lines;
* a `podtip` has no cardinality;
* no attributes, and no line without a role.

```pmov error=E07
objekat Građanin { Mlb# : long }
objekat Student  { BrojInd : string }

specijalizacija Vrsta {
  nadtip Građanin (0,M)
  podtip Student
}
```

**Inheritance of the identifier.** A subtype takes the identifier of its supertype, so you must not write it again ([E11](#e11)), and a subtype does not need a `#` of its own ([E10](#e10) does not apply to it).

```pmov error=E11
objekat Građanin { Mlb# : long }
objekat Student  { Mlb : long, BrojInd : string }
objekat Radnik   { Plata : long }

specijalizacija Vrsta {
  nadtip Građanin (0,M)
  podtip Student
  podtip Radnik
}
```

A subtype can be the supertype of another specialization (a hierarchy), but a specialization must not loop back to itself ([E09](#e09)).

---

## 6. Keywords (Serbian and English)

You can write the keywords in Serbian or in English, and you can mix both in one model. The diagram and the other tabs look the same either way. The program never rewrites your text.

| Serbian | Also accepted | English |
|---|---|---|
| `objekat` | | `object` |
| `veza` | | `relationship` |
| `slab` | | `weak` |
| `agregacija` | | `aggregation` |
| `specijalizacija` | | `specialization` |
| `nadređeni` | `nadredjeni` | `owner` |
| `nadtip` | | `supertype` |
| `podtip` | | `subtype` |

The four domains `long`, `short`, `string`, `date` are the same in both languages.

Keywords are **case-sensitive**: `Object` or `Veza` is not a keyword, so a block written as `Objekat A { ... }` is an error ([S04](#s04)). `Object` is just an ordinary name. A name that is spelled exactly like a keyword (for example an object called `object`) is accepted right after the block keyword, but it is confusing, so avoid it.

An English model:

```pmov
object Employee {
  EmpNo# : long
  Name   : string
}

weak Child {
  owner Employee (0,M)
  No#
}
```

Mixed:

```pmov
objekat Employee { EmpNo# }

weak Child {
  nadređeni Employee (0,M)
  No#
}
```

The SR | EN switch in the toolbar changes the language of the program's own text (menus, tabs, messages). It does not change which keywords you can type, and it never changes your source.

---

## 7. Messages: errors and warnings

Every problem has a code. **S** codes are syntax problems (the text cannot be read), **E** codes are errors in the model, **W** codes are warnings. Errors are shown with a red squiggle in the editor and in the error panel under it; click a message to jump to its line. On a syntax error the diagram keeps showing the last valid state. Warnings do not stop anything.

A message looks like `error E04 (line 12, col 1): ...` (in Serbian mode: `greška E04 (red 12, kol 1): ...`). The codes are the same in both languages.

### Syntax (S)

<a id="s01"></a>
**S01 - unexpected symbol.** Something is in the wrong place, for example a missing name or a missing `{`.

```pmov error=S01
objekat {
  Mlb#
}
```

Fix: write the name, `objekat Radnik {`.

<a id="s02"></a>
**S02 - unclosed quoted name.** The closing `"` is missing on that line.

```pmov error=S02
objekat "Nalog za nabavku {
  Broj#
}
```

Fix: close the quotes: `objekat "Nalog za nabavku" {`. The error is usually followed by a second one (S01) for the rest of the line; fix the quotes and both go away.

<a id="s03"></a>
**S03 - unknown character.** A character that cannot appear there (outside a constraint text, where anything goes).

```pmov error=S03
objekat Radnik {
  Mlb# @ : long
}
```

Fix: remove the character.

<a id="s04"></a>
**S04 - unknown block kind.** The first word of a block is not one of the block keywords.

```pmov error=S04
entitet Radnik {
  Mlb#
}
```

Fix: use `objekat` (or `object`, etc.; see [section 6](#6-keywords-serbian-and-english)). This is also what you get when a keyword is spelled with a capital letter.

<a id="s05"></a>
**S05 - block not closed.** The text ended before the `}`.

```pmov error=S05
objekat Radnik {
  Mlb#
```

Fix: add the `}`.

<a id="s06"></a>
**S06 - unknown domain.** The word after `:` is not `long`, `short`, `string` or `date`.

```pmov error=S06
objekat Radnik {
  Mlb# : integer
}
```

Fix: pick one of the four domains.

### Errors (E)

<a id="e01"></a>
**E01 - duplicate name.** Two blocks have the same name (of any kind). The second one is ignored.

```pmov error=E01
objekat Radnik { Mlb# }
objekat Radnik { Sifra# }
```

Fix: rename one of them.

<a id="e02"></a>
**E02 - undeclared object.** A participant refers to a name that is not an `objekat`, `slab` or `agregacija`. (A `veza` or `specijalizacija` cannot be a participant, so naming one gives the same error.) Check the spelling and the case.

```pmov error=E02
objekat Radnik { Mlb# }

veza Radi {
  Radnik   (1,1)
  Odeljene (0,M)
}
```

Fix: declare `Odeljenje` and spell it the same way everywhere.

<a id="e03"></a>
**E03 - invalid cardinality.** Allowed: DG is 0 or 1, GG is 1 or M, DG not greater than GG.

```pmov error=E03
objekat A { IdA# }
objekat B { IdB# }

veza V {
  A (1,0)
  B (0,M)
}
```

Fix: use one of `(0,1) (1,1) (0,M) (1,M)`.

<a id="e04"></a>
**E04 - veza must have exactly two participants and no roles.** See [5.2](#52-veza). A participant line without a cardinality does not count as a participant (it is read as an attribute), so it can cause this error too.

```pmov error=E04
objekat A { IdA# }
objekat B { IdB# }

veza V {
  podtip A (0,M)
  B (0,M)
}
```

Fix: remove the role word; for three or more objects use `agregacija`.

<a id="e05"></a>
**E05 - attribute in a veza.** A veza cannot have attributes.

```pmov error=E05
objekat A { IdA# }
objekat B { IdB# }

veza V {
  A (0,M)
  B (0,M)
  Napomena : string
}
```

Fix: if a line was meant as a participant, add its cardinality. If the relationship really has attributes, use an `agregacija`.

<a id="e06"></a>
**E06 - bad weak object.** A `slab` needs exactly one `nadređeni X (DG,GG)` and at least one `#` attribute.

```pmov error=E06
objekat Radnik { Mlb# }

slab Isplata {
  Datum# : date
}
```

Fix: add `nadređeni Radnik (0,M)`.

<a id="e07"></a>
**E07 - bad specialization.** Needs exactly one `nadtip X (DG,GG)`, at least two `podtip Y` without cardinality, and no attributes.

```pmov error=E07
objekat A { IdA# }
objekat B { }
objekat C { }

specijalizacija S {
  nadtip A (0,M)
  podtip B (0,1)
  podtip C
}
```

Fix: remove the cardinality from `podtip B`.

<a id="e08"></a>
**E08 - aggregation with fewer than two components**, or a component without a cardinality.

```pmov error=E08
objekat Student { BrojInd# }
objekat Predmet { SifPred# }

agregacija Prijava {
  Student (0,M)
  Predmet
}
```

Fix: give every component a cardinality and list at least two.

<a id="e09"></a>
**E09 - cyclic specialization.** A is a subtype of B and B (directly or through others) is a subtype of A, or an object is its own subtype.

```pmov error=E09
objekat A { IdA# }
objekat B { }
objekat C { }

specijalizacija S1 {
  nadtip A (0,M)
  podtip B
  podtip C
}

specijalizacija S2 {
  nadtip B (0,M)
  podtip A
  podtip C
}
```

Fix: break the loop so that the hierarchy goes only downward.

<a id="e10"></a>
**E10 - object without an identifier.** Every `objekat` that is not a `podtip` needs at least one `#` attribute.

```pmov error=E10
objekat Radnik {
  ImeR : string
}
```

Fix: mark the identifier, `Mlb#`.

<a id="e11"></a>
**E11 - subtype repeats the identifier.** A subtype has an attribute with the same name as an identifier of its supertype. It inherits it, so remove it from the subtype (see [5.5](#55-specijalizacija)).

```pmov error=E11
objekat Osoba { Mlb# }
objekat Student { Mlb }
objekat Radnik { Plata }

specijalizacija Vrsta {
  nadtip Osoba (0,M)
  podtip Student
  podtip Radnik
}
```

<a id="e12"></a>
**E12 - line not allowed in this kind of block.** A participant line inside an `objekat`, or a role word inside an `agregacija`.

```pmov error=E12
objekat A { IdA# }

objekat B {
  IdB#
  A (0,M)
}
```

Fix: connections between objects go into a `veza`, not into an object.

### Warnings (W)

<a id="w01"></a>
**W01 - recursive veza without two mapping names.** Both participants are the same object but at least one line has no mapping name. See [5.2](#52-veza).

```pmov warn=W01
objekat Proizvod { Sifra# }

veza Struktura {
  Proizvod (0,M) Sastavljen
  Proizvod (0,M)
}
```

Fix: name both mappings.

<a id="w02"></a>
**W02 - attribute without a domain.** Allowed, but the Domains tab and the SQL will have a gap (the SQL falls back to `VARCHAR(255)`).

```pmov warn=W02
objekat Radnik {
  Mlb#
}
```

Fix: `Mlb# : long`.

<a id="w03"></a>
**W03 - object in no relationship.** The object is not used by any veza, slab, aggregation or specialization.

```pmov warn=W03
objekat Radnik { Mlb# : long }
```

Fix: connect it, or delete it if you do not need it.

<a id="w04"></a>
**W04 - duplicate attribute.** The same attribute name twice in one block.

```pmov warn=W04
objekat Radnik {
  Mlb# : long
  Ime  : string
  Ime  : string
}
```

Fix: remove the extra one.

---

## 8. Editor tips

| Key | What it does |
|---|---|
| **Tab** | Inserts 2 spaces. With several lines selected, indents all of them. |
| **Shift+Tab** | Removes one level of indentation (up to 2 spaces) from the line or from all selected lines. |
| **Enter** | Starts the new line at the same indentation. After a line ending in `{`, the new line is indented one level more. |
| **`}`** at the start of a line | Moves the brace back to the level of the line with the matching `{`. |
| **Esc**, then **Tab** | Leaves the editor, so keyboard users can move to the next part of the page. A plain Tab stays in the editor. |

Indentation is always 2 spaces, never a tab character. Pasted text is not changed.

Problems appear as red squiggles (errors) or yellow ones (warnings) under the text; hover to read the message. The same messages are listed in the panel below the editor. Click a message to put the cursor on its line. Clicking a shape in the diagram selects its block in the editor, and the other way around.

The **SR | EN** switch in the toolbar changes the language of the buttons, tabs and messages. It never touches your model text, and the keywords you typed stay as they are. Your choice is remembered. Your text is saved in the browser too, so it is still there when you come back.

---

## 9. From model to relational model

The Relational model tab converts the diagram by the FON rules. In short:

| Construct | Becomes |
|---|---|
| `objekat` | a relation with its own attributes; the key is its `#` attributes |
| `podtip` | a relation with the key of its supertype, plus its own attributes |
| `slab` | a relation with the owner's key plus its own `#`; the key is both together |
| `agregacija` | a relation with its attributes and the keys of all components; the key is the key of the first component whose cardinality has GG = 1, or, if there is none, the keys of all components together |
| `specijalizacija` | no relation of its own |
| `veza` | see below |

**Which veza becomes a relation of its own.** Look at the two cardinalities.

* **Both GG are M** (many-to-many): always its own relation.
* **Both DG are 1:** no relation of its own. Each participant whose cardinality is exactly `(1,1)` receives the key of the other side as a foreign key.
* **At least one DG is 0** (and not many-to-many): you choose. By default the foreign key goes into the side with GG = 1 (and may be empty, "nullable"). A switch in the Relational model tab turns this into a separate relation instead.

An attribute that is a foreign key is written in italics, and the key attributes are underlined. In plain text, they are listed after the relation: `key: ...; FK: ...`.

If a relation would get two attributes with the same name (for example from a recursive veza), the borrowed ones are renamed with the mapping name: `SifProizvoda_Sastavljen`, `SifProizvoda_Ugrađen`. This is another reason to name both mappings.

Result for the model in [section 10](#10-full-example):

```
Radnik(Mlb, ImeR, Adresa, Starost, SifOd)               key: Mlb; FK: SifOd
Odeljenje(SifOd, Naziv, Mlb)                             key: SifOd; FK: Mlb
Student(BrojInd, Ime, Smer)                              key: BrojInd
Predmet(SifPred, NazivPred)                              key: SifPred
Nastavnik(ŠifraNast, ImeNast, Zvanje)                    key: ŠifraNast
Isplata(Mlb, Datum, Iznos)                               key: Mlb, Datum
Prijava(BrojInd, SifPred, DatumPol, Ocena, ŠifraNast)    key: BrojInd, SifPred; FK: ŠifraNast
```

Why: `Zapošljavanje` has `(1,1)` and `(0,M)`. A DG is 0, so by default the key of the other side goes where GG = 1: `SifOd` into `Radnik`. `Rukovođenje` is `(0,1)` and `(1,1)`: the holder is `Odeljenje` (`Mlb` goes there). `Overe` puts `ŠifraNast` into `Prijava`. `Isplata` is a weak object, so its key is `Mlb` (from `Radnik`) plus `Datum`.

The SQL tab shows the same model as `CREATE TABLE` statements (`long` becomes `BIGINT`, `short` becomes `SMALLINT`, `string` becomes `VARCHAR(255)`, `date` becomes `DATE`), with the foreign keys added at the end. The Domains tab lists every attribute with its domain and constraint, without the `#`.

---

## 10. Full example

The same model, first with Serbian keywords and then with English ones.

### Serbian

```pmov
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

### English

```pmov
// ---------- objects ----------
object Employee {
  EmpNo#  : long NotNull
  EmpName : string
  Address : string
  Age     : short Between 15,65
}

object Department {
  DeptNo#  : short Mod_11
  DeptName : string
}

object Student { IndexNo#, Name, Major }
object Course  { CourseNo#, CourseName }
object Teacher { TeacherNo#, TeacherName, Title }

// ---------- relationships ----------
relationship Employment {
  Employee   (1,1) WorksIn
  Department (0,M) Employs
}

relationship Management {
  Employee   (0,1) Manages
  Department (1,1) ManagedBy
}

// ---------- weak object ----------
weak Payment {
  owner Employee (0,M)
  Date#  : date
  Amount : long
}

// ---------- aggregation ----------
aggregation ExamRegistration {
  Student (0,M)
  Course  (0,M)
  ExamDate : date
  Grade    : short Between 5,10
}

relationship Certifies {
  ExamRegistration (1,1)
  Teacher          (0,M)
}
```
