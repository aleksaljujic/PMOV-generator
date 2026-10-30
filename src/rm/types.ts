// FILE: src/rm/types.ts
// CONTRACT C04 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { ConstraintAction, ConstraintOp, Domain } from '../lang/ir';
import type { Diagnostic, Locale } from '../lang/diagnostics';

/** How a veza with DG=0 (and not M:N) is translated. Default 'fk'. */
export type Dg0Mode = 'fk' | 'relation';

export interface RmOptions {
  dg0Mode: Dg0Mode;
  /** C10: language of `RelationalModel.diagnostics` messages. Default 'sr'. */
  locale?: Locale;
}

export const DEFAULT_RM_OPTIONS: RmOptions = { dg0Mode: 'fk' };

/** C11: target database of `generateSql`. 'postgres' gives the pre-C11 output byte for byte. */
export type SqlDialect = 'postgres' | 'mssql' | 'oracle';
/** C11: in UI order. */
export const SQL_DIALECTS: readonly SqlDialect[] = ['postgres', 'mssql', 'oracle'];
export const DEFAULT_SQL_DIALECT: SqlDialect = 'postgres';

export interface RelAttribute {
  /** Spaces removed. Unique within the relation (see collision rule). */
  name: string;
  domain: Domain | null;
  constraint: string | null;
  /** Part of the primary key. */
  pk: boolean;
  /** Borrowed from another relation (references !== null). */
  fk: boolean;
  /** Only FK attributes can be nullable (holder side has DG = 0). */
  nullable: boolean;
  /** C10: user domain of the source attribute (SQL column type). Key present ONLY when non-null. */
  userDomain?: string | null;
  /** C10: length of the source attribute (`string(40)`). Key present ONLY when non-null. */
  length?: number | null;
  references: {
    relation: string;
    /** Attribute name in the referenced relation. */
    attribute: string;
    /** Attributes sharing a group form ONE (possibly composite) foreign key. */
    group: string;
  } | null;
}

export interface Relation {
  /** Spaces removed from the element name. */
  name: string;
  /** IR element that produced it. */
  elementId: string;
  attributes: RelAttribute[];
}

export interface RelationalModel {
  relations: Relation[];
  /** C10: one per foreign key (group), in relation order then FK order. Key present ONLY when non-empty. */
  referential?: ReferentialConstraint[];
  /** C10: general constraints in source order. Key present ONLY when non-empty. */
  general?: GeneralConstraint[];
  /** C10: E18, E19, E20, W06 (C01 format, `elementId: null`). Key present ONLY when non-empty. */
  diagnostics?: Diagnostic[];
}

// ---------- C10: cross-table constraints ----------

/** The four configurable cells of a referential constraint (FON table). Child DELETE and parent INSERT are always `/`. */
export type RefCell = 'childInsert' | 'childUpdate' | 'parentUpdate' | 'parentDelete';
export const REF_CELLS: readonly RefCell[] = ['childInsert', 'childUpdate', 'parentUpdate', 'parentDelete'];

/**
 * regular: plain FK. nullable: FK with nullable=true. identifying: FK ⊆ PK of a slab or podtip relation.
 * component: FK ⊆ PK of an agregacija or a veza that became a relation.
 */
export type FkKind = 'regular' | 'nullable' | 'identifying' | 'component';

export const DEFAULT_REF_ACTIONS: Readonly<Record<FkKind, Readonly<Record<RefCell, ConstraintAction>>>> = {
  regular:     { childInsert: 'restricted', childUpdate: 'restricted', parentUpdate: 'cascades', parentDelete: 'restricted' },
  nullable:    { childInsert: 'restricted', childUpdate: 'restricted', parentUpdate: 'cascades', parentDelete: 'nullifies' },
  identifying: { childInsert: 'restricted', childUpdate: 'restricted', parentUpdate: 'cascades', parentDelete: 'cascades' },
  component:   { childInsert: 'restricted', childUpdate: 'restricted', parentUpdate: 'cascades', parentDelete: 'restricted' },
};

/** Syntactically allowed actions per cell (E17 otherwise). `nullifies` additionally needs a nullable FK (E19). */
export const ALLOWED_REF_ACTIONS: Readonly<Record<RefCell, readonly ConstraintAction[]>> = {
  childInsert: ['restricted', 'nullifies', 'default'],
  childUpdate: ['restricted', 'nullifies', 'default'],
  parentUpdate: ['restricted', 'cascades', 'nullifies', 'default'],
  parentDelete: ['restricted', 'cascades', 'nullifies', 'default'],
};

export interface ReferentialConstraint {
  /** Block name when explicit, else `fk_<Child>_<Parent>` (+ `_2`, `_3` … when repeated). Also the SQL constraint name. */
  name: string;
  /** IR constraint id of the `ograničenje` block; null for a derived (default-only) constraint. */
  constraintId: string | null;
  child: string;
  parent: string;
  /** FK attributes in the child, in order. */
  attributes: string[];
  /** Referenced attributes in the parent, same order. */
  referenced: string[];
  /** `RelAttribute.references.group` of this FK. */
  group: string;
  fkKind: FkKind;
  /** Resolved actions: explicit where given, defaults (DEFAULT_REF_ACTIONS[fkKind]) elsewhere. */
  actions: Record<RefCell, ConstraintAction>;
  /** Cells set by the block (empty for a derived constraint). */
  explicitCells: RefCell[];
}

export interface GeneralConstraint {
  name: string;
  constraintId: string;
  condition: string;
  /** Operations to check, grouped per relation in first-appearance order. */
  checks: { relation: string; ops: ConstraintOp[] }[];
}

/** Row of the "Struktura domena" table. */
export interface DomainStructureRow {
  domain: string;
  /** Built-in type or naddomen name. */
  base: string;
  /** '–' when none. */
  length: string;
  /** Own constraint, '–' when none. */
  constraint: string;
  /** Effective constraint of the naddomen; null for a domain on a built-in type or when the parent has none. */
  inherited: string | null;
}

export interface DomainRow {
  attribute: string;   // without '#'
  domain: string;      // '–' (U+2013) when missing
  constraint: string;  // '–' when missing
}
