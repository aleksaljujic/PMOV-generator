// Tiny dependency-free XML builder helpers (T06).

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export type Attrs = Record<string, string | number | undefined | null>;

/** Round numbers to 2 decimals so output stays compact and deterministic. */
export function num(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

export function attrsToString(attrs: Attrs): string {
  let out = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    out += ` ${k}="${escapeXml(typeof v === 'number' ? num(v) : v)}"`;
  }
  return out;
}

/** el('rect', {x: 1}) → <rect x="1"/>; children are already-serialized strings, text must be escaped by the caller. */
export function el(tag: string, attrs: Attrs = {}, children: string | string[] = ''): string {
  const inner = Array.isArray(children) ? children.join('') : children;
  return inner === '' ? `<${tag}${attrsToString(attrs)}/>` : `<${tag}${attrsToString(attrs)}>${inner}</${tag}>`;
}
