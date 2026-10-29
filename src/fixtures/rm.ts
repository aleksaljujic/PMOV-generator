// FILE: src/fixtures/rm.ts
import type { Domain } from '../lang/ir';
import type { RelAttribute, RelationalModel } from '../rm/types';

const own = (name: string, domain: Domain | null = null, constraint: string | null = null, pk = false): RelAttribute => ({
  name, domain, constraint, pk, fk: false, nullable: false, references: null,
});
const ref = (
  name: string, relation: string, group: string, pk: boolean,
  domain: Domain | null = null, constraint: string | null = null, nullable = false,
): RelAttribute => ({ name, domain, constraint, pk, fk: true, nullable, references: { relation, attribute: name, group } });

/** generateRelationalModel(MAIN_EXAMPLE_IR) must equal this, ignoring the exact `group` strings
 *  (tests compare groups only for "same / different"). */
export const MAIN_EXAMPLE_RM: RelationalModel = {
  relations: [
    { name: 'Radnik', elementId: 'Radnik', attributes: [
      own('Mlb', 'long', 'NotNull', true), own('ImeR', 'string'), own('Adresa', 'string'),
      own('Starost', 'short', 'Between 15,65'), ref('SifOd', 'Odeljenje', 'Zapošljavanje:0', false, 'short', 'Moduo_11'),
    ] },
    { name: 'Odeljenje', elementId: 'Odeljenje', attributes: [
      own('SifOd', 'short', 'Moduo_11', true), own('Naziv', 'string'), ref('Mlb', 'Radnik', 'Rukovođenje:0', false, 'long', 'NotNull'),
    ] },
    { name: 'Student', elementId: 'Student', attributes: [own('BrojInd', null, null, true), own('Ime'), own('Smer')] },
    { name: 'Predmet', elementId: 'Predmet', attributes: [own('SifPred', null, null, true), own('NazivPred')] },
    { name: 'Nastavnik', elementId: 'Nastavnik', attributes: [own('ŠifraNast', null, null, true), own('ImeNast'), own('Zvanje')] },
    { name: 'Isplata', elementId: 'Isplata', attributes: [
      ref('Mlb', 'Radnik', 'Isplata:0', true, 'long', 'NotNull'), own('Datum', 'date', null, true), own('Iznos', 'long'),
    ] },
    { name: 'Prijava', elementId: 'Prijava', attributes: [
      ref('BrojInd', 'Student', 'Prijava:0', true), ref('SifPred', 'Predmet', 'Prijava:1', true),
      own('DatumPol', 'date'), own('Ocena', 'short', 'Between 5,10'), ref('ŠifraNast', 'Nastavnik', 'Overe:0', false),
    ] },
  ],
};
