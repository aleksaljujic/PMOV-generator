// Needs T15 (English keyword aliases in the parser).
import { describe, expect, it } from 'vitest';
import { compile } from '../lang';
import { applyBuilderAction } from './index';
import type { BuilderAction } from './index';

const EN = { locale: 'en' } as const;

function ok(src: string, a: BuilderAction, opts?: { locale: 'en' | 'sr' }) {
  const r = applyBuilderAction(src, a, opts);
  if (!r.ok) throw new Error(r.message);
  expect(compile(r.source).diagnostics.filter((d) => d.code.startsWith('S'))).toEqual([]);
  return r;
}

describe('EN output', () => {
  it('newModel', () => {
    const r = ok('', { kind: 'newModel' }, EN);
    expect(r.source).toBe('object Object1 {\n}\n');
    expect(r.select).toBe('Object1');
  });

  it('weak object', () => {
    const r = ok('object Employee {\n}\n', { kind: 'addSlab', parent: 'Employee' }, EN);
    expect(r.source).toContain('weak Weak1 {\n  owner Employee (0,M)\n  No#\n}');
  });

  it('veza, aggregation, component', () => {
    let r = ok('object A {\n}\n', { kind: 'addVeza', from: 'A', to: { newObject: true } }, EN);
    expect(r.source).toContain('object Object1 {\n}');
    expect(r.source).toContain('relationship _ {');
    r = ok('object A {\n}\n', { kind: 'addAgregacija', first: 'A', second: { newObject: true } }, EN);
    expect(r.source).toContain('aggregation Aggregation1 {');
    r = ok(r.source, { kind: 'addComponent', agregacija: 'Aggregation1', component: { newObject: true } }, EN);
    expect(r.source).toContain('Object2 (0,M)');
  });

  it('specialization', () => {
    const r = ok('object X {\n  K# : long\n}\n', { kind: 'addSpecijalizacija', nadtip: 'X' }, EN);
    expect(r.source).toContain('specialization Kind1 {\n  supertype X (0,M)\n  subtype Subtype1\n  subtype Subtype2\n}');
    const r2 = ok(r.source, { kind: 'addPodtip', specijalizacija: 'Kind1', podtip: { newObject: true } }, EN);
    expect(r2.source).toContain('  subtype Subtype3');
  });

  it('placeholder numbering ignores the other language', () => {
    const r = ok('objekat Objekat1 {\n}\n', { kind: 'addObject', near: 'Objekat1' }, EN);
    expect(r.select).toBe('Object1');
    expect(r.source).toContain('object Object1 {');
    expect(r.source).toContain('objekat Objekat1 {');
  });

  it('serbian keywords stay when editing in EN', () => {
    const r = ok('objekat A {\n}\n', { kind: 'addAttribute', owner: 'A', attr: { name: 'x', id: true } }, EN);
    expect(r.source).toBe('objekat A {\n  x#\n}\n');
  });
});

const ENGLISH = `object Employee {
  Id# : long
}
object Dept {
  Code# : long
}
weak Child {
  owner Employee (0,M)
  No#
}
aggregation G {
  Employee (0,M)
  Dept (0,M)
}
relationship Works {
  Employee (1,1)
  Dept (0,M)
}
object Top {
  T# : long
}
object P1 {
}
object P2 {
}
specialization Sp {
  supertype Top (0,M)
  subtype P1
  subtype P2
}
`;
const NADREDJENI = `objekat A {
  X# : long
}
slab S {
  nadredjeni A (0,M)
  Rb#
}
`;

describe('editing sources written with English keywords / nadredjeni', () => {
  for (const loc of ['sr', 'en'] as const) {
    it(`rename, attributes, addComponent, delete (${loc})`, () => {
      let r = ok(ENGLISH, { kind: 'rename', element: 'Employee', newName: 'Worker' }, { locale: loc });
      expect(r.source).toContain('owner Worker (0,M)');
      r = ok(r.source, { kind: 'addAttribute', owner: 'Worker', attr: { name: 'Name', id: false, domain: 'string' } }, { locale: loc });
      expect(r.source).toContain('Name');
      r = ok(r.source, { kind: 'editAttribute', owner: 'Worker', index: 1, attr: { name: 'Nm', id: false } }, { locale: loc });
      r = ok(r.source, { kind: 'deleteAttribute', owner: 'Worker', index: 1 }, { locale: loc });
      r = ok(r.source, { kind: 'addComponent', agregacija: 'G', component: 'Top' }, { locale: loc });
      expect(r.source).toContain('Top');
      r = ok(r.source, { kind: 'setCardinality', element: 'Child', participantIndex: 0, dg: 1, gg: '1' }, { locale: loc });
      expect(r.source).toContain('owner Worker (1,1)');
      const del = applyBuilderAction(r.source, { kind: 'deleteElement', element: 'Top', withDependents: false }, { locale: loc });
      expect(del.ok).toBe(false);
      r = ok(r.source, { kind: 'removePodtip', specijalizacija: 'Sp', podtip: 'P1', withDependents: true }, { locale: loc });
      expect(r.source).not.toContain('specialization Sp');
    });
  }

  it('nadredjeni source', () => {
    let r = ok(NADREDJENI, { kind: 'rename', element: 'A', newName: 'B' });
    expect(r.source).toContain('nadredjeni B (0,M)');
    r = ok(r.source, { kind: 'addAttribute', owner: 'S', attr: { name: 'q', id: false } });
    r = ok(r.source, { kind: 'deleteElement', element: 'B', withDependents: true });
    expect(r.source).not.toContain('slab');
  });
});
