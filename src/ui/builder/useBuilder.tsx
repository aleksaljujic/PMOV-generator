// Interaction logic of the interactive builder (React). All edits leave through `onAction`; nothing here edits text.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isPlaceholderName, pickRejection } from '../../builder';
import type { AttributeSpec, BuilderAction, BuilderResult, PickPurpose } from '../../builder';
import type { IRElement, Locale, PmovIR } from '../../lang';
import type { DiagramViewProps } from '../../render/flow';
import type { DiagramEdge, DiagramGraph, DiagramNode } from '../../render/graph/types';
import { AttributeForm, EdgeEditor, Menu, RenameInput } from './components';
import type { MenuItem } from './components';
import { BUILDER_STRINGS } from './strings';
import './builder.css';

export interface UseBuilderOptions {
  /** Last valid IR (null → nothing to edit). */
  ir: PmovIR | null;
  graph: DiagramGraph | null;
  /** Syntax errors: all controls are disabled. */
  disabled: boolean;
  selectedElementId: string | null;
  /** Element whose name field should open right away (a freshly created placeholder). */
  autoRenameId: string | null;
  onAutoRenameHandled(): void;
  /** Applies the action to the shared source. The result is used for inline errors and the delete confirmation. */
  onAction(action: BuilderAction): BuilderResult;
  /** UI language of the overlay strings and of pick rejections (default 'sr'). */
  locale?: Locale;
}

export type BuilderDiagramProps = Pick<
  DiagramViewProps,
  | 'renderNodeOverlay'
  | 'renderEdgeOverlay'
  | 'onEdgeLabelClick'
  | 'onNodeDoubleClick'
  | 'onCanvasClick'
  | 'pickMode'
  | 'placeholderIds'
>;

export interface BuilderController {
  locale: Locale;
  diagramProps: BuilderDiagramProps;
  /** Call first from the diagram's element click. true = the click was consumed (pick mode). */
  handleElementClick(elementId: string): boolean;
  picking: boolean;
  pickReason: string | null;
  toast: string | null;
  confirm: { message: string; dependents: { id: string; kind: IRElement['kind'] }[]; constraints?: string[] } | null;
  confirmDelete(): void;
  cancelConfirm(): void;
  cancelPick(): void;
}

type Sub = null | 'veza' | 'agregacija' | 'component' | 'podtip';
interface PickState {
  purpose: PickPurpose;
  build(target: string): BuilderAction;
}

const OBJ_LIKE = new Set(['objekat', 'slab', 'agregacija']);
const ATTR_OWNER_KINDS = OBJ_LIKE;

function specOf(a: {
  name: string;
  isId: boolean;
  domain: AttributeSpec['domain'];
  constraint: string | null;
  userDomain?: string | null;
  length?: number | null;
}): AttributeSpec {
  const spec: AttributeSpec = { name: a.name, id: a.isId, domain: a.domain, constraint: a.constraint };
  if (a.userDomain) spec.userDomain = a.userDomain;
  else if (a.length) spec.length = a.length;
  return spec;
}

/** Index of the attribute drawn by node `attr:<owner>:<name>[~k]` in its owner's attribute list. */
function attributeOfNode(el: IRElement | undefined, node: DiagramNode): number {
  if (!el || !('attributes' in el)) return -1;
  const rest = node.id.slice(`attr:${el.id}:`.length);
  const m = /^(.*?)(?:~(\d+))?$/.exec(rest);
  const name = m?.[1] ?? rest;
  const nth = m?.[2] ? Number(m[2]) : 1;
  let seen = 0;
  for (let i = 0; i < el.attributes.length; i++) {
    if (el.attributes[i]?.name === name && ++seen === nth) return i;
  }
  return -1;
}

export function useBuilder(opts: UseBuilderOptions): BuilderController {
  const { ir, graph, disabled, selectedElementId, autoRenameId, onAutoRenameHandled, onAction } = opts;
  const locale: Locale = opts.locale ?? 'sr';
  const t = BUILDER_STRINGS[locale];

  const [menu, setMenu] = useState<{ nodeId: string; sub: Sub } | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);
  const [pickReason, setPickReason] = useState<string | null>(null);
  const [form, setForm] = useState<{ nodeId: string; owner: string; index: number | null; seq: number; defaultId: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ nodeId: string; error: string | null } | null>(null);
  const [edgeId, setEdgeId] = useState<{ id: string; error: string | null } | null>(null);
  const [confirm, setConfirm] = useState<{ action: BuilderAction; message: string; dependents: { id: string; kind: IRElement['kind'] }[]; constraints?: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attrSel, setAttrSel] = useState<{ owner: string; index: number } | null>(null);

  const inside = useRef(false);
  const markInside = useCallback(() => {
    inside.current = true;
    setTimeout(() => {
      inside.current = false;
    }, 0);
  }, []);

  const byId = useMemo(() => new Map((ir?.elements ?? []).map((e) => [e.id, e])), [ir]);
  const edgesById = useMemo(() => new Map((graph?.edges ?? []).map((e) => [e.id, e])), [graph]);

  const showToast = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const closeAll = useCallback(() => {
    setMenu(null);
    setForm(null);
    setFormError(null);
    setRenaming(null);
    setEdgeId(null);
    setAttrSel(null);
  }, []);

  /** Apply an action; failures surface as a toast or the delete confirmation. */
  const run = useCallback(
    (action: BuilderAction): BuilderResult => {
      const r = onAction(action);
      if (!r.ok) {
        if (r.needsConfirmation) {
          const nc = r.needsConfirmation;
          setConfirm({ action, message: r.message, dependents: nc.dependents, ...(nc.constraints ? { constraints: nc.constraints } : {}) });
        }
        else showToast(r.message);
      }
      return r;
    },
    [onAction, showToast],
  );

  const startPick = useCallback((purpose: PickPurpose, build: (t: string) => BuilderAction) => {
    setMenu(null);
    setPick({ purpose, build });
    setPickReason(null);
  }, []);

  const cancelPick = useCallback(() => {
    setPick(null);
    setPickReason(null);
  }, []);

  // Leaving the builder (Tekst mode, syntax errors) drops every open popup.
  useEffect(() => {
    if (!disabled) return;
    closeAll();
    setPick(null);
    setPickReason(null);
    setConfirm(null);
  }, [disabled, closeAll]);

  // Esc / Delete.
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null);
        else if (pick) cancelPick();
        else closeAll();
        return;
      }
      if (e.key === 'Delete' && !typing && !pick && !confirm) {
        if (attrSel) {
          closeAll();
          run({ kind: 'deleteAttribute', owner: attrSel.owner, index: attrSel.index });
        } else if (selectedElementId && byId.has(selectedElementId)) {
          closeAll();
          run({ kind: 'deleteElement', element: selectedElementId, withDependents: false });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, confirm, pick, attrSel, selectedElementId, byId, cancelPick, closeAll, run]);

  // Open the name field of a freshly created placeholder.
  const handledAuto = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRenameId) {
      handledAuto.current = null;
      return;
    }
    if (handledAuto.current === autoRenameId) return;
    const el = byId.get(autoRenameId);
    if (!el) return;
    handledAuto.current = autoRenameId;
    onAutoRenameHandled();
    if (OBJ_LIKE.has(el.kind)) setRenaming({ nodeId: el.id, error: null });
  }, [autoRenameId, byId, onAutoRenameHandled]);

  const placeholderIds = useMemo<ReadonlySet<string>>(
    () => new Set((ir?.elements ?? []).filter((e) => OBJ_LIKE.has(e.kind) && isPlaceholderName(e.name)).map((e) => e.id)),
    [ir],
  );

  const pickMode = useMemo(() => {
    if (!pick || !ir) return null;
    const validIds = new Set(
      ir.elements.filter((e) => OBJ_LIKE.has(e.kind) && pickRejection(ir, pick.purpose, e.id, locale) === null).map((e) => e.id),
    );
    return { validIds };
  }, [pick, ir, locale]);

  const handleElementClick = useCallback(
    (elementId: string): boolean => {
      if (inside.current) return false;
      if (pick && ir) {
        const why = pickRejection(ir, pick.purpose, elementId, locale);
        if (why) {
          setPickReason(why);
          return true;
        }
        const action = pick.build(elementId);
        cancelPick();
        run(action);
        return true;
      }
      closeAll();
      return false;
    },
    [pick, ir, locale, cancelPick, closeAll, run],
  );

  const onCanvasClick = useCallback(() => {
    if (pick) cancelPick();
    closeAll();
  }, [pick, cancelPick, closeAll]);

  const startRename = useCallback((node: DiagramNode) => {
    if (!ir) return;
    closeAll();
    setRenaming({ nodeId: node.id, error: null });
  }, [ir, closeAll]);

  const onNodeDoubleClick = useCallback(
    (node: DiagramNode) => {
      if (disabled || pick) return;
      if (node.type === 'junction') return;
      startRename(node);
    },
    [disabled, pick, startRename],
  );

  const commitRename = useCallback(
    (node: DiagramNode, value: string) => {
      const el = byId.get(node.elementId);
      if (!el) return setRenaming(null);
      let action: BuilderAction;
      if (node.type === 'atribut') {
        const index = attributeOfNode(el, node);
        const a = 'attributes' in el ? el.attributes[index] : undefined;
        if (!a) return setRenaming(null);
        action = { kind: 'editAttribute', owner: el.id, index, attr: { ...specOf(a), name: value } };
      } else {
        action = { kind: 'rename', element: el.id, newName: value };
      }
      const r = onAction(action);
      if (r.ok) setRenaming(null);
      else setRenaming({ nodeId: node.id, error: r.message });
    },
    [byId, onAction],
  );

  const renameInitial = (node: DiagramNode): string => {
    const el = byId.get(node.elementId);
    if (!el) return '';
    if (node.type === 'atribut') {
      const i = attributeOfNode(el, node);
      return 'attributes' in el ? (el.attributes[i]?.name ?? '') : '';
    }
    return el.name;
  };

  // ---------------------------------------------------------------- node overlay

  const renameBox = (node: DiagramNode): ReactNode =>
    renaming?.nodeId === node.id ? (
      <RenameInput
        t={t}
        initial={renameInitial(node)}
        error={renaming.error}
        onCommit={(v) => commitRename(node, v)}
        onCancel={() => setRenaming(null)}
      />
    ) : null;

  const attributeForm = (node: DiagramNode, el: IRElement, index: number | null): ReactNode => {
    if (form?.nodeId !== node.id || !('attributes' in el)) return null;
    const existing = index !== null ? el.attributes[index] : undefined;
    return (
      <AttributeForm
        t={t}
        locale={locale}
        key={`${node.id}:${form.seq}`}
        initial={existing ? specOf(existing) : null}
        defaultId={form.defaultId}
        error={formError}
        userDomains={ir?.domains ?? []}
        onAddDomain={(domain) => onAction({ kind: 'addDomain', domain })}
        onCancel={() => {
          setForm(null);
          setFormError(null);
        }}
        {...(index !== null
          ? {
              onDelete: () => {
                setForm(null);
                run({ kind: 'deleteAttribute', owner: el.id, index });
              },
            }
          : {})}
        onSave={(attr) => {
          const action: BuilderAction =
            index === null
              ? { kind: 'addAttribute', owner: el.id, attr }
              : { kind: 'editAttribute', owner: el.id, index, attr };
          const r = onAction(action);
          if (!r.ok) return setFormError(r.message);
          setFormError(null);
          // Adding: fast entry, open an empty form for the next attribute. Editing: close.
          setForm(index === null ? { ...form, seq: form.seq + 1, defaultId: false } : null);
        }}
      />
    );
  };

  const menuItems = (el: IRElement, sub: Sub): MenuItem[] => {
    const id = el.id;
    const targetItems = (newAction: BuilderAction, purpose: PickPurpose, build: (t: string) => BuilderAction): MenuItem[] => [
      { label: t.newObject, onSelect: () => { closeAll(); run(newAction); } },
      { label: t.existingElement, onSelect: () => startPick(purpose, build) },
    ];
    if (sub === 'veza') {
      return targetItems({ kind: 'addVeza', from: id, to: { newObject: true } }, { kind: 'veza', from: id }, (t) => ({ kind: 'addVeza', from: id, to: t }));
    }
    if (sub === 'agregacija') {
      return targetItems(
        { kind: 'addAgregacija', first: id, second: { newObject: true } },
        { kind: 'agregacija', first: id },
        (t) => ({ kind: 'addAgregacija', first: id, second: t }),
      );
    }
    if (sub === 'component') {
      return targetItems(
        { kind: 'addComponent', agregacija: id, component: { newObject: true } },
        { kind: 'component', agregacija: id },
        (t) => ({ kind: 'addComponent', agregacija: id, component: t }),
      );
    }
    if (sub === 'podtip') {
      return targetItems(
        { kind: 'addPodtip', specijalizacija: id, podtip: { newObject: true } },
        { kind: 'podtip', specijalizacija: id },
        (t) => ({ kind: 'addPodtip', specijalizacija: id, podtip: t }),
      );
    }
    const open = (s: Sub) => () => setMenu((m) => (m ? { ...m, sub: s } : m));
    const del: MenuItem = {
      label: t.deleteLabel,
      danger: true,
      separatorBefore: true,
      onSelect: () => { closeAll(); run({ kind: 'deleteElement', element: id, withDependents: false }); },
    };
    if (el.kind === 'specijalizacija') return [{ label: t.addSubtype, onSelect: open('podtip') }, del];
    const items: MenuItem[] = [
      { label: t.menuObject, onSelect: () => { closeAll(); run({ kind: 'addObject', near: id }); } },
      { label: t.menuRelationship, onSelect: open('veza') },
      { label: t.menuWeak, onSelect: () => { closeAll(); run({ kind: 'addSlab', parent: id }); } },
      { label: t.menuAggregation, onSelect: open('agregacija') },
    ];
    if (el.kind === 'objekat') {
      items.push({ label: t.menuSpecialization, onSelect: () => { closeAll(); run({ kind: 'addSpecijalizacija', nadtip: id }); } });
    }
    if (el.kind === 'agregacija') items.push({ label: t.addComponent, onSelect: open('component') });
    items.push(del);
    return items;
  };

  const renderNodeOverlay = useCallback(
    (node: DiagramNode, state: { selected: boolean; hasError: boolean }): ReactNode => {
      if (disabled || pick || !ir) return null;
      const el = byId.get(node.elementId);
      if (!el) return null;
      const wrap = (open: boolean, children: ReactNode) => (
        <div className={`pmovb${open ? ' pmovb-open' : ''}`} onClickCapture={markInside} onDoubleClickCapture={markInside}>
          {children}
        </div>
      );

      if (node.type === 'atribut') {
        const index = attributeOfNode(el, node);
        if (index < 0) return null;
        const open = form?.nodeId === node.id || renaming?.nodeId === node.id;
        return wrap(
          open,
          <>
            {renaming?.nodeId !== node.id && (
              <div
                className="pmovb-pill"
                data-testid={`attr-pill-${node.id}`}
                onClick={() => {
                  setMenu(null);
                  setRenaming(null);
                  setEdgeId(null);
                  setAttrSel({ owner: el.id, index });
                  setFormError(null);
                  setForm({ nodeId: node.id, owner: el.id, index, seq: 0, defaultId: false });
                }}
              />
            )}
            {attributeForm(node, el, index)}
            {renameBox(node)}
          </>,
        );
      }

      if (node.type === 'veza') {
        return wrap(
          renaming?.nodeId === node.id,
          <>
            {state.selected && renaming?.nodeId !== node.id && (
              <button type="button" className="pmovb-del" onClick={() => run({ kind: 'deleteElement', element: el.id, withDependents: false })}>
                {t.deleteLabel}
              </button>
            )}
            {renameBox(node)}
          </>,
        );
      }

      if (node.type === 'junction') return null;

      const menuOpen = menu?.nodeId === node.id;
      const formOpen = form?.nodeId === node.id;
      const on = state.selected || menuOpen || formOpen;
      const hasId = 'attributes' in el && el.attributes.some((a) => a.isId);
      const isSub = ir.elements.some((s) => s.kind === 'specijalizacija' && s.subtypes.some((t) => t.ref === el.id));
      const needsId = el.kind === 'objekat' && !hasId && !isSub;

      return wrap(
        menuOpen || formOpen || renaming?.nodeId === node.id,
        <>
          <button
            type="button"
            className={`pmovb-plus pmovb-reveal nodrag${on ? ' is-on' : ''}`}
            aria-label={t.add}
            onClick={() => {
              setForm(null);
              setRenaming(null);
              setEdgeId(null);
              setMenu(menuOpen ? null : { nodeId: node.id, sub: null });
            }}
          >
            +
          </button>
          {menuOpen && <Menu items={menuItems(el, menu.sub)} />}
          {ATTR_OWNER_KINDS.has(el.kind) && (
            <>
              <button
                type="button"
                className={`pmovb-chip pmovb-reveal nodrag${on ? ' is-on' : ''}`}
                onClick={() => {
                  setMenu(null);
                  setRenaming(null);
                  setEdgeId(null);
                  setFormError(null);
                  setForm(formOpen ? null : { nodeId: node.id, owner: el.id, index: null, seq: 0, defaultId: needsId });
                }}
              >
                {t.addAttribute}
              </button>
              {needsId && <div className="pmovb-hint">{t.needsIdHint}</div>}
            </>
          )}
          {attributeForm(node, el, null)}
          {renameBox(node)}
        </>,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, pick, ir, byId, menu, form, renaming, formError, onAction, run, closeAll, startPick, t],
  );

  // ---------------------------------------------------------------- edge editor

  const edgeParticipant = (edge: DiagramEdge): { el: IRElement; index: number } | null => {
    const el = byId.get(edge.elementId);
    if (!el) return null;
    const suffix = edge.id.slice(`e:${el.id}:`.length);
    if (el.kind === 'slab' && suffix === 'owner') return { el, index: 0 };
    if (el.kind === 'specijalizacija' && suffix === 'super') return { el, index: 0 };
    if ((el.kind === 'veza' || el.kind === 'agregacija') && /^\d+$/.test(suffix)) return { el, index: Number(suffix) };
    return null;
  };

  const onEdgeLabelClick = useCallback(
    (id: string) => {
      if (disabled || pick) return;
      closeAll();
      setEdgeId((cur) => (cur?.id === id ? null : { id, error: null }));
    },
    [disabled, pick, closeAll],
  );

  const renderEdgeOverlay = useCallback(
    (edge: DiagramEdge): ReactNode => {
      if (disabled || pick || edgeId?.id !== edge.id) return null;
      const part = edgeParticipant(edge);
      if (!part) return null;
      const { el, index } = part;
      const p =
        el.kind === 'veza' ? el.participants[index]
        : el.kind === 'agregacija' ? el.components[index]
        : el.kind === 'slab' ? el.owner
        : el.kind === 'specijalizacija' ? el.supertype
        : null;
      if (!p) return null;
      const fail = (r: BuilderResult) => {
        if (!r.ok) setEdgeId({ id: edge.id, error: r.message });
        else setEdgeId((cur) => (cur ? { ...cur, error: null } : cur));
      };
      return (
        <EdgeEditor
          t={t}
          current={{ dg: p.card.min, gg: String(p.card.max) as '1' | 'M' }}
          mapping={el.kind === 'veza' || el.kind === 'agregacija' ? p.mapping : undefined}
          specName={el.kind === 'specijalizacija' ? el.name : null}
          error={edgeId.error}
          onCard={(dg, gg) => fail(onAction({ kind: 'setCardinality', element: el.id, participantIndex: index, dg, gg }))}
          onMapping={(name) => fail(onAction({ kind: 'setMappingName', element: el.id, participantIndex: index, name }))}
          onRenameSpec={(name) => {
            const r = onAction({ kind: 'rename', element: el.id, newName: name });
            if (r.ok) setEdgeId(null);
            else fail(r);
          }}
          onClose={() => setEdgeId(null)}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, pick, edgeId, byId, onAction, t],
  );

  const confirmDelete = useCallback(() => {
    if (!confirm) return;
    const a = confirm.action;
    setConfirm(null);
    if (a.kind === 'deleteElement' || a.kind === 'removePodtip' || a.kind === 'deleteAttribute') onAction({ ...a, withDependents: true });
    else if (a.kind === 'deleteDomain') onAction({ ...a, replace: true });
  }, [confirm, onAction]);

  const diagramProps = useMemo<BuilderDiagramProps>(
    () => ({
      renderNodeOverlay,
      renderEdgeOverlay,
      onEdgeLabelClick,
      onNodeDoubleClick,
      onCanvasClick,
      pickMode,
      placeholderIds,
    }),
    [renderNodeOverlay, renderEdgeOverlay, onEdgeLabelClick, onNodeDoubleClick, onCanvasClick, pickMode, placeholderIds],
  );

  return {
    locale,
    diagramProps,
    handleElementClick,
    picking: pick !== null,
    pickReason,
    toast,
    confirm: confirm ? { message: confirm.message, dependents: confirm.dependents, ...(confirm.constraints ? { constraints: confirm.constraints } : {}) } : null,
    confirmDelete,
    cancelConfirm: () => setConfirm(null),
    cancelPick,
  };
}
