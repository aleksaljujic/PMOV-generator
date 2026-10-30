import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { MAIN_EXAMPLE_RM } from '../fixtures/rm';
import { compile } from '../lang';
import type { PmovIR } from '../lang';
import { generateRelationalModel } from '../rm';
import { applyBuilderAction } from './index';
import type { AttributeSpec, BuilderAction } from './index';

/** Applies actions in order; every step must succeed, parse, and leave no syntax errors. */
class Session {
  source = '';
  last: Extract<ReturnType<typeof applyBuilderAction>, { ok: true }> | null = null;
  do(action: BuilderAction): this {
    const r = applyBuilderAction(this.source, action);
    if (!r.ok) throw new Error(`${JSON.stringify(action)} failed: ${r.message}`);
    expect(compile(r.source).diagnostics.filter((d) => d.code.startsWith('S'))).toEqual([]);
    this.source = r.source;
    this.last = r;
    return this;
  }
  rename(element: string, newName: string): this {
    return this.do({ kind: 'rename', element, newName });
  }
  attr(owner: string, name: string, opts: Partial<AttributeSpec> = {}): this {
    return this.do({ kind: 'addAttribute', owner, attr: { name, id: false, ...opts } });
  }
}

function normalize(ir: PmovIR): unknown {
  const stripped = JSON.parse(JSON.stringify(ir, (k, v) => (k === 'span' || k === 'nameSpan' ? undefined : v))) as PmovIR;
  return [...stripped.elements].sort((a, b) => (a.id < b.id ? -1 : 1));
}

describe('both examples built from builder actions alone', () => {
  it('main example: IR and relational model equal the example', () => {
    const s = new Session();
    s.do({ kind: 'newModel' }).rename('Objekat1', 'Radnik');
    s.attr('Radnik', 'Mlb', { id: true, domain: 'long', constraint: 'NotNull' })
      .attr('Radnik', 'ImeR', { domain: 'string' })
      .attr('Radnik', 'Adresa', { domain: 'string' })
      .attr('Radnik', 'Starost', { domain: 'short', constraint: 'Between 15,65' });
    s.do({ kind: 'addObject', near: 'Radnik' }).rename('Objekat1', 'Odeljenje');
    s.attr('Odeljenje', 'SifOd', { id: true, domain: 'short', constraint: 'Moduo_11' }).attr('Odeljenje', 'Naziv', { domain: 'string' });
    for (const [name, attrs] of [
      ['Student', ['BrojInd#', 'Ime', 'Smer']],
      ['Predmet', ['SifPred#', 'NazivPred']],
      ['Nastavnik', ['ŠifraNast#', 'ImeNast', 'Zvanje']],
    ] as const) {
      s.do({ kind: 'addObject', near: 'Radnik' }).rename('Objekat1', name);
      for (const a of attrs) s.attr(name, a.replace('#', ''), { id: a.endsWith('#') });
    }

    // veza Zapošljavanje
    s.do({ kind: 'addVeza', from: 'Radnik', to: 'Odeljenje' }).rename('_#1', 'Zapošljavanje');
    s.do({ kind: 'setMappingName', element: 'Zapošljavanje', participantIndex: 0, name: 'Radi' });
    s.do({ kind: 'setMappingName', element: 'Zapošljavanje', participantIndex: 1, name: 'Zapošljava' });
    // veza Rukovođenje
    s.do({ kind: 'addVeza', from: 'Radnik', to: 'Odeljenje' }).rename('_#1', 'Rukovođenje');
    s.do({ kind: 'setCardinality', element: 'Rukovođenje', participantIndex: 0, dg: 0, gg: '1' });
    s.do({ kind: 'setCardinality', element: 'Rukovođenje', participantIndex: 1, dg: 1, gg: '1' });
    s.do({ kind: 'setMappingName', element: 'Rukovođenje', participantIndex: 0, name: 'Rukovodi' });
    s.do({ kind: 'setMappingName', element: 'Rukovođenje', participantIndex: 1, name: 'Rukovođeno' });
    // slab Isplata
    s.do({ kind: 'addSlab', parent: 'Radnik' }).rename('Slab1', 'Isplata');
    s.do({ kind: 'editAttribute', owner: 'Isplata', index: 0, attr: { name: 'Datum', id: true, domain: 'date' } });
    s.attr('Isplata', 'Iznos', { domain: 'long' });
    // agregacija Prijava + veza Overe
    s.do({ kind: 'addAgregacija', first: 'Student', second: 'Predmet' }).rename('Agregacija1', 'Prijava');
    s.attr('Prijava', 'DatumPol', { domain: 'date' }).attr('Prijava', 'Ocena', { domain: 'short', constraint: 'Between 5,10' });
    s.do({ kind: 'addVeza', from: 'Prijava', to: 'Nastavnik' }).rename('_#1', 'Overe');

    const built = compile(s.source);
    expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const example = compile(EXAMPLES[0]!.source);
    expect(normalize(built.ir!)).toEqual(normalize(example.ir!));

    const rm = generateRelationalModel(built.ir!);
    const shape = (m: typeof rm) =>
      m.relations
        .map((r) => ({ name: r.name, attrs: r.attributes.map((a) => `${a.name}:${a.pk ? 'pk' : ''}${a.fk ? 'fk' : ''}`).sort() }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    expect(shape(rm)).toEqual(shape(MAIN_EXAMPLE_RM));
  });

  it('specijalizacija example: IR equals the example', () => {
    const s = new Session();
    s.do({ kind: 'newModel' }).rename('Objekat1', 'Građanin');
    s.attr('Građanin', 'Mlb', { id: true, domain: 'long' })
      .attr('Građanin', 'Ime', { domain: 'string' })
      .attr('Građanin', 'Starost', { domain: 'short' });
    s.do({ kind: 'addSpecijalizacija', nadtip: 'Građanin' });
    expect(s.last?.select).toBe('Vrsta1');
    s.rename('Vrsta1', 'Vrsta').rename('Podtip1', 'Student').rename('Podtip2', 'Radnik');
    s.do({ kind: 'addPodtip', specijalizacija: 'Vrsta', podtip: { newObject: true } }).rename('Podtip1', 'Dete');
    s.do({ kind: 'addPodtip', specijalizacija: 'Vrsta', podtip: { newObject: true } }).rename('Podtip1', 'Penzioner');
    s.attr('Student', 'BrojInd', { domain: 'string' }).attr('Student', 'Semestar', { domain: 'short' });
    s.attr('Radnik', 'Plata', { domain: 'long' }).attr('Dete', 'Dodatak', { domain: 'long' }).attr('Penzioner', 'Penzija', { domain: 'long' });
    s.do({ kind: 'addObject', near: 'Građanin' }).rename('Objekat1', 'Proizvod');
    s.attr('Proizvod', 'SifProizvoda', { id: true }).attr('Proizvod', 'NazivProizvoda');
    s.do({ kind: 'addVeza', from: 'Proizvod', to: 'Proizvod' }).rename('_#1', 'Struktura');
    s.do({ kind: 'setCardinality', element: 'Struktura', participantIndex: 0, dg: 0, gg: 'M' });
    s.do({ kind: 'setMappingName', element: 'Struktura', participantIndex: 0, name: 'Sastavljen' });
    s.do({ kind: 'setMappingName', element: 'Struktura', participantIndex: 1, name: 'Ugrađen' });

    const built = compile(s.source);
    expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(built.diagnostics.filter((d) => d.code === 'W01')).toEqual([]);
    const example = compile(EXAMPLES[1]!.source);
    expect(normalize(built.ir!)).toEqual(normalize(example.ir!));
  });
});
