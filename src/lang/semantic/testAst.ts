// Tiny hand-built AST helper for unit tests (no parser needed).
import type { AttributeAst, BlockAst, BlockKind, LineAst, ModelAst, NameAst, ParticipantAst, Role } from '../ast';
import type { SourceSpan } from '../diagnostics';

let pos = 0;
export function sp(): SourceSpan {
  pos += 10;
  return { from: pos, to: pos + 5, line: pos / 10, col: 1, endLine: pos / 10, endCol: 6 };
}
const nm = (text: string): NameAst => ({ text, quoted: false, span: sp() });

export const attr = (name: string, isId = false, domain: AttributeAst['domain'] extends infer D ? (D extends { value: infer V } ? V : never) | null : never = null): AttributeAst => ({
  kind: 'attribute', name: nm(name), isId, hashSpan: null,
  domain: domain ? { value: domain, span: sp() } : null, constraint: null, span: sp(),
});
export const attrs = (...a: AttributeAst[]): LineAst => ({ kind: 'attributeLine', attributes: a, span: sp() });
export const part = (object: string, card?: [string, string], role?: Role, mapping?: string): ParticipantAst => ({
  kind: 'participant', role: role ? { value: role, span: sp() } : null, object: nm(object),
  card: card ? { min: card[0], max: card[1], span: sp() } : null, mapping: mapping ? nm(mapping) : null, span: sp(),
});
export const block = (kind: BlockKind, name: string, ...lines: LineAst[]): BlockAst => ({
  kind, kindSpan: sp(), name: nm(name), lines, span: sp(),
});
export const model = (...blocks: BlockAst[]): ModelAst => ({ blocks });
