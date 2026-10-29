# C03 — PMOV IR and `compile()`

Owner: **T02**. Consumers: T03 (RM), T04 (diagram graph), T06 (renderSvg), T08 (tabs), T09 (app).

The IR is plain JSON (no classes, no coordinates). It is the **only** input of every output generator.

## Contract code

```ts
// FILE: src/lang/ir.ts
// CONTRACT C03 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Diagnostic, SourceSpan } from './diagnostics';
import type { Domain, ModelAst } from './ast';

export type { Domain } from './ast';

export type ElementKind = 'objekat' | 'slab' | 'veza' | 'specijalizacija' | 'agregacija';

export interface Cardinality {
  min: 0 | 1;
  /** `m` in source is normalized to `M`. */
  max: 1 | 'M';
}

export interface IRAttribute {
  /** Without the `#`. */
  name: string;
  isId: boolean;
  domain: Domain | null;
  constraint: string | null;
  span: SourceSpan;
}

export interface IRParticipant {
  /** Element id of the referenced objekat / slab / agregacija (always resolvable in the same IR). */
  ref: string;
  /** Cardinality of the mapping FROM `ref` TOWARD the other side (veza) / the aggregation / the slab. */
  card: Cardinality;
  mapping: string | null;
  span: SourceSpan;
}

interface IRElementBase {
  /** Unique, stable id. Named element → its name verbatim (quoted names keep spaces). Unnamed veza → `_#1`, `_#2`, … in source order. */
  id: string;
  /** Display name; '' for an unnamed veza. */
  name: string;
  /** Whole block (kind keyword … closing brace). */
  span: SourceSpan;
  nameSpan: SourceSpan;
}

export interface IRObject extends IRElementBase {
  kind: 'objekat';
  attributes: IRAttribute[];
}

export interface IRSlab extends IRElementBase {
  kind: 'slab';
  /** nadređeni; `card` is nadređeni → slab. slab → nadređeni is implicitly (1,1). */
  owner: IRParticipant | null;
  attributes: IRAttribute[];
}

export interface IRAggregation extends IRElementBase {
  kind: 'agregacija';
  /** `card` is component → aggregation. */
  components: IRParticipant[];
  attributes: IRAttribute[];
}

export interface IRRelationship extends IRElementBase {
  kind: 'veza';
  /** Exactly 2 in a valid model; may be any count when the model has errors. */
  participants: IRParticipant[];
}

export interface IRSpecialization extends IRElementBase {
  kind: 'specijalizacija';
  supertype: IRParticipant | null;
  subtypes: { ref: string; span: SourceSpan }[];
}

export type IRElement = IRObject | IRSlab | IRAggregation | IRRelationship | IRSpecialization;

export interface PmovIR {
  /** One per block, in source order. */
  elements: IRElement[];
}

export interface CompileResult {
  /** Partial AST is returned even on syntax errors; null never happens in practice but consumers must accept it. */
  ast: ModelAst | null;
  /** null iff there is at least one S-code diagnostic. Otherwise a best-effort IR, even with E-codes. */
  ir: PmovIR | null;
  /** Syntax + semantic diagnostics, sorted by span.from. */
  diagnostics: Diagnostic[];
  /** true iff any diagnostic has severity 'error'. */
  hasErrors: boolean;
}
```

## Functions

```ts
// src/lang/semantic/index.ts   (exported via src/lang)
export function compile(source: string): CompileResult;   // parse → (if no S-codes) check + buildIr

// src/lang/semantic/query.ts   (pure helpers; T00 writes them verbatim, T02 owns them afterwards)
export function getElement(ir: PmovIR, id: string): IRElement | undefined;
/** Innermost element whose block span contains the offset (from <= offset <= to), else null. */
export function findElementAtOffset(ir: PmovIR, offset: number): string | null;
/** Direct supertype id of `id` (first spec listing it as podtip), else null. */
export function supertypeOf(ir: PmovIR, id: string): string | null;
export function isSubtype(ir: PmovIR, id: string): boolean;

// src/lang/index.ts — FROZEN barrel: export * from diagnostics, ast, ir, ./syntax, ./semantic
```

```ts
// FILE: src/lang/semantic/query.ts
import type { IRElement, PmovIR } from '../ir';

export function getElement(ir: PmovIR, id: string): IRElement | undefined {
  return ir.elements.find((e) => e.id === id);
}

export function findElementAtOffset(ir: PmovIR, offset: number): string | null {
  let best: IRElement | null = null;
  for (const e of ir.elements) {
    if (e.span.from <= offset && offset <= e.span.to) {
      if (!best || e.span.to - e.span.from < best.span.to - best.span.from) best = e;
    }
  }
  return best ? best.id : null;
}

export function supertypeOf(ir: PmovIR, id: string): string | null {
  for (const e of ir.elements) {
    if (e.kind === 'specijalizacija' && e.supertype && e.subtypes.some((s) => s.ref === id)) {
      return e.supertype.ref;
    }
  }
  return null;
}

export function isSubtype(ir: PmovIR, id: string): boolean {
  return supertypeOf(ir, id) !== null;
}
```

## IR build rules (T02)

- One element per block in source order, **including blocks that have semantic errors** (best effort, so the
  diagram can show them with a red outline). Exception: a block whose name duplicates an earlier block (E01)
  is dropped.
- `veza` named `_` → `name: ''`, `id: '_#N'` (N = 1-based count of unnamed vezas so far).
- Participants are **dropped** from the IR when their reference does not resolve to an objekat/slab/agregacija
  (E02) or their cardinality is invalid (E03), or they lack a required cardinality.
- `veza.participants` = all participant lines (roles ignored) that survived the rule above.
- `slab.owner` = first `nadređeni` participant that survived, else null.
- `specijalizacija.supertype` = first `nadtip` participant that survived; `subtypes` = `podtip` lines whose ref
  resolves.
- `agregacija.components` = participant lines that survived.
- `objekat` ignores participant lines (E12 is reported).
- Constraint text and domain copied from the AST; `#` → `isId: true`.
- Diagnostics sorted by `span.from`, then code.

## Golden fixtures (T00 writes verbatim; every consumer tests against these)

```ts
// FILE: src/fixtures/ir.ts
import { NO_SPAN } from '../lang/diagnostics';
import type { IRAttribute, IRParticipant, PmovIR } from '../lang/ir';

const a = (
  name: string,
  isId = false,
  domain: IRAttribute['domain'] = null,
  constraint: string | null = null,
): IRAttribute => ({ name, isId, domain, constraint, span: NO_SPAN });

const p = (ref: string, min: 0 | 1, max: 1 | 'M', mapping: string | null = null): IRParticipant => ({
  ref, card: { min, max }, mapping, span: NO_SPAN,
});

const base = (id: string) => ({ id, name: id, span: NO_SPAN, nameSpan: NO_SPAN });

/** IR of EXAMPLES[0] ("Osnovni primer"). compile(EXAMPLES[0].source).ir must deep-equal this modulo spans. */
export const MAIN_EXAMPLE_IR: PmovIR = {
  elements: [
    { ...base('Radnik'), kind: 'objekat', attributes: [
      a('Mlb', true, 'long', 'NotNull'), a('ImeR', false, 'string'), a('Adresa', false, 'string'),
      a('Starost', false, 'short', 'Between 15,65'),
    ] },
    { ...base('Odeljenje'), kind: 'objekat', attributes: [a('SifOd', true, 'short', 'Moduo_11'), a('Naziv', false, 'string')] },
    { ...base('Student'), kind: 'objekat', attributes: [a('BrojInd', true), a('Ime'), a('Smer')] },
    { ...base('Predmet'), kind: 'objekat', attributes: [a('SifPred', true), a('NazivPred')] },
    { ...base('Nastavnik'), kind: 'objekat', attributes: [a('ŠifraNast', true), a('ImeNast'), a('Zvanje')] },
    { ...base('Zapošljavanje'), kind: 'veza', participants: [p('Radnik', 1, 1, 'Radi'), p('Odeljenje', 0, 'M', 'Zapošljava')] },
    { ...base('Rukovođenje'), kind: 'veza', participants: [p('Radnik', 0, 1, 'Rukovodi'), p('Odeljenje', 1, 1, 'Rukovođeno')] },
    { ...base('Isplata'), kind: 'slab', owner: p('Radnik', 0, 'M'), attributes: [a('Datum', true, 'date'), a('Iznos', false, 'long')] },
    { ...base('Prijava'), kind: 'agregacija', components: [p('Student', 0, 'M'), p('Predmet', 0, 'M')],
      attributes: [a('DatumPol', false, 'date'), a('Ocena', false, 'short', 'Between 5,10')] },
    { ...base('Overe'), kind: 'veza', participants: [p('Prijava', 1, 1), p('Nastavnik', 0, 'M')] },
  ],
};

/** IR of EXAMPLES[1] ("Specijalizacija i rekurzivna veza"). */
export const SPEC_EXAMPLE_IR: PmovIR = {
  elements: [
    { ...base('Građanin'), kind: 'objekat', attributes: [a('Mlb', true, 'long'), a('Ime', false, 'string'), a('Starost', false, 'short')] },
    { ...base('Student'), kind: 'objekat', attributes: [a('BrojInd', false, 'string'), a('Semestar', false, 'short')] },
    { ...base('Radnik'), kind: 'objekat', attributes: [a('Plata', false, 'long')] },
    { ...base('Dete'), kind: 'objekat', attributes: [a('Dodatak', false, 'long')] },
    { ...base('Penzioner'), kind: 'objekat', attributes: [a('Penzija', false, 'long')] },
    { ...base('Proizvod'), kind: 'objekat', attributes: [a('SifProizvoda', true), a('NazivProizvoda')] },
    { ...base('Vrsta'), kind: 'specijalizacija', supertype: p('Građanin', 0, 'M'), subtypes: [
      { ref: 'Student', span: NO_SPAN }, { ref: 'Radnik', span: NO_SPAN },
      { ref: 'Dete', span: NO_SPAN }, { ref: 'Penzioner', span: NO_SPAN },
    ] },
    { ...base('Struktura'), kind: 'veza', participants: [p('Proizvod', 0, 'M', 'Sastavljen'), p('Proizvod', 0, 'M', 'Ugrađen')] },
  ],
};

/** Strip spans recursively so compile() output can be compared with the fixtures above. */
export function stripSpans<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'span' || k === 'nameSpan' ? undefined : v))) as T;
}
```

Expected diagnostics for the examples: `MAIN` → no errors, W02 for every attribute without domain;
`SPEC` → no errors, W02 for `SifProizvoda`, `NazivProizvoda`. (W01 does not fire: both mapping names present.)
