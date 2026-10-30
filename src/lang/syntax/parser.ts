import {
  DOMAINS,
  canonicalBlockKind,
  canonicalRole,
  isConditionKeyword,
  isConstraintBlockKeyword,
  isDomainDeclKeyword,
  type AttributeAst,
  type AttributeLineAst,
  type BlockAst,
  type CardinalityAst,
  type ConstraintBlockAst,
  type ConstraintLineAst,
  type DomainDeclAst,
  type Domain,
  type LineAst,
  type ParseResult,
  type ParticipantAst,
  type NameAst,
  type Token,
} from '../ast';
import { joinSpans, type Diagnostic, type DiagnosticCode, type LangOptions, type SourceSpan } from '../diagnostics';
import { lexWith } from './lexer';
import { syntaxMessages, type Expected } from './messages';
import { PositionMap } from './positions';

/** Thrown internally to abandon the current line; always caught inside the parser. */
class LineAbort extends Error {}

export function parseSource(source: string, options?: LangOptions): ParseResult {
  const M = syntaxMessages(options?.locale);
  const pm = new PositionMap(source);
  const lexed = lexWith(source, pm, options);
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
    t.type === 'eof' ? M.eof : t.type === 'newline' ? M.newline : t.text;

  /** Report S01 (or S03 for unknown characters) on the token. */
  const unexpected = (t: Token, what: Expected) => {
    if (t.type === 'unknown') {
      report('S03', M.S03(t.text), t.span);
    } else {
      report('S01', M.S01(describe(t), M.expected[what]), t.span);
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

  const fail = (t: Token, what: Expected): never => {
    unexpected(t, what);
    throw new LineAbort();
  };

  /** `(` number `)` directly after a type; consumed only when the whole shape is there. */
  const parseLength = (): { value: number; span: SourceSpan } | null => {
    if (peek().type === 'lparen' && peek(1).type === 'number' && peek(2).type === 'rparen') {
      const open = next();
      const num = next();
      const close = next();
      return { value: Number(num.text), span: joinSpans(open.span, close.span) };
    }
    return null;
  };

  /** Free-text rest of the line (stops at newline / eof / depth-0 `}`), trimmed. null when empty. */
  const readTail = (stopAtRbrace: boolean): { text: string; span: SourceSpan } | null => {
    let first: Token | null = null;
    let last: Token | null = null;
    let depth = 0;
    for (;;) {
      const t = peek();
      if (t.type === 'newline' || t.type === 'eof') break;
      if (stopAtRbrace && t.type === 'rbrace' && depth === 0) break;
      if (t.type === 'lparen') depth++;
      else if (t.type === 'rparen' && depth > 0) depth--;
      first ??= t;
      last = t;
      next();
    }
    if (!first || !last) return null;
    const cspan = sliceSpan(first, last);
    return { text: source.slice(cspan.from, cspan.to).trim(), span: cspan };
  };

  // ---- attribute line ----
  const parseAttribute = (): AttributeAst => {
    const nameTok = peek();
    if (!isName(nameTok)) fail(nameTok, 'attrName');
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
        return fail(d, 'domain');
      }
      next();
      const known = (DOMAINS as readonly string[]).includes(d.text);
      if (known) {
        attr.domain = { value: d.text as Domain, span: d.span };
      } else {
        attr.userDomain = toName(d);
        // Any non-built-in identifier is a user domain; the checker reports undeclared ones (E13).
      }
      span = joinSpans(span, d.span);
      const len = parseLength();
      if (len) {
        attr.length = len;
        span = joinSpans(span, len.span);
      }
      if (peek().type !== 'comma') {
        const c = readTail(true);
        if (c) {
          attr.constraint = c;
          span = joinSpans(span, c.span);
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
        fail(t, 'commaOrEol');
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
      if (t.type === 'newline' || t.type === 'eof' || t.type === 'rbrace') fail(t, 'comma');
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
      if (t.type === 'newline' || t.type === 'eof' || t.type === 'rbrace') fail(t, 'rparen');
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
    if (t.type === 'ident' && canonicalRole(t.text) !== null) return true;
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
      if (startTok.type === 'ident' && canonicalRole(startTok.text) !== null) {
        next();
        role = { value: canonicalRole(startTok.text) as NonNullable<ParticipantAst['role']>['value'], span: startTok.span };
      }
      const nameTok = peek();
      if (!isName(nameTok)) fail(nameTok, 'objectName');
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
      if (!isLineEnd(peek())) fail(peek(), 'eol');
    } catch (e) {
      if (!(e instanceof LineAbort)) throw e;
      skipLine();
    }
    if (!object) return null;
    return { kind: 'participant', role, object, card, mapping, span: joinSpans(startTok.span, end) };
  };

  // ---- block ----
  const isBlockKind = (t: Token): boolean =>
    t.type === 'ident' &&
    (canonicalBlockKind(t.text) !== null || isDomainDeclKeyword(t.text) || isConstraintBlockKeyword(t.text));

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
    const kind = canonicalBlockKind(kindTok.text) as NonNullable<ReturnType<typeof canonicalBlockKind>>;
    const nameTok = peek();
    if (!isName(nameTok)) {
      unexpected(nameTok, 'blockName');
      resync();
      return null;
    }
    next();
    if (nameTok.type === 'ident' && nameTok.text === '_' && kind !== 'veza') {
      unexpected(nameTok, 'blockName');
    }
    // "{" may sit on the next line
    let k = 0;
    while (peek(k).type === 'newline') k++;
    if (peek(k).type !== 'lbrace') {
      unexpected(peek(), 'lbrace');
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
        report('S05', M.S05(nameTok.value), nameTok.span);
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

  // ---- domain declaration ----
  const parseDomainDecl = (): DomainDeclAst | null => {
    const kw = next();
    const nameTok = peek();
    if (!isName(nameTok)) {
      unexpected(nameTok, 'domainName');
      skipLine();
      return null;
    }
    next();
    const decl: DomainDeclAst = {
      kind: 'domainDecl',
      keywordSpan: kw.span,
      name: toName(nameTok),
      base: null,
      constraint: null,
      span: joinSpans(kw.span, nameTok.span),
    };
    const colon = peek();
    if (colon.type !== 'colon') {
      unexpected(colon, 'colon');
      skipLine();
      return decl;
    }
    next();
    decl.span = joinSpans(decl.span, colon.span);
    const ty = peek();
    if (ty.type !== 'ident') {
      unexpected(ty, 'type');
      skipLine();
      return decl;
    }
    next();
    const isBuiltin = (DOMAINS as readonly string[]).includes(ty.text);
    const length = parseLength();
    let bspan = ty.span;
    if (length) bspan = joinSpans(bspan, length.span);
    decl.base = {
      builtin: isBuiltin ? (ty.text as Domain) : null,
      name: isBuiltin ? null : toName(ty),
      length,
      span: bspan,
    };
    decl.span = joinSpans(decl.span, bspan);
    const c = readTail(false);
    if (c) {
      decl.constraint = c;
      decl.span = joinSpans(decl.span, c.span);
    }
    return decl;
  };

  // ---- constraint block ----
  const lineHasArrow = (): boolean => {
    for (let k = 0; ; k++) {
      const t = peek(k);
      if (t.type === 'arrow') return true;
      if (isLineEnd(t)) return false;
    }
  };

  const parseConstraintLine = (): ConstraintLineAst | null => {
    const first = peek();
    try {
      if (lineHasArrow()) {
        if (!isName(first)) fail(first, 'objectName');
        next();
        let attrs: NameAst[] | null = null;
        if (peek().type === 'lparen') {
          next();
          attrs = [];
          for (;;) {
            const a = peek();
            if (!isName(a)) fail(a, 'attrName');
            next();
            attrs.push(toName(a));
            const sep = peek();
            if (sep.type === 'comma') {
              next();
              continue;
            }
            if (sep.type === 'rparen') {
              next();
              break;
            }
            fail(sep, 'rparen');
          }
        }
        if (peek().type !== 'arrow') fail(peek(), 'arrow');
        next();
        const par = peek();
        if (!isName(par)) fail(par, 'objectName');
        next();
        if (!isLineEnd(peek())) fail(peek(), 'eol');
        return { kind: 'refHeader', child: toName(first), attrs, parent: toName(par), span: joinSpans(first.span, par.span) };
      }
      if (first.type === 'ident' && isConditionKeyword(first.text) && peek(1).type === 'colon') {
        next();
        const colon = next();
        const tail = readTail(true);
        const textSpan = tail ? tail.span : pm.span(colon.span.to, colon.span.to);
        return {
          kind: 'condition',
          keywordSpan: first.span,
          text: tail ? tail.text : '',
          textSpan,
          span: joinSpans(first.span, tail ? tail.span : colon.span),
        };
      }
      if (isName(first) && peek(1).type === 'colon') {
        next();
        const colon = next();
        const items: Extract<ConstraintLineAst, { kind: 'rule' }>['items'] = [];
        let end = colon.span;
        for (;;) {
          const op = peek();
          if (isLineEnd(op) || op.type === 'comma') fail(op, 'ruleItem');
          next();
          let itemSpan = op.span;
          let action: { value: string; span: SourceSpan } | null = null;
          const a = peek();
          if (!isLineEnd(a) && a.type !== 'comma') {
            next();
            action = { value: a.value.toLowerCase(), span: a.span };
            itemSpan = joinSpans(itemSpan, a.span);
          }
          items.push({ op: { value: op.value.toLowerCase(), span: op.span }, action, span: itemSpan });
          end = itemSpan;
          const sep = peek();
          if (sep.type === 'comma') {
            next();
            continue;
          }
          if (isLineEnd(sep)) break;
          fail(sep, 'commaOrEol');
        }
        return { kind: 'rule', relation: toName(first), items, span: joinSpans(first.span, end) };
      }
      return fail(first, 'constraintLine');
    } catch (e) {
      if (!(e instanceof LineAbort)) throw e;
      skipLine();
      return null;
    }
  };

  const parseConstraintBlock = (): ConstraintBlockAst | null => {
    const kindTok = next();
    const nameTok = peek();
    if (!isName(nameTok)) {
      unexpected(nameTok, 'blockName');
      resync();
      return null;
    }
    next();
    let k = 0;
    while (peek(k).type === 'newline') k++;
    if (peek(k).type !== 'lbrace') {
      unexpected(peek(), 'lbrace');
      resync();
      return null;
    }
    p += k;
    next();
    const block: ConstraintBlockAst = {
      kind: 'ograničenje',
      kindSpan: kindTok.span,
      name: toName(nameTok),
      lines: [],
      span: kindTok.span,
    };
    for (;;) {
      skipNewlines();
      const t = peek();
      if (t.type === 'eof') {
        report('S05', M.S05(nameTok.value), nameTok.span);
        block.span = joinSpans(kindTok.span, t.span);
        break;
      }
      if (t.type === 'rbrace') {
        next();
        block.span = joinSpans(kindTok.span, t.span);
        break;
      }
      const before = p;
      const line = parseConstraintLine();
      if (line) block.lines.push(line);
      if (p === before) next();
    }
    return block;
  };

  const blocks: BlockAst[] = [];
  const domains: DomainDeclAst[] = [];
  const constraints: ConstraintBlockAst[] = [];
  for (;;) {
    skipNewlines();
    const t = peek();
    if (t.type === 'eof') break;
    if (!isBlockKind(t)) {
      if (t.type === 'unknown') {
        report('S03', M.S03(t.text), t.span);
      } else {
        report('S04', M.S04(t.text), t.span);
      }
      next();
      resync();
      continue;
    }
    const before = p;
    if (isDomainDeclKeyword(t.text)) {
      const d = parseDomainDecl();
      if (d) domains.push(d);
    } else if (isConstraintBlockKeyword(t.text)) {
      const c = parseConstraintBlock();
      if (c) constraints.push(c);
    } else {
      const b = parseBlock();
      if (b) blocks.push(b);
    }
    if (p === before) next();
  }
  const ast: ParseResult['ast'] = { blocks };
  if (domains.length > 0) ast.domains = domains;
  if (constraints.length > 0) ast.constraints = constraints;
  return { ast, diagnostics };
}
