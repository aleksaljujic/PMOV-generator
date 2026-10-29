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
