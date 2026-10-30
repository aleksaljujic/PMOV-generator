// Small presentational pieces of the builder overlay (React). They never edit text: they call back into the hook.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DOMAINS } from '../../lang';
import type { Domain, IRDomain, Locale } from '../../lang';
import type { AttributeSpec, BuilderResult, DomainSpec } from '../../builder';
import { Combobox } from '../common';
import type { BuilderStrings } from './strings';

export interface MenuItem {
  label: string;
  onSelect(): void;
  danger?: boolean;
  separatorBefore?: boolean;
}

export function Menu({ items }: { items: MenuItem[] }): JSX.Element {
  return (
    <div className="pmovb-menu nodrag nopan nowheel" role="menu">
      {items.map((it) => (
        <div key={it.label}>
          {it.separatorBefore && <hr />}
          <button type="button" role="menuitem" className={it.danger ? 'is-danger' : undefined} onClick={it.onSelect}>
            {it.label}
          </button>
        </div>
      ))}
    </div>
  );
}

/** Inline name editor drawn over a node. Enter commits, Esc / blur-without-change cancels. */
export function RenameInput(props: {
  t: BuilderStrings;
  initial: string;
  error: string | null;
  onCommit(value: string): void;
  onCancel(): void;
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(props.initial);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <>
      <input
        ref={ref}
        type="text"
        className="pmovb-rename nodrag nopan"
        aria-label={props.t.nameAria}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') props.onCommit(value);
          else if (e.key === 'Escape') {
            done.current = true;
            props.onCancel();
          }
        }}
        onBlur={() => {
          if (done.current) return;
          if (value === props.initial) props.onCancel();
          else props.onCommit(value);
        }}
      />
      {props.error && <div className="pmovb-error pmovb-rename-error">{props.error}</div>}
    </>
  );
}

const NO_DOMAIN = '';
const NEW_DOMAIN = '__new__';
const USER = 'u:';

/** Small inline form for "Novi domen…": saved immediately as its own `addDomain` action. */
function DomainForm(props: {
  t: BuilderStrings;
  locale?: Locale;
  domains: IRDomain[];
  onSave(spec: DomainSpec): BuilderResult;
  onDone(name: string | null): void;
}): JSX.Element {
  const { t } = props;
  const [name, setName] = useState('');
  const [base, setBase] = useState<string>('short');
  const [length, setLength] = useState('');
  const [constraint, setConstraint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (name.trim() === '') return setError(t.badName);
    const n = Number(length);
    const spec: DomainSpec = { name: name.trim(), base };
    if (base === 'string' && length.trim() !== '' && Number.isInteger(n) && n > 0) spec.length = n;
    if (constraint.trim() !== '') spec.constraint = constraint.trim();
    const r = props.onSave(spec);
    if (r.ok) props.onDone(spec.name);
    else setError(r.message);
  };
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') props.onDone(null);
  };
  return (
    <div className="pmovb-subform" role="group" aria-label={t.domainFormAria} onKeyDown={keys}>
      <label>
        {t.domainName}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label>
        {t.domainBase}
        <Combobox
          value={base}
          onChange={setBase}
          locale={props.locale}
          options={[
            ...DOMAINS.map((d) => ({ value: d, label: d })),
            ...props.domains.map((d) => ({ value: d.name, label: d.name })),
          ]}
        />
      </label>
      {base === 'string' && (
        <label>
          {t.domainLength}
          <input type="number" min={1} value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
      )}
      <label>
        {t.domainConstraint}
        <input type="text" value={constraint} onChange={(e) => setConstraint(e.target.value)} />
      </label>
      {error && <div className="pmovb-error">{error}</div>}
      <div className="buttons">
        <button type="button" onClick={() => props.onDone(null)}>
          {t.cancel}
        </button>
        <button type="button" className="primary" onClick={save}>
          {t.save}
        </button>
      </div>
    </div>
  );
}

/** "+ atribut" / edit form. Enter = save (and open an empty form for the next attribute when adding). */
export function AttributeForm(props: {
  t: BuilderStrings;
  initial: AttributeSpec | null;
  defaultId: boolean;
  error: string | null;
  /** C10: domains declared in the model (`ir.domains`). */
  userDomains?: IRDomain[];
  /** C10: saves a new domain at once (its own `addDomain` action). */
  onAddDomain?(spec: DomainSpec): BuilderResult;
  onSave(attr: AttributeSpec): void;
  onDelete?(): void;
  onCancel(): void;
  locale?: Locale;
}): JSX.Element {
  const { initial, t } = props;
  const [name, setName] = useState(initial?.name ?? '');
  const [isId, setIsId] = useState(initial ? initial.id : props.defaultId);
  const [domain, setDomain] = useState<string>(initial?.userDomain ? USER + initial.userDomain : (initial?.domain ?? NO_DOMAIN));
  const [length, setLength] = useState(initial?.length ? String(initial.length) : '');
  const [constraint, setConstraint] = useState(initial?.constraint ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [addedDomains, setAddedDomains] = useState<IRDomain[]>([]);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => nameRef.current?.focus(), []);

  const known = props.userDomains ?? [];
  const domains = [...known, ...addedDomains.filter((a) => !known.some((k) => k.name === a.name))];
  const userName = domain.startsWith(USER) ? domain.slice(USER.length) : null;
  const picked = userName === null ? undefined : domains.find((d) => d.name === userName);
  const noType = domain === NO_DOMAIN;

  const save = () => {
    if (name.trim() === '') {
      setLocalError(t.badName);
      return;
    }
    setLocalError(null);
    const spec: AttributeSpec = {
      name: name.trim(),
      id: isId,
      domain: noType || userName !== null ? null : (domain as Domain),
      constraint: noType || constraint.trim() === '' ? null : constraint.trim(),
    };
    if (userName !== null) spec.userDomain = userName;
    const n = Number(length);
    if (domain === 'string' && length.trim() !== '' && Number.isInteger(n) && n > 0) spec.length = n;
    props.onSave(spec);
  };
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') props.onCancel();
  };
  const err = localError ?? props.error;

  return (
    <div className="pmovb-pop nodrag nopan nowheel" role="dialog" aria-label={t.attributeAria} onKeyDown={keys}>
      <label>
        {t.attrName}
        <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="row">
        <input type="checkbox" checked={isId} onChange={(e) => setIsId(e.target.checked)} />
        {t.attrIdentifier}
      </label>
      <label>
        {t.attrDomain}
        <Combobox
          value={domain}
          locale={props.locale}
          onChange={(v) => {
            if (v === NEW_DOMAIN) setCreating(true);
            else setDomain(v);
          }}
          options={[
            { value: NO_DOMAIN, label: '–' },
            ...DOMAINS.map((d) => ({ value: d, label: d })),
            ...domains.map((d) => ({ value: USER + d.name, label: d.name, group: t.userDomains })),
            ...(props.onAddDomain ? [{ value: NEW_DOMAIN, label: t.newDomain, pinned: true }] : []),
          ]}
        />
      </label>
      {creating && props.onAddDomain && (
        <DomainForm
          t={t}
          locale={props.locale}
          domains={domains}
          onSave={props.onAddDomain}
          onDone={(created) => {
            setCreating(false);
            if (created !== null) {
              setAddedDomains((cur) => [...cur, { name: created } as IRDomain]);
              setDomain(USER + created);
            }
          }}
        />
      )}
      {domain === 'string' && (
        <label>
          {t.attrLength}
          <input type="number" min={1} value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
      )}
      <label>
        {t.attrConstraint}
        <input
          type="text"
          value={constraint}
          disabled={noType}
          placeholder={picked?.effectiveConstraint ?? ''}
          onChange={(e) => setConstraint(e.target.value)}
        />
      </label>
      {err && <div className="pmovb-error">{err}</div>}
      <div className="buttons">
        {props.onDelete && (
          <button type="button" className="danger" onClick={props.onDelete}>
            {t.deleteLabel}
          </button>
        )}
        <button type="button" onClick={props.onCancel}>
          {t.cancel}
        </button>
        <button type="button" className="primary" onClick={save}>
          {t.save}
        </button>
      </div>
    </div>
  );
}

const CARDS: { dg: 0 | 1; gg: '1' | 'M' }[] = [
  { dg: 0, gg: '1' },
  { dg: 1, gg: '1' },
  { dg: 0, gg: 'M' },
  { dg: 1, gg: 'M' },
];

/** Popover next to an edge label: cardinality buttons, mapping name, specijalizacija name. */
export function EdgeEditor(props: {
  t: BuilderStrings;
  current: { dg: 0 | 1; gg: '1' | 'M' };
  mapping: string | null | undefined; // undefined = no mapping field
  specName: string | null; // non-null = show the rename field
  error: string | null;
  onCard(dg: 0 | 1, gg: '1' | 'M'): void;
  onMapping(name: string | null): void;
  onRenameSpec(name: string): void;
  onClose(): void;
}): JSX.Element {
  const [mapping, setMapping] = useState(props.mapping ?? '');
  const [spec, setSpec] = useState(props.specName ?? '');
  const field = (value: string, set: (v: string) => void, commit: () => void, label: string): ReactNode => (
    <label>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') props.onClose();
        }}
        onBlur={commit}
      />
    </label>
  );
  return (
    <div className="pmovb-pop pmovb-pop--edge nodrag nopan nowheel" role="dialog" aria-label={props.t.edgeAria} onClick={(e) => e.stopPropagation()}>
      <div className="cards" aria-label={props.t.cardinalityAria}>
        {CARDS.map((c) => (
          <button
            key={`${c.dg}${c.gg}`}
            type="button"
            className={c.dg === props.current.dg && c.gg === props.current.gg ? 'is-current' : undefined}
            onClick={() => props.onCard(c.dg, c.gg)}
          >
            {`(${c.dg},${c.gg})`}
          </button>
        ))}
      </div>
      {props.mapping !== undefined &&
        field(mapping, setMapping, () => {
          const next = mapping.trim() === '' ? null : mapping.trim();
          if (next !== (props.mapping ?? null)) props.onMapping(next);
        }, props.t.mapping)}
      {props.specName !== null &&
        field(spec, setSpec, () => {
          if (spec.trim() !== '' && spec.trim() !== props.specName) props.onRenameSpec(spec.trim());
        }, props.t.specName)}
      {props.error && <div className="pmovb-error">{props.error}</div>}
    </div>
  );
}
