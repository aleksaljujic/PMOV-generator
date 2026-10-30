// Owned by T08. Contract C08 §Output tabs.
import { useMemo, useState } from 'react';
import type { Locale, PmovIR } from '../../lang';
import {
  dg0ToggleableVezas,
  formatModelText,
  generateRelationalModel,
  generateSql,
} from '../../rm';
import type { Dg0Mode, RelAttribute, RelationalModel, SqlDialect } from '../../rm';
import { DEFAULT_SQL_DIALECT, SQL_DIALECTS } from '../../rm/types';
import { tabStrings } from './strings';
import './tabs.css';

export interface RelationalTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
  onDg0ModeChange(mode: Dg0Mode): void;
  locale?: Locale;
}

export interface SqlTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
  locale?: Locale;
  /** C11: default DEFAULT_SQL_DIALECT. */
  dialect?: SqlDialect;
  /** C11: when absent, no dropdown is shown. */
  onDialectChange?(dialect: SqlDialect): void;
}

const DIALECT_LABELS: Record<SqlDialect, string> = {
  postgres: 'PostgreSQL',
  mssql: 'Microsoft SQL Server',
  oracle: 'Oracle',
};

export function useCopy(getText: () => string): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip || typeof clip.writeText !== 'function') return;
    void Promise.resolve(clip.writeText(getText()))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };
  return [copied, copy];
}

export function useModel(ir: PmovIR | null, hasErrors: boolean, dg0Mode: Dg0Mode): RelationalModel | null {
  return useMemo(
    () => (ir && !hasErrors ? generateRelationalModel(ir, { dg0Mode }) : null),
    [ir, hasErrors, dg0Mode],
  );
}

function AttrView({ a, nullableTitle }: { a: RelAttribute; nullableTitle: string }): JSX.Element {
  let node: JSX.Element | string = a.name;
  if (a.pk) node = <u>{a.name}</u>;
  else if (a.fk) node = <i>{a.name}</i>;
  return (
    <>
      {node}
      {a.nullable && (
        <sup className="pmov-tabs-nullable" title={nullableTitle}>
          ?
        </sup>
      )}
    </>
  );
}

export function RelationalTab({ ir, hasErrors, dg0Mode, onDg0ModeChange, locale }: RelationalTabProps): JSX.Element {
  const t = tabStrings(locale);
  const rm = useModel(ir, hasErrors, dg0Mode);
  const toggleable = useMemo(
    () => (ir && !hasErrors ? dg0ToggleableVezas(ir).length > 0 : false),
    [ir, hasErrors],
  );
  const [copied, copy] = useCopy(() => (rm ? formatModelText(rm) : ''));
  if (hasErrors) return <div className="pmov-tabs-empty">{t.errorText}</div>;
  if (!rm) return <div className="pmov-tabs-empty">{t.emptyText}</div>;
  return (
    <div className="pmov-tabs-root">
      <div className="pmov-tabs-toolbar">
        {toggleable && (
          <fieldset className="pmov-tabs-dg0">
            <legend>{t.dg0Legend}</legend>
            <label>
              <input
                type="radio"
                name="pmov-dg0-mode"
                checked={dg0Mode === 'relation'}
                onChange={() => onDg0ModeChange('relation')}
              />
              {t.dg0Relation}
            </label>
            <label>
              <input
                type="radio"
                name="pmov-dg0-mode"
                checked={dg0Mode === 'fk'}
                onChange={() => onDg0ModeChange('fk')}
              />
              {t.dg0Fk}
            </label>
          </fieldset>
        )}
        <button type="button" onClick={copy}>
          {t.copyAsText}
        </button>
        {copied && <span className="pmov-tabs-feedback">{t.copied}</span>}
      </div>
      <div className="pmov-tabs-relations">
        {rm.relations.map((rel) => (
          <div className="pmov-tabs-relation" key={rel.elementId + rel.name}>
            {rel.name}(
            {rel.attributes.map((a, i) => (
              <span key={a.name + i}>
                {i > 0 && ', '}
                <AttrView a={a} nullableTitle={t.nullableTitle} />
              </span>
            ))}
            )
          </div>
        ))}
      </div>
    </div>
  );
}

export function SqlTab({
  ir,
  hasErrors,
  dg0Mode,
  locale,
  dialect = DEFAULT_SQL_DIALECT,
  onDialectChange,
}: SqlTabProps): JSX.Element {
  const t = tabStrings(locale);
  const rm = useModel(ir, hasErrors, dg0Mode);
  const sql = useMemo(() => (rm ? generateSql(rm, ir ?? undefined, locale, dialect) : ''), [rm, ir, locale, dialect]);
  const [copied, copy] = useCopy(() => sql);
  if (hasErrors) return <div className="pmov-tabs-empty">{t.errorText}</div>;
  if (!rm) return <div className="pmov-tabs-empty">{t.emptyText}</div>;
  return (
    <div className="pmov-tabs-root">
      <div className="pmov-tabs-toolbar">
        {onDialectChange && (
          <label className="pmov-tabs-dialect">
            {t.dialectLabel}{' '}
            <select value={dialect} onChange={(e) => onDialectChange(e.target.value as SqlDialect)}>
              {SQL_DIALECTS.map((d) => (
                <option key={d} value={d}>
                  {DIALECT_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={copy}>
          {t.copy}
        </button>
        {copied && <span className="pmov-tabs-feedback">{t.copied}</span>}
      </div>
      <pre className="pmov-tabs-sql">{sql}</pre>
    </div>
  );
}
