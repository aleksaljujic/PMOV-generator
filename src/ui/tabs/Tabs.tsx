// Owned by T08. Contract C08 §Output tabs.
import { useMemo, useState } from 'react';
import type { PmovIR } from '../../lang';
import {
  buildDomainTable,
  dg0ToggleableVezas,
  formatModelText,
  generateRelationalModel,
  generateSql,
} from '../../rm';
import type { Dg0Mode, RelAttribute, RelationalModel } from '../../rm';
import './tabs.css';

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

const ERROR_TEXT = 'Ispravite greške da bi se generisao relacioni model.';
const EMPTY_TEXT = 'Nema podataka. Unesite dijagram u editor.';

function useCopy(getText: () => string): [boolean, () => void] {
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

function useModel(ir: PmovIR | null, hasErrors: boolean, dg0Mode: Dg0Mode): RelationalModel | null {
  return useMemo(
    () => (ir && !hasErrors ? generateRelationalModel(ir, { dg0Mode }) : null),
    [ir, hasErrors, dg0Mode],
  );
}

export function DomainTab({ ir }: { ir: PmovIR | null }): JSX.Element {
  const rows = useMemo(() => (ir ? buildDomainTable(ir) : null), [ir]);
  if (!rows) return <div className="pmov-tabs-empty">{EMPTY_TEXT}</div>;
  return (
    <div className="pmov-tabs-root">
      <table className="pmov-tabs-table">
        <thead>
          <tr>
            <th>ATRIBUT</th>
            <th>DOMEN</th>
            <th>OGRANIČENJE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.attribute}-${i}`}>
              <td>{r.attribute}</td>
              <td>{r.domain}</td>
              <td>{r.constraint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttrView({ a }: { a: RelAttribute }): JSX.Element {
  let node: JSX.Element | string = a.name;
  if (a.pk) node = <u>{a.name}</u>;
  else if (a.fk) node = <i>{a.name}</i>;
  return (
    <>
      {node}
      {a.nullable && (
        <sup className="pmov-tabs-nullable" title="može biti NULL">
          ?
        </sup>
      )}
    </>
  );
}

export function RelationalTab({ ir, hasErrors, dg0Mode, onDg0ModeChange }: RelationalTabProps): JSX.Element {
  const rm = useModel(ir, hasErrors, dg0Mode);
  const toggleable = useMemo(
    () => (ir && !hasErrors ? dg0ToggleableVezas(ir).length > 0 : false),
    [ir, hasErrors],
  );
  const [copied, copy] = useCopy(() => (rm ? formatModelText(rm) : ''));
  if (hasErrors) return <div className="pmov-tabs-empty">{ERROR_TEXT}</div>;
  if (!rm) return <div className="pmov-tabs-empty">{EMPTY_TEXT}</div>;
  return (
    <div className="pmov-tabs-root">
      <div className="pmov-tabs-toolbar">
        {toggleable && (
          <fieldset className="pmov-tabs-dg0">
            <legend>Veze sa DG=0:</legend>
            <label>
              <input
                type="radio"
                name="pmov-dg0-mode"
                checked={dg0Mode === 'relation'}
                onChange={() => onDg0ModeChange('relation')}
              />
              posebna relacija
            </label>
            <label>
              <input
                type="radio"
                name="pmov-dg0-mode"
                checked={dg0Mode === 'fk'}
                onChange={() => onDg0ModeChange('fk')}
              />
              strani ključ
            </label>
          </fieldset>
        )}
        <button type="button" onClick={copy}>
          Kopiraj kao tekst
        </button>
        {copied && <span className="pmov-tabs-feedback">Kopirano</span>}
      </div>
      <div className="pmov-tabs-relations">
        {rm.relations.map((rel) => (
          <div className="pmov-tabs-relation" key={rel.elementId + rel.name}>
            {rel.name}(
            {rel.attributes.map((a, i) => (
              <span key={a.name + i}>
                {i > 0 && ', '}
                <AttrView a={a} />
              </span>
            ))}
            )
          </div>
        ))}
      </div>
    </div>
  );
}

export function SqlTab({ ir, hasErrors, dg0Mode }: SqlTabProps): JSX.Element {
  const rm = useModel(ir, hasErrors, dg0Mode);
  const sql = useMemo(() => (rm ? generateSql(rm) : ''), [rm]);
  const [copied, copy] = useCopy(() => sql);
  if (hasErrors) return <div className="pmov-tabs-empty">{ERROR_TEXT}</div>;
  if (!rm) return <div className="pmov-tabs-empty">{EMPTY_TEXT}</div>;
  return (
    <div className="pmov-tabs-root">
      <div className="pmov-tabs-toolbar">
        <button type="button" onClick={copy}>
          Kopiraj
        </button>
        {copied && <span className="pmov-tabs-feedback">Kopirano</span>}
      </div>
      <pre className="pmov-tabs-sql">{sql}</pre>
    </div>
  );
}
