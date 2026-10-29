// Owned by T09. Contract C08 §App-level pieces.
import { formatDiagnostic } from '../../lang';
import type { Diagnostic } from '../../lang';

export function ErrorPanel(props: { diagnostics: Diagnostic[]; onSelect(d: Diagnostic): void }): JSX.Element {
  const { diagnostics, onSelect } = props;
  return (
    <section className="error-panel" aria-label="Greške i upozorenja">
      <header className="error-panel__header">
        <span>Greške i upozorenja</span>
        <span className="error-panel__badge" data-testid="error-count">{diagnostics.length}</span>
      </header>
      {diagnostics.length === 0 ? (
        <p className="error-panel__empty">Nema grešaka.</p>
      ) : (
        <ul className="error-panel__list">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${d.span.from}-${i}`}>
              <button
                type="button"
                className={`error-panel__item error-panel__item--${d.severity}`}
                onClick={() => onSelect(d)}
              >
                {formatDiagnostic(d)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
