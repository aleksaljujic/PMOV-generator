import { describe, expect, it } from 'vitest';
import { compile } from '../lang';
import { applyBuilderAction, isPlaceholderName, pickRejection, placeholderName } from './index';
import type { BuilderAction, BuilderResult } from './index';

type Ok = Extract<BuilderResult, { ok: true }>;
type Err = Extract<BuilderResult, { ok: false }>;

function ok(source: string, action: BuilderAction): Ok {
  const r = applyBuilderAction(source, action);
  if (!r.ok) throw new Error(`expected ok, got: ${r.message}`);
  return r;
}
function err(source: string, action: BuilderAction): Err {
  const r = applyBuilderAction(source, action);
  if (r.ok) throw new Error('expected failure');
  return r;
}
const codes = (source: string): string[] => compile(source).diagnostics.map((d) => d.code).sort();
const errs = (source: string): string[] =>
  compile(source).diagnostics.filter((d) => d.severity === 'error').map((d) => d.code).sort();

const NEW = 'objekat Objekat1 {\n}\n';
const SYNTAX = 'Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.';

describe('newModel / placeholders', () => {
  it('newModel gives exactly one placeholder object', () => {
    const r = ok('anything', { kind: 'newModel' });
    expect(r.source).toBe(NEW);
    expect(r.select).toBe('Objekat1');
    expect(codes(r.source)).toEqual(['E10', 'W03']);
  });

  it('placeholder numbering skips taken names', () => {
    const ir = compile('objekat Objekat1 {\n}\nobjekat Objekat3 {\n}\nspecijalizacija Vrsta1 {\n}\n').ir;
    expect(placeholderName(ir, 'objekat')).toBe('Objekat2');
    expect(placeholderName(ir, 'objekat', ['Objekat2'])).toBe('Objekat4');
    expect(placeholderName(ir, 'specijalizacija')).toBe('Vrsta2');
    expect(placeholderName(null, 'slab')).toBe('Slab1');
    expect(placeholderName(null, 'agregacija')).toBe('Agregacija1');
    expect(placeholderName(null, 'podtip')).toBe('Podtip1');
  });

  it('isPlaceholderName', () => {
    expect(isPlaceholderName('Objekat12')).toBe(true);
    expect(isPlaceholderName('Radnik')).toBe(false);
    expect(isPlaceholderName('Objekat')).toBe(false);
  });

  it('refuses to act on syntax errors', () => {
    const r = err('objekat A {\n  X#\n', { kind: 'addObject', near: 'A' });
    expect(r.message).toBe(SYNTAX);
    expect(err('blok A {}', { kind: 'rename', element: 'A', newName: 'B' }).message).toBe(SYNTAX);
  });

  it('fails cleanly on unknown elements', () => {
    expect(err(NEW, { kind: 'addObject', near: 'Nema' }).message).toBe('Izmena nije uspela, pokušajte ponovo.');
  });
});

describe('addObject / addVeza', () => {
  it('addObject appends a block after one blank line and places it to the right', () => {
    const r = ok(NEW, { kind: 'addObject', near: 'Objekat1' });
    expect(r.source).toBe('objekat Objekat1 {\n}\n\nobjekat Objekat2 {\n}\n');
    expect(r.placeAt).toEqual([{ id: 'Objekat2', near: 'Objekat1', dir: 'right' }]);
    expect(r.select).toBe('Objekat2');
  });

  it('keeps existing trailing blank lines and missing final newline in mind', () => {
    expect(ok('objekat A {\n}\n\n', { kind: 'addObject', near: 'A' }).source).toBe('objekat A {\n}\n\nobjekat Objekat1 {\n}\n');
    expect(ok('objekat A {\n}', { kind: 'addObject', near: 'A' }).source).toBe('objekat A {\n}\n\nobjekat Objekat1 {\n}\n');
  });

  it('addVeza to a new object', () => {
    const src = 'objekat Radnik {\n  Mlb#\n}\n';
    const r = ok(src, { kind: 'addVeza', from: 'Radnik', to: { newObject: true } });
    expect(r.source).toBe(
      `${src}\nobjekat Objekat1 {\n}\n\nveza _ {\n  Radnik   (1,1)\n  Objekat1 (0,M)\n}\n`,
    );
    expect(r.select).toBe('_#1');
    expect(r.placeAt).toEqual([
      { id: '_#1', near: 'Radnik', dir: 'right' },
      { id: 'Objekat1', near: '_#1', dir: 'right' },
    ]);
    expect(errs(r.source)).toEqual(['E10']);
  });

  it('addVeza to an existing object', () => {
    const src = 'objekat A {\n  X#\n}\n\nobjekat B {\n  Y#\n}\n';
    const r = ok(src, { kind: 'addVeza', from: 'A', to: 'B' });
    expect(r.source).toBe(`${src}\nveza _ {\n  A (1,1)\n  B (0,M)\n}\n`);
    expect(errs(r.source)).toEqual([]);
    expect(r.placeAt).toEqual([{ id: '_#1', near: 'A', dir: 'right' }]);
  });

  it('second unnamed veza gets id _#2', () => {
    const src = 'objekat A {\n  X#\n}\nobjekat B {\n  Y#\n}\nveza _ {\n  A (1,1)\n  B (0,M)\n}\n';
    expect(ok(src, { kind: 'addVeza', from: 'B', to: 'A' }).select).toBe('_#2');
  });

  it('recursive veza gets Uloga1/Uloga2 and no W01', () => {
    const src = 'objekat A {\n  X#\n}\n';
    const r = ok(src, { kind: 'addVeza', from: 'A', to: 'A' });
    expect(r.source).toBe(`${src}\nveza _ {\n  A (1,1) Uloga1\n  A (0,M) Uloga2\n}\n`);
    expect(codes(r.source)).not.toContain('W01');
    expect(errs(r.source)).toEqual([]);
  });

  it('quotes names with spaces', () => {
    const src = 'objekat "Moj objekat" {\n  X#\n}\n';
    const r = ok(src, { kind: 'addVeza', from: 'Moj objekat', to: { newObject: true } });
    expect(r.source).toContain('  "Moj objekat" (1,1)\n  Objekat1      (0,M)');
    expect(codes(r.source)).not.toContain('E02');
  });

  it('veza cannot start from a veza', () => {
    const src = 'objekat A {\n  X#\n}\nveza _ {\n  A (1,1)\n  A (0,M)\n}\n';
    expect(err(src, { kind: 'addVeza', from: '_#1', to: 'A' }).message).toBe('Izmena nije uspela, pokušajte ponovo.');
  });
});

describe('addSlab / addAgregacija / addComponent', () => {
  it('addSlab', () => {
    const src = 'objekat Radnik {\n  Mlb#\n}\n';
    const r = ok(src, { kind: 'addSlab', parent: 'Radnik' });
    expect(r.source).toBe(`${src}\nslab Slab1 {\n  nadređeni Radnik (0,M)\n  Rb#\n}\n`);
    expect(r.select).toBe('Slab1');
    expect(r.placeAt).toEqual([{ id: 'Slab1', near: 'Radnik', dir: 'right' }]);
    expect(compile(r.source).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('addAgregacija with a new object, and with an existing one', () => {
    const src = 'objekat A {\n  X#\n}\n';
    const r = ok(src, { kind: 'addAgregacija', first: 'A', second: { newObject: true } });
    expect(r.source).toBe(`${src}\nobjekat Objekat1 {\n}\n\nagregacija Agregacija1 {\n  A        (0,M)\n  Objekat1 (0,M)\n}\n`);
    expect(r.placeAt).toEqual([
      { id: 'Agregacija1', near: 'A', dir: 'right' },
      { id: 'Objekat1', near: 'Agregacija1', dir: 'right' },
    ]);
    const src2 = `${src}\nobjekat B {\n  Y#\n}\n`;
    const r2 = ok(src2, { kind: 'addAgregacija', first: 'A', second: 'B' });
    expect(r2.source).toBe(`${src2}\nagregacija Agregacija1 {\n  A (0,M)\n  B (0,M)\n}\n`);
    expect(compile(r2.source).hasErrors).toBe(false);
  });

  it('addAgregacija rejects the same element twice', () => {
    expect(err('objekat A {\n  X#\n}\n', { kind: 'addAgregacija', first: 'A', second: 'A' }).message).toBe(
      'Komponente moraju biti različiti elementi.',
    );
  });

  it('addComponent appends after the last participant, aligned', () => {
    const src = 'objekat C {\n  Z#\n}\nagregacija G {\n  Student (0,M)\n  Predmet (0,M)\n  Datum : date\n}\nobjekat Student {\n  S#\n}\nobjekat Predmet {\n  P#\n}\n';
    const r = ok(src, { kind: 'addComponent', agregacija: 'G', component: 'C' });
    expect(r.source).toContain('  Predmet (0,M)\n  C       (0,M)\n  Datum : date');
    const r2 = ok(src, { kind: 'addComponent', agregacija: 'G', component: { newObject: true } });
    expect(r2.source).toContain('  Objekat1 (0,M)\n  Datum');
    expect(r2.source.endsWith('objekat Objekat1 {\n}\n')).toBe(true);
    expect(r2.placeAt).toEqual([{ id: 'Objekat1', near: 'G', dir: 'right' }]);
  });

  it('addComponent rejects self and duplicates', () => {
    const src = 'objekat A {\n  X#\n}\nobjekat B {\n  Y#\n}\nagregacija G {\n  A (0,M)\n  B (0,M)\n}\n';
    expect(err(src, { kind: 'addComponent', agregacija: 'G', component: 'G' }).message).toBe('Komponente moraju biti različiti elementi.');
    expect(err(src, { kind: 'addComponent', agregacija: 'G', component: 'A' }).message).toBe('Element je već komponenta.');
  });
});

describe('specijalizacija', () => {
  const base = 'objekat Gradjanin {\n  Mlb#\n}\n';

  it('addSpecijalizacija creates two subtypes and no E10 on them', () => {
    const r = ok(base, { kind: 'addSpecijalizacija', nadtip: 'Gradjanin' });
    expect(r.source).toBe(
      `${base}\nobjekat Podtip1 {\n}\n\nobjekat Podtip2 {\n}\n\nspecijalizacija Vrsta1 {\n  nadtip Gradjanin (0,M)\n  podtip Podtip1\n  podtip Podtip2\n}\n`,
    );
    expect(errs(r.source)).toEqual([]);
    expect(r.select).toBe('Vrsta1');
    expect(r.placeAt?.map((p) => p.dir)).toEqual(['below', 'below', 'below', 'right']);
  });

  it('nadtip without identifier keeps E10 on the nadtip only', () => {
    const r = ok('objekat G {\n}\n', { kind: 'addSpecijalizacija', nadtip: 'G' });
    const e10 = compile(r.source).diagnostics.filter((d) => d.code === 'E10');
    expect(e10.map((d) => d.elementId)).toEqual(['G']);
  });

  const withSpec = ok(base, { kind: 'addSpecijalizacija', nadtip: 'Gradjanin' }).source;

  it('addPodtip with a new object goes at the right end of the row', () => {
    const r = ok(withSpec, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: { newObject: true } });
    expect(r.source).toContain('  podtip Podtip2\n  podtip Podtip3\n}');
    expect(r.source.endsWith('objekat Podtip3 {\n}\n')).toBe(true);
    expect(r.placeAt).toEqual([{ id: 'Podtip3', near: 'Podtip2', dir: 'right' }]);
    expect(errs(r.source)).toEqual([]);
  });

  it('addPodtip with an existing object', () => {
    const src = `${withSpec}\nobjekat Drugi {\n  D#\n}\n`;
    const r = ok(src, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: 'Drugi' });
    expect(r.source).toContain('  podtip Podtip2\n  podtip Drugi\n}');
    expect(errs(r.source)).toEqual([]);
  });

  it('addPodtip rejects self, duplicates and cycles', () => {
    expect(err(withSpec, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: 'Gradjanin' }).message).toBe('Podtip ne može biti sam nadtip.');
    expect(err(withSpec, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: 'Podtip1' }).message).toBe('Objekat je već podtip.');
    // Podtip1 becomes a nadtip of a second specijalizacija; adding Gradjanin below it would close a cycle.
    const two = ok(withSpec, { kind: 'addSpecijalizacija', nadtip: 'Podtip1' }).source;
    expect(
      err(two, { kind: 'addPodtip', specijalizacija: 'Vrsta2', podtip: 'Gradjanin' }).message,
    ).toBe('Ovo bi napravilo ciklus specijalizacije.');
    expect(codes(two)).not.toContain('E09');
  });

  it('pickRejection mirrors the builder rules', () => {
    const ir = compile(withSpec).ir!;
    const p = { kind: 'podtip', specijalizacija: 'Vrsta1' } as const;
    expect(pickRejection(ir, p, 'Gradjanin')).toBe('Podtip ne može biti sam nadtip.');
    expect(pickRejection(ir, p, 'Podtip2')).toBe('Objekat je već podtip.');
    expect(pickRejection(ir, { kind: 'veza', from: 'Gradjanin' }, 'Gradjanin')).toBeNull();
    expect(pickRejection(ir, { kind: 'agregacija', first: 'Gradjanin' }, 'Gradjanin')).not.toBeNull();
    expect(pickRejection(ir, { kind: 'veza', from: 'Gradjanin' }, 'Vrsta1')).not.toBeNull();
  });

  it('removePodtip removes one line when 2+ would remain', () => {
    const three = ok(withSpec, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: { newObject: true } }).source;
    const r = ok(three, { kind: 'removePodtip', specijalizacija: 'Vrsta1', podtip: 'Podtip2', withDependents: false });
    expect(r.source).toContain('  podtip Podtip1\n  podtip Podtip3\n}');
    expect(errs(r.source)).toEqual(['E10']); // the detached Podtip2 is a core object again
  });

  it('removePodtip asks before dropping the specijalizacija when < 2 would remain', () => {
    const a: BuilderAction = { kind: 'removePodtip', specijalizacija: 'Vrsta1', podtip: 'Podtip2', withDependents: false };
    const r = err(withSpec, a);
    expect(r.message).toBe('Obrisati i zavisne elemente (1)?');
    expect(r.needsConfirmation?.dependents).toEqual([{ id: 'Vrsta1', kind: 'specijalizacija' }]);
    const done = ok(withSpec, { ...a, withDependents: true });
    expect(done.source).not.toContain('specijalizacija');
    expect(done.source).toContain('objekat Podtip1');
  });
});

describe('rename', () => {
  const src = '// header\nobjekat Radnik { Mlb# }  // trailing\n\nveza Radi {\n  Radnik    (1,1)\n  Odeljenje (0,M)\n}\n\nobjekat Odeljenje {\n  S#\n}\n';

  it('renames the block and every reference, keeps comments and formatting', () => {
    const r = ok(src, { kind: 'rename', element: 'Radnik', newName: 'Zaposleni' });
    expect(r.source).toBe(
      '// header\nobjekat Zaposleni { Mlb# }  // trailing\n\nveza Radi {\n  Zaposleni (1,1)\n  Odeljenje (0,M)\n}\n\nobjekat Odeljenje {\n  S#\n}\n',
    );
    expect(r.select).toBe('Zaposleni');
    expect(r.renames).toContainEqual({ from: 'Radnik', to: 'Zaposleni' });
    expect(r.renames).toContainEqual({ from: 'attr:Radnik:Mlb', to: 'attr:Zaposleni:Mlb' });
    expect(codes(r.source)).toEqual(codes(src));
  });

  it('rejects duplicates and bad names', () => {
    expect(err(src, { kind: 'rename', element: 'Radnik', newName: 'Odeljenje' }).message).toBe('Ime je već zauzeto.');
    expect(err(src, { kind: 'rename', element: 'Radnik', newName: '' }).message).toBe('Neispravno ime.');
    expect(err(src, { kind: 'rename', element: 'Radnik', newName: 'a"b' }).message).toBe('Neispravno ime.');
    expect(err(src, { kind: 'rename', element: 'Radnik', newName: '_' }).message).toBe('Neispravno ime.');
  });

  it('quotes names with spaces and keyword names', () => {
    expect(ok(src, { kind: 'rename', element: 'Radnik', newName: 'Moj radnik' }).source).toContain('objekat "Moj radnik" {');
    expect(ok(src, { kind: 'rename', element: 'Radnik', newName: 'nadtip' }).source).toContain('objekat "nadtip" {');
  });

  it('renaming a veza to empty makes it _ (and back)', () => {
    const r = ok(src, { kind: 'rename', element: 'Radi', newName: '' });
    expect(r.source).toContain('veza _ {');
    expect(r.select).toBe('_#1');
    expect(r.renames).toContainEqual({ from: 'Radi', to: '_#1' });
    const back = ok(r.source, { kind: 'rename', element: '_#1', newName: 'Radi' });
    expect(back.source).toBe(src);
  });

  it('renames a specijalizacija (spec and junction node ids move too)', () => {
    const s = ok('objekat G {\n  A#\n}\n', { kind: 'addSpecijalizacija', nadtip: 'G' }).source;
    const r = ok(s, { kind: 'rename', element: 'Vrsta1', newName: 'Vrsta' });
    expect(r.renames).toContainEqual({ from: 'spec:Vrsta1', to: 'spec:Vrsta' });
    expect(r.renames).toContainEqual({ from: 'junction:Vrsta1', to: 'junction:Vrsta' });
  });
});

describe('setCardinality / setMappingName', () => {
  const src = 'objekat A {\n  X#\n}\nobjekat B {\n  Y#\n}\nveza V {\n  A (1,1) Radi\n  B (0,M)\n}\nslab S {\n  nadređeni A (0,M)\n  Rb#\n}\n';

  it('rewrites (DG,GG) on the right participant', () => {
    expect(ok(src, { kind: 'setCardinality', element: 'V', participantIndex: 1, dg: 1, gg: 'M' }).source).toContain('  B (1,M)\n');
    expect(ok(src, { kind: 'setCardinality', element: 'V', participantIndex: 0, dg: 0, gg: '1' }).source).toContain('  A (0,1) Radi\n');
    expect(ok(src, { kind: 'setCardinality', element: 'S', participantIndex: 0, dg: 1, gg: '1' }).source).toContain('nadređeni A (1,1)');
  });

  it('sets, changes and clears the mapping name', () => {
    expect(ok(src, { kind: 'setMappingName', element: 'V', participantIndex: 1, name: 'Ima' }).source).toContain('  B (0,M) Ima\n');
    expect(ok(src, { kind: 'setMappingName', element: 'V', participantIndex: 0, name: 'Nov naziv' }).source).toContain('A (1,1) "Nov naziv"');
    expect(ok(src, { kind: 'setMappingName', element: 'V', participantIndex: 0, name: null }).source).toContain('  A (1,1)\n');
    expect(ok(src, { kind: 'setMappingName', element: 'V', participantIndex: 1, name: null }).source).toBe(src);
  });
});

describe('deleteElement', () => {
  const src = [
    'objekat A {\n  X#\n}',
    'objekat B {\n  Y#\n}',
    'objekat C {\n  Z#\n}',
    'veza V1 {\n  A (1,1)\n  B (0,M)\n}',
    'veza V2 {\n  B (1,1)\n  C (0,M)\n}',
    'slab S {\n  nadređeni A (0,M)\n  Rb#\n}',
    'agregacija G {\n  A (0,M)\n  B (0,M)\n  C (0,M)\n}',
  ].join('\n\n') + '\n';

  it('removes the block and the veze that reference it, without a prompt for veze only', () => {
    const r = ok(src, { kind: 'deleteElement', element: 'V1', withDependents: false });
    expect(r.source).not.toContain('veza V1');
    expect(r.source).toContain('veza V2');
    expect(r.source).not.toMatch(/\n\n\n/);
  });

  it('asks before deleting dependents (slab, agregacija)', () => {
    const a: BuilderAction = { kind: 'deleteElement', element: 'C', withDependents: false };
    // C is only a third component of G and part of V2 → V2 goes silently, G keeps 2 components
    const r = ok(src, a);
    expect(r.source).not.toContain('veza V2');
    expect(r.source).toContain('agregacija G {\n  A (0,M)\n  B (0,M)\n}');
    expect(compile(r.source).hasErrors).toBe(false);

    const hard = err(src, { kind: 'deleteElement', element: 'A', withDependents: false });
    expect(hard.message).toBe('Obrisati i zavisne elemente (1)?');
    expect(hard.needsConfirmation?.dependents).toEqual([{ id: 'S', kind: 'slab' }]);
    const done = ok(src, { kind: 'deleteElement', element: 'A', withDependents: true });
    expect(done.source).not.toContain('slab S');
    expect(done.source).not.toContain('veza V1');
    expect(done.source).toContain('veza V2');
    expect(done.source).toContain('agregacija G {\n  B (0,M)\n  C (0,M)\n}');
    expect(compile(done.source).hasErrors).toBe(false);
  });

  it('counts an agregacija left with < 2 components as a dependent (transitively)', () => {
    const s = 'objekat A {\n  X#\n}\nobjekat B {\n  Y#\n}\nagregacija G {\n  A (0,M)\n  B (0,M)\n}\nveza V {\n  G (1,1)\n  A (0,M)\n}\n';
    const r = err(s, { kind: 'deleteElement', element: 'B', withDependents: false });
    expect(r.needsConfirmation?.dependents).toEqual([{ id: 'G', kind: 'agregacija' }]);
    const done = ok(s, { kind: 'deleteElement', element: 'B', withDependents: true });
    expect(done.source).toBe('objekat A {\n  X#\n}\n');
  });

  it('deleting a podtip object removes its podtip line; deleting a nadtip removes the specijalizacija', () => {
    let s = ok('objekat G {\n  A#\n}\n', { kind: 'addSpecijalizacija', nadtip: 'G' }).source;
    s = ok(s, { kind: 'addPodtip', specijalizacija: 'Vrsta1', podtip: { newObject: true } }).source;
    const r = ok(s, { kind: 'deleteElement', element: 'Podtip3', withDependents: false });
    expect(r.source).not.toContain('Podtip3');
    expect(compile(r.source).hasErrors).toBe(false);

    const two = ok('objekat G {\n  A#\n}\n', { kind: 'addSpecijalizacija', nadtip: 'G' }).source;
    expect(err(two, { kind: 'deleteElement', element: 'Podtip1', withDependents: false }).needsConfirmation).toBeTruthy();
    const gone = ok(two, { kind: 'deleteElement', element: 'G', withDependents: true });
    expect(gone.source).not.toContain('specijalizacija');
    expect(gone.source).toContain('objekat Podtip1');
    expect(codes(gone.source)).toContain('E10');
  });

  it('deleting the only block leaves an empty source', () => {
    expect(ok(NEW, { kind: 'deleteElement', element: 'Objekat1', withDependents: false }).source).toBe('');
  });

  it('shifting unnamed veza ids are reported as renames', () => {
    const s = 'objekat A {\n  X#\n}\nveza _ {\n  A (1,1) U1\n  A (0,M) U2\n}\nveza _ {\n  A (1,1) U1\n  A (0,M) U2\n}\n';
    const r = ok(s, { kind: 'deleteElement', element: '_#1', withDependents: false });
    expect(r.renames).toEqual([{ from: '_#2', to: '_#1' }]);
  });
});

describe('attributes', () => {
  const dom = { domain: 'long' as const, constraint: null };

  it('adds to an empty block, quoting names with spaces', () => {
    const r = ok(NEW, { kind: 'addAttribute', owner: 'Objekat1', attr: { name: 'Br', id: true, ...dom } });
    expect(r.source).toBe('objekat Objekat1 {\n  Br# : long\n}\n');
    expect(r.select).toBe('Objekat1');
    expect(codes(r.source)).toEqual(['W03']);
    const q = ok(NEW, { kind: 'addAttribute', owner: 'Objekat1', attr: { name: 'Ime i prezime', id: false } });
    expect(q.source).toBe('objekat Objekat1 {\n  "Ime i prezime"\n}\n');
  });

  it('adds to a multi-line block aligned to the colon column', () => {
    const s = 'objekat R {\n  Mlb#    : long NotNull\n  ImeR    : string\n}\n';
    const r = ok(s, { kind: 'addAttribute', owner: 'R', attr: { name: 'Ab', id: false, domain: 'string', constraint: 'In(a, b)' } });
    expect(r.source).toBe('objekat R {\n  Mlb#    : long NotNull\n  ImeR    : string\n  Ab      : string In(a, b)\n}\n');
  });

  it('expands a single-line block when adding', () => {
    const s = 'objekat Student   { BrojInd#, Ime }\n';
    const r = ok(s, { kind: 'addAttribute', owner: 'Student', attr: { name: 'Smer', id: false } });
    expect(r.source).toBe('objekat Student   {\n  BrojInd#, Ime\n  Smer\n}\n');
  });

  it('edits in place; single-line stays single-line', () => {
    const s = 'objekat Student { BrojInd#, Ime, Smer }\n';
    const r = ok(s, { kind: 'editAttribute', owner: 'Student', index: 1, attr: { name: 'Prezime', id: false } });
    expect(r.source).toBe('objekat Student { BrojInd#, Prezime, Smer }\n');
    expect(r.renames).toEqual([{ from: 'attr:Student:Ime', to: 'attr:Student:Prezime' }]);
    const h = ok(s, { kind: 'editAttribute', owner: 'Student', index: 2, attr: { name: 'Smer', id: true, domain: 'string', constraint: 'NotNull' } });
    expect(h.source).toBe('objekat Student { BrojInd#, Ime, Smer# : string NotNull }\n');
  });

  it('a constraint on a non-last item of a comma line splits the line', () => {
    const s = 'objekat S {\n  A#, B, C\n}\n';
    const r = ok(s, { kind: 'editAttribute', owner: 'S', index: 1, attr: { name: 'B', id: false, domain: 'long', constraint: 'NotNull' } });
    expect(r.source).toBe('objekat S {\n  A#\n  B : long NotNull\n  C\n}\n');
    const one = ok('objekat S { A#, B, C }\n', { kind: 'editAttribute', owner: 'S', index: 0, attr: { name: 'A', id: true, domain: 'long', constraint: 'NotNull' } });
    expect(one.source).toBe('objekat S {\n  A# : long NotNull\n  B\n  C\n}\n');
  });

  it('edit keeps the colon alignment of the original', () => {
    const s = 'objekat R {\n  Mlb#    : long NotNull\n}\n';
    const r = ok(s, { kind: 'editAttribute', owner: 'R', index: 0, attr: { name: 'Id', id: true, domain: 'short' } });
    expect(r.source).toBe('objekat R {\n  Id#     : short\n}\n');
  });

  it('constraint without a domain is dropped', () => {
    const r = ok(NEW, { kind: 'addAttribute', owner: 'Objekat1', attr: { name: 'A', id: false, constraint: 'NotNull' } });
    expect(r.source).toBe('objekat Objekat1 {\n  A\n}\n');
  });

  it('deletes from multi-line, single-line and comma-separated blocks', () => {
    const m = 'objekat R {\n  A# : long\n  B : string\n  C, D\n}\n';
    expect(ok(m, { kind: 'deleteAttribute', owner: 'R', index: 1 }).source).toBe('objekat R {\n  A# : long\n  C, D\n}\n');
    expect(ok(m, { kind: 'deleteAttribute', owner: 'R', index: 2 }).source).toBe('objekat R {\n  A# : long\n  B : string\n  D\n}\n');
    expect(ok(m, { kind: 'deleteAttribute', owner: 'R', index: 3 }).source).toBe('objekat R {\n  A# : long\n  B : string\n  C\n}\n');
    const s = 'objekat S { A#, B, C }\n';
    expect(ok(s, { kind: 'deleteAttribute', owner: 'S', index: 0 }).source).toBe('objekat S { B, C }\n');
    expect(ok(s, { kind: 'deleteAttribute', owner: 'S', index: 2 }).source).toBe('objekat S { A#, B }\n');
    expect(ok('objekat S { A# }\n', { kind: 'deleteAttribute', owner: 'S', index: 0 }).source).toBe('objekat S {  }\n');
  });

  it('works on slab and agregacija and rejects veza', () => {
    const s = 'objekat A {\n  X#\n}\nslab S {\n  nadređeni A (0,M)\n  Rb#\n}\n';
    expect(ok(s, { kind: 'addAttribute', owner: 'S', attr: { name: 'Iznos', id: false, domain: 'long' } }).source).toContain(
      '  Rb#\n  Iznos : long\n}',
    );
    const v = 'objekat A {\n  X#\n}\nveza _ {\n  A (1,1) U1\n  A (0,M) U2\n}\n';
    expect(err(v, { kind: 'addAttribute', owner: '_#1', attr: { name: 'Q', id: false } }).ok).toBe(false);
  });

  it('rejects invalid attribute names', () => {
    expect(err(NEW, { kind: 'addAttribute', owner: 'Objekat1', attr: { name: '  ', id: false } }).message).toBe('Neispravno ime.');
  });

  it('keeps CRLF line endings', () => {
    const s = 'objekat A {\r\n  X#\r\n}\r\n';
    const r = ok(s, { kind: 'addAttribute', owner: 'A', attr: { name: 'Y', id: false } });
    expect(r.source).toBe('objekat A {\r\n  X#\r\n  Y\r\n}\r\n');
  });
});
