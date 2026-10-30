// Domain table, E13–E15, W05 and attribute resolution. Owned by T23. Contract C10 §2.
import type { Domain, DomainDeclAst, ModelAst } from '../ast';
import { DOMAINS } from '../ast';
import type { Diagnostic, SourceSpan } from '../diagnostics';
import { severityOf } from '../diagnostics';
import type { IRDomain } from '../ir';
import type { Messages } from './messages';
import { attributesOf, type Analysis } from './shared';

export interface DomainInfo {
  decl: DomainDeclAst;
  ir: IRDomain;
}

export interface DomainTable {
  /** First valid declaration per name, in source order. */
  byName: Map<string, DomainInfo>;
  list: DomainInfo[];
  diagnostics: Diagnostic[];
}

function mk(code: 'E13' | 'E14' | 'E15' | 'W05', message: string, span: SourceSpan, elementId: string | null): Diagnostic {
  return { code, severity: severityOf(code), message, span, elementId };
}

export function buildDomainTable(ast: ModelAst, a: Analysis, m: Messages): DomainTable {
  const diagnostics: Diagnostic[] = [];
  const decls = ast.domains ?? [];
  const byDecl = new Map<string, DomainDeclAst>();
  const valid: DomainDeclAst[] = [];

  for (const d of decls) {
    const name = d.name.text;
    if ((DOMAINS as readonly string[]).includes(name)) {
      diagnostics.push(mk('E14', m.e14Builtin(name), d.name.span, null));
      continue;
    }
    const first = byDecl.get(name);
    if (first) {
      diagnostics.push(mk('E14', m.e14Dup(name, first.name.span.line), d.name.span, null));
      continue;
    }
    byDecl.set(name, d);
    valid.push(d);
  }

  // E13 for undeclared parents.
  const parentOf = (d: DomainDeclAst): string | null => d.base?.name?.text ?? null;
  for (const d of valid) {
    const p = d.base?.name;
    if (p && !byDecl.has(p.text)) diagnostics.push(mk('E13', m.e13(p.text), p.span, null));
  }

  // E15: cycles, one report per cycle on its first member in source order.
  const order = new Map(valid.map((d, i) => [d.name.text, i]));
  const inCycle = new Set<string>();
  const reported = new Set<string>();
  for (const start of valid) {
    const path: string[] = [];
    const pos = new Map<string, number>();
    let cur: string | null = start.name.text;
    while (cur !== null && byDecl.has(cur)) {
      const at = pos.get(cur);
      if (at !== undefined) {
        const cyc = path.slice(at);
        cyc.forEach((n) => inCycle.add(n));
        const key = [...cyc].sort().join('\u0000');
        if (!reported.has(key)) {
          reported.add(key);
          const firstName = cyc.reduce((x, y) => (order.get(y)! < order.get(x)! ? y : x));
          const rot = cyc.indexOf(firstName);
          const chain = [...cyc.slice(rot), ...cyc.slice(0, rot)];
          chain.push(firstName);
          const d = byDecl.get(firstName)!;
          diagnostics.push(mk('E15', m.e15(chain), d.base!.name!.span, null));
        }
        break;
      }
      pos.set(cur, path.length);
      path.push(cur);
      cur = parentOf(byDecl.get(cur)!);
    }
  }

  // Resolution.
  const cache = new Map<string, { base: Domain | null; length: number | null; eff: string | null }>();
  const resolve = (name: string): { base: Domain | null; length: number | null; eff: string | null } => {
    const hit = cache.get(name);
    if (hit) return hit;
    const d = byDecl.get(name)!;
    const own = d.constraint ? d.constraint.text : null;
    let res: { base: Domain | null; length: number | null; eff: string | null };
    if (inCycle.has(name)) {
      res = { base: null, length: d.base?.length?.value ?? null, eff: own };
    } else if (!d.base) {
      res = { base: null, length: null, eff: own };
    } else if (d.base.name) {
      const pn = d.base.name.text;
      if (byDecl.has(pn)) {
        const p = resolve(pn);
        res = {
          base: p.base,
          length: d.base.length ? d.base.length.value : p.length,
          eff: p.eff && own ? `${p.eff} And ${own}` : p.eff ?? own,
        };
      } else {
        res = { base: null, length: d.base.length?.value ?? null, eff: own };
      }
    } else {
      res = { base: d.base.builtin, length: d.base.length?.value ?? null, eff: own };
    }
    cache.set(name, res);
    return res;
  };

  const list: DomainInfo[] = [];
  const table = new Map<string, DomainInfo>();
  for (const d of valid) {
    const r = resolve(d.name.text);
    const ir: IRDomain = {
      name: d.name.text,
      parent: parentOf(d),
      base: r.base,
      length: r.length,
      constraint: d.constraint ? d.constraint.text : null,
      effectiveConstraint: r.eff,
      span: d.span,
      nameSpan: d.name.span,
    };
    const info = { decl: d, ir };
    list.push(info);
    table.set(d.name.text, info);
  }

  // E14c on domain lengths (only when the resolved base is known and not string).
  for (const d of valid) {
    const len = d.base?.length;
    if (!len) continue;
    const base = table.get(d.name.text)!.ir.base;
    if (base !== null && base !== 'string') diagnostics.push(mk('E14', m.e14Length(), len.span, null));
  }

  // W05: unused domains.
  const used = new Set<string>();
  for (const d of decls) {
    const p = d.base?.name;
    if (p) used.add(p.text);
  }
  for (const { block } of a.entries) {
    for (const at of attributesOf(block)) if (at.userDomain) used.add(at.userDomain.text);
  }
  for (const d of valid) {
    if (!used.has(d.name.text)) diagnostics.push(mk('W05', m.w05(d.name.text), d.name.span, null));
  }

  return { byName: table, list, diagnostics };
}
