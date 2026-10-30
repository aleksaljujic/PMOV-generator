// Owned by T09. Top bar: ☰ sidebar toggle (Tekst / Interaktivno), title, Primeri dropdown, re-layout and export buttons.
import { useRef } from 'react';
import { EXAMPLES } from '../../examples';
import type { Locale } from '../../lang';
import { Combobox } from '../common';
import type { Mode } from './storage';
import { SIDEBAR_ID } from './SplitPane';
import { SHELL_STRINGS } from './strings';

export interface ToolbarProps {
  onPickExample(id: string): void;
  /** Example currently loaded (its title is shown); '' or omitted shows the "Primeri" placeholder. */
  exampleId?: string;
  onRelayout(): void;
  onExportSvg(): void;
  onExportPng(): void;
  /** JSON interchange (C13 §2). Without them there are no JSON buttons. */
  onExportJson?(): void;
  onImportJson?(file: File): void;
  /** Interactive builder (C09). All optional: without them the toolbar is the original one. */
  mode?: Mode;
  onModeChange?(mode: Mode): void;
  onNewDiagram?(): void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?(): void;
  onRedo?(): void;
  /** Language switch (spec/fix_editor.md): default 'sr'; the SR | EN switch shows only with onLocaleChange. */
  locale?: Locale;
  onLocaleChange?(locale: Locale): void;
}

export function Toolbar({
  onPickExample, exampleId = '', onRelayout, onExportSvg, onExportPng, onExportJson, onImportJson, mode, onModeChange, onNewDiagram, canUndo, canRedo, onUndo, onRedo, locale = 'sr', onLocaleChange,
}: ToolbarProps): JSX.Element {
  const t = SHELL_STRINGS[locale];
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <header className="toolbar">
      {onModeChange && mode && (
        <button
          type="button"
          className={`toolbar__burger${mode === 'tekst' ? ' is-active' : ''}`}
          aria-expanded={mode === 'tekst'}
          aria-controls={SIDEBAR_ID}
          aria-label={mode === 'tekst' ? t.hideText : t.showText}
          title={mode === 'tekst' ? t.hideText : t.showText}
          onClick={() => onModeChange(mode === 'tekst' ? 'interaktivno' : 'tekst')}
        >
          ☰
        </button>
      )}
      <h1 className="toolbar__title">PMOV editor</h1>
      <Combobox
        className="toolbar__select"
        aria-label={t.examples}
        placeholder={t.examples}
        locale={locale}
        value={exampleId}
        options={EXAMPLES.map((ex) => ({ value: ex.id, label: locale === 'en' ? ex.titleEn ?? ex.title : ex.title }))}
        onChange={onPickExample}
      />
      {onNewDiagram && <button type="button" onClick={onNewDiagram}>{t.newDiagram}</button>}
      {mode === 'interaktivno' && onUndo && (
        <>
          <button type="button" disabled={!canUndo} onClick={onUndo} title="Ctrl+Z">{t.undo}</button>
          <button type="button" disabled={!canRedo} onClick={onRedo} title="Ctrl+Shift+Z">{t.redo}</button>
        </>
      )}
      <span className="toolbar__spacer" />
      {onLocaleChange && (
        <div className="toolbar__modes toolbar__lang" role="group" aria-label={t.language}>
          {(['sr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={locale === l}
              className={locale === l ? 'is-active' : undefined}
              onClick={() => onLocaleChange(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onRelayout}>{t.relayout}</button>
      <button type="button" onClick={onExportSvg}>{t.exportSvg}</button>
      <button type="button" onClick={onExportPng}>{t.exportPng}</button>
      {onExportJson && <button type="button" onClick={onExportJson}>{t.exportJson}</button>}
      {onImportJson && (
        <>
          <button type="button" onClick={() => fileInput.current?.click()}>{t.importJson}</button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="import-json-input"
            aria-label={t.importJson}
            onChange={(e) => {
              const input = e.target;
              const file = input.files?.[0];
              if (file) onImportJson(file);
              input.value = '';
            }}
          />
        </>
      )}
    </header>
  );
}
