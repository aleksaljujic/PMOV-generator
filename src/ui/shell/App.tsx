// Owned by T09. The "Mermaid Live Editor for PMOV" page. Contract C08 §App-level pieces.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLES } from '../../examples';
import { applyBuilderAction, isPlaceholderName } from '../../builder';
import type { BuilderAction, BuilderResult } from '../../builder';
import { compile, findElementAtOffset, getElement } from '../../lang';
import type { Diagnostic, Locale } from '../../lang';
import { DiagramView } from '../../render/flow';
import type { DiagramViewHandle } from '../../render/flow';
import type { PositionMap, Point } from '../../render/graph/types';
import { buildDiagramGraph } from '../../render/graph';
import { graphToSvg, svgToPngBlob } from '../../render/svg';
import { exportDiagramJson, formatJsonImportError, parseDiagramJson, PMOV_JSON_MAX_BYTES } from '../../interchange';
import { generateRelationalModel } from '../../rm';
import type { Dg0Mode, SqlDialect } from '../../rm/types';
import { BuilderOverlay, useBuilder } from '../builder';
import { Editor } from '../editor';
import type { EditorHandle } from '../editor';
import { ConstraintsTab, DomainTab, RelationalTab, SqlTab } from '../tabs';
import type { TabHighlight } from '../tabs';
import { downloadBlob } from './download';
import { computePlacements, moveKeys } from './placement';
import { ErrorPanel } from './ErrorPanel';
import { SafeBoundary } from './SafeBoundary';
import { SplitPane } from './SplitPane';
import {
  clearPositions,
  loadDg0Mode,
  loadSqlDialect,
  loadEditorWidth,
  loadLang,
  loadMode,
  loadPositions,
  loadSource,
  saveDg0Mode,
  saveSqlDialect,
  saveEditorWidth,
  saveLang,
  saveMode,
  savePositions,
  saveSource,
} from './storage';
import type { Mode } from './storage';
import { SHELL_STRINGS } from './strings';
import { Toolbar } from './Toolbar';
import { useCompile } from './useCompile';
import './styles.css';

type TabId = 'diagram' | 'domains' | 'rm' | 'constraints' | 'sql';
const TAB_IDS: TabId[] = ['diagram', 'domains', 'rm', 'constraints', 'sql'];

const NO_ERRORS: ReadonlySet<string> = new Set();
const HISTORY_LIMIT = 200;
const CREATING = new Set<BuilderAction['kind']>([
  'addObject', 'addSlab', 'addAgregacija', 'addPodtip', 'addComponent',
]);

interface Snapshot { source: string; positions: PositionMap }

function TextFallbackEditor(props: { value: string; onChange(v: string): void; label: string }): JSX.Element {
  return (
    <textarea
      className="fallback-editor"
      aria-label={props.label}
      spellCheck={false}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

export function App(): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => loadLang());
  const t = SHELL_STRINGS[locale];
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const TABS = useMemo(
    () => TAB_IDS.map((id) => ({ id, label: id === 'diagram' ? t.tabDiagram : id === 'domains' ? t.tabDomains : id === 'rm' ? t.tabRm : id === 'constraints' ? t.tabConstraints : t.tabSql })),
    [t],
  );
  const changeLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    saveLang(l);
  }, []);
  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      /* ignore */
    }
  }, [locale]);

  const [source, setSource] = useState<string>(() => loadSource() ?? EXAMPLES[0]?.source ?? "");
  /** Example last loaded from Primeri (shown in the toolbar); '' after Novi dijagram or a JSON import. */
  const [exampleId, setExampleId] = useState<string>(
    () => EXAMPLES.find((e) => e.source === source || e.sourceEn === source)?.id ?? '',
  );
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

  const [sqlDialect, setSqlDialect] = useState<SqlDialect>(() => loadSqlDialect());
  const [mode, setModeState] = useState<Mode>(() => loadMode());
  const interactive = mode === 'interaktivno';
  // The sidebar content stays mounted while the close animation runs; without an animation it unmounts at once.
  const [sidebarGone, setSidebarGone] = useState(interactive);
  const sidebarOpen = !interactive || !sidebarGone;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoRenameId, setAutoRenameId] = useState<string | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const history = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);

  const { result, lastValidIr, lastValidGraph } = useCompile(source, interactive ? 0 : 300, locale);
  const hasSyntaxErrors = (result?.diagnostics ?? []).some((d) => d.code.startsWith('S'));
  const hasErrors = result?.hasErrors ?? false;
  const [highlight, setHighlight] = useState<TabHighlight>(null);
  // C10 §7: RM diagnostics (E18-E20, W06) join the list but never set `hasErrors` for the RM tabs.
  const rmDiagnostics = useMemo<Diagnostic[]>(() => {
    const ir = result?.ir;
    if (!ir || hasErrors) return [];
    try {
      return generateRelationalModel(ir, { dg0Mode, locale }).diagnostics ?? [];
    } catch {
      return [];
    }
  }, [result, hasErrors, dg0Mode, locale]);
  const diagnostics = useMemo<Diagnostic[]>(() => {
    const base = result?.diagnostics ?? [];
    return rmDiagnostics.length === 0 ? base : [...base, ...rmDiagnostics].sort((a, b) => a.span.from - b.span.from);
  }, [result, rmDiagnostics]);

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

  // ---------------------------------------------------------------- interactive builder (C09)

  const pushHistory = useCallback((snap: Snapshot) => {
    const h = history.current;
    h.past.push(snap);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    h.future = [];
    setHistoryTick((t) => t + 1);
  }, []);

  const restore = useCallback((snap: Snapshot) => {
    sourceRef.current = snap.source;
    setSource(snap.source);
    positionsRef.current = snap.positions;
    setSavedPositions(snap.positions);
    savePositions(snap.positions);
    setSelectedElementId(null);
    setHighlightRange(null);
  }, []);

  const onUndo = useCallback(() => {
    const h = history.current;
    const snap = h.past.pop();
    if (!snap) return;
    h.future.push({ source: sourceRef.current, positions: positionsRef.current });
    restore(snap);
    setHistoryTick((t) => t + 1);
  }, [restore]);

  const onRedo = useCallback(() => {
    const h = history.current;
    const snap = h.future.pop();
    if (!snap) return;
    h.past.push({ source: sourceRef.current, positions: positionsRef.current });
    restore(snap);
    setHistoryTick((t) => t + 1);
  }, [restore]);

  const changeMode = useCallback((m: Mode) => {
    setModeState(m);
    saveMode(m);
    if (m === 'tekst') {
      // The editor's own history starts from the current text.
      history.current = { past: [], future: [] };
      setHistoryTick((t) => t + 1);
    }
  }, []);

  const finishClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setSidebarGone(true);
  }, []);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (!interactive) {
      setSidebarGone(false);
      return;
    }
    let animated = false;
    try {
      animated = typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* no animation */
    }
    // transitionend normally ends it; the timer covers a transition that never fires.
    if (animated) closeTimer.current = setTimeout(finishClose, 400);
    else finishClose();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [interactive, finishClose]);

  // Focus follows the toggle: closing -> diagram panel, opening -> editor (not on first load).
  const firstModeRender = useRef(true);
  useEffect(() => {
    if (firstModeRender.current) {
      firstModeRender.current = false;
      return;
    }
    if (interactive) document.querySelector<HTMLElement>('[data-testid="diagram-panel"]')?.focus();
    else editorRef.current?.focus();
  }, [interactive]);

  // Ctrl+B / Cmd+B toggles the sidebar, also from the editor, but not from builder text fields.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'b') return;
      const el = e.target as HTMLElement | null;
      if (el && !el.closest?.('.cm-editor, [data-testid="editor"]') && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      changeMode(modeRef.current === 'tekst' ? 'interaktivno' : 'tekst');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [changeMode]);

  /** One interactive action = one history step: new source, selection, and saved positions for new/renamed nodes. */
  const applyAction = useCallback(
    (action: BuilderAction): BuilderResult => {
      const cur = sourceRef.current;
      const r = applyBuilderAction(cur, action, { locale: localeRef.current });
      if (!r.ok) return r;
      const prevPositions = positionsRef.current;
      let onScreen: PositionMap = {};
      try {
        onScreen = diagramRef.current?.getPositions() ?? {};
      } catch {
        /* ignore */
      }
      const base: PositionMap = { ...onScreen, ...prevPositions };
      let next: PositionMap = r.renames?.length ? moveKeys(prevPositions, base, r.renames) : { ...prevPositions };
      try {
        const ir = compile(r.source, { locale: localeRef.current }).ir;
        if (ir) {
          const graph = buildDiagramGraph(ir);
          if (r.placeAt?.length) next = { ...next, ...computePlacements(graph, { ...base, ...next }, r.placeAt) };
          const ids = new Set(graph.nodes.map((n) => n.id));
          for (const id of Object.keys(next)) if (!ids.has(id)) delete next[id];
        }
      } catch {
        /* positions are best effort */
      }
      pushHistory({ source: cur, positions: prevPositions });
      sourceRef.current = r.source;
      setSource(r.source);
      positionsRef.current = next;
      setSavedPositions(next);
      savePositions(next);
      setSelectedElementId(action.kind === 'deleteElement' ? null : (r.select ?? null));
      setHighlightRange(null);
      if (CREATING.has(action.kind) && r.select && isPlaceholderName(r.select)) setAutoRenameId(r.select);
      return r;
    },
    [pushHistory],
  );

  const onNewDiagram = useCallback(() => {
    const cur = sourceRef.current;
    if (cur.trim() !== '' && !window.confirm(SHELL_STRINGS[localeRef.current].confirmNew)) return;
    const r = applyBuilderAction(cur, { kind: 'newModel' }, { locale: localeRef.current });
    if (!r.ok) return;
    if (mode !== 'interaktivno') changeMode('interaktivno');
    pushHistory({ source: cur, positions: positionsRef.current });
    sourceRef.current = r.source;
    setSource(r.source);
    setExampleId('');
    clearPositions();
    positionsRef.current = {};
    setSavedPositions({});
    setLayoutNonce((n) => n + 1);
    setSelectedElementId(r.select ?? null);
    setHighlightRange(null);
    if (r.select) setAutoRenameId(r.select);
  }, [mode, changeMode, pushHistory]);

  const onAutoRenameHandled = useCallback(() => setAutoRenameId(null), []);
  const builder = useBuilder({
    ir: lastValidIr,
    graph: lastValidGraph,
    disabled: !interactive || hasSyntaxErrors,
    selectedElementId,
    autoRenameId,
    onAutoRenameHandled,
    onAction: applyAction,
    locale,
  });

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y in Interaktivno mode (text fields keep their own undo).
  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive, onUndo, onRedo]);

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
      if (interactive && builder.handleElementClick(elementId)) return;
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
    [lastValidIr, interactive, builder],
  );

  const onNodeMoved = useCallback((nodeId: string, position: Point) => {
    const next = { ...positionsRef.current, [nodeId]: position };
    positionsRef.current = next;
    setSavedPositions(next);
    savePositions(next);
  }, []);

  /** C10 §7: a diagnostic without an element whose span lies in a domain / constraint opens that tab. */
  const routeDiagnostic = useCallback(
    (d: Diagnostic): boolean => {
      if (d.elementId || !lastValidIr) return false;
      const inside = (s: { from: number; to: number }) => d.span.from >= s.from && d.span.to <= s.to;
      const dom = lastValidIr.domains?.find((x) => inside(x.span));
      if (dom) {
        setTab('domains');
        setHighlight({ kind: 'domain', name: dom.name });
        return true;
      }
      const con = lastValidIr.constraints?.find((x) => inside(x.span));
      if (con) {
        setTab('constraints');
        setHighlight({ kind: 'constraint', name: con.name });
        return true;
      }
      return false;
    },
    [lastValidIr],
  );

  /** Tab edits (Domeni / Ograničenja) in both modes. Tekst: new editor value; Interaktivno: one history step. */
  const onTabAction = useCallback(
    (action: BuilderAction): BuilderResult => {
      if (interactive) return applyAction(action);
      const r = applyBuilderAction(sourceRef.current, action, { locale: localeRef.current });
      if (r.ok) {
        sourceRef.current = r.source;
        setSource(r.source);
      }
      return r;
    },
    [interactive, applyAction],
  );

  const onSelectDiagnostic = useCallback(
    (d: Diagnostic) => {
      if (routeDiagnostic(d) && interactive) return;
      if (interactive) {
        // No editor line to jump to: select the element and centre it on the diagram.
        if (d.elementId) {
          setSelectedElementId(d.elementId);
          diagramRef.current?.centerOnElement?.(d.elementId);
        }
        return;
      }
      editorRef.current?.jumpTo(d.span.line, d.span.col);
    },
    [interactive, routeDiagnostic],
  );

  const onSqlDialectChange = useCallback((d: SqlDialect) => {
    setSqlDialect(d);
    saveSqlDialect(d);
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
      const exSource = locale === 'en' ? ex.sourceEn ?? ex.source : ex.source;
      const edited = source.trim() !== '' && !EXAMPLES.some((e) => e.source === source || e.sourceEn === source);
      if (edited && !window.confirm(t.confirmExample)) return;
      if (interactive) pushHistory({ source, positions: positionsRef.current });
      sourceRef.current = exSource;
      setSource(exSource);
      setExampleId(id);
      setSelectedElementId(null);
      setHighlightRange(null);
      resetPositions();
      setLayoutNonce((n) => n + 1);
    },
    [source, resetPositions, interactive, pushHistory, locale, t],
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
      window.alert(`${SHELL_STRINGS[localeRef.current].exportFailed}: ${(e as Error).message}`);
    }
  }, [lastValidGraph]);

  const onExportPng = useCallback(async () => {
    if (!lastValidGraph) return;
    try {
      const svg = graphToSvg(lastValidGraph, currentPositions());
      downloadBlob(await svgToPngBlob(svg), 'pmov-dijagram.png');
    } catch (e) {
      window.alert(`${SHELL_STRINGS[localeRef.current].exportFailed}: ${(e as Error).message}`);
    }
  }, [lastValidGraph]);

  const onExportJson = useCallback(() => {
    try {
      const text = exportDiagramJson({
        source: sourceRef.current,
        ir: result?.ir ?? null,
        graph: lastValidGraph ?? null,
        positions: currentPositions(),
        options: { dg0Mode, sqlDialect },
        locale: localeRef.current,
        now: new Date(),
      });
      const name = localeRef.current === 'en' ? 'pmov-diagram.json' : 'pmov-dijagram.json';
      downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), name);
    } catch (e) {
      window.alert(`${SHELL_STRINGS[localeRef.current].exportFailed}: ${(e as Error).message}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, lastValidGraph, dg0Mode, sqlDialect]);

  const onImportJson = useCallback(
    async (file: File) => {
      const loc = localeRef.current;
      const fail = (error: Parameters<typeof formatJsonImportError>[0]) =>
        window.alert(formatJsonImportError(error, loc));
      if (file.size > PMOV_JSON_MAX_BYTES) return fail({ code: 'tooLarge' });
      let text: string;
      try {
        text = await readFileText(file);
      } catch {
        return fail({ code: 'readError' });
      }
      const r = parseDiagramJson(text);
      if (!r.ok) return fail(r.error);
      const cur = sourceRef.current;
      if (cur.trim() !== '' && cur !== r.source && !window.confirm(SHELL_STRINGS[loc].confirmImport)) return;
      if (interactive) pushHistory({ source: cur, positions: positionsRef.current });
      sourceRef.current = r.source;
      setSource(r.source);
      setExampleId('');
      positionsRef.current = r.positions;
      setSavedPositions(r.positions);
      savePositions(r.positions);
      if (r.options.dg0Mode) onDg0Change(r.options.dg0Mode);
      if (r.options.sqlDialect) onSqlDialectChange(r.options.sqlDialect);
      setSelectedElementId(null);
      setHighlightRange(null);
      setLayoutNonce((n) => n + 1);
      if (r.fromModel) window.alert(SHELL_STRINGS[loc].importedFromModel);
    },
    [interactive, pushHistory, onDg0Change, onSqlDialectChange],
  );

  const left = !sidebarOpen ? null : (
    <div className="pane pane--left">
      <div className="pane__editor">
        <SafeBoundary name="Editor" fallback={<TextFallbackEditor value={source} onChange={setSource} label={t.sourceText} />}>
          <Editor
            ref={editorRef}
            value={source}
            onChange={setSource}
            diagnostics={diagnostics}
            highlightRange={highlightRange}
            onCursorChange={onCursorChange}
            locale={locale}
          />
        </SafeBoundary>
      </div>
      <ErrorPanel diagnostics={diagnostics} onSelect={onSelectDiagnostic} locale={locale} />
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
            onClick={() => {
              setTab(t.id);
              setHighlight(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {interactive && hasSyntaxErrors && (
        <div className="builder-banner" role="alert">
          <span>{t.syntaxBanner}</span>
          <button type="button" onClick={() => changeMode('tekst')}>{t.openText}</button>
        </div>
      )}
      <div className="pane__content">
        {/* DiagramView stays mounted; hidden with CSS so positions/viewport survive tab switches. */}
        <div className={`panel panel--diagram${tab === 'diagram' ? '' : ' is-hidden'}`} data-testid="diagram-panel" tabIndex={-1}>
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
              locale={locale}
              {...(interactive ? builder.diagramProps : {})}
            />
          </SafeBoundary>
          {interactive && <BuilderOverlay builder={builder} />}
        </div>
        {tab !== 'diagram' && (
          <div className="panel panel--text" data-testid="text-panel">
            <SafeBoundary key={tab} name={TABS.find((t) => t.id === tab)!.label}>
              {tab === 'domains' && <DomainTab ir={lastValidIr} locale={locale} onAction={onTabAction} highlight={highlight} />}
              {tab === 'rm' && (
                <RelationalTab ir={lastValidIr} hasErrors={hasErrors} dg0Mode={dg0Mode} onDg0ModeChange={onDg0Change} locale={locale} />
              )}
              {tab === 'constraints' && (
                <ConstraintsTab ir={lastValidIr} hasErrors={hasErrors} dg0Mode={dg0Mode} locale={locale} onAction={onTabAction} highlight={highlight} />
              )}
              {tab === 'sql' && <SqlTab ir={lastValidIr} hasErrors={hasErrors} dg0Mode={dg0Mode} locale={locale} dialect={sqlDialect} onDialectChange={onSqlDialectChange} />}
            </SafeBoundary>
          </div>
        )}
      </div>
      {interactive && <ErrorPanel diagnostics={diagnostics} onSelect={onSelectDiagnostic} locale={locale} />}
    </div>
  );

  return (
    <div className={`app${interactive ? ' app--interactive' : ''}`}>
      <Toolbar
        mode={mode}
        onModeChange={changeMode}
        onNewDiagram={onNewDiagram}
        canUndo={history.current.past.length > 0}
        canRedo={history.current.future.length > 0}
        onUndo={onUndo}
        onRedo={onRedo}
        onPickExample={onPickExample}
        exampleId={exampleId}
        onRelayout={onRelayout}
        onExportSvg={onExportSvg}
        onExportPng={() => void onExportPng()}
        onExportJson={onExportJson}
        onImportJson={(f) => void onImportJson(f)}
        locale={locale}
        onLocaleChange={changeLocale}
      />
      <SplitPane
        left={left}
        right={right}
        width={editorWidth}
        onWidthChange={setEditorWidth}
        dividerLabel={t.resizeEditor}
        collapsed={interactive}
        onLeftTransitionEnd={interactive ? finishClose : undefined}
      />
    </div>
  );
}
