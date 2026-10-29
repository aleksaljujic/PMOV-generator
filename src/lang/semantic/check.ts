// Semantic checker: E01–E12, W01–W04. Owned by T02. Contract C01.
import type { AttributeAst, BlockAst, ModelAst, ParticipantAst } from '../ast';
import type { Diagnostic, DiagnosticCode, SourceSpan } from '../diagnostics';
import { severityOf } from '../diagnostics';
import {
  analyze, attributesOf, parseCard, participantsOf, resolveRef,
  type Analysis, type Entry,
} from './shared';

function mk(code: DiagnosticCode, message: string, span: SourceSpan, elementId: string | null): Diagnostic {
  return { code, severity: severityOf(code), message, span, elementId };
}

function lineText(p: ParticipantAst): string {
  const parts: string[] = [];
  if (p.role) parts.push(p.role.value);
  parts.push(p.object.text);
  if (p.card) parts.push(`(${p.card.min},${p.card.max})`);
  if (p.mapping) parts.push(p.mapping.text);
  return parts.join(' ');
}

const ABOUT_CARD = 'DG mora biti 0 ili 1, GG mora biti 1 ili M, i DG ≤ GG.';

/** E02 + E03 for one participant line. */
function checkRef(
  a: Analysis, p: ParticipantAst, id: string, needCard: boolean, out: Diagnostic[], missingCode: 'E03' | 'E08' = 'E03',
  ownerName = '',
): void {
  if (!resolveRef(a, p.object.text)) {
    out.push(mk('E02', `'${p.object.text}' nije deklarisan objekat, slab objekat ni agregacija.`, p.object.span, id));
  }
  if (p.card) {
    if (!parseCard(p.card)) {
      out.push(mk('E03', `neispravna kardinalnost (${p.card.min},${p.card.max}): ${ABOUT_CARD}`, p.card.span, id));
    }
  } else if (needCard) {
    if (missingCode === 'E08') {
      out.push(mk('E08', `komponenta '${p.object.text}' agregacije '${ownerName}' nema kardinalnost (DG,GG).`, p.object.span, id));
    } else {
      out.push(mk('E03', `nedostaje kardinalnost (DG,GG) uz '${p.object.text}': ${ABOUT_CARD}`, p.object.span, id));
    }
  }
}

function checkVeza(a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  if (ps.length !== 2) {
    out.push(mk('E04', `veza '${name}' ima ${ps.length} učesnika, a veza mora imati tačno 2. Za vezu više objekata koristi 'agregacija'.`, b.name.span, id));
  }
  for (const p of ps) {
    if (p.role) out.push(mk('E04', `učesnik veze ne sme imati ulogu '${p.role.value}'.`, p.role.span, id));
    checkRef(a, p, id, true, out);
  }
  for (const at of attributesOf(b)) {
    out.push(mk('E05', `veza '${name}' ne može imati atribut '${at.name.text}'. Ako je to učesnik, dodaj kardinalnost (DG,GG); za vezu sa atributima koristi 'agregacija'.`, at.name.span, id));
  }
  // W01
  const [p0, p1] = ps;
  if (ps.length === 2 && p0 && p1 && p0.object.text === p1.object.text && (!p0.mapping || !p1.mapping)) {
    out.push(mk('W01', `rekurzivna veza '${name}' treba da ima nazive preslikavanja za oba učesnika.`, b.name.span, id));
  }
}

function checkSlab(a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  const owners = ps.filter((p) => p.role?.value === 'nadređeni');
  if (owners.length !== 1 || ps.some((p) => p.role?.value !== 'nadređeni')) {
    out.push(mk('E06', `slab objekat '${name}' mora imati tačno jednog učesnika 'nadređeni X (DG,GG)'.`, b.name.span, id));
  }
  if (!attributesOf(b).some((x) => x.isId)) {
    out.push(mk('E06', `slab objekat '${name}' mora imati bar jedan parcijalni identifikator (#).`, b.name.span, id));
  }
  for (const p of ps) checkRef(a, p, id, p.role?.value === 'nadređeni', out);
}

function checkSpec(a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  const msg = `specijalizacija '${name}' mora imati tačno jedan 'nadtip X (DG,GG)' i bar dva 'podtip Y' (bez kardinalnosti), i ne sme imati atribute.`;
  const supers = ps.filter((p) => p.role?.value === 'nadtip');
  const subs = ps.filter((p) => p.role?.value === 'podtip');
  if (supers.length !== 1) out.push(mk('E07', msg, b.name.span, id));
  if (subs.length < 2) out.push(mk('E07', msg, b.name.span, id));
  for (const p of ps) {
    const r = p.role?.value;
    if (r !== 'nadtip' && r !== 'podtip') {
      out.push(mk('E07', `${msg} Red '${lineText(p)}' nema ulogu nadtip ni podtip.`, p.span, id));
    } else if (r === 'podtip' && p.card) {
      out.push(mk('E07', `${msg} Podtip '${p.object.text}' ne sme imati kardinalnost.`, p.card.span, id));
    }
    if (r === 'podtip') {
      if (!resolveRef(a, p.object.text)) {
        out.push(mk('E02', `'${p.object.text}' nije deklarisan objekat, slab objekat ni agregacija.`, p.object.span, id));
      }
    } else {
      checkRef(a, p, id, r === 'nadtip', out);
    }
  }
  for (const at of attributesOf(b)) {
    out.push(mk('E07', `${msg} Atribut '${at.name.text}' nije dozvoljen.`, at.name.span, id));
  }
}

function checkAgg(a: Analysis, b: BlockAst, id: string, out: Diagnostic[]): void {
  const ps = participantsOf(b);
  const name = b.name.text;
  if (ps.length < 2) {
    out.push(mk('E08', `agregacija '${name}' ima ${ps.length} komponenti, a mora imati bar 2.`, b.name.span, id));
  }
  for (const p of ps) {
    if (p.role) out.push(mk('E12', `red '${lineText(p)}' nije dozvoljen u bloku 'agregacija'.`, p.role.span, id));
    checkRef(a, p, id, true, out, 'E08', name);
  }
}

function checkObjekat(b: BlockAst, id: string, out: Diagnostic[]): void {
  for (const p of participantsOf(b)) {
    out.push(mk('E12', `red '${lineText(p)}' nije dozvoljen u bloku 'objekat'.`, p.span, id));
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
function checkCycles(specs: SpecInfo[], out: Diagnostic[]): Map<string, Set<string>> {
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
        out.push(mk('E09', `ciklična specijalizacija: ${cyc.join(' → ')}.`, s.supSpan!, s.entry.id));
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

function checkAttributes(b: BlockAst, id: string, out: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const at of attributesOf(b)) {
    if (!at.domain) out.push(mk('W02', `atribut '${at.name.text}' nema domen.`, at.name.span, id));
    if (seen.has(at.name.text)) {
      out.push(mk('W04', `atribut '${at.name.text}' je već naveden u bloku '${b.name.text}'.`, at.name.span, id));
    }
    seen.add(at.name.text);
  }
}

export function check(ast: ModelAst): Diagnostic[] {
  const out: Diagnostic[] = [];
  const a = analyze(ast);

  for (const d of a.duplicates) {
    out.push(mk('E01', `ime '${d.block.name.text}' je već deklarisano u redu ${d.earlier.block.name.span.line}.`, d.block.name.span, d.earlier.id));
  }

  const used = new Set<string>();
  for (const { block: b, id } of a.entries) {
    for (const p of participantsOf(b)) {
      const r = resolveRef(a, p.object.text);
      if (r) used.add(r.id);
    }
    switch (b.kind) {
      case 'objekat': checkObjekat(b, id, out); break;
      case 'veza': checkVeza(a, b, id, out); break;
      case 'slab': checkSlab(a, b, id, out); break;
      case 'specijalizacija': checkSpec(a, b, id, out); break;
      case 'agregacija': checkAgg(a, b, id, out); break;
    }
    checkAttributes(b, id, out);
  }

  const specs = specInfos(a);
  const up = checkCycles(specs, out);
  const subtypes = new Set<string>();
  for (const s of specs) for (const x of s.subs) subtypes.add(x);

  for (const { block: b, id } of a.entries) {
    const attrs = attributesOf(b);
    if (b.kind === 'objekat') {
      if (!attrs.some((x) => x.isId) && !subtypes.has(id)) {
        out.push(mk('E10', `objekat '${b.name.text}' nema identifikator (#). Svaki objekat koji nije podtip mora imati identifikator.`, b.name.span, id));
      }
      if (!used.has(id)) {
        out.push(mk('W03', `objekat '${b.name.text}' ne učestvuje ni u jednoj vezi.`, b.name.span, id));
      }
    }
    if (subtypes.has(id)) {
      for (const sup of transitiveSupers(up, id)) {
        const sb = a.byName.get(sup)!.block;
        const ids = new Set(attributesOf(sb).filter((x: AttributeAst) => x.isId).map((x) => x.name.text));
        for (const at of attrs) {
          if (ids.has(at.name.text)) {
            out.push(mk('E11', `podtip '${b.name.text}' ponavlja identifikator '${at.name.text}' nadtipa '${sup}' — podtip ga nasleđuje.`, at.name.span, id));
          }
        }
      }
    }
  }
  return out;
}
