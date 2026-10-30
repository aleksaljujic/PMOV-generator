// C10 §3: referential / general constraints of the relational model and their diagnostics (E18–E20, W06).
import type { Diagnostic, DiagnosticCode, IRConstraintRule, IRGeneralConstraint, IRReferentialConstraint, Locale, PmovIR } from '../lang';
import { severityOf } from '../lang';
import type { ConstraintAction } from '../lang';
import { DEFAULT_REF_ACTIONS, REF_CELLS } from './types';
import type { FkKind, GeneralConstraint, RefCell, ReferentialConstraint, RelAttribute, Relation } from './types';

export interface FkGroup {
  child: string;
  parent: string;
  attrs: RelAttribute[];
  group: string;
}

/** FK groups per relation in relation order, then first-appearance order inside the relation. */
export function collectFkGroups(relations: Relation[]): FkGroup[] {
  const out: FkGroup[] = [];
  for (const r of relations) {
    const byGroup = new Map<string, FkGroup>();
    for (const a of r.attributes) {
      if (!a.references) continue;
      let g = byGroup.get(a.references.group);
      if (!g) {
        g = { child: r.name, parent: a.references.relation, attrs: [], group: a.references.group };
        byGroup.set(a.references.group, g);
        out.push(g);
      }
      g.attrs.push(a);
    }
  }
  return out;
}

export function fkKindOf(attrs: RelAttribute[], identifyingChild: boolean): FkKind {
  if (attrs.every((a) => a.pk)) return identifyingChild ? 'identifying' : 'component';
  if (attrs.some((a) => a.nullable)) return 'nullable';
  return 'regular';
}

const MSG = {
  sr: {
    E18missing: (c: string, p: string) => `ne postoji strani ključ iz '${c}' u '${p}'.`,
    E18ambiguous: (c: string, p: string, l: string) => `iz '${c}' u '${p}' postoji više stranih ključeva; navedite atribute: ${l}.`,
    E18wrong: (c: string, p: string, a: string) => `atributi (${a}) nisu strani ključ iz '${c}' u '${p}'.`,
    E19pk: (c: string, a: string) => `NULLIFIES nije moguć: '${c}.${a}' je deo primarnog ključa.`,
    E19opt: (c: string, a: string) => `NULLIFIES nije moguć: strani ključ '${c}(${a})' nije opcioni.`,
    E20: (c: string, a: string, p: string, line: number) => `strani ključ '${c}(${a}) → ${p}' već ima ograničenje (red ${line}).`,
    W06: (r: string, a: string) => `'${r}.${a}' ne postoji u relacionom modelu.`,
  },
  en: {
    E18missing: (c: string, p: string) => `there is no foreign key from '${c}' to '${p}'.`,
    E18ambiguous: (c: string, p: string, l: string) => `there are several foreign keys from '${c}' to '${p}'; list the attributes: ${l}.`,
    E18wrong: (c: string, p: string, a: string) => `attributes (${a}) are not a foreign key from '${c}' to '${p}'.`,
    E19pk: (c: string, a: string) => `NULLIFIES is not possible: '${c}.${a}' is part of the primary key.`,
    E19opt: (c: string, a: string) => `NULLIFIES is not possible: foreign key '${c}(${a})' is not optional.`,
    E20: (c: string, a: string, p: string, line: number) => `foreign key '${c}(${a}) → ${p}' already has a constraint (line ${line}).`,
    W06: (r: string, a: string) => `'${r}.${a}' does not exist in the relational model.`,
  },
} as const;

/** (relation, op) of a rule -> cell of the constraint, or null when it does not apply. */
function cellOf(c: IRReferentialConstraint, rule: IRConstraintRule): RefCell | null {
  if (c.child === c.parent) {
    if (rule.op === 'insert') return 'childInsert';
    return rule.op === 'update' ? 'parentUpdate' : 'parentDelete';
  }
  if (rule.relation === c.child) {
    if (rule.op === 'insert') return 'childInsert';
    return rule.op === 'update' ? 'childUpdate' : null;
  }
  if (rule.relation === c.parent) {
    if (rule.op === 'update') return 'parentUpdate';
    return rule.op === 'delete' ? 'parentDelete' : null;
  }
  return null;
}

export interface BuiltConstraints {
  referential: ReferentialConstraint[];
  general: GeneralConstraint[];
  diagnostics: Diagnostic[];
}

export function buildConstraints(
  ir: PmovIR,
  relations: Relation[],
  identifyingElements: ReadonlySet<string>,
  locale: Locale = 'sr',
): BuiltConstraints {
  const m = MSG[locale];
  const diagnostics: Diagnostic[] = [];
  const diag = (code: DiagnosticCode, message: string, span: Diagnostic['span']): void => {
    diagnostics.push({ code, severity: severityOf(code), message, span, elementId: null });
  };
  const elementOf = new Map(relations.map((r) => [r.name, r.elementId]));
  const groups = collectFkGroups(relations);
  const list = (attrs: string[]): string => attrs.join(', ');

  // match blocks to FKs
  const claimed = new Map<FkGroup, IRReferentialConstraint>();
  for (const c of ir.constraints ?? []) {
    if (c.kind !== 'referential') continue;
    const cands = groups.filter((g) => g.child === c.child && g.parent === c.parent);
    let fk: FkGroup | undefined;
    if (c.childAttrs) {
      const want = [...c.childAttrs].sort().join('\u0000');
      fk = cands.find((g) => g.attrs.map((a) => a.name).sort().join('\u0000') === want);
      if (!fk) {
        diag('E18', cands.length === 0 ? m.E18missing(c.child, c.parent) : m.E18wrong(c.child, c.parent, list(c.childAttrs)), c.headerSpan);
        continue;
      }
    } else if (cands.length === 0) {
      diag('E18', m.E18missing(c.child, c.parent), c.headerSpan);
      continue;
    } else if (cands.length > 1) {
      const names = cands.map((g) => `${c.child}(${list(g.attrs.map((a) => a.name))})`).join('; ');
      diag('E18', m.E18ambiguous(c.child, c.parent, names), c.headerSpan);
      continue;
    } else fk = cands[0]!;
    const first = claimed.get(fk);
    if (first) {
      diag('E20', m.E20(c.child, list(fk.attrs.map((a) => a.name)), c.parent, first.span.line), c.headerSpan);
      continue;
    }
    claimed.set(fk, c);
  }

  const referential: ReferentialConstraint[] = [];
  const nameCount = new Map<string, number>();
  for (const fk of groups) {
    const kind = fkKindOf(fk.attrs, identifyingElements.has(elementOf.get(fk.child) ?? ''));
    const block = claimed.get(fk) ?? null;
    const actions: Record<RefCell, ConstraintAction> = { ...DEFAULT_REF_ACTIONS[kind] };
    const explicit = new Set<RefCell>();
    if (block) {
      for (const rule of block.rules) {
        const cell = cellOf(block, rule);
        if (!cell || explicit.has(cell)) continue;
        if (rule.action === 'nullifies') {
          const pkAttr = fk.attrs.find((a) => a.pk);
          if (pkAttr) {
            diag('E19', m.E19pk(fk.child, pkAttr.name), rule.span);
            continue;
          }
          if (kind !== 'nullable') {
            diag('E19', m.E19opt(fk.child, list(fk.attrs.map((a) => a.name))), rule.span);
            continue;
          }
        }
        actions[cell] = rule.action;
        explicit.add(cell);
      }
    }
    let name: string;
    if (block) name = block.name;
    else {
      const base = `fk_${fk.child}_${fk.parent}`;
      const n = (nameCount.get(base) ?? 0) + 1;
      nameCount.set(base, n);
      name = n === 1 ? base : `${base}_${n}`;
    }
    referential.push({
      name, constraintId: block ? block.id : null, child: fk.child, parent: fk.parent,
      attributes: fk.attrs.map((a) => a.name), referenced: fk.attrs.map((a) => a.references!.attribute),
      group: fk.group, fkKind: kind, actions, explicitCells: REF_CELLS.filter((c) => explicit.has(c)),
    });
  }

  const general: GeneralConstraint[] = [];
  const attrsOf = new Map(relations.map((r) => [r.name, new Set(r.attributes.map((a) => a.name))]));
  for (const c of ir.constraints ?? []) {
    if (c.kind !== 'general') continue;
    const checks: GeneralConstraint['checks'] = [];
    for (const rule of (c as IRGeneralConstraint).rules) {
      let entry = checks.find((x) => x.relation === rule.relation);
      if (!entry) checks.push((entry = { relation: rule.relation, ops: [] }));
      if (!entry.ops.includes(rule.op)) entry.ops.push(rule.op);
    }
    general.push({ name: c.name, constraintId: c.id, condition: c.condition, checks });
    for (const ref of c.refs) {
      if (!attrsOf.get(ref.relation)?.has(ref.attribute)) diag('W06', m.W06(ref.relation, ref.attribute), ref.span);
    }
  }

  diagnostics.sort((a, b) => a.span.from - b.span.from);
  return { referential, general, diagnostics };
}
