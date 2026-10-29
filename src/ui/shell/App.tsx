// Owned by T09. The "Mermaid Live Editor for PMOV" page. Contract C08 §App-level pieces.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLES } from '../../examples';
import { findElementAtOffset, getElement } from '../../lang';
import type { Diagnostic } from '../../lang';
import { DiagramView } from '../../render/flow';
import type { DiagramViewHandle } from '../../render/flow';
import type { PositionMap, Point } from '../../render/graph/types';
import { graphToSvg, svgToPngBlob } from '../../render/svg';
import type { Dg0Mode } from '../../rm/types';
import { Editor } from '../editor';
import type { EditorHandle } from '../editor';
import { DomainTab, RelationalTab, SqlTab } from '../tabs';
import { downloadBlob } from './download';
import { ErrorPanel } from './ErrorPanel';
import { SafeBoundary } from './SafeBoundary';
import { SplitPane } from './SplitPane';
import {
  clearPositions,
  loadDg0Mode,
  loadEditorWidth,
  loadPositions,
  loadSource,
  saveDg0Mode,
  saveEditorWidth,
  savePositions,
  saveSource,
} from './storage';
import { Toolbar } from './Toolbar';
import { useCompile } from './useCompile';
import './styles.css';

type TabId = 'diagram' | 'domains' | 'rm' | 'sql';
const TABS: { id: TabId; label: string }[] = [
  { id: 'diagram', label: 'Dijagram' },
  { id: 'domains', label: 'Domeni' },
  { id: 'rm', label: 'Relacioni model' },
  { id: 'sql', label: 'SQL' },
];

const NO_ERRORS: ReadonlySet<string> = new Set();

function TextFallbackEditor(props: { value: string; onChange(v: string): void }): JSX.Element {
  return (
    <textarea
      className="fallback-editor"
      aria-label="Izvorni tekst"
      spellCheck={false}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function App(): JSX.Element {
  const [source, setSource] = useState<string>(() => loadSource() ?? EXAMPLES[0]?.source ?? "");
  const [tab, setTab] = useState<TabId>('diagram');
  const [dg0Mode, setDg0Mode] = useState<Dg0Mode>(() => loadDg0Mode());
  const [savedPositions, setSavedPositions] = useState<PositionMap>(() => loadPositions());
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [editorWidth, setEditorWidth] = useState<number>(() => loadEditorWidth() ?? 520);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [highlightRange, setHighlightRange] = useState<{ from: number; to: number } | null>(null);

  const editorRef = useRef<EditorHandle>(null);
  const diagramRef = useRef<DiagramViewHandle>(null);
  const positionsRef = useRef(savedPositions);
  positionsRef.current = savedPositions;

  const { result, lastValidIr, lastValidGraph } = useCompile(source);
  const diagnostics = useMemo<Diagnostic[]>(() => result?.diagnostics ?? [], [result]);
  const hasErrors = result?.hasErrors ?? false;

  const errorElementIds = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    for (const d of diagnostics) if (d.severity === 'error' && d.elementId) ids.add(d.elementId);
    return ids.size === 0 ? NO_ERRORS : ids;
  }, [diagnostics]);

  // Persist source (debounced).
  useEffect(() => {
    const t = setTimeout(() => saveSource(source), 300);
    return () => clearTimeout(t);
  }, [source]);

  useEffect(() => {
    const t = setTimeout(() => saveEditorWidth(editorWidth), 200);
    return () => clearTimeout(t);
  }, [editorWidth]);

  const onCursorChange = useCallback(
    (offset: number) => {
      if (!lastValidIr) return;
      try {
        setSelectedElementId(findElementAtOffset(lastValidIr, offset));
      } catch {
        /* lang not ready */
      }
    },
    [lastValidIr],
  );

  const onElementClick = useCallback(
    (elementId: string) => {
      setSelectedElementId(elementId);
      if (!lastValidIr) return;
      try {
        const el = getElement(lastValidIr, elementId);
        if (el) {
          setHighlightRange({ from: el.span.from, to: el.span.to });
          editorRef.current?.revealRange(el.span.from, el.span.to);
        }
      } catch {
        /* ignore */
      }
    },
    [lastValidIr],
  );

  const onNodeMoved = useCallback((nodeId: string, position: Point) => {
    const next = { ...positionsRef.current, [nodeId]: position };
    positionsRef.current = next;
    setSavedPositions(next);
    savePositions(next);
  }, []);

  const onSelectDiagnostic = useCallback((d: Diagnostic) => {
    editorRef.current?.jumpTo(d.span.line, d.span.col);
  }, []);

  const onDg0Change = useCallback((m: Dg0Mode) => {
    setDg0Mode(m);
    saveDg0Mode(m);
  }, []);

  const resetPositions = useCallback(() => {
    clearPositions();
    positionsRef.current = {};
    setSavedPositions({});
  }, []);

  const onRelayout = useCallback(() => {
    resetPositions();
    setLayoutNonce((n) => n + 1);
  }, [resetPositions]);

  const onPickExample = useCallback(
    (id: string) => {
      const ex = EXAMPLES.find((e) => e.id === id);
      if (!ex) return;
      const edited = source.trim() !== '' && !EXAMPLES.some((e) => e.source === source);
      if (edited && !window.confirm('Izmenjeni tekst će biti zamenjen primerom. Nastaviti?')) return;
      setSource(ex.source);
      setSelectedElementId(null);
      setHighlightRange(null);
      resetPositions();
      setLayoutNonce((n) => n + 1);
    },
    [source, resetPositions],
  );

  const currentPositions = (): PositionMap => {
    try {
      return diagramRef.current?.getPositions() ?? positionsRef.current;
    } catch {
      return positionsRef.current;
    }
  };

  const onExportSvg = useCallback(() => {
    if (!lastValidGraph) return;
    try {
      const svg = graphToSvg(lastValidGraph, currentPositions());
      downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'pmov-dijagram.svg');
    } catch (e) {
      window.alert(`Izvoz nije uspeo: ${(e as Error).message}`);
    }
  }, [lastValidGraph]);

  const onExportPng = useCallback(async () => {
    if (!lastValidGraph) return;
    try {
      const svg = graphToSvg(lastValidGraph, currentPositions());
      downloadBlob(await svgToPngBlob(svg), 'pmov-dijagram.png');
    } catch (e) {
      window.alert(`Izvoz nije uspeo: ${(e as Error).message}`);
    }
  }, [lastValidGraph]);

  const left = (
    <div className="pane pane--left">
      <div className="pane__editor">
        <SafeBoundary name="Editor" fallback={<TextFallbackEditor value={source} onChange={setSource} />}>
          <Editor
            ref={editorRef}
            value={source}
            onChange={setSource}
            diagnostics={diagnostics}
            highlightRange={highlightRange}
            onCursorChange={onCursorChange}
          />
        </SafeBoundary>
      </div>
      <ErrorPanel diagnostics={diagnostics} onSelect={onSelectDiagnostic} />
    </div>
  );

  const right = (
    <div className="pane pane--right">
      <div className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`tabbar__tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pane__content">
        {/* DiagramView stays mounted; hidden with CSS so positions/viewport survive tab switches. */}
        <div className={`panel panel--diagram${tab === 'diagram' ? '' : ' is-hidden'}`} data-testid="diagram-panel">
          <SafeBoundary name="Dijagram">
            <DiagramView
              ref={diagramRef}
              graph={lastValidGraph}
              savedPositions={savedPositions}
              layoutNonce={layoutNonce}
              errorElementIds={errorElementIds}
              selectedElementId={selectedElementId}
              onElementClick={onElementClick}
              onNodeMoved={onNodeMoved}
            />
          </SafeBoundary>
        </div>
        {tab !== 'diagram' && (
          <div className="panel panel--text" data-testid="text-panel">
            <SafeBoundary key={tab} name={TABS.find((t) => t.id === tab)!.label}>
              {tab === 'domains' && <DomainTab ir={lastValidIr} />}
              {tab === 'rm' && (
                <RelationalTab ir={lastValidIr} hasErrors={hasErrors} dg0Mode={dg0Mode} onDg0ModeChange={onDg0Change} />
              )}
              {tab === 'sql' && <SqlTab ir={lastValidIr} hasErrors={hasErrors} dg0Mode={dg0Mode} />}
            </SafeBoundary>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      <Toolbar
        onPickExample={onPickExample}
        onRelayout={onRelayout}
        onExportSvg={onExportSvg}
        onExportPng={() => void onExportPng()}
      />
      <SplitPane left={left} right={right} width={editorWidth} onWidthChange={setEditorWidth} />
    </div>
  );
}
