// FILE: src/lang/semantic/query.ts
import type { IRElement, PmovIR } from '../ir';

export function getElement(ir: PmovIR, id: string): IRElement | undefined {
  return ir.elements.find((e) => e.id === id);
}

export function findElementAtOffset(ir: PmovIR, offset: number): string | null {
  let best: IRElement | null = null;
  for (const e of ir.elements) {
    if (e.span.from <= offset && offset <= e.span.to) {
      if (!best || e.span.to - e.span.from < best.span.to - best.span.from) best = e;
    }
  }
  return best ? best.id : null;
}

export function supertypeOf(ir: PmovIR, id: string): string | null {
  for (const e of ir.elements) {
    if (e.kind === 'specijalizacija' && e.supertype && e.subtypes.some((s) => s.ref === id)) {
      return e.supertype.ref;
    }
  }
  return null;
}

export function isSubtype(ir: PmovIR, id: string): boolean {
  return supertypeOf(ir, id) !== null;
}
