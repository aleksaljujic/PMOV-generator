// Owned by T09. Debounced compile that keeps the last valid IR/graph across syntax errors.
import { useEffect, useMemo, useState } from 'react';
import { compile } from '../../lang';
import type { CompileResult, PmovIR } from '../../lang';
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
  result: CompileResult | null;
  lastValidIr: PmovIR | null;
}

function run(source: string, prevIr: PmovIR | null): State {
  try {
    const result = compile(source);
    return { source, result, lastValidIr: result.ir ?? prevIr };
  } catch {
    return { source, result: null, lastValidIr: prevIr };
  }
}

export function useCompile(source: string, delayMs = 300): UseCompileResult {
  const [state, setState] = useState<State>(() => run(source, null));

  useEffect(() => {
    if (source === state.source) return;
    const t = setTimeout(() => setState((prev) => run(source, prev.lastValidIr)), delayMs);
    return () => clearTimeout(t);
  }, [source, state.source, delayMs]);

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
