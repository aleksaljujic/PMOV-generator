# Fix: editor Tab, `nadredjeni` spelling, English language option

Three changes, all small to medium and independent of each other:

1. **Tab in the editor** indents the text instead of moving focus out of the editor.
2. **`nadredjeni`** (written with `dj`) is accepted everywhere `nadređeni` is.
3. **English option**: the whole program (UI, diagnostics, DSL keywords, builder) can be switched to English.

Work split: Wave 4 tasks T14–T19 (parallel) and T20 (acceptance), see [`tasks/README.md`](tasks/README.md). The
contract changes and frozen code (Wave 0) are done: CHANGELOG 2026-10-30.

This document extends [`requrement.md`](requrement.md) and [`feature_interactive_pmov.md`](feature_interactive_pmov.md).
Everything in them still applies unless stated otherwise here.

---

## 1. Tab in the editor

**Today:** `src/ui/editor/Editor.tsx` uses `defaultKeymap` without `indentWithTab`, so pressing Tab moves the focus
to the next element on the page. The PMOV language (`pmovLanguage.ts`) also has no indentation rules, so Enter
after `{` does not indent the next line.

**Required behaviour:**

| Key | Effect |
|---|---|
| **Tab** | No selection: inserts 2 spaces at the cursor (the indent unit used by every example). Selection over one or more lines: indents every selected line by 2 spaces. |
| **Shift+Tab** | Removes one indent level (up to 2 spaces) from the current line or from every selected line. |
| **Enter** | New line keeps the current indentation. After a line ending in `{` the new line is indented by one more level. |
| **`}`** typed at the start of a line (only whitespace before it) | The line is dedented to the level of the matching `{` line. |
| **Esc, then Tab** | Moves focus out of the editor (CodeMirror's standard escape hatch, so keyboard users are not trapped). |

The indent unit is 2 spaces, never a tab character. Pasted text is not changed.

**Implementation notes (T07, `src/ui/editor/`):**

- Add `indentWithTab` (from `@codemirror/commands`) to the keymap and `indentUnit.of('  ')`.
- Give `pmovParser` an `indent` function: one level per open `{` on the lines above, minus one when the line
  starts with `}`; and `languageData.indentOnInput: /^\s*\}$/` so `indentOnInput()` dedents a typed `}`.
- Interaktivno mode is unaffected (the editor is hidden there).

**Tests:** Tab with no selection inserts 2 spaces; Tab and Shift+Tab over a 3-line selection; Enter after
`objekat Radnik {` gives a 2-space indent; typing `}` dedents; existing editor tests stay green.

---

## 2. `nadredjeni` as an alternative spelling of `nadređeni`

Many students type without Serbian diacritics, so `nadredjeni` must work exactly like `nadređeni`.

```
slab Dete {
  nadredjeni Radnik (0,M)
  Rb#
}
```

**Rules:**

- The parser accepts `nadredjeni` wherever the role `nadređeni` is accepted. In the AST and IR the role is
  always the canonical `nadređeni`, so the checker, RM, graph, layout and SQL need no changes.
- Matching is case-sensitive, like all other keywords.
- The participant rule from `requrement.md` ("a line is a participant if it has a cardinality or starts with a
  role keyword") counts `nadredjeni` as a role keyword.
- The editor highlights `nadredjeni` as a role (`modifier`), same as `nadređeni`.
- Diagnostics that mention the role (for example E06) keep using the canonical spelling `nadređeni`.
- The source text is never rewritten: a user who typed `nadredjeni` keeps seeing `nadredjeni`.
- The grammar in `requrement.md` becomes `uloga = "nadređeni" | "nadredjeni" | "nadtip" | "podtip" ;`.

**Where:**

- `src/lang/ast.ts` (frozen, **done**): `ROLE_ALIASES` (with `nadredjeni` → `nadređeni`) and `canonicalRole(word)`.
- `src/lang/syntax/parser.ts` (T01): the two role checks (the participant-start test and the participant
  parser, around lines 199 and 211) look up `ROLES` **or** `ROLE_ALIASES` and store the canonical role.
- `src/ui/editor/pmovLanguage.ts` (T07): the roles set includes the alias keys.

**Tests:** parsing a slab with `nadredjeni` gives the same AST (except spans) as with `nadređeni`; golden fixtures
are unchanged; a highlighting test for the alias.

---

## 3. English language option

### What the user sees

- A switch **"SR | EN"** in the toolbar. The choice is remembered in localStorage (`pmov.lang.v1`, default `sr`,
  so existing users see no change). Switching takes effect immediately and does **not** change the DSL source.
- With **EN** selected, everything the program says is in English:
  - toolbar, buttons, menus, dialogs, banners, tooltips, empty states (for example *"Primeri"* → *"Examples"*,
    *"Novi dijagram"* → *"New diagram"*, *"Tekst | Interaktivno"* → *"Text | Interactive"*,
    *"Poništi / Ponovi"* → *"Undo / Redo"*);
  - output tab names and contents: *Dijagram, Domeni, Relacioni model, SQL* → *Diagram, Domains, Relational
    model, SQL*; Domains table headers *ATRIBUT | DOMEN | OGRANIČENJE* → *ATTRIBUTE | DOMAIN | CONSTRAINT*;
    *"Kopiraj kao tekst"* → *"Copy as text"*;
  - error panel and every diagnostic message (S, E and W codes). The format becomes
    `error E02 (line 3, col 5): …` instead of `greška E02 (red 3, kol 5): …`. **Codes stay the same** in both
    languages;
  - interactive builder: element menu (*Object, Relationship, Weak object, Aggregation, Specialization*),
    inline editors, hints (*"Add an identifier (#)"*), confirm dialogs;
  - examples in the "Examples" menu: titles are translated; see "Examples" below for content.
- The SVG/PNG export contains only diagram content (user names), so it is the same in both languages.

### English DSL keywords

The DSL accepts English keywords **in both UI languages**. Serbian and English keywords can be mixed in one source.

| Serbian (canonical) | English alias |
|---|---|
| `objekat` | `object` |
| `veza` | `relationship` |
| `slab` | `weak` |
| `specijalizacija` | `specialization` |
| `agregacija` | `aggregation` |
| `nadređeni` / `nadredjeni` | `owner` |
| `nadtip` | `supertype` |
| `podtip` | `subtype` |

Domains (`long`, `short`, `string`, `date`) are already English and stay as they are.

Same mechanism as section 2: aliases are resolved in the parser, the AST and IR keep the canonical Serbian kinds and
roles, nothing downstream changes, and the source text is never rewritten. A user name that equals an English
keyword follows the same rules as a name that equals a Serbian keyword today: right after the block keyword it is
accepted (`objekat object { … }` compiles), but it is confusing and the docs advise against it. `Object`
(capitalised) is always a plain name. Add a check in the T01 tests that the golden fixtures don't use any of
the new words as names.

Example in English:

```
object Employee {
  EmpNo# : long
  Name : string
}

weak Child {
  owner Employee (0,M)
  No#
}
```

### Builder in EN mode

- New blocks are written with the keywords of the **selected UI language** (`object`, `weak`, `owner`, …).
  Existing blocks keep their spelling.
- Placeholder names in EN: `ObjectN`, `WeakN`, `AggregationN`, `KindN`, `SubtypeN` (instead of `ObjekatN`,
  `SlabN`, `AgregacijaN`, `VrstaN`, `PodtipN`); the default partial identifier of a new weak object is `No#`
  instead of `Rb#`. Placeholder detection (grey italics) recognises both languages' placeholders.

### Examples

The four examples (`osnovni`, `specijalizacija`, `biblioteka`, `proizvodnja`) have an English version (English
keywords and English names, for example `Radnik` → `Employee`) in the optional fields `titleEn` / `sourceEn`
(**done**, frozen `src/examples/index.ts`). The "Examples" menu loads the version matching the selected language.
`EXAMPLES` keeps its existing entries and indices.

### Architecture

- **No shared dictionary module.** `Locale` (`'sr' | 'en'`) lives in the frozen `src/lang/diagnostics.ts`. Each
  folder keeps its UI strings in its own `strings.ts` with an `sr` and an `en` table, and a test checks that both
  tables have the same keys. This way the agents don't have to agree on shared string keys and can work in
  parallel.
- **Diagnostics:** `lex` / `parse` / `compile(source, options?: LangOptions)` with an optional `locale` (default
  `'sr'`). The parser and checker build their messages from a per-code table for each language.
  `formatDiagnostic(d, locale?)` uses `greška/upozorenje, red, kol` or `error/warning, line, col`. Default
  behaviour and all existing tests stay unchanged (additive to C01, C02 and C03).
- **Keywords:** `BLOCK_KIND_ALIASES`, `ROLE_ALIASES`, `canonicalBlockKind`, `canonicalRole` (for parsing) and
  `BLOCK_KIND_KEYWORDS`, `ROLE_KEYWORDS` (for generating text) are in the frozen `src/lang/ast.ts`.
- **UI:** the shell keeps the locale state (`loadLang`/`saveLang` in `storage.ts`, `STORAGE_KEYS.lang`) and passes
  `locale` to `compile`, `Toolbar`, `Tabs`, `ErrorPanel`, `DiagramView`, the Editor and the builder.
- **Builder (`src/builder/`):** operations take the locale to choose keywords and placeholder names.
- The `<html lang>` attribute follows the selected language.

### Tests

- Every UI string key exists in both dictionaries.
- Every diagnostic code has a message in both languages; compiling the error fixtures with `locale: 'en'` gives the
  same codes and spans as with `'sr'`.
- Each English example compiles without errors and gives the same IR shape (same kinds, cardinalities and
  identifiers) as its Serbian version.
- A source using only English keywords compiles to the same IR as its Serbian version.
- App test: switching to EN changes toolbar, tabs and error panel text, keeps the source, and survives a reload.
- Builder test: in EN mode "+ → Weak object" inserts `weak Weak1 { owner X (0,M) No# }`.

---

## Contract changes (summary, all done in Wave 0)

All changes are **additive**; defaults keep today's behaviour. CHANGELOG entry 2026-10-30.

| Contract | Change |
|---|---|
| C00 | Language-of-text rule; Wave 4 task-to-folder list. |
| C01 | `Locale`, `LangOptions`, `formatDiagnostic(d, locale?)`; §English messages (templates filled in by T15 / T16). |
| C02 | `BLOCK_KIND_ALIASES`, `ROLE_ALIASES`, `canonicalBlockKind`, `canonicalRole`, `BLOCK_KIND_KEYWORDS`, `ROLE_KEYWORDS`; §Keyword aliases; `lex` / `parse(source, options?)`. |
| C03 | `compile(source, options?)`. |
| C08 | Editor Tab/indent behaviour and `locale`; `locale` on tabs, ErrorPanel, DiagramView, Toolbar; `STORAGE_KEYS.lang`; `Example.titleEn` / `sourceEn`; English UI strings table. |
| C09 | `applyBuilderAction(…, options?)`, `locale` on `placeholderName` / `pickRejection` / `UseBuilderOptions`; English placeholders. |

## Tasks

| Task | Folder | Part of this spec |
|---|---|---|
| [T14](tasks/T14-editor-tab-and-locale.md) | `src/ui/editor` | §1, highlighting for §2 / §3, lint message locale |
| [T15](tasks/T15-parser-aliases-and-messages.md) | `src/lang/syntax` | §2 and the English keywords, S-messages |
| [T16](tasks/T16-semantic-english-messages.md) | `src/lang/semantic` | E/W messages, `compile` locale |
| [T17](tasks/T17-tabs-locale.md) | `src/ui/tabs` | tabs in English |
| [T18](tasks/T18-builder-locale.md) | `src/builder` + `src/ui/builder` | builder in EN mode |
| [T19](tasks/T19-shell-language-switch.md) | `src/ui/shell` (+ `src/render/flow`) | SR \| EN switch, wiring, examples menu, README |
| [T20](tasks/T20-acceptance-editor-and-english.md) | `e2e/` | acceptance |
