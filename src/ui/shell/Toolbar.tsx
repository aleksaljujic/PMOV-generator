// Owned by T09. Top bar: title, Primeri dropdown, re-layout and export buttons.
import { EXAMPLES } from '../../examples';

export interface ToolbarProps {
  onPickExample(id: string): void;
  onRelayout(): void;
  onExportSvg(): void;
  onExportPng(): void;
}

export function Toolbar({ onPickExample, onRelayout, onExportSvg, onExportPng }: ToolbarProps): JSX.Element {
  return (
    <header className="toolbar">
      <h1 className="toolbar__title">PMOV editor</h1>
      <select
        className="toolbar__select"
        aria-label="Primeri"
        value=""
        onChange={(e) => {
          if (e.target.value) onPickExample(e.target.value);
        }}
      >
        <option value="">Primeri</option>
        {EXAMPLES.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.title}
          </option>
        ))}
      </select>
      <span className="toolbar__spacer" />
      <button type="button" onClick={onRelayout}>Ponovo rasporedi</button>
      <button type="button" onClick={onExportSvg}>Izvezi SVG</button>
      <button type="button" onClick={onExportPng}>Izvezi PNG</button>
    </header>
  );
}
