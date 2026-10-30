// Unit tests for C10 §2 against hand-built ASTs (no parser needed).
import { describe, expect, it } from 'vitest';
import type { ConstraintBlockAst, ConstraintLineAst, DomainDeclAst, ModelAst, NameAst, RuleLineAst } from '../ast';
import type { SourceSpan } from '../diagnostics';
import { buildIr } from './buildIr';
import { check } from './check';
import { sp, attr, attrs, block, part } from './testAst';

const nm = (text: string): NameAst => ({ text, quoted: false, span: sp() });
const num = (value: number): { value: number; span: SourceSpan } => ({ value, span: sp() });

const dom = (name: string, base: string, opts: { len?: number; c?: string } = {}): DomainDeclAst => {
  const builtin = ['long', 'short', 'string', 'date'].includes(base);
  return {
    kind: 'domainDecl', keywordSpan: sp(), name: nm(name),
    base: {
      builtin: builtin ? (base as 'long') : null, name: builtin ? null : nm(base),
      length: opts.len !== undefined ? num(opts.len) : null, span: sp(),
    },
    constraint: opts.c ? { text: opts.c, span: sp() } : null, span: sp(),
  };
};
const uattr = (name: string, userDomain: string, extra: object = {}) => ({ ...attr(name), userDomain: nm(userDomain), ...extra });
const O = (n: string, ...a: ReturnType<typeof attr>[]) => block('objekat', n, attrs(attr('Id', true, 'long'), ...a));
const ref = (child: string, parent: string, a?: string[]): ConstraintLineAst => ({
  kind: 'refHeader', child: nm(child), attrs: a ? a.map(nm) : null, parent: nm(parent), span: sp(),
});
const cond = (text: string): ConstraintLineAst => ({
  kind: 'condition', keywordSpan: sp(), text, textSpan: { from: 100, to: 100 + text.length, line: 3, col: 10, endLine: 3, endCol: 10 + text.length }, span: sp(),
});
const rule = (relation: string, ...items: [string, string | null][]): RuleLineAst => ({
  kind: 'rule', relation: nm(relation),
  items: items.map(([o, a]) => ({ op: { value: o, span: sp() }, action: a ? { value: a, span: sp() } : null, span: sp() })),
  span: sp(),
});
const con = (name: string, ...lines: ConstraintLineAst[]): ConstraintBlockAst => ({
  kind: 'ograničenje', kindSpan: sp(), name: nm(name), lines, span: sp(),
});
const M = (o: { domains?: DomainDeclAst[]; constraints?: ConstraintBlockAst[]; blocks?: ModelAst['blocks'] }): ModelAst => ({
  blocks: o.blocks ?? [O('A'), O('B')],
  ...(o.domains ? { domains: o.domains } : {}),
  ...(o.constraints ? { constraints: o.constraints } : {}),
});
const codes = (m: ModelAst, c?: string) => check(m).map((d) => d.code).filter((x) => !c || x === c);
const has = (m: ModelAst, c: string) => codes(m).includes(c as never);

describe('domain table', () => {
  it('omit-when-empty: no C10 keys without C10 syntax', () => {
    const ir = buildIr(M({}));
    expect('domains' in ir || 'constraints' in ir).toBe(false);
    expect(JSON.stringify(ir)).not.toContain('userDomain');
  });
  it('E13 on attribute and on domain base', () => {
    const bad = M({ blocks: [O('A', uattr('X', 'Nema'))] });
    const d = check(bad).find((x) => x.code === 'E13')!;
    expect(d.elementId).toBe('A');
    expect(d.message).toBe("domen 'Nema' nije deklarisan.");
    expect(has(M({ domains: [dom('D', 'Nema')] }), 'E13')).toBe(true);
    expect(has(M({ domains: [dom('D', 'long')], blocks: [O('A', uattr('X', 'D'))] }), 'E13')).toBe(false);
  });
  it('E14a duplicate (first wins), E14b built-in name, E14c length', () => {
    const dup = M({ domains: [dom('D', 'long'), dom('D', 'short')], blocks: [O('A', uattr('X', 'D'))] });
    expect(codes(dup, 'E14')).toHaveLength(1);
    expect(buildIr(dup).domains).toHaveLength(1);
    expect(buildIr(dup).domains![0]!.base).toBe('long');
    expect(has(M({ domains: [dom('string', 'long')] }), 'E14')).toBe(true);
    expect(has(M({ domains: [dom('D', 'long', { len: 5 })] }), 'E14')).toBe(true);
    expect(has(M({ domains: [dom('D', 'string', { len: 5 })], blocks: [O('A', uattr('X', 'D'))] }), 'E14')).toBe(false);
    const withLen = (b: 'long' | 'string') => M({ blocks: [O('A', { ...attr('X', false, b), length: num(3) })] });
    expect(has(withLen('long'), 'E14')).toBe(true);
    expect(has(withLen('string'), 'E14')).toBe(false);
    expect(has(M({ domains: [dom('D', 'long')], blocks: [O('A', uattr('X', 'D', { length: num(3) }))] }), 'E14')).toBe(true);
  });
  it('E15 once per cycle, on the first domain in source order', () => {
    const m = M({ domains: [dom('C', 'string'), dom('A', 'B'), dom('B', 'A')], blocks: [O('X', uattr('Y', 'A'), uattr('Z', 'C'))] });
    const ds = check(m).filter((d) => d.code === 'E15');
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toBe("domeni 'A' → 'B' → 'A' čine ciklus.");
    expect(ds[0]!.span).toBe(m.domains![1]!.base!.name!.span);
    expect(buildIr(m).domains!.find((d) => d.name === 'A')!.base).toBeNull();
    expect(has(M({ domains: [dom('A', 'A')] }), 'E15')).toBe(true);
    expect(has(M({ domains: [dom('A', 'B'), dom('B', 'long')] }), 'E15')).toBe(false);
  });
  it('W05 and W02 suppression', () => {
    const m = M({ domains: [dom('D', 'long'), dom('U', 'long'), dom('P', 'U')], blocks: [O('A', uattr('X', 'D'), attr('Y'))] });
    const w5 = check(m).filter((d) => d.code === 'W05').map((d) => d.message);
    expect(w5).toEqual(["domen 'P' se ne koristi."]);
    expect(codes(m, 'W02')).toHaveLength(1); // only Y
  });
  it('resolution: chain, length, effective constraint, attributes', () => {
    const m = M({
      domains: [dom('Naziv', 'string', { len: 40, c: 'NotNull' }), dom('Kratak', 'Naziv', { c: "Like '[A-Z]%'" }), dom('Oznaka', 'Kratak')],
      blocks: [O('A', uattr('O', 'Oznaka'), { ...uattr('P', 'Naziv'), length: num(10) }, { ...attr('Q', false, 'string'), length: num(7) })],
    });
    const ir = buildIr(m);
    const o = ir.domains!.find((d) => d.name === 'Oznaka')!;
    expect(o).toMatchObject({ parent: 'Kratak', base: 'string', length: 40, constraint: null, effectiveConstraint: "NotNull And Like '[A-Z]%'" });
    expect(ir.domains!.find((d) => d.name === 'Naziv')!).toMatchObject({ parent: null, effectiveConstraint: 'NotNull' });
    const at = (ir.elements[0] as unknown as { attributes: Record<string, unknown>[] }).attributes;
    expect(at[1]).toMatchObject({ userDomain: 'Oznaka', domain: 'string', length: 40, constraint: null });
    expect(at[2]).toMatchObject({ userDomain: 'Naziv', length: 10 });
    expect(at[3]).toMatchObject({ domain: 'string', length: 7 });
    expect('userDomain' in at[3]!).toBe(false);
    expect('length' in at[0]!).toBe(false);
  });
  it('unresolvable attribute domain is null', () => {
    const at = (buildIr(M({ blocks: [O('A', uattr('X', 'Nema'))] })).elements[0] as { attributes: { domain: unknown }[] }).attributes;
    expect(at[1]!.domain).toBeNull();
  });
});

describe('constraints', () => {
  const base = { blocks: [O('A'), O('B'), O('Radnik'), block('veza', 'Zaposlenje', part('A', ['0', 'M']), part('B', ['0', 'M']))] };
  const ok = (...lines: ConstraintLineAst[]) => M({ ...base, constraints: [con('C', ref('A', 'B'), ...lines)] });
  const e17 = (m: ModelAst) => check(m).filter((d) => d.code === 'E17');

  it('valid referential constraint builds an IR entry', () => {
    const m = ok(rule('B', ['update', 'cascades'], ['delete', 'restricted']), rule('A', ['insert', 'nullifies']));
    expect(check(m).filter((d) => d.code === 'E16' || d.code === 'E17')).toEqual([]);
    const c = buildIr(m).constraints![0]!;
    expect(c).toMatchObject({ kind: 'referential', id: 'C', child: 'A', parent: 'B', childAttrs: null });
    expect(c.rules.map((r) => [r.relation, r.op, r.action])).toEqual([
      ['B', 'update', 'cascades'], ['B', 'delete', 'restricted'], ['A', 'insert', 'nullifies'],
    ]);
  });
  it('quoted names with spaces are normalized; childAttrs kept; relation lookup includes named veza', () => {
    const m = M({ ...base, constraints: [con('C', ref('A', 'Zaposlenje', ['X', 'Y']), rule('Zaposlenje', ['update', 'cascades']))] });
    expect(check(m).filter((d) => d.code === 'E16')).toEqual([]);
    const m2 = M({ blocks: [O('Ime Prezime'), O('B')], constraints: [con('C', ref('Ime Prezime', 'B', ['p', 'q']))] });
    expect(check(m2).filter((d) => d.code === 'E16')).toHaveLength(0);
    expect((buildIr(m2).constraints![0] as { child: string }).child).toBe('ImePrezime');
    const c = buildIr(m).constraints![0]!;
    expect(c).toMatchObject({ childAttrs: ['X', 'Y'], parent: 'Zaposlenje' });
  });
  it('E16: header and rule relations; the broken header drops the constraint, a broken rule only the rule', () => {
    const h = M({ ...base, constraints: [con('C', ref('A', 'Nema'))] });
    expect(has(h, 'E16')).toBe(true);
    expect(buildIr(h).constraints).toBeUndefined();
    const r = ok(rule('Nema', ['update', 'cascades']), rule('B', ['update', 'cascades']));
    expect(codes(r, 'E16')).toHaveLength(1);
    expect(buildIr(r).constraints![0]!.rules).toHaveLength(1);
    expect(check(h).find((d) => d.code === 'E16')!.message).toBe("relacija 'Nema' ne postoji.");
    expect(has(M({ ...base, constraints: [con('C', ref('A', 'B'))] }), 'E16')).toBe(false);
  });
  it('E17 no header; more than one header; both kinds', () => {
    expect(e17(M({ ...base, constraints: [con('C', rule('A', ['insert', 'restricted']))] }))).toHaveLength(1);
    expect(buildIr(M({ ...base, constraints: [con('C')] })).constraints).toBeUndefined();
    const two = M({ ...base, constraints: [con('C', ref('A', 'B'), ref('B', 'A'))] });
    expect(e17(two)).toHaveLength(1);
    expect(buildIr(two).constraints).toBeUndefined();
    const both = M({ ...base, constraints: [con('C', ref('A', 'B'), cond('A.X > 1'), rule('A', ['insert', 'restricted']))] });
    expect(e17(both)).toHaveLength(1);
  });
  it('E17 empty uslov; general without rule line', () => {
    const empty = M({ ...base, constraints: [con('C', cond(''), rule('A', ['insert', 'restricted']))] });
    expect(e17(empty)).toHaveLength(1);
    expect(buildIr(empty).constraints).toBeUndefined();
    const norule = M({ ...base, constraints: [con('C', cond('A.X > 1'))] });
    expect(e17(norule)).toHaveLength(1);
    expect(buildIr(norule).constraints).toBeUndefined();
    expect(e17(M({ ...base, constraints: [con('C', cond('A.X > 1'), rule('A', ['insert', 'restricted']))] }))).toEqual([]);
  });
  it('E17 unknown operation; unknown or missing action; invalid rules are dropped, valid kept', () => {
    const m = ok(rule('B', ['merge', 'restricted'], ['update', 'explode'], ['delete', null], ['update', 'cascades']));
    expect(e17(m)).toHaveLength(3);
    expect(buildIr(m).constraints![0]!.rules.map((r) => r.op)).toEqual(['update']);
    expect(e17(ok(rule('B', ['update', 'cascades'])))).toEqual([]);
  });
  it('E17 cell "/": child delete, parent insert', () => {
    const cd = e17(ok(rule('A', ['delete', 'restricted'])));
    expect(cd).toHaveLength(1);
    expect(cd[0]!.message).toBe("ograničenje 'C': DELETE nije dozvoljen za relaciju-dete 'A'.");
    expect(e17(ok(rule('B', ['insert', 'restricted'])))).toHaveLength(1);
    expect(e17(ok(rule('A', ['insert', 'restricted'], ['update', 'restricted'])))).toEqual([]);
  });
  it('E17 action not allowed for the cell', () => {
    expect(e17(ok(rule('A', ['insert', 'cascades'])))).toHaveLength(1);
    expect(e17(ok(rule('A', ['update', 'cascades'])))).toHaveLength(1);
    expect(e17(ok(rule('B', ['delete', 'cascades'])))).toEqual([]);
    expect(e17(ok(rule('A', ['insert', 'default'])))).toEqual([]);
  });
  it('E17 repeated op for the same relation (first wins)', () => {
    const m = ok(rule('B', ['update', 'cascades']), rule('B', ['update', 'restricted']));
    expect(e17(m)).toHaveLength(1);
    expect(buildIr(m).constraints![0]!.rules).toHaveLength(1);
    expect(buildIr(m).constraints![0]!.rules[0]!.action).toBe('cascades');
    expect(e17(ok(rule('B', ['update', 'cascades']), rule('A', ['update', 'restricted'])))).toEqual([]);
  });
  it('E17 rule relation neither child nor parent', () => {
    const m = ok(rule('Radnik', ['update', 'restricted']));
    expect(e17(m)).toHaveLength(1);
    expect(codes(m, 'E16')).toEqual([]);
    expect(buildIr(m).constraints![0]!.rules).toEqual([]);
  });
  it('recursive FK (child == parent): insert -> child cell, update/delete -> parent cells', () => {
    const rec = (...lines: ConstraintLineAst[]) => M({ ...base, constraints: [con('C', ref('A', 'A', ['p']), ...lines)] });
    expect(e17(rec(rule('A', ['insert', 'nullifies'], ['update', 'cascades'], ['delete', 'cascades'])))).toEqual([]);
    expect(e17(rec(rule('A', ['insert', 'cascades'])))).toHaveLength(1);
  });
  it('general constraint: refs with spans, restricted only, rules', () => {
    const m = M({ ...base, constraints: [con('G', cond('A.X <= Radnik.Plata'), rule('A', ['insert', 'restricted'], ['update', 'restricted']), rule('Radnik', ['update', 'restricted']))] });
    expect(e17(m)).toEqual([]);
    const g = buildIr(m).constraints![0]!;
    if (g.kind !== 'general') throw new Error();
    expect(g.condition).toBe('A.X <= Radnik.Plata');
    expect(g.refs.map((r) => [r.relation, r.attribute, r.span.from, r.span.to])).toEqual([['A', 'X', 100, 103], ['Radnik', 'Plata', 107, 119]]);
    expect(g.rules).toHaveLength(3);
    const bad = M({ ...base, constraints: [con('G', cond('A.X > 1'), rule('A', ['insert', 'cascades']))] });
    expect(e17(bad)).toHaveLength(1);
    // child delete is fine for a general constraint (no child/parent roles)
    expect(e17(M({ ...base, constraints: [con('G', cond('A.X > 1'), rule('A', ['delete', 'restricted']))] }))).toEqual([]);
  });
  it('E17 duplicate constraint name (first wins); namespaces are separate', () => {
    const m = M({ ...base, constraints: [con('C', ref('A', 'B')), con('C', ref('B', 'A'))] });
    expect(e17(m)).toHaveLength(1);
    const ir = buildIr(m);
    expect(ir.constraints).toHaveLength(1);
    expect(ir.constraints![0]).toMatchObject({ child: 'A' });
    // same name as an element / a domain: no E01, no E17
    const sep = M({ ...base, domains: [dom('A', 'long')], constraints: [con('A', ref('A', 'B'))], blocks: [O('A'), O('B'), O('Z', uattr('Q', 'A'))] });
    expect(codes(sep).filter((c) => c === 'E01' || c === 'E14' || c === 'E17')).toEqual([]);
  });
  it('en messages: same code/span, English text', () => {
    const m = ok(rule('A', ['delete', 'restricted']));
    const sr = check(m).find((d) => d.code === 'E17')!;
    const en = check(m, { locale: 'en' }).find((d) => d.code === 'E17')!;
    expect(en.span).toEqual(sr.span);
    expect(en.message).toBe("constraint 'C': DELETE is not allowed for the child relation 'A'.");
  });
});
