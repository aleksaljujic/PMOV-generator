// Ograničenja tab (T25, C10 §4): FON-style cards for referential and general constraints.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConstraintAction, ConstraintOp, Locale, PmovIR } from '../../lang';
import { ALLOWED_REF_ACTIONS, DEFAULT_REF_ACTIONS, formatConstraintsText, generateRelationalModel } from '../../rm';
import type { Dg0Mode, GeneralConstraint, ReferentialConstraint, RefCell, RelationalModel } from '../../rm';
import { scrollIfAvailable, useRunner } from './actions';
import type { TabAction, TabHighlight } from './actions';
import { tabStrings } from './strings';
import { useCopy } from './Tabs';
import './tabs.css';

export interface ConstraintsTabProps {
  ir: PmovIR | null;
  hasErrors: boolean;
  dg0Mode: Dg0Mode;
  locale?: Locale;
  onAction?: TabAction;
  highlight?: TabHighlight;
}

type Strings = ReturnType<typeof tabStrings>;
const OPS: readonly ConstraintOp[] = ['insert', 'update', 'delete'];

function actionLabel(t: Strings, a: ConstraintAction): string {
  return a === 'default' ? t.defaultAction : t[a];
}
const opLabel = (t: Strings, o: ConstraintOp): string => (o === 'insert' ? t.opInsert : o === 'update' ? t.opUpdate : t.opDelete);

/** Why `nullifies` is not allowed for this FK, or null when it is. */
export function nullifiesReason(c: ReferentialConstraint, t: Strings): string | null {
  if (c.fkKind === 'nullable') return null;
  return c.fkKind === 'identifying' || c.fkKind === 'component' ? t.fkInPk : t.fkNotOptional;
}

function title(c: ReferentialConstraint): string {
  const single = c.attributes.length === 1;
  return single
    ? `${c.child}.${c.attributes[0]} ⊆ ${c.parent}.${c.referenced[0]}`
    : `${c.child}(${c.attributes.join(', ')}) ⊆ ${c.parent}(${c.referenced.join(', ')})`;
}

function ActionCell(props: {
  c: ReferentialConstraint;
  cell: RefCell;
  t: Strings;
  editable: boolean;
  onChange(cell: RefCell, a: ConstraintAction): void;
}): JSX.Element {
  const { c, cell, t, editable, onChange } = props;
  const value = c.actions[cell];
  const isDefault = value === DEFAULT_REF_ACTIONS[c.fkKind][cell];
  if (!editable) return <td className={isDefault ? '' : 'pmov-tabs-bold'}>{actionLabel(t, value)}</td>;
  const reason = nullifiesReason(c, t);
  return (
    <td className={isDefault ? '' : 'pmov-tabs-bold'}>
      <select
        aria-label={`${c.name} ${cell}`}
        value={value}
        onChange={(e) => onChange(cell, e.target.value as ConstraintAction)}
      >
        {ALLOWED_REF_ACTIONS[cell].map((a) => {
          const off = a === 'nullifies' && reason !== null && value !== 'nullifies';
          return (
            <option key={a} value={a} disabled={off} title={off ? (reason ?? undefined) : undefined}>
              {actionLabel(t, a)}
            </option>
          );
        })}
      </select>
    </td>
  );
}

const NA = <td className="pmov-tabs-na">/</td>;

function ReferentialCard(props: {
  c: ReferentialConstraint;
  t: Strings;
  onAction?: TabAction;
  highlighted: boolean;
  hlRef: React.MutableRefObject<HTMLDivElement | null>;
}): JSX.Element {
  const { c, t, onAction, highlighted, hlRef } = props;
  const runner = useRunner(onAction, t);
  const set = (cell: RefCell, action: ConstraintAction) =>
    runner.run({
      kind: 'setReferentialAction',
      child: c.child,
      parent: c.parent,
      attrs: c.attributes,
      cell,
      action,
      constraint: c.constraintId,
    });
  const cellProps = { c, t, editable: onAction !== undefined, onChange: set };
  return (
    <div
      className={'pmov-tabs-card' + (highlighted ? ' pmov-tabs-highlight' : '')}
      data-constraint={c.name}
      ref={highlighted ? hlRef : undefined}
    >
      <div className="pmov-tabs-card-title">
        <strong>{c.name}</strong> <span className="pmov-tabs-fk">{title(c)}</span>
        {c.constraintId === null && <span className="pmov-tabs-badge">{t.defaultBadge}</span>}
      </div>
      <table className="pmov-tabs-table">
        <thead>
          <tr>
            <th />
            <th>{t.opInsert}</th>
            <th>{t.opUpdate}</th>
            <th>{t.opDelete}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>{c.child}</th>
            <ActionCell {...cellProps} cell="childInsert" />
            <ActionCell {...cellProps} cell="childUpdate" />
            {NA}
          </tr>
          <tr>
            <th>{c.parent}</th>
            {NA}
            <ActionCell {...cellProps} cell="parentUpdate" />
            <ActionCell {...cellProps} cell="parentDelete" />
          </tr>
        </tbody>
      </table>
      {onAction && c.constraintId !== null && (
        <button type="button" onClick={() => runner.run({ kind: 'resetReferential', constraint: c.constraintId as string })}>
          {t.resetToDefault}
        </button>
      )}
      {runner.error && (
        <div className="pmov-tabs-error" role="alert">
          {runner.error}
        </div>
      )}
      {runner.dialog}
    </div>
  );
}

// ---------- general constraint form ----------

const REF_RE = /([\p{L}_][\p{L}\p{N}_]*)\.([\p{L}\p{N}_]*)/gu;
const TAIL_RE = /([\p{L}_][\p{L}\p{N}_]*)(?:\.([\p{L}\p{N}_]*))?$/u;

/** Relations of the model that the condition mentions as `Relation.…`, in order of first appearance. */
export function relationsInCondition(condition: string, rm: RelationalModel): string[] {
  const known = new Set(rm.relations.map((r) => r.name));
  const out: string[] = [];
  for (const m of condition.matchAll(REF_RE)) {
    const rel = m[1] as string;
    if (known.has(rel) && !out.includes(rel)) out.push(rel);
  }
  return out;
}

/** `Relation.Attribute` suggestions for the text at the end of `condition`. */
export function suggestRefs(condition: string, rm: RelationalModel, limit = 8): string[] {
  const m = TAIL_RE.exec(condition);
  if (!m) return [];
  const prefix = (m[2] === undefined ? (m[1] as string) : `${m[1]}.${m[2]}`).toLowerCase();
  const all = rm.relations.flatMap((r) => r.attributes.map((a) => `${r.name}.${a.name}`));
  return all.filter((s) => s.toLowerCase().startsWith(prefix) && s.toLowerCase() !== prefix).slice(0, limit);
}

function ConstraintForm(props: {
  rm: RelationalModel;
  editing: GeneralConstraint | null;
  t: Strings;
  onAction: TabAction;
  onClose(): void;
}): JSX.Element {
  const { rm, editing, t, onAction, onClose } = props;
  const runner = useRunner(onAction, t);
  const [name, setName] = useState(editing?.name ?? '');
  const [condition, setCondition] = useState(editing?.condition ?? '');
  const [picked, setPicked] = useState<Record<string, ConstraintOp[]>>(
    Object.fromEntries((editing?.checks ?? []).map((c) => [c.relation, c.ops])),
  );
  const rels = relationsInCondition(condition, rm);
  const opsOf = (r: string): ConstraintOp[] => picked[r] ?? ['insert', 'update'];
  const toggle = (r: string, op: ConstraintOp) => {
    const cur = opsOf(r);
    setPicked({ ...picked, [r]: cur.includes(op) ? cur.filter((o) => o !== op) : OPS.filter((o) => o === op || cur.includes(o)) });
  };
  const suggestions = suggestRefs(condition, rm);
  const complete = (s: string) => setCondition(condition.replace(TAIL_RE, s));
  const spec = {
    name: name.trim(),
    condition: condition.trim(),
    checks: rels.map((relation) => ({ relation, ops: opsOf(relation) })).filter((c) => c.ops.length > 0),
  };
  return (
    <form
      className="pmov-tabs-form"
      onSubmit={(e) => {
        e.preventDefault();
        runner.run(editing ? { kind: 'editConstraint', name: editing.name, spec } : { kind: 'addConstraint', spec }, onClose);
      }}
    >
      <label>
        {t.fieldName}
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {t.fieldCondition}
        <input
          className="pmov-tabs-mono"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        />
      </label>
      {suggestions.length > 0 && (
        <ul className="pmov-tabs-suggest" aria-label="suggestions">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => complete(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {rels.length > 0 && <div>{t.checkedOps}</div>}
      {rels.map((r) => (
        <div key={r} className="pmov-tabs-checks">
          <strong>{r}</strong>
          {OPS.map((op) => (
            <label key={op}>
              <input type="checkbox" checked={opsOf(r).includes(op)} onChange={() => toggle(r, op)} />
              {opLabel(t, op)}
            </label>
          ))}
        </div>
      ))}
      <button type="submit">{t.save}</button>{' '}
      <button type="button" onClick={onClose}>
        {t.cancel}
      </button>
      {runner.error && (
        <div className="pmov-tabs-error" role="alert">
          {runner.error}
        </div>
      )}
      {runner.dialog}
    </form>
  );
}

function GeneralCard(props: {
  g: GeneralConstraint;
  t: Strings;
  onAction?: TabAction;
  highlighted: boolean;
  hlRef: React.MutableRefObject<HTMLDivElement | null>;
  onEdit(): void;
}): JSX.Element {
  const { g, t, onAction, highlighted, hlRef, onEdit } = props;
  const runner = useRunner(onAction, t);
  return (
    <div
      className={'pmov-tabs-card' + (highlighted ? ' pmov-tabs-highlight' : '')}
      data-constraint={g.name}
      ref={highlighted ? hlRef : undefined}
    >
      <div className="pmov-tabs-card-title">
        <strong>{g.name}</strong>
      </div>
      <code className="pmov-tabs-mono">{g.condition}</code>
      <table className="pmov-tabs-table">
        <thead>
          <tr>
            <th />
            <th>{t.opInsert}</th>
            <th>{t.opUpdate}</th>
            <th>{t.opDelete}</th>
          </tr>
        </thead>
        <tbody>
          {g.checks.map((c) => (
            <tr key={c.relation}>
              <th>{c.relation}</th>
              {OPS.map((op) => (
                <td key={op} className={c.ops.includes(op) ? '' : 'pmov-tabs-na'}>
                  {c.ops.includes(op) ? t.restricted : '/'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {onAction && (
        <>
          <button type="button" onClick={onEdit}>
            {t.edit}
          </button>{' '}
          <button type="button" onClick={() => runner.run({ kind: 'deleteConstraint', name: g.name })}>
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
    </div>
  );
}

/** The tab body for a ready relational model. Exported for unit tests with hand-made models. */
export function ConstraintsView(props: {
  rm: RelationalModel;
  locale?: Locale;
  onAction?: TabAction;
  highlight?: TabHighlight;
}): JSX.Element {
  const { rm, locale, onAction, highlight } = props;
  const t = tabStrings(locale);
  const [copied, copy] = useCopy(() => formatConstraintsText(rm, locale));
  const [form, setForm] = useState<{ editing: GeneralConstraint | null } | null>(null);
  const hlRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => scrollIfAvailable(hlRef.current), [highlight]);
  const hl = highlight?.kind === 'constraint' ? highlight.name : null;
  const referential = rm.referential ?? [];
  const general = rm.general ?? [];
  return (
    <div className="pmov-tabs-root">
      <div className="pmov-tabs-toolbar">
        <button type="button" onClick={copy}>
          {t.copyAsText}
        </button>
        {copied && <span className="pmov-tabs-feedback">{t.copied}</span>}
        {onAction && !form && (
          <button type="button" onClick={() => setForm({ editing: null })}>
            {t.addConstraint}
          </button>
        )}
      </div>
      {onAction && form && (
        <ConstraintForm
          key={form.editing?.name ?? '+'}
          rm={rm}
          editing={form.editing}
          t={t}
          onAction={onAction}
          onClose={() => setForm(null)}
        />
      )}
      {referential.length === 0 && general.length === 0 && <div className="pmov-tabs-hint">{t.noConstraints}</div>}
      {referential.map((c) => (
        <ReferentialCard key={c.name} c={c} t={t} onAction={onAction} highlighted={hl === c.name} hlRef={hlRef} />
      ))}
      {general.map((g) => (
        <GeneralCard
          key={g.name}
          g={g}
          t={t}
          onAction={onAction}
          highlighted={hl === g.name}
          hlRef={hlRef}
          onEdit={() => setForm({ editing: g })}
        />
      ))}
    </div>
  );
}

export function ConstraintsTab({ ir, hasErrors, dg0Mode, locale, onAction, highlight }: ConstraintsTabProps): JSX.Element {
  const t = tabStrings(locale);
  const rm = useMemo(
    () => (ir && !hasErrors ? generateRelationalModel(ir, { dg0Mode, locale }) : null),
    [ir, hasErrors, dg0Mode, locale],
  );
  if (hasErrors) return <div className="pmov-tabs-empty">{t.errorText}</div>;
  if (!rm) return <div className="pmov-tabs-empty">{t.emptyText}</div>;
  return <ConstraintsView rm={rm} locale={locale} onAction={onAction} highlight={highlight} />;
}
