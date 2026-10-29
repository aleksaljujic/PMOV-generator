const NARROW = new Set('iljtf.,:()|\'!; Il'.split(''));
const WIDE = new Set('MWmwŠŽ'.split(''));

function charFactor(ch: string): number {
  if (ch === ' ') return 0.28;
  if (WIDE.has(ch)) return 0.85;
  if (NARROW.has(ch)) return 0.3;
  if (ch >= '0' && ch <= '9') return 0.56;
  if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) return 0.68;
  return 0.55;
}

/** Deterministic text width estimate (no DOM). */
export function estimateTextWidth(text: string, fontSize: number): number {
  let sum = 0;
  for (const ch of text) sum += charFactor(ch);
  return sum * fontSize;
}

export function attributeNodeId(ownerId: string, attrName: string, occurrence = 1): string {
  const base = `attr:${ownerId}:${attrName}`;
  return occurrence >= 2 ? `${base}~${occurrence}` : base;
}
