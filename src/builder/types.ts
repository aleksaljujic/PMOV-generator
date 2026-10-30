// Types of contract C09 (pure part). No React.
import type { ConstraintAction, ConstraintOp, Domain, ElementKind, Locale } from '../lang';
import type { RefCell } from '../rm/types';

export interface BuilderOptions {
  locale?: Locale;
}

export interface AttributeSpec {
  name: string;
  id: boolean;
  domain?: Domain | null;
  constraint?: string | null;
  /** C10: user domain as the type (wins over `domain`). */
  userDomain?: string | null;
  /** C10: `string(n)`; only used with `domain: 'string'`. */
  length?: number | null;
}

/** C10: a `domen` line. `base` is a built-in type or the name of another domain (naddomen). */
export interface DomainSpec {
  name: string;
  base: string;
  length?: number | null;
  constraint?: string | null;
}

/** C10: a general (`uslov`) constraint. */
export interface GeneralConstraintSpec {
  name: string;
  condition: string;
  checks: { relation: string; ops: ConstraintOp[] }[];
}
export type NewObject = { newObject: true };

export type BuilderAction =
  | { kind: 'newModel' }
  | { kind: 'addObject'; near: string }
  | { kind: 'addVeza'; from: string; to: string | NewObject }
  | { kind: 'addSlab'; parent: string }
  | { kind: 'addAgregacija'; first: string; second: string | NewObject }
  | { kind: 'addComponent'; agregacija: string; component: string | NewObject }
  | { kind: 'addSpecijalizacija'; nadtip: string }
  | { kind: 'addPodtip'; specijalizacija: string; podtip: string | NewObject }
  | { kind: 'removePodtip'; specijalizacija: string; podtip: string; withDependents: boolean }
  | { kind: 'addAttribute'; owner: string; attr: AttributeSpec }
  | { kind: 'editAttribute'; owner: string; index: number; attr: AttributeSpec }
  /** `withDependents` (C10, additive): also remove `ograničenje` blocks that reference the attribute. */
  | { kind: 'deleteAttribute'; owner: string; index: number; withDependents?: boolean }
  | { kind: 'rename'; element: string; newName: string }
  | { kind: 'setCardinality'; element: string; participantIndex: number; dg: 0 | 1; gg: '1' | 'M' }
  | { kind: 'setMappingName'; element: string; participantIndex: number; name: string | null }
  | { kind: 'deleteElement'; element: string; withDependents: boolean }
  // ---- C10: domains and cross-table constraints (spec/feature_domain_strucutre.md) ----
  | { kind: 'addDomain'; domain: DomainSpec }
  /** Rename when `domain.name !== name`; every attribute/domain using it is updated. */
  | { kind: 'editDomain'; name: string; domain: DomainSpec }
  /** Used and `replace: false` → ok:false with needsConfirmation.usages. */
  | { kind: 'deleteDomain'; name: string; replace: boolean }
  /** "Izdvoj u domen": attribute `index` of `owner` (IR attribute order). */
  | { kind: 'extractDomain'; owner: string; index: number }
  /** Sets one cell. `constraint` = id of the existing block for this FK, or null to create one. */
  | { kind: 'setReferentialAction'; child: string; parent: string; attrs: string[]; cell: RefCell; action: ConstraintAction; constraint: string | null }
  /** "Vrati podrazumevano": removes the block. */
  | { kind: 'resetReferential'; constraint: string }
  | { kind: 'addConstraint'; spec: GeneralConstraintSpec }
  | { kind: 'editConstraint'; name: string; spec: GeneralConstraintSpec }
  | { kind: 'deleteConstraint'; name: string };

export interface Placement {
  id: string;
  near: string;
  dir: 'right' | 'below';
}

export type BuilderResult =
  | {
      ok: true;
      source: string;
      select?: string;
      renames?: { from: string; to: string }[];
      placeAt?: Placement[];
    }
  | {
      ok: false;
      message: string;
      needsConfirmation?: {
        dependents: { id: string; kind: ElementKind }[];
        /** C10: deleteDomain: number of attributes/domains using it. */
        usages?: number;
        /** C10: deleteElement / deleteAttribute: `ograničenje` blocks that would be removed too. */
        constraints?: string[];
      };
    };

export type PlaceholderKind = 'objekat' | 'slab' | 'agregacija' | 'specijalizacija' | 'podtip';

export type PickPurpose =
  | { kind: 'veza'; from: string }
  | { kind: 'agregacija'; first: string }
  | { kind: 'component'; agregacija: string }
  | { kind: 'podtip'; specijalizacija: string };

export const MSG = {
  syntax: 'Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.',
  failed: 'Izmena nije uspela, pokušajte ponovo.',
  nameTaken: 'Ime je već zauzeto.',
  badName: 'Neispravno ime.',
  podtipSelf: 'Podtip ne može biti sam nadtip.',
  podtipDup: 'Objekat je već podtip.',
  podtipCycle: 'Ovo bi napravilo ciklus specijalizacije.',
  distinct: 'Komponente moraju biti različiti elementi.',
  alreadyComponent: 'Element je već komponenta.',
} as const;

/** C10 additions. */
export type MsgKeyC10 =
  | 'domainTaken' | 'domainCycle' | 'domainUsed' | 'noDomain' | 'unknownDomain'
  | 'constraintTaken' | 'badCondition' | 'cellNotSettable' | 'actionNotAllowed' | 'noConstraint' | 'confirmConstraints';

export type MsgKey = keyof typeof MSG | 'confirmDeps' | MsgKeyC10;

/** Builder messages per locale. `confirmDeps`, `domainUsed`, `confirmConstraints` contain `{n}`. */
export const MESSAGES: Record<Locale, Record<MsgKey, string>> = {
  sr: {
    ...MSG,
    confirmDeps: 'Obrisati i zavisne elemente ({n})?',
    domainTaken: 'Ime domena je već zauzeto.',
    domainCycle: 'Ovo bi napravilo ciklus domena.',
    domainUsed: 'Domen se koristi u {n} atributa/domena. Zameniti ga osnovnim tipom?',
    noDomain: 'Atribut nema domen.',
    unknownDomain: 'Domen ne postoji.',
    constraintTaken: 'Ime ograničenja je već zauzeto.',
    badCondition: 'Uslov i bar jedna relacija su obavezni.',
    cellNotSettable: 'Ova ćelija se ne može menjati.',
    actionNotAllowed: 'Ova akcija nije dozvoljena u toj ćeliji.',
    noConstraint: 'Ograničenje ne postoji.',
    confirmConstraints: 'Obrisati i ograničenja ({n})?',
  },
  en: {
    syntax: 'The diagram has syntax errors. Fix them in text mode.',
    failed: 'The change failed, please try again.',
    nameTaken: 'That name is already taken.',
    badName: 'Invalid name.',
    podtipSelf: 'A subtype cannot be its own supertype.',
    podtipDup: 'The object is already a subtype.',
    podtipCycle: 'This would create a specialization cycle.',
    distinct: 'Components must be different elements.',
    alreadyComponent: 'The element is already a component.',
    confirmDeps: 'Also delete dependent elements ({n})?',
    domainTaken: 'Domain name is already taken.',
    domainCycle: 'This would create a domain cycle.',
    domainUsed: 'The domain is used by {n} attributes/domains. Replace it with its base type?',
    noDomain: 'The attribute has no domain.',
    unknownDomain: 'The domain does not exist.',
    constraintTaken: 'Constraint name is already taken.',
    badCondition: 'A condition and at least one relation are required.',
    cellNotSettable: 'This cell cannot be changed.',
    actionNotAllowed: 'This action is not allowed in that cell.',
    noConstraint: 'The constraint does not exist.',
    confirmConstraints: 'Also delete constraints ({n})?',
  },
};
