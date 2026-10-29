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
