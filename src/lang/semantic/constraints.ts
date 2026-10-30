// Cross-table constraints: E16, E17 and the IR build. Owned by T23. Contract C10 §2.
import type { ConstraintAction, ConstraintOp, ConstraintBlockAst, ModelAst, NameAst, RuleLineAst } from '../ast';
import { CONSTRAINT_ACTIONS, CONSTRAINT_OPS } from '../ast';
import type { Diagnostic, SourceSpan } from '../diagnostics';
import { severityOf } from '../diagnostics';
import type { IRConstraint, IRConstraintRule } from '../ir';
import type { Messages } from './messages';
import { isUnnamedVeza, type Analysis } from './shared';

/** Same data as ALLOWED_REF_ACTIONS in rm/types (lang may not import src/rm). */
type Cell = 'childInsert' | 'childUpdate' | 'parentUpdate' | 'parentDelete';
const ALLOWED: Record<Cell, readonly ConstraintAction[]> = {
  childInsert: ['restricted', 'nullifies', 'default'],
  childUpdate: ['restricted', 'nullifies', 'default'],
  parentUpdate: ['restricted', 'cascades', 'nullifies', 'default'],
  parentDelete: ['restricted', 'cascades', 'nullifies', 'default'],
};

export const relName = (n: string): string => n.replace(/\s/g, '');

function mk(code: 'E16' | 'E17', message: string, span: SourceSpan): Diagnostic {
  return { code, severity: severityOf(code), message, span, elementId: null };
}

const REF_RE = /([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}_][\p{L}\p{N}_]*)/gu;

export interface ConstraintsResult {
  diagnostics: Diagnostic[];
  constraints: IRConstraint[];
}

export function analyzeConstraints(ast: ModelAst, a: Analysis, m: Messages): ConstraintsResult {
  const diagnostics: Diagnostic[] = [];
  const constraints: IRConstraint[] = [];
  const relations = new Set<string>();
  for (const { block } of a.entries) {
    if (block.kind === 'specijalizacija' || isUnnamedVeza(block)) continue;
    relations.add(relName(block.name.text));
  }
  const seenNames = new Map<string, ConstraintBlockAst>();

  const checkRel = (n: NameAst): boolean => {
    if (relations.has(relName(n.text))) return true;
    diagnostics.push(mk('E16', m.e16(relName(n.text)), n.span));
    return false;
  };

  /** Validates one rule line; `cellOf` is null for general constraints. */
  const rules = (
    c: string, lines: RuleLineAst[], cellOf: ((rel: string, op: ConstraintOp) => Cell | '/' | 'foreign') | null,
  ): IRConstraintRule[] => {
    const out: IRConstraintRule[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      if (!checkRel(line.relation)) continue;
      const rel = relName(line.relation.text);
      if (cellOf && cellOf(rel, 'insert') === 'foreign') {
        diagnostics.push(mk('E17', m.e17ForeignRelation(c, rel), line.relation.span));
        continue;
      }
      for (const item of line.items) {
        const op = item.op.value;
        if (!(CONSTRAINT_OPS as readonly string[]).includes(op)) {
          diagnostics.push(mk('E17', m.e17UnknownOp(c, op), item.op.span));
          continue;
        }
        const act = item.action?.value ?? null;
        if (act === null || !(CONSTRAINT_ACTIONS as readonly string[]).includes(act)) {
          diagnostics.push(mk('E17', m.e17BadAction(c, act), item.action ? item.action.span : item.span));
          continue;
        }
        const o = op as ConstraintOp;
        const action = act as ConstraintAction;
        const actionSpan = item.action!.span;
        if (cellOf) {
          const cell = cellOf(rel, o);
          if (cell === '/') {
            diagnostics.push(mk('E17', o === 'delete' ? m.e17ChildDelete(c, rel) : m.e17ParentInsert(c, rel), item.op.span));
            continue;
          }
          if (cell !== 'foreign' && !ALLOWED[cell].includes(action)) {
            diagnostics.push(mk('E17', m.e17ActionNotAllowed(c, action, o, rel), actionSpan));
            continue;
          }
        } else if (action !== 'restricted') {
          diagnostics.push(mk('E17', m.e17GeneralAction(c, action), actionSpan));
          continue;
        }
        const key = `${rel}\u0000${o}`;
        if (seen.has(key)) {
          diagnostics.push(mk('E17', m.e17DupOp(c, o, rel), item.op.span));
          continue;
        }
        seen.add(key);
        out.push({ relation: rel, op: o, action, span: item.span });
      }
    }
    return out;
  };

  for (const blk of ast.constraints ?? []) {
    const c = blk.name.text;
    const first = seenNames.get(c);
    if (first) {
      diagnostics.push(mk('E17', m.e17DupName(c, first.name.span.line), blk.name.span));
      continue;
    }
    seenNames.set(c, blk);

    const heads = blk.lines.filter((l) => l.kind === 'refHeader' || l.kind === 'condition');
    const ruleLines = blk.lines.filter((l): l is RuleLineAst => l.kind === 'rule');
    const base = { id: c, name: c, span: blk.span, nameSpan: blk.name.span };

    if (heads.length === 0) {
      diagnostics.push(mk('E17', m.e17NoHeader(c), blk.name.span));
      continue;
    }
    if (heads.length > 1) {
      diagnostics.push(mk('E17', m.e17ManyHeaders(c), heads[1]!.span));
      continue;
    }
    const head = heads[0]!;

    if (head.kind === 'refHeader') {
      const okChild = checkRel(head.child);
      const okParent = checkRel(head.parent);
      if (!okChild || !okParent) continue;
      const child = relName(head.child.text);
      const parent = relName(head.parent.text);
      const cellOf = (rel: string, op: ConstraintOp): Cell | '/' | 'foreign' => {
        if (rel !== child && rel !== parent) return 'foreign';
        if (child === parent) return op === 'insert' ? 'childInsert' : op === 'update' ? 'parentUpdate' : 'parentDelete';
        if (rel === child) return op === 'insert' ? 'childInsert' : op === 'update' ? 'childUpdate' : '/';
        return op === 'insert' ? '/' : op === 'update' ? 'parentUpdate' : 'parentDelete';
      };
      constraints.push({
        ...base,
        kind: 'referential',
        child,
        parent,
        childAttrs: head.attrs ? head.attrs.map((x) => x.text) : null,
        rules: rules(c, ruleLines, cellOf),
        headerSpan: head.span,
      });
    } else {
      if (head.text.trim() === '') {
        diagnostics.push(mk('E17', m.e17EmptyCondition(c), head.textSpan));
        continue;
      }
      if (ruleLines.length === 0) {
        diagnostics.push(mk('E17', m.e17NoRules(c), blk.name.span));
        continue;
      }
      const refs: { relation: string; attribute: string; span: SourceSpan }[] = [];
      for (const mt of head.text.matchAll(REF_RE)) {
        const idx = mt.index ?? 0;
        const s = head.textSpan;
        refs.push({
          relation: mt[1]!,
          attribute: mt[2]!,
          span: {
            from: s.from + idx, to: s.from + idx + mt[0].length,
            line: s.line, col: s.col + idx, endLine: s.line, endCol: s.col + idx + mt[0].length,
          },
        });
      }
      constraints.push({
        ...base,
        kind: 'general',
        condition: head.text,
        conditionSpan: head.textSpan,
        refs,
        rules: rules(c, ruleLines, null),
      });
    }
  }
  return { diagnostics, constraints };
}
