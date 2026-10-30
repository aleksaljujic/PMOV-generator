// Validity of pick-mode targets. No React.
import type { Locale, PmovIR } from '../lang';
import { MESSAGES } from './types';
import type { MsgKey, PickPurpose } from './types';

/** Ancestors of `id` through specijalizacija (nadtip chain). */
export function ancestors(ir: PmovIR, id: string): Set<string> {
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const cur = queue.pop() as string;
    for (const e of ir.elements) {
      if (e.kind === 'specijalizacija' && e.supertype && e.subtypes.some((s) => s.ref === cur)) {
        if (!seen.has(e.supertype.ref)) {
          seen.add(e.supertype.ref);
          queue.push(e.supertype.ref);
        }
      }
    }
  }
  return seen;
}

/** Reason (in `locale`, default Serbian) why `candidate` cannot be picked for `purpose`, or null if it can. */
export function pickRejection(ir: PmovIR, purpose: PickPurpose, candidate: string, locale: Locale = 'sr'): string | null {
  const key = pickRejectionKey(ir, purpose, candidate);
  return key === null ? null : MESSAGES[locale][key];
}

export function pickRejectionKey(ir: PmovIR, purpose: PickPurpose, candidate: string): MsgKey | null {
  const el = ir.elements.find((e) => e.id === candidate);
  if (!el) return 'failed';
  switch (purpose.kind) {
    case 'veza':
      return el.kind === 'objekat' || el.kind === 'slab' || el.kind === 'agregacija' ? null : 'failed';
    case 'agregacija':
      if (el.kind !== 'objekat' && el.kind !== 'slab' && el.kind !== 'agregacija') return 'failed';
      return candidate === purpose.first ? 'distinct' : null;
    case 'component': {
      if (el.kind !== 'objekat' && el.kind !== 'slab' && el.kind !== 'agregacija') return 'failed';
      if (candidate === purpose.agregacija) return 'distinct';
      const agg = ir.elements.find((e) => e.id === purpose.agregacija);
      if (agg?.kind === 'agregacija' && agg.components.some((c) => c.ref === candidate)) return 'alreadyComponent';
      return null;
    }
    case 'podtip': {
      const spec = ir.elements.find((e) => e.id === purpose.specijalizacija);
      if (spec?.kind !== 'specijalizacija' || !spec.supertype || el.kind !== 'objekat') return 'failed';
      if (candidate === spec.supertype.ref) return 'podtipSelf';
      if (spec.subtypes.some((s) => s.ref === candidate)) return 'podtipDup';
      if (ancestors(ir, spec.supertype.ref).has(candidate)) return 'podtipCycle';
      return null;
    }
  }
}
