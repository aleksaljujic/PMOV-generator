// Public entry of src/lang/semantic — owned by T02. Contract C03.
import type { Diagnostic } from '../diagnostics';
import type { CompileResult } from '../ir';
import { parse } from '../syntax';
import { buildIr } from './buildIr';
import { check } from './check';

export { getElement, findElementAtOffset, supertypeOf, isSubtype } from './query';

function sortDiagnostics(ds: Diagnostic[]): Diagnostic[] {
  return [...ds].sort((x, y) => x.span.from - y.span.from || (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
}

export function compile(source: string): CompileResult {
  const { ast, diagnostics } = parse(source);
  if (diagnostics.some((d) => d.code.startsWith('S'))) {
    return { ast, ir: null, diagnostics: sortDiagnostics(diagnostics), hasErrors: true };
  }
  const all = sortDiagnostics([...diagnostics, ...check(ast)]);
  return { ast, ir: buildIr(ast), diagnostics: all, hasErrors: all.some((d) => d.severity === 'error') };
}
