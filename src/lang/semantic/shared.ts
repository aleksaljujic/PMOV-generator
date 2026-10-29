// Shared helpers for the checker and the IR builder. Owned by T02.
import type { AttributeAst, BlockAst, CardinalityAst, ModelAst, ParticipantAst } from '../ast';
import type { Cardinality } from '../ir';

export interface Entry {
  block: BlockAst;
  id: string;
}

export interface Analysis {
  /** One entry per kept block (duplicates by name are dropped), in source order. */
  entries: Entry[];
  /** Duplicate blocks (E01), with the entry they duplicate. */
  duplicates: { block: BlockAst; earlier: Entry }[];
  /** First declaration per name (any kind). */
  byName: Map<string, Entry>;
}

export function isUnnamedVeza(b: BlockAst): boolean {
  return b.kind === 'veza' && !b.name.quoted && b.name.text === '_';
}

export function analyze(ast: ModelAst): Analysis {
  const entries: Entry[] = [];
  const duplicates: Analysis['duplicates'] = [];
  const byName = new Map<string, Entry>();
  let unnamed = 0;
  for (const block of ast.blocks) {
    if (isUnnamedVeza(block)) {
      unnamed += 1;
      entries.push({ block, id: `_#${unnamed}` });
      continue;
    }
    const earlier = byName.get(block.name.text);
    if (earlier) {
      duplicates.push({ block, earlier });
      continue;
    }
    const entry = { block, id: block.name.text };
    byName.set(block.name.text, entry);
    entries.push(entry);
  }
  return { entries, duplicates, byName };
}

/** Only objekat / slab / agregacija can be referenced by participants. */
export function resolveRef(a: Analysis, name: string): Entry | undefined {
  const e = a.byName.get(name);
  if (!e) return undefined;
  const k = e.block.kind;
  return k === 'objekat' || k === 'slab' || k === 'agregacija' ? e : undefined;
}

/** Valid cardinality (DG in {0,1}, GG in {1,M,m}) or null. */
export function parseCard(c: CardinalityAst | null): Cardinality | null {
  if (!c) return null;
  const min = c.min.trim();
  const max = c.max.trim();
  if (min !== '0' && min !== '1') return null;
  if (max !== '1' && max !== 'M' && max !== 'm') return null;
  return { min: min === '0' ? 0 : 1, max: max === '1' ? 1 : 'M' };
}

export function participantsOf(b: BlockAst): ParticipantAst[] {
  return b.lines.filter((l): l is ParticipantAst => l.kind === 'participant');
}

export function attributesOf(b: BlockAst): AttributeAst[] {
  const out: AttributeAst[] = [];
  for (const l of b.lines) if (l.kind === 'attributeLine') out.push(...l.attributes);
  return out;
}
