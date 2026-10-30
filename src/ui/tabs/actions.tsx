// Shared action plumbing of the editable tabs (T25, C10 §4). Types of the public props live here.
import { useState } from 'react';
import type { BuilderAction, BuilderResult } from '../../builder';
import type { tabStrings } from './strings';

export type TabAction = (action: BuilderAction) => BuilderResult | void;
export type TabHighlight = { kind: 'domain' | 'constraint'; name: string } | null;

type Strings = ReturnType<typeof tabStrings>;

interface Pending {
  message: string;
  action: BuilderAction;
  onOk?: () => void;
}

/** Re-sends a rejected action with its confirmation flag set. */
function confirmed(action: BuilderAction): BuilderAction {
  if (action.kind === 'deleteDomain') return { ...action, replace: true };
  if ('withDependents' in action) return { ...action, withDependents: true };
  return action;
}

export interface Runner {
  /** Sends the action; `onOk` runs when the result is ok (or void). */
  run(action: BuilderAction, onOk?: () => void): void;
  error: string | null;
  clearError(): void;
  dialog: JSX.Element | null;
}

export function useRunner(onAction: TabAction | undefined, t: Strings): Runner {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const send = (action: BuilderAction, onOk?: () => void) => {
    if (!onAction) return;
    const res = onAction(action);
    if (!res || res.ok) {
      setError(null);
      onOk?.();
      return;
    }
    if (res.needsConfirmation) {
      setPending({ message: res.message, action, onOk });
      return;
    }
    setError(res.message);
  };

  const dialog = pending ? (
    <div className="pmov-tabs-confirm" role="alertdialog" aria-label={pending.message}>
      <p>{pending.message}</p>
      <button
        type="button"
        onClick={() => {
          const p = pending;
          setPending(null);
          send(confirmed(p.action), p.onOk);
        }}
      >
        {t.yes}
      </button>{' '}
      <button type="button" onClick={() => setPending(null)}>
        {t.no}
      </button>
    </div>
  ) : null;

  return { run: send, error, clearError: () => setError(null), dialog };
}

export function scrollIfAvailable(el: HTMLElement | null): void {
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
}
