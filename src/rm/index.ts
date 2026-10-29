// Public entry of src/rm — owned by T03. Contract C04.
import type { PmovIR } from '../lang';
import type { DomainRow, Relation, RelationalModel, RmOptions } from './types';

export * from './types';

export function generateRelationalModel(_ir: PmovIR, _options?: RmOptions): RelationalModel {
  throw new Error('not implemented: T03');
}

export function formatRelation(_rel: Relation): string {
  throw new Error('not implemented: T03');
}

export function formatModelText(_rm: RelationalModel): string {
  throw new Error('not implemented: T03');
}

export function generateSql(_rm: RelationalModel): string {
  throw new Error('not implemented: T03');
}

export function buildDomainTable(_ir: PmovIR): DomainRow[] {
  throw new Error('not implemented: T03');
}

export function dg0ToggleableVezas(_ir: PmovIR): string[] {
  throw new Error('not implemented: T03');
}
