// Owned by T09. Contract C08 §App-level pieces.
import { formatDiagnostic } from '../../lang';
import type { Diagnostic, Locale } from '../../lang';
import { SHELL_STRINGS } from './strings';

export function ErrorPanel(props: {
  diagnostics: Diagnostic[];
  onSelect(d: Diagnostic): void;
  locale?: Locale;
}): JSX.Element {
  const { diagnostics, onSelect, locale = 'sr' } = props;
  const t = SHELL_STRINGS[locale];
  return (
    <section className="error-panel" aria-label={t.errorsTitle}>
      <header className="error-panel__header">
        <span>{t.errorsTitle}</span>
        <span className="error-panel__badge" data-testid="error-count">{diagnostics.length}</span>
      </header>
      {diagnostics.length === 0 ? (
        <p className="error-panel__empty">{t.noErrors}</p>
      ) : (
        <ul className="error-panel__list">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${d.span.from}-${i}`}>
              <button
                type="button"
                className={`error-panel__item error-panel__item--${d.severity}`}
                onClick={() => onSelect(d)}
              >
                {formatDiagnostic(d, locale)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
