// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuilderAction, BuilderResult } from '../../builder';
import { compile } from '../../lang';
import { buildDiagramGraph } from '../../render/graph';
import { BuilderOverlay, useBuilder } from './index';
import type { BuilderController } from './index';

afterEach(cleanup);

const SOURCE = `objekat A {
  X# : long
}
objekat B {
  Y : long
}
slab S {
  nadređeni A (0,M)
  Rb#
}
agregacija G {
  A (0,M)
  B (0,M)
}
veza V {
  A (1,1)
  B (0,M)
}
objekat Nadtip {
  N# : long
}
objekat P1 {
}
objekat P2 {
}
specijalizacija Sp {
  nadtip Nadtip (0,M)
  podtip P1
  podtip P2
}
`;
const ir = compile(SOURCE).ir!;
const graph = buildDiagramGraph(ir);

let api: BuilderController;

function Harness(props: {
  onAction(a: BuilderAction): BuilderResult;
  selected?: string | null;
  disabled?: boolean;
  autoRenameId?: string | null;
}): JSX.Element {
  const b = useBuilder({
    ir,
    graph,
    disabled: props.disabled ?? false,
    selectedElementId: props.selected ?? null,
    autoRenameId: props.autoRenameId ?? null,
    onAutoRenameHandled: () => {},
    onAction: props.onAction,
  });
  api = b;
  return (
    <div>
      {graph.nodes.map((n) => (
        <div key={n.id} data-testid={`host-${n.id}`} style={{ position: 'relative' }}>
          {b.diagramProps.renderNodeOverlay?.(n, { selected: true, hasError: false })}
        </div>
      ))}
      {graph.edges.map((e) => (
        <div key={e.id} data-testid={`edge-${e.id}`}>
          {b.diagramProps.renderEdgeOverlay?.(e)}
        </div>
      ))}
      <BuilderOverlay builder={b} />
    </div>
  );
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });
const okResult: BuilderResult = { ok: true, source: '' };
const host = (id: string) => within(screen.getByTestId(`host-${id}`));
const openMenu = (id: string) => fireEvent.click(host(id).getByRole('button', { name: 'Dodaj' }));
const menuLabels = () => within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent);

/** Opens a searchable dropdown and clicks the option with this label. */
function pickOption(input: HTMLElement, label: string): void {
  fireEvent.mouseDown(input);
  fireEvent.click(screen.getByRole('option', { name: label }));
}
const optionLabels = (input: HTMLElement): (string | null)[] => {
  fireEvent.mouseDown(input);
  const out = screen.getAllByRole('option').map((o) => o.textContent);
  fireEvent.blur(input);
  return out;
};

describe('+ menu', () => {
  it('lists the right items per node kind', () => {
    render(<Harness onAction={() => okResult} />);
    openMenu('A');
    expect(menuLabels()).toEqual(['Objekat', 'Veza', 'Slab objekat', 'Agregacija', 'Specijalizacija', 'Obriši']);
    openMenu('S');
    expect(menuLabels()).toEqual(['Objekat', 'Veza', 'Slab objekat', 'Agregacija', 'Obriši']);
    openMenu('G');
    expect(menuLabels()).toEqual(['Objekat', 'Veza', 'Slab objekat', 'Agregacija', 'Dodaj komponentu', 'Obriši']);
    openMenu('spec:Sp');
    expect(menuLabels()).toEqual(['Dodaj podtip', 'Obriši']);
  });

  it('has no + on veza nodes and none on junctions', () => {
    render(<Harness onAction={() => okResult} />);
    expect(host('V').queryByRole('button', { name: 'Dodaj' })).toBeNull();
    expect(host('junction:Sp').queryByRole('button', { name: 'Dodaj' })).toBeNull();
  });

  it('simple items dispatch actions', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Objekat' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addObject', near: 'A' });
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Slab objekat' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addSlab', parent: 'A' });
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Specijalizacija' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addSpecijalizacija', nadtip: 'A' });
  });

  it('Veza → Novi objekat / Postojeći element…', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Veza' }));
    expect(menuLabels()).toEqual(['Novi objekat', 'Postojeći element…']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Novi objekat' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addVeza', from: 'A', to: { newObject: true } });
  });

  it('Dodaj podtip and Dodaj komponentu use the same sub-menu', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openMenu('spec:Sp');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dodaj podtip' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Novi objekat' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addPodtip', specijalizacija: 'Sp', podtip: { newObject: true } });
    openMenu('G');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dodaj komponentu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Novi objekat' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addComponent', agregacija: 'G', component: { newObject: true } });
  });

  it('renders nothing when disabled (syntax errors)', () => {
    render(<Harness onAction={() => okResult} disabled />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('pick mode', () => {
  function startPick(onAction = vi.fn(() => okResult)) {
    render(<Harness onAction={onAction} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Veza' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postojeći element…' }));
    return onAction;
  }

  it('shows the status line, exposes valid ids, and completes on click', async () => {
    const onAction = startPick();
    expect(screen.getByRole('status').textContent).toContain('Izaberite element (Esc za otkazivanje)');
    expect(api.picking).toBe(true);
    expect(api.diagramProps.pickMode?.validIds.has('B')).toBe(true);
    expect(api.diagramProps.pickMode?.validIds.has('V')).toBe(false);
    await tick();
    let consumed = false;
    act(() => { consumed = api.handleElementClick('B'); });
    expect(consumed).toBe(true);
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addVeza', from: 'A', to: 'B' });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('clicking the source element again makes a recursive veza', async () => {
    const onAction = startPick();
    await tick();
    act(() => { api.handleElementClick('A'); });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addVeza', from: 'A', to: 'A' });
  });

  it('Esc and a click on empty canvas cancel', () => {
    const onAction = startPick();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('status')).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Agregacija' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postojeći element…' }));
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => { api.diagramProps.onCanvasClick?.(); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the rejection reason for a podtip pick and keeps picking', async () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openMenu('spec:Sp');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dodaj podtip' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postojeći element…' }));
    await tick();
    act(() => { api.handleElementClick('Nadtip'); });
    expect(screen.getByRole('status').textContent).toContain('Podtip ne može biti sam nadtip.');
    act(() => { api.handleElementClick('P1'); });
    expect(screen.getByRole('status').textContent).toContain('Objekat je već podtip.');
    expect(onAction).not.toHaveBeenCalled();
    act(() => { api.handleElementClick('B'); });
    expect(onAction).toHaveBeenCalledWith({ kind: 'addPodtip', specijalizacija: 'Sp', podtip: 'B' });
  });
});

describe('attribute form', () => {
  const openForm = (id = 'B') => fireEvent.click(host(id).getByRole('button', { name: '+ atribut' }));
  const form = () => within(screen.getByRole('dialog', { name: 'Atribut' }));

  it('validates the name', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openForm();
    fireEvent.click(form().getByRole('button', { name: 'Sačuvaj' }));
    expect(form().getByText('Neispravno ime.')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows the error from the builder', () => {
    render(<Harness onAction={() => ({ ok: false, message: 'Neispravno ime.' })} />);
    openForm();
    fireEvent.change(form().getByLabelText('Naziv'), { target: { value: 'a"b' } });
    fireEvent.click(form().getByRole('button', { name: 'Sačuvaj' }));
    expect(form().getByText('Neispravno ime.')).toBeTruthy();
  });

  it('Enter saves and opens an empty form for the next attribute; Esc closes', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    fireEvent.click(host('P1').getByRole('button', { name: '+ atribut' }));
    // P1 is a subtype: no identifier hint, checkbox unchecked
    expect((form().getByLabelText('Identifikator (#)') as HTMLInputElement).checked).toBe(false);
    fireEvent.keyDown(form().getByLabelText('Naziv'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Atribut' })).toBeNull();

    // A has an identifier → unchecked; use a fresh object-like case: P2 has none but is a subtype
    openForm('B');
    const name = form().getByLabelText('Naziv') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Ime' } });
    pickOption(form().getByLabelText('Domen'), 'string');
    fireEvent.change(form().getByLabelText('Ograničenje'), { target: { value: 'NotNull' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({
      kind: 'addAttribute',
      owner: 'B',
      attr: { name: 'Ime', id: true, domain: 'string', constraint: 'NotNull' },
    });
    const next = form().getByLabelText('Naziv') as HTMLInputElement;
    expect(next.value).toBe('');
    expect(form().getByLabelText('Domen').getAttribute('data-value')).toBe('');
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Atribut' })).toBeNull();
  });

  it('clicking an attribute pill opens the filled form with Obriši', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    fireEvent.click(screen.getByTestId('attr-pill-attr:B:Y'));
    expect((form().getByLabelText('Naziv') as HTMLInputElement).value).toBe('Y');
    expect(form().getByLabelText('Domen').getAttribute('data-value')).toBe('long');
    fireEvent.click(form().getByRole('button', { name: 'Obriši' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'deleteAttribute', owner: 'B', index: 0 });
  });

  it('shows the identifier hint only where one is missing', () => {
    render(<Harness onAction={() => okResult} />);
    expect(host('B').getByText('Dodaj identifikator (#)')).toBeTruthy();
    expect(host('A').queryByText('Dodaj identifikator (#)')).toBeNull();
    expect(host('P1').queryByText('Dodaj identifikator (#)')).toBeNull();
    // the checkbox is checked by default for the first attribute of B
    openForm('B');
    expect((form().getByLabelText('Identifikator (#)') as HTMLInputElement).checked).toBe(true);
  });
});

describe('rename', () => {
  it('double-click opens an input; Enter renames; errors stay inline', () => {
    const onAction = vi.fn<(a: BuilderAction) => BuilderResult>(() => ({ ok: false, message: 'Ime je već zauzeto.' }));
    render(<Harness onAction={onAction} />);
    const node = graph.nodes.find((n) => n.id === 'B')!;
    act(() => { api.diagramProps.onNodeDoubleClick?.(node); });
    const input = screen.getByLabelText('Ime') as HTMLInputElement;
    expect(input.value).toBe('B');
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'rename', element: 'B', newName: 'A' });
    expect(screen.getByText('Ime je već zauzeto.')).toBeTruthy();
    onAction.mockImplementation(() => okResult);
    fireEvent.keyDown(screen.getByLabelText('Ime'), { key: 'Enter' });
    expect(screen.queryByLabelText('Ime')).toBeNull();
  });

  it('renaming an attribute goes through editAttribute and keeps its other fields', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    const node = graph.nodes.find((n) => n.id === 'attr:B:Y')!;
    act(() => { api.diagramProps.onNodeDoubleClick?.(node); });
    const input = screen.getByLabelText('Ime');
    fireEvent.change(input, { target: { value: 'Z' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({
      kind: 'editAttribute',
      owner: 'B',
      index: 0,
      attr: { name: 'Z', id: false, domain: 'long', constraint: null },
    });
  });

  it('opens the name field of an auto-rename placeholder', () => {
    render(<Harness onAction={() => okResult} autoRenameId="B" />);
    expect((screen.getByLabelText('Ime') as HTMLInputElement).value).toBe('B');
  });
});

describe('edge editor', () => {
  it('shows cardinality buttons and the mapping field for a veza edge', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    act(() => { api.diagramProps.onEdgeLabelClick?.('e:V:1'); });
    const edge = within(screen.getByTestId('edge-e:V:1'));
    fireEvent.click(edge.getByRole('button', { name: '(1,M)' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'setCardinality', element: 'V', participantIndex: 1, dg: 1, gg: 'M' });
    const mapping = edge.getByLabelText('Preslikavanje');
    fireEvent.change(mapping, { target: { value: 'Ima' } });
    fireEvent.keyDown(mapping, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'setMappingName', element: 'V', participantIndex: 1, name: 'Ima' });
  });

  it('specijalizacija label offers a rename field and no mapping', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    act(() => { api.diagramProps.onEdgeLabelClick?.('e:Sp:super'); });
    const edge = within(screen.getByTestId('edge-e:Sp:super'));
    expect(edge.queryByLabelText('Preslikavanje')).toBeNull();
    const name = edge.getByLabelText('Ime');
    fireEvent.change(name, { target: { value: 'Vrsta' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'rename', element: 'Sp', newName: 'Vrsta' });
  });
});

describe('delete', () => {
  it('asks for confirmation when the builder reports dependents, then repeats with withDependents', () => {
    const onAction = vi.fn<(a: BuilderAction) => BuilderResult>((a) =>
      a.kind === 'deleteElement' && !a.withDependents
        ? { ok: false, message: 'Obrisati i zavisne elemente (1)?', needsConfirmation: { dependents: [{ id: 'S', kind: 'slab' }] } }
        : okResult,
    );
    render(<Harness onAction={onAction} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Obriši' }));
    const dlg = within(screen.getByRole('alertdialog'));
    expect(dlg.getByText('Obrisati i zavisne elemente (1)?')).toBeTruthy();
    expect(dlg.getByText('slab S')).toBeTruthy();
    fireEvent.click(dlg.getByRole('button', { name: 'Obriši' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'deleteElement', element: 'A', withDependents: true });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelling the confirmation does nothing', () => {
    const onAction = vi.fn<(a: BuilderAction) => BuilderResult>(() => ({
      ok: false,
      message: 'Obrisati i zavisne elemente (1)?',
      needsConfirmation: { dependents: [{ id: 'S', kind: 'slab' }] },
    }));
    render(<Harness onAction={onAction} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Obriši' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Otkaži' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('Delete key removes the selected element, but not while typing', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} selected="B" />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'deleteElement', element: 'B', withDependents: false });
    onAction.mockClear();
    openMenu('B');
    fireEvent.click(host('B').getByRole('button', { name: '+ atribut' }));
    fireEvent.keyDown(screen.getByLabelText('Naziv'), { key: 'Delete' });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows a toast for plain failures', () => {
    render(<Harness onAction={() => ({ ok: false, message: 'Izmena nije uspela, pokušajte ponovo.' })} />);
    openMenu('A');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Objekat' }));
    expect(screen.getByRole('alert').textContent).toBe('Izmena nije uspela, pokušajte ponovo.');
  });
});
