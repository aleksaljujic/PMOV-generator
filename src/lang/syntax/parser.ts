import {
  BLOCK_KINDS,
  DOMAINS,
  ROLES,
  type AttributeAst,
  type AttributeLineAst,
  type BlockAst,
  type BlockKind,
  type CardinalityAst,
  type Domain,
  type LineAst,
  type ParseResult,
  type ParticipantAst,
  type Role,
  type NameAst,
  type Token,
} from '../ast';
import { joinSpans, type Diagnostic, type DiagnosticCode, type SourceSpan } from '../diagnostics';
import { lexWith } from './lexer';
import { PositionMap } from './positions';

/** Thrown internally to abandon the current line; always caught inside the parser. */
class LineAbort extends Error {}

export function parseSource(source: string): ParseResult {
  const pm = new PositionMap(source);
  const lexed = lexWith(source, pm);
  const diagnostics: Diagnostic[] = [...lexed.diagnostics];
  const toks = lexed.tokens;
  let p = 0;

  const peek = (o = 0): Token => toks[Math.min(p + o, toks.length - 1)] as Token;
  const next = (): Token => {
    const t = toks[p] as Token;
    if (p < toks.length - 1) p++;
    return t;
  };
  const report = (code: DiagnosticCode, message: string, span: SourceSpan) =>
    diagnostics.push({ code, severity: 'error', message, span, elementId: null });

  const describe = (t: Token): string =>
    t.type === 'eof' ? 'kraj fajla' : t.type === 'newline' ? 'novi red' : t.text;

  /** Report S01 (or S03 for unknown characters) on the token. */
  const unexpected = (t: Token, what: string) => {
    if (t.type === 'unknown') {
      report('S03', `nepoznat znak '${t.text}'.`, t.span);
    } else {
      report('S01', `neočekivan simbol '${describe(t)}', očekivano ${what}.`, t.span);
    }
  };

  const isName = (t: Token) => t.type === 'ident' || t.type === 'quoted';
  const isLineEnd = (t: Token) => t.type === 'newline' || t.type === 'eof' || t.type === 'rbrace';
  const toName = (t: Token): NameAst => ({ text: t.value, quoted: t.type === 'quoted', span: t.span });
  const sliceSpan = (a: Token, b: Token) => joinSpans(a.span, b.span);

  /** Skip to the newline / eof / `}` (not consumed). */
  const skipLine = () => {
    while (!isLineEnd(peek())) next();
  };

  const fail = (t: Token, what: string): never => {
    unexpected(t, what);
    throw new LineAbort();
  };

  // ---- attribute line ----
  const parseAttribute = (): AttributeAst => {
    const nameTok = peek();
    if (!isName(nameTok)) fail(nameTok, 'naziv atributa');
    next();
    let span = nameTok.span;
    const attr: AttributeAst = {
      kind: 'attribute',
      name: toName(nameTok),
      isId: false,
      hashSpan: null,
      domain: null,
      constraint: null,
      span,
    };
    const finish = () => {
      attr.span = span;
    };
    if (peek().type === 'hash') {
      const h = next();
      attr.isId = true;
      attr.hashSpan = h.span;
      span = joinSpans(span, h.span);
    }
    if (peek().type === 'colon') {
      const colon = next();
      span = joinSpans(span, colon.span);
      const d = peek();
      if (d.type !== 'ident') {
        finish();
        pendingAttr = attr;
        return fail(d, 'domen');
      }
      next();
      const known = (DOMAINS as readonly string[]).includes(d.text);
      if (known) {
        attr.domain = { value: d.text as Domain, span: d.span };
      } else {
        report('S06', `nepoznat domen '${d.text}'. Dozvoljeno: long, short, string, date.`, d.span);
      }
      span = joinSpans(span, d.span);
      if (peek().type !== 'comma') {
        // constraint: rest of line, stopping at a depth-0 "}"
        let first: Token | null = null;
        let last: Token | null = null;
        let depth = 0;
        for (;;) {
          const t = peek();
          if (t.type === 'newline' || t.type === 'eof') break;
          if (t.type === 'rbrace' && depth === 0) break;
          if (t.type === 'lparen') depth++;
          else if (t.type === 'rparen' && depth > 0) depth--;
          first ??= t;
          last = t;
          next();
        }
        if (first && last && known) {
          const cspan = sliceSpan(first, last);
          attr.constraint = { text: source.slice(cspan.from, cspan.to).trim(), span: cspan };
          span = joinSpans(span, cspan);
        }
      }
    }
    finish();
    return attr;
  };

  let pendingAttr: AttributeAst | null = null;

  const parseAttributeLine = (): AttributeLineAst | null => {
    const attributes: AttributeAst[] = [];
    pendingAttr = null;
    try {
      for (;;) {
        attributes.push(parseAttribute());
        const t = peek();
        if (t.type === 'comma') {
          next();
          continue;
        }
        if (isLineEnd(t)) break;
        fail(t, "',' ili kraj reda");
      }
    } catch (e) {
      if (!(e instanceof LineAbort)) throw e;
      if (pendingAttr) attributes.push(pendingAttr);
      skipLine();
    }
    if (attributes.length === 0) return null;
    const span = joinSpans((attributes[0] as AttributeAst).span, (attributes[attributes.length - 1] as AttributeAst).span);
    return { kind: 'attributeLine', attributes, span };
  };

  // ---- participant ----
  const rawSlice = (toksIn: Token[]): string =>
    toksIn.length === 0 ? '' : source.slice((toksIn[0] as Token).span.from, (toksIn[toksIn.length - 1] as Token).span.to).trim();

  const parseCardinality = (): CardinalityAst => {
    const open = next(); // "("
    const minToks: Token[] = [];
    const maxToks: Token[] = [];
    let depth = 0;
    for (;;) {
      const t = peek();
      if (t.type === 'newline' || t.type === 'eof' || t.type === 'rbrace') fail(t, "','");
      if (t.type === 'comma' && depth === 0) {
        next();
        break;
      }
      if (t.type === 'lparen') depth++;
      else if (t.type === 'rparen') depth = Math.max(0, depth - 1);
      minToks.push(next());
    }
    depth = 0;
    let close: Token;
    for (;;) {
      const t = peek();
      if (t.type === 'newline' || t.type === 'eof' || t.type === 'rbrace') fail(t, "')'");
      if (t.type === 'rparen' && depth === 0) {
        close = next();
        break;
      }
      if (t.type === 'lparen') depth++;
      else if (t.type === 'rparen') depth--;
      maxToks.push(next());
    }
    return { min: rawSlice(minToks), max: rawSlice(maxToks), span: joinSpans(open.span, close.span) };
  };

  const isParticipantStart = (): boolean => {
    const t = peek();
    if (t.type === 'ident' && (ROLES as readonly string[]).includes(t.text)) return true;
    return isName(t) && peek(1).type === 'lparen';
  };

  const parseParticipant = (): ParticipantAst | null => {
    const startTok = peek();
    let role: ParticipantAst['role'] = null;
    let object: NameAst | null = null;
    let card: CardinalityAst | null = null;
    let mapping: NameAst | null = null;
    let end: SourceSpan = startTok.span;
    try {
      if (startTok.type === 'ident' && (ROLES as readonly string[]).includes(startTok.text)) {
        next();
        role = { value: startTok.text as Role, span: startTok.span };
      }
      const nameTok = peek();
      if (!isName(nameTok)) fail(nameTok, 'naziv objekta');
      next();
      object = toName(nameTok);
      end = nameTok.span;
      if (peek().type === 'lparen') {
        card = parseCardinality();
        end = card.span;
        if (isName(peek())) {
          const m = next();
          mapping = toName(m);
          end = m.span;
        }
      }
      if (!isLineEnd(peek())) fail(peek(), 'kraj reda');
    } catch (e) {
      if (!(e instanceof LineAbort)) throw e;
      skipLine();
    }
    if (!object) return null;
    return { kind: 'participant', role, object, card, mapping, span: joinSpans(startTok.span, end) };
  };

  // ---- block ----
  const isBlockKind = (t: Token): boolean => t.type === 'ident' && (BLOCK_KINDS as readonly string[]).includes(t.text);

  /** Resync at top level: skip to the next line starting with a block keyword, or past a balanced "}". */
  const resync = () => {
    let depth = 0;
    let lineStart = false;
    for (;;) {
      const t = peek();
      if (t.type === 'eof') return;
      if (t.type === 'newline') {
        next();
        lineStart = true;
        continue;
      }
      if (lineStart && depth === 0 && isBlockKind(t)) return;
      lineStart = false;
      next();
      if (t.type === 'lbrace') depth++;
      else if (t.type === 'rbrace') {
        if (depth > 0) {
          depth--;
          if (depth === 0) return;
        }
      }
    }
  };

  const skipNewlines = () => {
    while (peek().type === 'newline') next();
  };

  const parseBlock = (): BlockAst | null => {
    const kindTok = next();
    const kind = kindTok.text as BlockKind;
    const nameTok = peek();
    if (!isName(nameTok)) {
      unexpected(nameTok, 'naziv bloka');
      resync();
      return null;
    }
    next();
    if (nameTok.type === 'ident' && nameTok.text === '_' && kind !== 'veza') {
      unexpected(nameTok, 'naziv bloka');
    }
    // "{" may sit on the next line
    let k = 0;
    while (peek(k).type === 'newline') k++;
    if (peek(k).type !== 'lbrace') {
      unexpected(peek(), "'{'");
      resync();
      return null;
    }
    p += k;
    next(); // "{"

    const block: BlockAst = {
      kind,
      kindSpan: kindTok.span,
      name: toName(nameTok),
      lines: [],
      span: kindTok.span,
    };
    for (;;) {
      skipNewlines();
      const t = peek();
      if (t.type === 'eof') {
        report('S05', `blok '${nameTok.value}' nije zatvoren — nedostaje '}'.`, nameTok.span);
        block.span = joinSpans(kindTok.span, t.span);
        break;
      }
      if (t.type === 'rbrace') {
        next();
        block.span = joinSpans(kindTok.span, t.span);
        break;
      }
      const before = p;
      const line: LineAst | null = isParticipantStart() ? parseParticipant() : parseAttributeLine();
      if (line) block.lines.push(line);
      if (p === before) next(); // guarantee progress
    }
    return block;
  };

  const blocks: BlockAst[] = [];
  for (;;) {
    skipNewlines();
    const t = peek();
    if (t.type === 'eof') break;
    if (!isBlockKind(t)) {
      if (t.type === 'unknown') {
        report('S03', `nepoznat znak '${t.text}'.`, t.span);
      } else {
        report(
          'S04',
          `nepoznata vrsta bloka '${t.text}'. Dozvoljeno: objekat, veza, slab, specijalizacija, agregacija.`,
          t.span,
        );
      }
      next();
      resync();
      continue;
    }
    const before = p;
    const b = parseBlock();
    if (b) blocks.push(b);
    if (p === before) next();
  }
  return { ast: { blocks }, diagnostics };
}
