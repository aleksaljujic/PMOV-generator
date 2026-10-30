// C10 §5 golden source-in / source-out tests. Need the T22 parser (and T23 for the IR round trip).
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../examples';
import { DOMAIN_EXAMPLE_IR } from '../fixtures/domains';
import { compile } from '../lang';
import type { ConstraintAction, PmovIR } from '../lang';
import type { RefCell } from '../rm';
import { applyBuilderAction } from './index';
import type { BuilderAction, BuilderOptions } from './index';

type R = ReturnType<typeof applyBuilderAction>;
const run = (src: string, a: BuilderAction, o?: BuilderOptions): R => applyBuilderAction(src, a, o);
function ok(src: string, a: BuilderAction, o?: BuilderOptions): string {
  const r = run(src, a, o);
  if (!r.ok) throw new Error(r.message);
  expect(compile(r.source).diagnostics.filter((d) => d.code.startsWith('S'))).toEqual([]);
  return r.source;
}
const bad = (src: string, a: BuilderAction, o?: BuilderOptions) => {
  const r = run(src, a, o);
  if (r.ok) throw new Error('expected failure');
  return r;
};

const BASE = `// model
domen Starost : short Between 15,65
domen Naziv   : string(40)

objekat Radnik {
  Mlb#    : long NotNull
  ImeR    : Naziv
  Starost : Starost
  Plata   : long >= 0
}

objekat Odeljenje {
  SifOd# : short
}

veza Zaposlen {
  Radnik    (1,1)
  Odeljenje (0,M)
}
`;

describe('addDomain', () => {
  it('after the last domain, aligned', () => {
    const out = ok(BASE, { kind: 'addDomain', domain: { name: 'Iznos', base: 'long', constraint: '>= 0' } });
    expect(out).toContain('domen Naziv   : string(40)\ndomen Iznos   : long >= 0\n\nobjekat');
  });
  it('first domain goes below the leading comment block', () => {
    const src = '// model\n\nobjekat A {\n  X# : long\n}\n';
    const out = ok(src, { kind: 'addDomain', domain: { name: 'Sifra', base: 'short', constraint: 'Moduo_11' } });
    expect(out).toBe('// model\n\ndomen Sifra : short Moduo_11\n\nobjekat A {\n  X# : long\n}\n');
  });
  it('first domain, no comment, English keyword', () => {
    const out = ok('object A {\n  X# : long\n}\n', { kind: 'addDomain', domain: { name: 'D', base: 'string', length: 20 } }, { locale: 'en' });
    expect(out).toBe('domain D : string(20)\n\nobject A {\n  X# : long\n}\n');
  });
  it('derived domain', () => {
    const out = ok(BASE, { kind: 'addDomain', domain: { name: 'Ime', base: 'Naziv' } });
    expect(out).toContain('domen Ime     : Naziv\n');
  });
  it('rejections', () => {
    expect(bad(BASE, { kind: 'addDomain', domain: { name: 'Naziv', base: 'long' } }).message).toBe('Ime domena je već zauzeto.');
    expect(bad(BASE, { kind: 'addDomain', domain: { name: 'long', base: 'long' } }).message).toBe('Neispravno ime.');
    expect(bad(BASE, { kind: 'addDomain', domain: { name: 'Q', base: 'Q' } }).message).toBe('Ovo bi napravilo ciklus domena.');
    expect(bad(BASE, { kind: 'addDomain', domain: { name: 'Q', base: 'Nema' } }).message).toBe('Domen ne postoji.');
  });
});

describe('editDomain', () => {
  it('rewrites the line', () => {
    const out = ok(BASE, { kind: 'editDomain', name: 'Starost', domain: { name: 'Starost', base: 'short', constraint: 'Between 18,65' } });
    expect(out).toContain('domen Starost : short Between 18,65\n');
  });
  it('rename updates attributes and derived domains', () => {
    const src = BASE.replace('domen Naziv   : string(40)', 'domen Naziv   : string(40)\ndomen Kratko  : Naziv');
    const out = ok(src, { kind: 'editDomain', name: 'Naziv', domain: { name: 'Ime', base: 'string', length: 40 } });
    expect(out).toContain('domen Ime     : string(40)');
    expect(out).toContain('domen Kratko  : Ime');
    expect(out).toContain('ImeR    : Ime\n');
    expect(out).not.toContain('Naziv');
  });
  it('cycle and taken name', () => {
    const src = BASE + '\n';
    const withChild = src.replace('domen Naziv   : string(40)', 'domen Naziv   : string(40)\ndomen Kratko  : Naziv');
    expect(bad(withChild, { kind: 'editDomain', name: 'Naziv', domain: { name: 'Naziv', base: 'Kratko' } }).message).toBe('Ovo bi napravilo ciklus domena.');
    expect(bad(BASE, { kind: 'editDomain', name: 'Naziv', domain: { name: 'Starost', base: 'string' } }).message).toBe('Ime domena je već zauzeto.');
  });
});

describe('deleteDomain', () => {
  it('unused: removes the line', () => {
    const src = BASE.replace('Starost : Starost', 'Starost : short');
    const out = ok(src, { kind: 'deleteDomain', name: 'Starost', replace: false });
    expect(out).not.toContain('Between 15,65');
    expect(out).toContain('domen Naziv   : string(40)\n\nobjekat');
  });
  it('used: asks, then replaces by the base type', () => {
    const r = bad(BASE, { kind: 'deleteDomain', name: 'Naziv', replace: false });
    expect(r.message).toBe('Domen se koristi u 1 atributa/domena. Zameniti ga osnovnim tipom?');
    expect(!r.ok && r.needsConfirmation).toEqual({ dependents: [], usages: 1 });
    const out = ok(BASE, { kind: 'deleteDomain', name: 'Naziv', replace: true });
    expect(out).toContain('ImeR    : string(40)');
    expect(out).not.toContain('domen Naziv');
    const out2 = ok(BASE, { kind: 'deleteDomain', name: 'Starost', replace: true });
    expect(out2).toContain('Starost : short\n');
    expect(out2).not.toContain('Between 15,65');
  });
});

describe('extractDomain', () => {
  it('moves the constraint into a new domain', () => {
    const src = 'objekat A {\n  X# : long\n  Age : short Between 15,65\n}\n';
    const out = ok(src, { kind: 'extractDomain', owner: 'A', index: 1 });
    expect(out).toBe('domen Age : short Between 15,65\n\nobjekat A {\n  X# : long\n  Age : Age\n}\n');
  });
  it('name collision gives X2', () => {
    const out = ok(BASE, { kind: 'extractDomain', owner: 'Radnik', index: 3 });
    expect(out).toContain('domen Plata');
    const out2 = ok(BASE.replace('Plata   : long >= 0', 'Starost2 : long').replace('Mlb#    : long NotNull', 'Starost : long NotNull'), { kind: 'extractDomain', owner: 'Radnik', index: 0 });
    expect(out2).toContain('domen Starost2 : long NotNull');
  });
  it('rejects attributes without a domain', () => {
    expect(bad('objekat A {\n  X#\n}\n', { kind: 'extractDomain', owner: 'A', index: 0 }).message).toBe('Atribut nema domen.');
    expect(bad(BASE, { kind: 'extractDomain', owner: 'Radnik', index: 1 }).message).toBe('Atribut nema domen.');
  });
});

const REF = `${BASE}
ograničenje RadnikOdeljenje {
  Radnik(SifOd) -> Odeljenje
  Odeljenje : update cascades
}
`;

describe('setReferentialAction', () => {
  const act = (cell: RefCell, action: ConstraintAction, constraint: string | null): BuilderAction =>
    ({ kind: 'setReferentialAction', child: 'Radnik', parent: 'Odeljenje', attrs: ['SifOd'], cell, action, constraint });
  it('creates a block', () => {
    const out = ok(BASE, act('parentDelete', 'cascades', null));
    expect(out.endsWith('\nograničenje RadnikOdeljenje {\n  Radnik(SifOd) -> Odeljenje\n  Odeljenje : delete cascades\n}\n')).toBe(true);
  });
  it('second new block gets a number; English keyword', () => {
    const once = ok(BASE, act('childInsert', 'nullifies', null), { locale: 'en' });
    expect(once).toContain('constraint RadnikOdeljenje {');
    const twice = ok(once, act('childInsert', 'nullifies', null), { locale: 'en' });
    expect(twice).toContain('constraint RadnikOdeljenje2 {');
  });
  it('edits an existing item', () => {
    const out = ok(REF, act('parentUpdate', 'restricted', 'RadnikOdeljenje'));
    expect(out).toContain('Odeljenje : update restricted\n');
  });
  it('appends an item to an existing rule line', () => {
    const out = ok(REF, act('parentDelete', 'cascades', 'RadnikOdeljenje'));
    expect(out).toContain('Odeljenje : update cascades, delete cascades\n');
  });
  it('adds a rule line for the other relation', () => {
    const out = ok(REF, act('childInsert', 'nullifies', 'RadnikOdeljenje'));
    expect(out).toContain('  Odeljenje : update cascades\n  Radnik    : insert nullifies\n}');
  });
  it('rejects childUpdate for a recursive FK and disallowed actions', () => {
    const r = bad(BASE, { kind: 'setReferentialAction', child: 'Radnik', parent: 'Radnik', attrs: ['A'], cell: 'childUpdate', action: 'restricted', constraint: null });
    expect(r.ok).toBe(false);
    expect(bad(BASE, act('childInsert', 'cascades', null)).ok).toBe(false);
  });
  it('resetReferential removes the block and a blank line', () => {
    expect(ok(REF, { kind: 'resetReferential', constraint: 'RadnikOdeljenje' })).toBe(BASE);
  });
});

describe('general constraints', () => {
  const spec = { name: 'PlataLimit', condition: 'Radnik.Plata <= 1000', checks: [{ relation: 'Radnik', ops: ['insert', 'update'] as ('insert' | 'update')[] }, { relation: 'Odeljenje', ops: ['update'] as 'update'[] }] };
  it('add, edit, delete', () => {
    const added = ok(REF, { kind: 'addConstraint', spec });
    expect(added.endsWith('\nograničenje PlataLimit {\n  uslov: Radnik.Plata <= 1000\n  Radnik    : insert restricted, update restricted\n  Odeljenje : update restricted\n}\n')).toBe(true);
    const edited = ok(added, { kind: 'editConstraint', name: 'PlataLimit', spec: { ...spec, name: 'Limit', condition: 'Radnik.Plata <= 2000' } });
    expect(edited).toContain('ograničenje Limit {\n  uslov: Radnik.Plata <= 2000');
    expect(ok(edited, { kind: 'deleteConstraint', name: 'Limit' })).toBe(REF);
  });
  it('rejects a taken name and a missing condition', () => {
    expect(bad(REF, { kind: 'addConstraint', spec: { ...spec, name: 'RadnikOdeljenje' } }).message).toBe('Ime ograničenja je već zauzeto.');
    expect(bad(REF, { kind: 'addConstraint', spec: { ...spec, condition: ' ' } }).ok).toBe(false);
  });
});

const FULL = `${REF}
ograničenje Limit {
  uslov: Radnik.Plata <= 100 And Radnik.SifOd > 0
  Radnik : insert restricted
}
`;

describe('effects on existing actions', () => {
  it('rename updates headers, rules and uslov refs', () => {
    const out = ok(FULL, { kind: 'rename', element: 'Radnik', newName: 'Zaposleni' });
    expect(out).toContain('Zaposleni(SifOd) -> Odeljenje');
    expect(out).toContain('uslov: Zaposleni.Plata <= 100 And Zaposleni.SifOd > 0');
    expect(out).toContain('Zaposleni : insert restricted');
    const out2 = ok(FULL, { kind: 'rename', element: 'Odeljenje', newName: 'Odsek' });
    expect(out2).toContain('Radnik(SifOd) -> Odsek');
    expect(out2).toContain('Odsek : update cascades');
  });
  it('attribute rename updates refs', () => {
    const out = ok(FULL, { kind: 'editAttribute', owner: 'Radnik', index: 3, attr: { name: 'Zarada', id: false, domain: 'long', constraint: '>= 0' } });
    expect(out).toContain('uslov: Radnik.Zarada <= 100');
  });
  it('FK attribute follows the parent key rename', () => {
    const out = ok(FULL, { kind: 'editAttribute', owner: 'Odeljenje', index: 0, attr: { name: 'Sifra', id: true, domain: 'short' } });
    expect(out).toContain('Radnik(Sifra) -> Odeljenje');
    expect(out).toContain('Radnik.Sifra > 0');
  });
  it('deleteElement lists constraints and removes them on confirmation', () => {
    const r = bad(FULL, { kind: 'deleteElement', element: 'Odeljenje', withDependents: false });
    expect(!r.ok && r.needsConfirmation?.constraints).toEqual(['RadnikOdeljenje']);
    const out = ok(FULL, { kind: 'deleteElement', element: 'Odeljenje', withDependents: true });
    expect(out).not.toContain('RadnikOdeljenje');
    expect(out).toContain('ograničenje Limit');
  });
  it('deleteAttribute lists constraints', () => {
    const r = bad(FULL, { kind: 'deleteAttribute', owner: 'Radnik', index: 3 });
    expect(!r.ok && r.needsConfirmation?.constraints).toEqual(['Limit']);
    const out = ok(FULL, { kind: 'deleteAttribute', owner: 'Radnik', index: 3, withDependents: true });
    expect(out).not.toContain('Limit');
    expect(out).not.toContain('Plata');
  });
  it('attributes with a user domain', () => {
    const out = ok(BASE, { kind: 'addAttribute', owner: 'Odeljenje', attr: { name: 'Naz', id: false, userDomain: 'Naziv' } });
    expect(out).toContain('  Naz    : Naziv\n');
    const out2 = ok(BASE, { kind: 'addAttribute', owner: 'Odeljenje', attr: { name: 'Naz', id: false, domain: 'string', length: 30, constraint: 'NotNull' } });
    expect(out2).toContain('Naz    : string(30) NotNull');
    expect(bad(BASE, { kind: 'addAttribute', owner: 'Odeljenje', attr: { name: 'N', id: false, userDomain: 'Nema' } }).message).toBe('Domen ne postoji.');
  });
});

describe('round trip: the domeni example from actions', () => {
  it('matches the example IR (domains and attributes)', () => {
    const src = EXAMPLES.find((e) => e.id === 'domeni')?.source ?? '';
    const ir = compile(src).ir as PmovIR;
    expect(ir.domains?.map((d) => d.name)).toEqual(DOMAIN_EXAMPLE_IR.domains?.map((d) => d.name));
    // remove and re-add all domains with actions; the model keeps its domain list.
    let s = src;
    for (const d of ir.domains ?? []) s = ok(s, { kind: 'deleteDomain', name: d.name, replace: true });
    expect(compile(s).ir?.domains).toBeUndefined();
    for (const d of DOMAIN_EXAMPLE_IR.domains ?? []) {
      s = ok(s, { kind: 'addDomain', domain: { name: d.name, base: d.parent ?? (d.base as string), length: d.length, constraint: d.constraint } });
    }
    expect(compile(s).ir?.domains?.map((d) => [d.name, d.base, d.length, d.constraint])).toEqual(
      DOMAIN_EXAMPLE_IR.domains?.map((d) => [d.name, d.base, d.length, d.constraint]),
    );
  });
});
