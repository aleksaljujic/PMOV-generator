// FILE: src/fixtures/domains.ts
// FROZEN golden data for contract C10 (spec/feature_domain_strucutre.md): the `domeni` example.
import { NO_SPAN } from '../lang/diagnostics';
import type { IRAttribute, IRConstraintRule, IRParticipant, PmovIR } from '../lang/ir';
import type { DomainStructureRow, ReferentialConstraint } from '../rm/types';

const a = (
  name: string,
  isId = false,
  domain: IRAttribute['domain'] = null,
  constraint: string | null = null,
  userDomain: string | null = null,
  length: number | null = null,
): IRAttribute => ({
  name, isId, domain, constraint, span: NO_SPAN,
  ...(userDomain !== null ? { userDomain } : {}),
  ...(length !== null ? { length } : {}),
});

const p = (ref: string, min: 0 | 1, max: 1 | 'M', mapping: string | null = null): IRParticipant => ({
  ref, card: { min, max }, mapping, span: NO_SPAN,
});

const base = (id: string) => ({ id, name: id, span: NO_SPAN, nameSpan: NO_SPAN });

const r = (relation: string, op: IRConstraintRule['op'], action: IRConstraintRule['action']): IRConstraintRule => ({
  relation, op, action, span: NO_SPAN,
});

const d = (name: string, parent: string | null, b: IRAttribute['domain'], length: number | null, constraint: string | null, effectiveConstraint: string | null) => ({
  name, parent, base: b, length, constraint, effectiveConstraint, span: NO_SPAN, nameSpan: NO_SPAN,
});

/**
 * IR of the `domeni` example (EXAMPLES id 'domeni', Serbian source).
 * compile(source).ir must deep-equal this modulo spans (use stripSpans from ./ir).
 * Omit-when-empty rule (C10): `userDomain` / `length` keys exist only when non-null; `domains` / `constraints` only
 * when non-empty. So sources without C10 syntax produce exactly the same IR as before.
 */
export const DOMAIN_EXAMPLE_IR: PmovIR = {
  elements: [
    { ...base('Radnik'), kind: 'objekat', attributes: [
      a('Mlb', true, 'long', 'NotNull'), a('ImeR', false, 'string', null, 'Naziv', 40), a('Adresa', false, 'string'),
      a('Starost', false, 'short', null, 'Starost'), a('Plata', false, 'long', 'NotNull', 'Iznos'),
    ] },
    { ...base('Odeljenje'), kind: 'objekat', attributes: [
      a('SifOd', true, 'short', null, 'Šifra'), a('Naziv', false, 'string', null, 'Naziv', 40),
    ] },
    { ...base('Student'), kind: 'objekat', attributes: [a('BrojInd', true), a('Ime'), a('Smer')] },
    { ...base('Predmet'), kind: 'objekat', attributes: [a('SifPred', true), a('NazivPred')] },
    { ...base('Nastavnik'), kind: 'objekat', attributes: [a('ŠifraNast', true), a('ImeNast'), a('Zvanje')] },
    { ...base('Zapošljavanje'), kind: 'veza', participants: [p('Radnik', 1, 1, 'Radi'), p('Odeljenje', 0, 'M', 'Zapošljava')] },
    { ...base('Rukovođenje'), kind: 'veza', participants: [p('Radnik', 0, 1, 'Rukovodi'), p('Odeljenje', 1, 1, 'Rukovođeno')] },
    { ...base('Isplata'), kind: 'slab', owner: p('Radnik', 0, 'M'), attributes: [
      a('Datum', true, 'date'), a('Iznos', false, 'long', null, 'Iznos'),
    ] },
    { ...base('Prijava'), kind: 'agregacija', components: [p('Student', 0, 'M'), p('Predmet', 0, 'M')],
      attributes: [a('DatumPol', false, 'date'), a('Ocena', false, 'short', null, 'Ocena')] },
    { ...base('Overe'), kind: 'veza', participants: [p('Prijava', 1, 1), p('Nastavnik', 0, 'M')] },
  ],
  domains: [
    d('Šifra', null, 'short', null, 'Moduo_11', 'Moduo_11'),
    d('Naziv', null, 'string', 40, null, null),
    d('Starost', null, 'short', null, 'Between 15,65', 'Between 15,65'),
    d('Iznos', null, 'long', null, '>= 0', '>= 0'),
    d('Ocena', null, 'short', null, 'Between 5,10', 'Between 5,10'),
  ],
  constraints: [
    { kind: 'referential', id: 'RadnikUOdeljenju', name: 'RadnikUOdeljenju', child: 'Radnik', parent: 'Odeljenje',
      childAttrs: ['SifOd'], rules: [r('Odeljenje', 'update', 'cascades'), r('Odeljenje', 'delete', 'restricted')],
      span: NO_SPAN, nameSpan: NO_SPAN, headerSpan: NO_SPAN },
    { kind: 'referential', id: 'IsplateRadnika', name: 'IsplateRadnika', child: 'Isplata', parent: 'Radnik',
      childAttrs: null, rules: [r('Radnik', 'delete', 'restricted')],
      span: NO_SPAN, nameSpan: NO_SPAN, headerSpan: NO_SPAN },
    { kind: 'general', id: 'IsplataDoPlate', name: 'IsplataDoPlate', condition: 'Isplata.Iznos <= Radnik.Plata',
      conditionSpan: NO_SPAN,
      refs: [
        { relation: 'Isplata', attribute: 'Iznos', span: NO_SPAN },
        { relation: 'Radnik', attribute: 'Plata', span: NO_SPAN },
      ],
      rules: [r('Isplata', 'insert', 'restricted'), r('Isplata', 'update', 'restricted'), r('Radnik', 'update', 'restricted')],
      span: NO_SPAN, nameSpan: NO_SPAN },
  ],
};

/** A derived-domain chain for checker/RM tests: Naziv → KratakNaziv → Oznaka. */
export const DOMAIN_CHAIN_SOURCE = `domen Naziv       : string(40) NotNull
domen KratakNaziv : Naziv Like '[A-Z]%'
domen Oznaka      : KratakNaziv

objekat Artikal {
  Sifra#  : long
  Oznaka  : Oznaka
}
`;

/** buildDomainStructure(DOMAIN_EXAMPLE_IR) must equal this. */
export const DOMAIN_EXAMPLE_STRUCTURE: DomainStructureRow[] = [
  { domain: 'Šifra', base: 'short', length: '–', constraint: 'Moduo_11', inherited: null },
  { domain: 'Naziv', base: 'string', length: '40', constraint: '–', inherited: null },
  { domain: 'Starost', base: 'short', length: '–', constraint: 'Between 15,65', inherited: null },
  { domain: 'Iznos', base: 'long', length: '–', constraint: '>= 0', inherited: null },
  { domain: 'Ocena', base: 'short', length: '–', constraint: 'Between 5,10', inherited: null },
];

const R = 'restricted' as const;
const C = 'cascades' as const;

/**
 * generateRelationalModel(DOMAIN_EXAMPLE_IR).referential must equal this, in this order,
 * ignoring the exact `group` strings (compare groups only for "same / different").
 */
export const DOMAIN_EXAMPLE_REFERENTIAL: ReferentialConstraint[] = [
  { name: 'RadnikUOdeljenju', constraintId: 'RadnikUOdeljenju', child: 'Radnik', parent: 'Odeljenje',
    attributes: ['SifOd'], referenced: ['SifOd'], group: 'Zapošljavanje:0', fkKind: 'regular',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: ['parentUpdate', 'parentDelete'] },
  { name: 'fk_Odeljenje_Radnik', constraintId: null, child: 'Odeljenje', parent: 'Radnik',
    attributes: ['Mlb'], referenced: ['Mlb'], group: 'Rukovođenje:0', fkKind: 'regular',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: [] },
  { name: 'IsplateRadnika', constraintId: 'IsplateRadnika', child: 'Isplata', parent: 'Radnik',
    attributes: ['Mlb'], referenced: ['Mlb'], group: 'Isplata:0', fkKind: 'identifying',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: ['parentDelete'] },
  { name: 'fk_Prijava_Student', constraintId: null, child: 'Prijava', parent: 'Student',
    attributes: ['BrojInd'], referenced: ['BrojInd'], group: 'Prijava:0', fkKind: 'component',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: [] },
  { name: 'fk_Prijava_Predmet', constraintId: null, child: 'Prijava', parent: 'Predmet',
    attributes: ['SifPred'], referenced: ['SifPred'], group: 'Prijava:1', fkKind: 'component',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: [] },
  { name: 'fk_Prijava_Nastavnik', constraintId: null, child: 'Prijava', parent: 'Nastavnik',
    attributes: ['ŠifraNast'], referenced: ['ŠifraNast'], group: 'Overe:0', fkKind: 'regular',
    actions: { childInsert: R, childUpdate: R, parentUpdate: C, parentDelete: R }, explicitCells: [] },
];
