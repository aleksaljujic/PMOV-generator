// FILE: src/rm/types.ts
// CONTRACT C04 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Domain } from '../lang/ir';

/** How a veza with DG=0 (and not M:N) is translated. Default 'fk'. */
export type Dg0Mode = 'fk' | 'relation';

export interface RmOptions {
  dg0Mode: Dg0Mode;
}

export const DEFAULT_RM_OPTIONS: RmOptions = { dg0Mode: 'fk' };

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
}

export interface DomainRow {
  attribute: string;   // without '#'
  domain: string;      // '–' (U+2013) when missing
  constraint: string;  // '–' when missing
}
