// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompileResult, PmovIR } from '../../lang';

const compileMock = vi.fn();
vi.mock('../../lang', async (orig) => ({ ...(await orig<typeof import('../../lang')>()), compile: (s: string) => compileMock(s) }));
vi.mock('../../render/graph', () => ({ buildDiagramGraph: (ir: PmovIR) => ({ nodes: [], edges: [], ir }) }));

import { useCompile } from './useCompile';

const irOf = (n: number) => ({ elements: [], n }) as unknown as PmovIR;
const ok = (n: number): CompileResult => ({ ast: null, ir: irOf(n), diagnostics: [], hasErrors: false });
const syntaxErr: CompileResult = {
  ast: null, ir: null, hasErrors: true,
  diagnostics: [{ code: 'S01', severity: 'error', message: 'x', span: { from: 0, to: 1, line: 1, col: 1, endLine: 1, endCol: 2 }, elementId: null }],
};

beforeEach(() => { vi.useFakeTimers(); compileMock.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('useCompile', () => {
  it('compiles immediately on mount, then debounces by 300ms', () => {
    compileMock.mockReturnValue(ok(1));
    const { result, rerender } = renderHook(({ s }) => useCompile(s), { initialProps: { s: 'a' } });
    expect(compileMock).toHaveBeenCalledTimes(1);
    expect(result.current.lastValidIr).toEqual(irOf(1));
    rerender({ s: 'ab' });
    rerender({ s: 'abc' });
    act(() => { vi.advanceTimersByTime(299); });
    expect(compileMock).toHaveBeenCalledTimes(1);
    compileMock.mockReturnValue(ok(2));
    act(() => { vi.advanceTimersByTime(1); });
    expect(compileMock).toHaveBeenCalledTimes(2);
    expect(compileMock).toHaveBeenLastCalledWith('abc');
    expect(result.current.lastValidIr).toEqual(irOf(2));
  });

  it('keeps last valid IR and graph on syntax errors', () => {
    compileMock.mockReturnValue(ok(1));
    const { result, rerender } = renderHook(({ s }) => useCompile(s), { initialProps: { s: 'a' } });
    const graph = result.current.lastValidGraph;
    expect(graph).not.toBeNull();
    compileMock.mockReturnValue(syntaxErr);
    rerender({ s: 'a {' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.result?.ir).toBeNull();
    expect(result.current.result?.hasErrors).toBe(true);
    expect(result.current.lastValidIr).toEqual(irOf(1));
    expect(result.current.lastValidGraph).toBe(graph);
  });

  it('survives a throwing compile', () => {
    compileMock.mockImplementation(() => { throw new Error('not implemented'); });
    const { result } = renderHook(() => useCompile('a'));
    expect(result.current.result).toBeNull();
    expect(result.current.lastValidGraph).toBeNull();
  });
});
