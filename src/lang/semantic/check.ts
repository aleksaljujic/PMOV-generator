// Semantic checker: E01–E17, W01–W05. Owned by T02, extended by T23. Contract C01.
import type { AttributeAst, BlockAst, ModelAst, ParticipantAst } from '../ast';
import type { Diagnostic, DiagnosticCode, LangOptions, Locale, SourceSpan } from '../diagnostics';
import { severityOf } from '../diagnostics';
import { ROLE_KEYWORDS } from '../ast';
import { messagesFor, type Messages } from './messages';
import { analyzeConstraints } from './constraints';
import { buildDomainTable, type DomainTable } from './domains';
import {
  analyze, attributesOf, parseCard, participantsOf, resolveRef,
  type Analysis, type Entry,
} from './shared';

function mk(code: DiagnosticCode, message: string, span: SourceSpan, elementId: string | null): Diagnostic {
  return { code, severity: severityOf(code), message, span, elementId };
}

function lineText(p: ParticipantAst, locale: Locale): string {
  const parts: string[] = [];
  if (p.role) parts.push(ROLE_KEYWORDS[locale][p.role.value]);
  parts.push(p.object.text);
  if (p.card) parts.push(`(${p.card.min},${p.card.max})`);
  if (p.mapping) parts.push(p.mapping.text);
  return parts.join(' ');
}

/** E02 + E03 for one participant line. */
function checkRef(
  m: Messages, a: Analysis, p: ParticipantAst, id: string, needCard: boolean, out: Diagnostic[], missingCode: 'E03' | 'E08' = 'E03',
  ownerName = '',
): void {
  if (!resolveRef(a, p.object.text)) {
    out.push(mk('E02', m.e02(p.object.text), p.object.span, id));
  }
  if (p.card) {
    if (!parseCard(p.card)) {
      out.push(mk('E03', m.e03Invalid(p.card.min, p.card.max), p.card.span, id));
    }
  } else if (needCard) {
    if (missingCode === 'E08') {
      out.push(mk('E08', m.e08Card(p.object.text, ownerName), p.object.span, id));
    } else {
      out.push(mk('E03', m.e03Missing(p.object.text), p.object.span, id));
    }
  }
}

function checkVeza(m: Messages, a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  if (ps.length !== 2) {
    out.push(mk('E04', m.e04Count(name, ps.length), b.name.span, id));
  }
  for (const p of ps) {
    if (p.role) out.push(mk('E04', m.e04Role(ROLE_KEYWORDS[m.locale][p.role.value]), p.role.span, id));
    checkRef(m, a, p, id, true, out);
  }
  for (const at of attributesOf(b)) {
    out.push(mk('E05', m.e05(name, at.name.text), at.name.span, id));
  }
  // W01
  const [p0, p1] = ps;
  if (ps.length === 2 && p0 && p1 && p0.object.text === p1.object.text && (!p0.mapping || !p1.mapping)) {
    out.push(mk('W01', m.w01(name), b.name.span, id));
  }
}

function checkSlab(m: Messages, a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  const owners = ps.filter((p) => p.role?.value === 'nadređeni');
  if (owners.length !== 1 || ps.some((p) => p.role?.value !== 'nadređeni')) {
    out.push(mk('E06', m.e06Owner(name), b.name.span, id));
  }
  if (!attributesOf(b).some((x) => x.isId)) {
    out.push(mk('E06', m.e06Id(name), b.name.span, id));
  }
  for (const p of ps) checkRef(m, a, p, id, p.role?.value === 'nadređeni', out);
}

function checkSpec(m: Messages, a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  const msg = m.e07Base(name);
  const supers = ps.filter((p) => p.role?.value === 'nadtip');
  const subs = ps.filter((p) => p.role?.value === 'podtip');
  if (supers.length !== 1) out.push(mk('E07', msg, b.name.span, id));
  if (subs.length < 2) out.push(mk('E07', msg, b.name.span, id));
  for (const p of ps) {
    const r = p.role?.value;
    if (r !== 'nadtip' && r !== 'podtip') {
      out.push(mk('E07', m.e07Line(msg, lineText(p, m.locale)), p.span, id));
    } else if (r === 'podtip' && p.card) {
      out.push(mk('E07', m.e07SubCard(msg, p.object.text), p.card.span, id));
    }
    if (r === 'podtip') {
      if (!resolveRef(a, p.object.text)) {
        out.push(mk('E02', m.e02(p.object.text), p.object.span, id));
      }
    } else {
      checkRef(m, a, p, id, r === 'nadtip', out);
    }
  }
  for (const at of attributesOf(b)) {
    out.push(mk('E07', m.e07Attr(msg, at.name.text), at.name.span, id));
  }
}

function checkAgg(m: Messages, a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  if (ps.length < 2) {
    out.push(mk('E08', m.e08Count(name, ps.length), b.name.span, id));
  }
  for (const p of ps) {
    if (p.role) out.push(mk('E12', m.e12(lineText(p, m.locale), 'agregacija'), p.role.span, id));
    checkRef(m, a, p, id, true, out, 'E08', name);
  }
}

function checkObjekat(m: Messages, b: BlockAst, id: string, out: Diagnostic[]): void {
  for (const p of participantsOf(b)) {
    out.push(mk('E12', m.e12(lineText(p, m.locale), 'objekat'), p.span, id));
  }
}

interface SpecInfo { entry: Entry; sup: string | null; supSpan: SourceSpan | null; subs: string[] }

function specInfos(a: Analysis): SpecInfo[] {
  const res: SpecInfo[] = [];
  for (const entry of a.entries) {
    if (entry.block.kind !== 'specijalizacija') continue;
    const ps = participantsOf(entry.block);
    const sup = ps.find((p) => p.role?.value === 'nadtip');
    const supRes = sup ? resolveRef(a, sup.object.text) : undefined;
    res.push({
      entry,
      sup: supRes ? supRes.id : null,
      supSpan: sup ? sup.object.span : null,
      subs: ps.filter((p) => p.role?.value === 'podtip').map((p) => resolveRef(a, p.object.text)?.id)
        .filter((x): x is string => !!x),
    });
  }
  return res;
}

/** E09; returns the acyclic "up" graph (podtip → nadtipovi) for E10/E11. */
function checkCycles(m: Messages, specs: SpecInfo[], out: Diagnostic[]): Map<string, Set<string>> {
  const up = new Map<string, Set<string>>();
  const pathUp = (from: string, to: string): string[] | null => {
    const seen = new Set<string>();
    const dfs = (n: string): string[] | null => {
      if (n === to) return [n];
      if (seen.has(n)) return null;
      seen.add(n);
      for (const m of up.get(n) ?? []) {
        const r = dfs(m);
        if (r) return [n, ...r];
      }
      return null;
    };
    return dfs(from);
  };
  for (const s of specs) {
    if (!s.sup) continue;
    for (const sub of s.subs) {
      const back = pathUp(s.sup, sub);
      if (back) {
        const cyc = [sub, ...back];
        out.push(mk('E09', m.e09(cyc), s.supSpan!, s.entry.id));
      } else {
        if (!up.has(sub)) up.set(sub, new Set());
        up.get(sub)!.add(s.sup);
      }
    }
  }
  return up;
}

function transitiveSupers(up: Map<string, Set<string>>, id: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const walk = (n: string) => {
    for (const m of up.get(n) ?? []) {
      if (!seen.has(m)) { seen.add(m); order.push(m); walk(m); }
    }
  };
  walk(id);
  return order;
}

function checkAttributes(m: Messages, dt: DomainTable, b: BlockAst, id: string, out: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const at of attributesOf(b)) {
    if (at.userDomain && !dt.byName.has(at.userDomain.text)) {
      out.push(mk('E13', m.e13(at.userDomain.text), at.userDomain.span, id));
    }
    if (at.length) {
      const base = at.domain ? at.domain.value : at.userDomain ? dt.byName.get(at.userDomain.text)?.ir.base ?? null : null;
      if (base !== null && base !== 'string') out.push(mk('E14', m.e14Length(), at.length.span, id));
    }
    if (!at.domain && !at.userDomain) out.push(mk('W02', m.w02(at.name.text), at.name.span, id));
    if (seen.has(at.name.text)) {
      out.push(mk('W04', m.w04(at.name.text, b.name.text), at.name.span, id));
    }
    seen.add(at.name.text);
  }
}

export function check(ast: ModelAst, options?: LangOptions): Diagnostic[] {
  const m = messagesFor(options?.locale);
  const out: Diagnostic[] = [];
  const a = analyze(ast);

  for (const d of a.duplicates) {
    out.push(mk('E01', m.e01(d.block.name.text, d.earlier.block.name.span.line), d.block.name.span, d.earlier.id));
  }

  const dt = buildDomainTable(ast, a, m);
  out.push(...dt.diagnostics);
  out.push(...analyzeConstraints(ast, a, m).diagnostics);

  const used = new Set<string>();
  for (const { block: b, id } of a.entries) {
    for (const p of participantsOf(b)) {
      const r = resolveRef(a, p.object.text);
      if (r) used.add(r.id);
    }
    switch (b.kind) {
      case 'objekat': checkObjekat(m, b, id, out); break;
      case 'veza': checkVeza(m, a, b, id, out); break;
      case 'slab': checkSlab(m, a, b, id, out); break;
      case 'specijalizacija': checkSpec(m, a, b, id, out); break;
      case 'agregacija': checkAgg(m, a, b, id, out); break;
    }
    checkAttributes(m, dt, b, id, out);
  }

  const specs = specInfos(a);
  const up = checkCycles(m, specs, out);
  const subtypes = new Set<string>();
  for (const s of specs) for (const x of s.subs) subtypes.add(x);

  for (const { block: b, id } of a.entries) {
    const attrs = attributesOf(b);
    if (b.kind === 'objekat') {
      if (!attrs.some((x) => x.isId) && !subtypes.has(id)) {
        out.push(mk('E10', m.e10(b.name.text), b.name.span, id));
      }
      if (!used.has(id)) {
        out.push(mk('W03', m.w03(b.name.text), b.name.span, id));
      }
    }
    if (subtypes.has(id)) {
      for (const sup of transitiveSupers(up, id)) {
        const sb = a.byName.get(sup)!.block;
        const ids = new Set(attributesOf(sb).filter((x: AttributeAst) => x.isId).map((x) => x.name.text));
        for (const at of attrs) {
          if (ids.has(at.name.text)) {
            out.push(mk('E11', m.e11(b.name.text, at.name.text, sup), at.name.span, id));
          }
        }
      }
    }
  }
  return out;
}
