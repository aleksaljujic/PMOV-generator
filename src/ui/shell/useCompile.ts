// Owned by T09. Debounced compile that keeps the last valid IR/graph across syntax errors.
import { useEffect, useMemo, useState } from 'react';
import { compile } from '../../lang';
import type { CompileResult, Locale, PmovIR } from '../../lang';
import { buildDiagramGraph } from '../../render/graph';
import type { DiagramGraph } from '../../render/graph/types';

export interface UseCompileResult {
  /** Result for the most recently compiled source (null if compile threw). */
  result: CompileResult | null;
  lastValidIr: PmovIR | null;
  lastValidGraph: DiagramGraph | null;
}

interface State {
  source: string;
  locale: Locale;
  result: CompileResult | null;
  lastValidIr: PmovIR | null;
}

function run(source: string, prevIr: PmovIR | null, locale: Locale): State {
  try {
    const result = compile(source, { locale });
    return { source, locale, result, lastValidIr: result.ir ?? prevIr };
  } catch {
    return { source, locale, result: null, lastValidIr: prevIr };
  }
}

export function useCompile(source: string, delayMs = 300, locale: Locale = 'sr'): UseCompileResult {
  const [state, setState] = useState<State>(() => run(source, null, locale));

  useEffect(() => {
    if (source === state.source && locale === state.locale) return;
    // A language change recompiles at once (messages only); source changes are debounced.
    const wait = source === state.source ? 0 : delayMs;
    const t = setTimeout(() => setState((prev) => run(source, prev.lastValidIr, locale)), wait);
    return () => clearTimeout(t);
  }, [source, state.source, state.locale, locale, delayMs]);

  const lastValidGraph = useMemo<DiagramGraph | null>(() => {
    if (!state.lastValidIr) return null;
    try {
      return buildDiagramGraph(state.lastValidIr);
    } catch {
      return null;
    }
  }, [state.lastValidIr]);

  return { result: state.result, lastValidIr: state.lastValidIr, lastValidGraph };
}
