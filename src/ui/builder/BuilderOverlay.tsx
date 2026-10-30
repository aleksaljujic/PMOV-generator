// Status line, toast and delete confirmation of the interactive builder (React). Rendered over the diagram panel.
import { BUILDER_STRINGS } from './strings';
import type { BuilderController } from './useBuilder';
import './builder.css';

export function BuilderOverlay({ builder }: { builder: BuilderController }): JSX.Element {
  const { confirm } = builder;
  const t = BUILDER_STRINGS[builder.locale];
  const kindLabel: Record<string, string> = {
    objekat: t.kindObject,
    slab: t.kindWeak,
    veza: t.kindRelationship,
    agregacija: t.kindAggregation,
    specijalizacija: t.kindSpecialization,
  };
  return (
    <>
      {builder.picking && (
        <div className="pmovb-status" role="status">
          {t.pickStatus}
          {builder.pickReason && <span className="reason">{builder.pickReason}</span>}
        </div>
      )}
      {builder.toast && (
        <div className="pmovb-toast" role="alert">
          {builder.toast}
        </div>
      )}
      {confirm && (
        <div className="pmovb-modal-backdrop">
          <div className="pmovb-modal" role="alertdialog" aria-label={t.confirmAria}>
            <h3>{confirm.message}</h3>
            <ul>
              {confirm.dependents.map((d) => (
                <li key={d.id}>
                  {kindLabel[d.kind] ?? d.kind} {d.id.startsWith('_#') ? t.unnamed : d.id}
                </li>
              ))}
              {(confirm.constraints ?? []).map((c) => (
                <li key={`c:${c}`}>
                  {t.constraintLabel}: {c}
                </li>
              ))}
            </ul>
            <div className="buttons">
              <button type="button" onClick={builder.cancelConfirm}>
                {t.cancel}
              </button>
              <button type="button" className="danger" onClick={builder.confirmDelete}>
                {t.deleteLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
