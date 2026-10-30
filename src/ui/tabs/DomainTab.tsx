// Domeni tab (T25, C10 §4): "Struktura domena" + "Atributi"; editable only with `onAction`.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale, PmovIR } from '../../lang';
import type { IRDomain } from '../../lang/ir';
import { buildDomainStructure, buildDomainTable } from '../../rm';
import { Combobox } from '../common';
import { scrollIfAvailable, useRunner } from './actions';
import type { TabAction, TabHighlight } from './actions';
import { tabStrings } from './strings';
import './tabs.css';

export interface DomainTabProps {
  ir: PmovIR | null;
  locale?: Locale;
  onAction?: TabAction;
  highlight?: TabHighlight;
}

const BUILTINS = ['long', 'short', 'string', 'date'] as const;

/** Domain names that may NOT be chosen as the naddomen of `self` (itself and its descendants). */
export function forbiddenParents(domains: IRDomain[], self: string | null): Set<string> {
  const out = new Set<string>();
  if (self === null) return out;
  out.add(self);
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of domains) if (d.parent && out.has(d.parent) && !out.has(d.name)) (out.add(d.name), (changed = true));
  }
  return out;
}

type FormState = { mode: 'add' } | { mode: 'edit'; name: string } | null;

function DomainForm(props: {
  ir: PmovIR;
  editing: IRDomain | null;
  t: ReturnType<typeof tabStrings>;
  locale?: Locale;
  onAction: TabAction;
  onClose(): void;
}): JSX.Element {
  const { ir, editing, t, onAction, onClose } = props;
  const runner = useRunner(onAction, t);
  const domains = ir.domains ?? [];
  const [name, setName] = useState(editing?.name ?? '');
  const [base, setBase] = useState(editing ? (editing.parent ?? editing.base ?? 'long') : 'long');
  const [length, setLength] = useState(editing?.length != null && !editing.parent ? String(editing.length) : '');
  const [constraint, setConstraint] = useState(editing?.constraint ?? '');
  const forbidden = forbiddenParents(domains, editing?.name ?? null);
  const parents = domains.filter((d) => !forbidden.has(d.name));
  const n = Number(length);
  const spec = {
    name: name.trim(),
    base,
    length: base === 'string' && length.trim() !== '' && Number.isFinite(n) ? n : null,
    constraint: constraint.trim() === '' ? null : constraint.trim(),
  };
  const submit = () =>
    runner.run(editing ? { kind: 'editDomain', name: editing.name, domain: spec } : { kind: 'addDomain', domain: spec }, onClose);
  return (
    <form
      className="pmov-tabs-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label>
        {t.fieldName}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {t.fieldTypeParent}
        <Combobox
          value={base}
          onChange={setBase}
          locale={props.locale}
          options={[
            ...BUILTINS.map((b) => ({ value: b, label: b })),
            ...parents.map((d) => ({ value: d.name, label: d.name })),
          ]}
        />
      </label>
      {base === 'string' && (
        <label>
          {t.fieldLength}
          <input type="number" min={1} value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
      )}
      <label>
        {t.fieldConstraint}
        <input value={constraint} onChange={(e) => setConstraint(e.target.value)} />
      </label>
      <button type="submit">{t.save}</button>{' '}
      <button type="button" onClick={onClose}>
        {t.cancel}
      </button>
      {editing && (
        <>
          {' '}
          <button type="button" onClick={() => runner.run({ kind: 'deleteDomain', name: editing.name, replace: false }, onClose)}>
            {t.del}
          </button>
        </>
      )}
      {runner.error && (
        <div className="pmov-tabs-error" role="alert">
          {runner.error}
        </div>
      )}
      {runner.dialog}
    </form>
  );
}

export function DomainTab({ ir, locale, onAction, highlight }: DomainTabProps): JSX.Element {
  const t = tabStrings(locale);
  const rows = useMemo(() => (ir ? buildDomainTable(ir) : null), [ir]);
  const structure = useMemo(() => (ir && ir.domains?.length ? buildDomainStructure(ir) : []), [ir]);
  const [form, setForm] = useState<FormState>(null);
  const runner = useRunner(onAction, t);
  const hlRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => scrollIfAvailable(hlRef.current), [highlight]);

  // Attribute rows → (owner, index, has a built-in type), for "Izdvoj u domen".
  const owners = useMemo(() => {
    const out: { owner: string; index: number; builtin: boolean }[] = [];
    for (const el of ir?.elements ?? []) {
      if (!('attributes' in el)) continue;
      el.attributes.forEach((a, index) => out.push({ owner: el.id, index, builtin: a.domain !== null && !a.userDomain }));
    }
    return out;
  }, [ir]);

  if (!ir || !rows) return <div className="pmov-tabs-empty">{t.emptyText}</div>;
  const editing = form?.mode === 'edit' ? (ir.domains ?? []).find((d) => d.name === form.name) ?? null : null;
  const canMap = onAction !== undefined && owners.length === rows.length;
  const hl = highlight?.kind === 'domain' ? highlight.name : null;

  return (
    <div className="pmov-tabs-root">
      <h3 className="pmov-tabs-heading">{t.domainStructure}</h3>
      {structure.length === 0 ? (
        <div className="pmov-tabs-hint">{t.noDomains}</div>
      ) : (
        <table className="pmov-tabs-table pmov-tabs-domains">
          <thead>
            <tr>
              <th>{t.colDomain}</th>
              <th>{t.colTypeParent}</th>
              <th>{t.colLength}</th>
              <th>{t.colConstraint}</th>
            </tr>
          </thead>
          <tbody>
            {structure.map((r) => (
              <tr
                key={r.domain}
                ref={hl === r.domain ? hlRef : undefined}
                className={[hl === r.domain ? 'pmov-tabs-highlight' : '', onAction ? 'pmov-tabs-clickable' : ''].join(' ').trim()}
                data-domain={r.domain}
                onClick={onAction ? () => setForm({ mode: 'edit', name: r.domain }) : undefined}
              >
                <td>{r.domain}</td>
                <td>{r.base}</td>
                <td>{r.length}</td>
                <td>
                  {r.constraint}
                  {r.inherited && (
                    <div className="pmov-tabs-inherited">
                      {t.inherited} {r.inherited}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {onAction && !form && (
        <p>
          <button type="button" onClick={() => setForm({ mode: 'add' })}>
            {t.addDomain}
          </button>
        </p>
      )}
      {onAction && form && (
        <DomainForm
          locale={locale}
          key={form.mode === 'edit' ? form.name : '+'}
          ir={ir}
          editing={editing}
          t={t}
          onAction={onAction}
          onClose={() => setForm(null)}
        />
      )}
      <h3 className="pmov-tabs-heading">{t.attributes}</h3>
      <table className="pmov-tabs-table">
        <thead>
          <tr>
            <th>{t.colAttribute}</th>
            <th>{t.colDomain}</th>
            <th>{t.colConstraint}</th>
            {canMap && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const o = owners[i];
            return (
              <tr key={`${r.attribute}-${i}`}>
                <td>{r.attribute}</td>
                <td>{r.domain}</td>
                <td>{r.constraint}</td>
                {canMap && (
                  <td>
                    {o?.builtin && (
                      <button type="button" onClick={() => runner.run({ kind: 'extractDomain', owner: o.owner, index: o.index })}>
                        {t.extractToDomain}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {runner.error && (
        <div className="pmov-tabs-error" role="alert">
          {runner.error}
        </div>
      )}
      {runner.dialog}
    </div>
  );
}
