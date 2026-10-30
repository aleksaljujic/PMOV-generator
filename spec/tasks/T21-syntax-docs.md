# T21 — DSL syntax documentation

**Wave:** 6 (one small agent). **Folder (owns everything inside):** `docs/` (new).
**Extra edit rights:** a single link line at the top of the "The DSL" section of the root `README.md`. Nothing else
in README.
**Sources of truth (read-only):** `spec/requrement.md` (DSL, checks), `spec/fix_editor.md` (aliases, English
option, Tab), contracts C01 (diagnostic codes and their sr/en messages), C02 (lexical rules, grammar
disambiguation, keyword aliases), C03 (IR build rules), C04 (relational-model rules), and `src/examples/index.ts`.

## Goal

A user-facing reference for the PMOV DSL in `docs/syntax.md`, in English. It is written for a student who knows
PMOV/ER from the FON course but has never used this program. Someone should be able to write a correct model
from this page alone.

## Content

1. **Quick start:** a minimal model of 2 objects and 1 veza, and what it draws.
2. **Lexical basics:**
   - names (Serbian letters, quoted names with spaces) and case sensitivity;
   - `//` comments;
   - one line = one attribute or participant, commas for several attributes, single-line blocks `{ A#, B }`.
3. **Block kinds**, one section each, with syntax, rules and a small example:
   - `objekat`, `veza` (including the `_` name and recursive veza with mapping names);
   - `slab` (`nadređeni` / `nadredjeni`);
   - `agregacija` (also as a participant in a veza);
   - `specijalizacija` (`nadtip` / `podtip`, inheritance of the identifier).
   Each rule links to the error code that enforces it.
4. **Attributes:**
   - `#` (identifier / partial identifier);
   - domains `long short string date`;
   - constraint text after the domain, including commas and parentheses (`Between 15,65`, `In(a, b)`).
5. **Participants:** `[role] Name (DG,GG) [MappingName]`. Cover the allowed cardinalities (DG ∈ {0,1},
   GG ∈ {1,M}, DG ≤ GG), the direction of the cardinality for veza, slab and specijalizacija, and how the parser
   tells a participant from an attribute.
6. **Keywords table:** Serbian keyword, accepted alternative spellings (`nadredjeni`), English keyword. Mixing is
   allowed, and keywords are case-sensitive.
7. **Diagnostics reference:** every S, E and W code with a one-line meaning, a minimal wrong example and the fix.
8. **Editor tips:** Tab / Shift+Tab, Esc then Tab, auto-indent, error squiggles, clicking an error, the SR | EN
   switch. Also note that the language switch never changes the source.
9. **From model to relational model:** a short summary of how each construct becomes relations (C04), with the
   main example's result.
10. **Full example:** the main example in Serbian and in English keywords, side by side or one after the other.

Keep it practical: short paragraphs, many small examples, tables where they help. No implementation details
(no file names or function names).

## Verification (required)

Every code block marked as valid must compile with **zero errors** (warnings allowed only where the text says
so). Every "wrong" example must produce exactly the error code the text names. Check this with a throwaway test
file, for example `src/zz_docs_check.test.ts`, that extracts the fenced `pmov` blocks from `docs/syntax.md` and
runs `compile` on each. Use fence info strings ```` ```pmov ```` for valid blocks and ```` ```pmov error=E06 ````
for wrong ones. **Delete the throwaway test before finishing**, and record the result in the session log.

## Definition of done

- [ ] `docs/syntax.md` covers every item under Content.
- [ ] All code blocks verified as above; the throwaway test deleted.
- [ ] One link line added in README; nothing else in README changed.
- [ ] `npm test` is unchanged versus before (no new failures).
- [ ] Session log `spec/sessions/T21.md`; Status filled in below.

## Status

Done. `docs/syntax.md` covers all 10 content items. 54 `pmov` blocks verified with a throwaway test (deleted):
23 valid (zero errors), 26 `error=` (each produces exactly the named code; S02 also yields a follow-up S01), 5 `warn=`.
README link line added. Full suite: only the known `src/render/layout` failures.
