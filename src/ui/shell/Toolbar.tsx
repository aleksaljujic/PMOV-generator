// Owned by T09. Top bar: ☰ sidebar toggle (Tekst / Interaktivno), title, Primeri dropdown, re-layout and export buttons.
import { useRef } from 'react';
import { EXAMPLES } from '../../examples';
import type { Locale } from '../../lang';
import { Combobox } from '../common';
import type { LayoutChoice, Mode } from './storage';
import { HELP_PANEL_ID } from './HelpPanel';
import { HELP_STRINGS } from './helpStrings';
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
  /** Grid layout (spec/feature_grid_layout.md): the Raspored select and the two toggles show only with their callbacks. */
  layout?: LayoutChoice;
  onLayoutChange?(layout: LayoutChoice): void;
  lockAttributes?: boolean;
  onLockAttributesChange?(on: boolean): void;
  snapToGrid?: boolean;
  onSnapToGridChange?(on: boolean): void;
  /** Syntax help (T51): the "? Pomoć" button shows only with onHelpToggle. */
  helpOpen?: boolean;
  onHelpToggle?(): void;
}

export function Toolbar({
  onPickExample, exampleId = '', onRelayout, onExportSvg, onExportPng, onExportJson, onImportJson, mode, onModeChange, onNewDiagram, canUndo, canRedo, onUndo, onRedo, locale = 'sr', onLocaleChange,
  layout = 'grid', onLayoutChange, lockAttributes = true, onLockAttributesChange, snapToGrid = true, onSnapToGridChange, helpOpen = false, onHelpToggle,
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
      {onHelpToggle && (
        <button
          type="button"
          className={`toolbar__help${helpOpen ? ' is-active' : ''}`}
          aria-expanded={helpOpen}
          aria-controls={HELP_PANEL_ID}
          title={HELP_STRINGS[locale].buttonTitle}
          onClick={onHelpToggle}
        >
          {HELP_STRINGS[locale].button}
        </button>
      )}
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
      {onLayoutChange && (
        <label className="toolbar__layout">
          <span>{t.layout}:</span>
          <select
            className="toolbar__select"
            aria-label={t.layout}
            value={layout}
            onChange={(e) => onLayoutChange(e.target.value === 'free' ? 'free' : 'grid')}
          >
            <option value="grid">{t.layoutGrid}</option>
            <option value="free">{t.layoutFree}</option>
          </select>
        </label>
      )}
      {onLockAttributesChange && (
        <button
          type="button"
          aria-pressed={lockAttributes}
          className={lockAttributes ? 'is-active' : undefined}
          title={t.attrLockTitle}
          onClick={() => onLockAttributesChange(!lockAttributes)}
        >
          {t.attrLock}
        </button>
      )}
      {onSnapToGridChange && (
        <button
          type="button"
          aria-pressed={snapToGrid}
          className={snapToGrid ? 'is-active' : undefined}
          title={t.snapTitle}
          onClick={() => onSnapToGridChange(!snapToGrid)}
        >
          {t.snap}
        </button>
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
