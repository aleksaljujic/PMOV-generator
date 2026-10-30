// FILE: src/lang/ir.ts
// CONTRACT C03 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Diagnostic, SourceSpan } from './diagnostics';
import type { ConstraintAction, ConstraintOp, Domain, ModelAst } from './ast';

export type { Domain, ConstraintAction, ConstraintOp } from './ast';

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
  /** Built-in type. For a user domain this is the domain's RESOLVED built-in base (null if unresolvable). */
  domain: Domain | null;
  /** The attribute's own constraint (a user domain's constraint is in `PmovIR.domains`). */
  constraint: string | null;
  span: SourceSpan;
  /** C10: user domain name. Key present ONLY when non-null (omit-when-empty, keeps old golden IR equal). */
  userDomain?: string | null;
  /** C10: own length (`string(40)`), else the resolved length of `userDomain`. Key present ONLY when non-null. */
  length?: number | null;
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
  /** C10: user domains in source order. Key present ONLY when non-empty (omit-when-empty). */
  domains?: IRDomain[];
  /** C10: cross-table constraints in source order. Key present ONLY when non-empty. */
  constraints?: IRConstraint[];
}

// ---------- C10: domains and cross-table constraints ----------

export interface IRDomain {
  /** Unique (domains have their own namespace). */
  name: string;
  /** Naddomen name, or null when the base is a built-in type. */
  parent: string | null;
  /** Resolved built-in type through the parent chain; null when unresolvable (E13/E15). */
  base: Domain | null;
  /** Own length, else inherited; null when none. */
  length: number | null;
  /** Own constraint text, null when absent. */
  constraint: string | null;
  /** Parent's effective constraint `And` own (either part may be missing); null when both are absent. */
  effectiveConstraint: string | null;
  span: SourceSpan;
  nameSpan: SourceSpan;
}

export interface IRConstraintRule {
  /** Relation name: element name with spaces removed. */
  relation: string;
  op: ConstraintOp;
  action: ConstraintAction;
  span: SourceSpan;
}

interface IRConstraintBase {
  /** Constraint name (own namespace, unique). */
  id: string;
  name: string;
  /** Only valid rules (E17 ones are dropped), in source order. */
  rules: IRConstraintRule[];
  span: SourceSpan;
  nameSpan: SourceSpan;
}

export interface IRReferentialConstraint extends IRConstraintBase {
  kind: 'referential';
  /** Relation names (spaces removed). */
  child: string;
  parent: string;
  /** FK attribute names of the child as written; null when omitted. */
  childAttrs: string[] | null;
  headerSpan: SourceSpan;
}

export interface IRGeneralConstraint extends IRConstraintBase {
  kind: 'general';
  /** Raw condition text. */
  condition: string;
  conditionSpan: SourceSpan;
  /** `Relation.Attribute` references found in the condition, in order (span = the reference in the source). */
  refs: { relation: string; attribute: string; span: SourceSpan }[];
}

export type IRConstraint = IRReferentialConstraint | IRGeneralConstraint;

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
