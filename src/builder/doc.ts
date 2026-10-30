// Parsed view of a source plus low-level text helpers. No React.
import { compile, lex } from '../lang';
import type {
  Locale, AttributeAst, BlockAst, IRElement, ModelAst, NameAst, ParticipantAst, PmovIR, SourceSpan, Token } from '../lang';
import type { MsgKey } from './types';

/** Thrown inside the builder; converted to `{ ok: false }` by `applyBuilderAction`. */
export class Fail extends Error {
  constructor(
    readonly key: MsgKey,
    readonly extra?: { dependents: { id: string; kind: IRElement['kind'] }[]; usages?: number; constraints?: string[] },
    readonly n?: number,
  ) {
    super(key);
  }
}
export const fail = (key: MsgKey = 'failed'): never => {
  throw new Fail(key);
};

/** Anything with a name, a span and content lines: a `BlockAst` or a C10 `ConstraintBlockAst`. */
export interface Blk {
  name: NameAst;
  span: SourceSpan;
  lines: { span: SourceSpan }[];
}

export interface Doc {
  source: string;
  nl: string;
  ast: ModelAst;
  ir: PmovIR;
  /** Element id per AST block ('' for blocks dropped as duplicates). */
  ids: string[];
  /** All block names in the source (for placeholder numbering). */
  names: string[];
  tokens: Token[];
  locale: Locale;
}

export function isUnnamed(b: BlockAst): boolean {
  return b.kind === 'veza' && !b.name.quoted && b.name.text === '_';
}

/** Mirrors the id rules of C03: first block of a name wins, unnamed veza → `_#k`. */
export function blockIds(ast: ModelAst): string[] {
  const seen = new Set<string>();
  let unnamed = 0;
  return ast.blocks.map((b) => {
    if (isUnnamed(b)) return `_#${++unnamed}`;
    if (seen.has(b.name.text)) return '';
    seen.add(b.name.text);
    return b.name.text;
  });
}

export function loadDoc(source: string, locale: Locale = 'sr'): Doc {
  const res = compile(source);
  if (!res.ast || !res.ir || res.diagnostics.some((d) => d.code.startsWith('S'))) throw new Fail('syntax');
  return {
    source,
    nl: source.includes('\r\n') ? '\r\n' : '\n',
    ast: res.ast,
    ir: res.ir,
    ids: blockIds(res.ast),
    names: res.ast.blocks.map((b) => b.name.text),
    tokens: lex(source).tokens,
    locale,
  };
}

export function element(doc: Doc, id: string): IRElement {
  return doc.ir.elements.find((e) => e.id === id) ?? fail();
}
export function blockOf(doc: Doc, id: string): BlockAst {
  const i = doc.ids.indexOf(id);
  return (i >= 0 ? doc.ast.blocks[i] : undefined) ?? fail();
}
export function blockIndex(doc: Doc, id: string): number {
  const i = doc.ids.indexOf(id);
  return i >= 0 ? i : fail();
}

export const flatAttributes = (b: BlockAst): AttributeAst[] =>
  b.lines.flatMap((l) => (l.kind === 'attributeLine' ? l.attributes : []));
export const participantLines = (b: BlockAst): ParticipantAst[] =>
  b.lines.filter((l): l is ParticipantAst => l.kind === 'participant');

/** AST participant line whose span starts where the IR participant's span starts. */
export function participantAt(b: BlockAst, span: SourceSpan): ParticipantAst {
  return participantLines(b).find((p) => p.span.from === span.from) ?? fail();
}

// ---------------------------------------------------------------- text helpers

export const lineStart = (s: string, pos: number): number => s.lastIndexOf('\n', pos - 1) + 1;
/** Offset just after the newline that ends the line containing `pos` (or end of text). */
export const lineEnd = (s: string, pos: number): number => {
  const i = s.indexOf('\n', pos);
  return i < 0 ? s.length : i + 1;
};
export const isBlank = (s: string): boolean => /^[ \t\r\n]*$/.test(s);
export const indentOf = (s: string, pos: number): string => {
  const ls = lineStart(s, pos);
  return /^[ \t]*/.exec(s.slice(ls, pos))?.[0] ?? '';
};

export interface Edit {
  from: number;
  to: number;
  text: string;
  /** Delete whole lines when the span is alone on them, then collapse the blank line it leaves behind. */
  removeLines?: boolean;
}

export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = source;
  let limit = Infinity;
  for (const e of sorted) {
    if (e.to > limit) fail();
    let from = e.from;
    let to = e.to;
    if (e.removeLines) {
      const ls = lineStart(out, from);
      const le = lineEnd(out, Math.max(to - 1, from));
      if (isBlank(out.slice(ls, from)) && isBlank(out.slice(to, le))) {
        from = ls;
        to = le;
        const blankBefore = from === 0 || /\n[ \t]*\r?\n$/.test(out.slice(0, from)) || /^[ \t\r\n]*$/.test(out.slice(0, from));
        if (blankBefore) {
          const m = /^[ \t]*\r?\n/.exec(out.slice(to));
          if (m) to += m[0].length;
        }
      }
    }
    out = out.slice(0, from) + e.text + out.slice(to);
    limit = e.from;
  }
  return out;
}

/** The `{` token of a block. */
export function lbraceOf(doc: Doc, b: Blk): Token {
  return doc.tokens.find((t) => t.type === 'lbrace' && t.span.from >= b.name.span.to) ?? fail();
}
export function rbracePos(doc: Doc, b: Blk): number {
  const p = b.span.to - 1;
  return doc.source[p] === '}' ? p : fail();
}

/** `{` ends its line (optionally followed by a comment) and `}` sits alone on its line. */
export function isMultiline(doc: Doc, b: Blk): boolean {
  const s = doc.source;
  const lb = lbraceOf(doc, b);
  const rb = rbracePos(doc, b);
  if (isBlank(s.slice(lb.span.to, lineEnd(s, lb.span.to)).replace(/\/\/.*$/m, '')) === false) return false;
  if (lineStart(s, rb) <= lb.span.from) return false;
  return isBlank(s.slice(lineStart(s, rb), rb));
}

/** Source text of each content line of a block (trimmed). */
export function contentLines(doc: Doc, b: Blk): string[] {
  return b.lines.map((l) => doc.source.slice(l.span.from, l.span.to).trim());
}

/**
 * Edits that add `text` as a new line of the block. `after` anchors the line right after the line that
 * contains that span; without it the line goes at the end of the block. Single-line blocks are expanded first.
 */
export function addLineEdits(doc: Doc, b: Blk, text: string, after?: SourceSpan): Edit[] {
  const s = doc.source;
  const nl = doc.nl;
  const blockIndent = indentOf(s, b.span.from);
  if (isMultiline(doc, b)) {
    if (after) {
      return [{ from: lineEnd(s, after.to), to: lineEnd(s, after.to), text: `${indentOf(s, after.from)}${text}${nl}` }];
    }
    const rb = rbracePos(doc, b);
    const last = b.lines[b.lines.length - 1];
    const indent = last ? indentOf(s, last.span.from) : `${blockIndent}  `;
    const at = lineStart(s, rb);
    return [{ from: at, to: at, text: `${indent}${text}${nl}` }];
  }
  const lines = [...contentLines(doc, b)];
  if (after) {
    const idx = b.lines.findIndex((l) => l.span.from <= after.from && after.to <= l.span.to);
    lines.splice(idx < 0 ? lines.length : idx + 1, 0, text);
  } else {
    lines.push(text);
  }
  return [rewriteLines(doc, b, lines)];
}

/** Replace everything between `{` and `}` with the given lines, one per line. */
export function rewriteLines(doc: Doc, b: Blk, lines: string[]): Edit {
  const blockIndent = indentOf(doc.source, b.span.from);
  const lb = lbraceOf(doc, b);
  const nl = doc.nl;
  const body = lines.map((l) => `${blockIndent}  ${l}`).join(nl);
  return { from: lb.span.to, to: b.span.to, text: `${nl}${body}${nl}${blockIndent}}` };
}

/** Text to append so that `blocks` end up at the end of the source, one blank line before the first. */
export function appendEdit(doc: Doc, blocks: string[]): Edit {
  const s = doc.source;
  const nl = doc.nl;
  let prefix = '';
  if (s.trim() !== '') {
    if (/\n[ \t]*\r?\n$/.test(s)) prefix = '';
    else if (s.endsWith('\n')) prefix = nl;
    else prefix = nl + nl;
  }
  const text = prefix + blocks.map((b) => b.split('\n').join(nl)).join(nl + nl) + nl;
  return { from: s.length, to: s.length, text };
}
