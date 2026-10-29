// Owned by T08. Contract C08 §Output tabs.
import type { PmovIR } from '../../lang';
import type { Dg0Mode } from '../../rm';

export interface RelationalTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
  onDg0ModeChange(mode: Dg0Mode): void;
}

export interface SqlTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
}

export function DomainTab(_props: { ir: PmovIR | null }): JSX.Element {
  return <div>not implemented: T08</div>;
}

export function RelationalTab(_props: RelationalTabProps): JSX.Element {
  return <div>not implemented: T08</div>;
}

export function SqlTab(_props: SqlTabProps): JSX.Element {
  return <div>not implemented: T08</div>;
}
