// Syntax help panel (T51): a drawer on the right with a short PMOV syntax reference. Esc or × closes it.
import { useEffect, useRef } from 'react';
import type { Locale } from '../../lang';
import { HELP_STRINGS } from './helpStrings';

export const HELP_PANEL_ID = 'pmov-help-panel';

export interface HelpPanelProps {
  open: boolean;
  onClose(): void;
  locale?: Locale;
}

export function HelpPanel({ open, onClose, locale = 'sr' }: HelpPanelProps): JSX.Element | null {
  const h = HELP_STRINGS[locale];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside id={HELP_PANEL_ID} className="help-panel" aria-label={h.title}>
      <div className="help-panel__header">
        <h2 className="help-panel__title">{h.title}</h2>
        <button ref={closeRef} type="button" className="help-panel__close" aria-label={h.close} title={h.close} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="help-panel__body">
        <p className="help-panel__intro">{h.intro}</p>
        {h.sections.map((s) => (
          <section key={s.title} className="help-panel__section">
            <h3>{s.title}</h3>
            {s.text && <p>{s.text}</p>}
            {s.code && <pre className="help-panel__code">{s.code}</pre>}
            {s.rows && (
              <table className="help-panel__table">
                <tbody>
                  {s.rows.map(([a, b]) => (
                    <tr key={a}>
                      <td><code>{a}</code></td>
                      <td>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
        <p className="help-panel__footer">{h.footer}</p>
      </div>
    </aside>
  );
}
