// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuilderAction, BuilderResult } from '../../builder';
import type { IRDomain, PmovIR } from '../../lang';
import { NO_SPAN } from '../../lang/diagnostics';
import { buildDiagramGraph } from '../../render/graph';
import { BuilderOverlay, useBuilder } from './index';

afterEach(cleanup);

// Hand-made IR so that the UI test does not depend on the parser/checker of other agents.
const ir: PmovIR = {
  elements: [{ id: 'A', name: 'A', kind: 'objekat', span: NO_SPAN, nameSpan: NO_SPAN, attributes: [
    { name: 'X', isId: true, domain: 'long', constraint: null, span: NO_SPAN },
    { name: 'Age', isId: false, domain: 'short', constraint: null, userDomain: 'Starost', span: NO_SPAN },
  ] }],
  domains: [{
    name: 'Starost', parent: null, base: 'short', length: null, constraint: 'Between 15,65', effectiveConstraint: 'Between 15,65',
    span: NO_SPAN, nameSpan: NO_SPAN,
  } as IRDomain],
};
const graph = buildDiagramGraph(ir);
const okResult: BuilderResult = { ok: true, source: '' };

function Harness({ onAction }: { onAction(a: BuilderAction): BuilderResult }): JSX.Element {
  const b = useBuilder({ ir, graph, disabled: false, selectedElementId: null, autoRenameId: null, onAutoRenameHandled: () => {}, onAction });
  return (
    <div>
      {graph.nodes.map((n) => (
        <div key={n.id} data-testid={`host-${n.id}`}>
          {b.diagramProps.renderNodeOverlay?.(n, { selected: true, hasError: false })}
        </div>
      ))}
      <BuilderOverlay builder={b} />
    </div>
  );
}
const form = () => within(screen.getByRole('dialog', { name: 'Atribut' }));
const openAdd = () => fireEvent.click(within(screen.getByTestId('host-A')).getByRole('button', { name: '+ atribut' }));

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

describe('attribute form: domains', () => {
  it('lists user domains and "Novi domen…"', () => {
    render(<Harness onAction={() => okResult} />);
    openAdd();
    const labels = optionLabels(form().getByLabelText('Domen'));
    expect(labels).toEqual(['–', 'long', 'short', 'string', 'date', 'Starost', 'Novi domen…']);
  });

  it('sends userDomain and shows the effective constraint as placeholder', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openAdd();
    fireEvent.change(form().getByLabelText('Naziv'), { target: { value: 'Godine' } });
    pickOption(form().getByLabelText('Domen'), 'Starost');
    expect((form().getByLabelText('Ograničenje') as HTMLInputElement).placeholder).toBe('Between 15,65');
    fireEvent.click(form().getByRole('button', { name: 'Sačuvaj' }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'addAttribute', owner: 'A', attr: { name: 'Godine', id: false, domain: null, constraint: null, userDomain: 'Starost' } });
  });

  it('"Novi domen…" dispatches addDomain and selects the new domain', () => {
    const onAction = vi.fn(() => okResult);
    render(<Harness onAction={onAction} />);
    openAdd();
    pickOption(form().getByLabelText('Domen'), 'Novi domen…');
    const sub = within(screen.getByRole('group', { name: 'Novi domen' }));
    fireEvent.change(sub.getByLabelText('Naziv domena'), { target: { value: 'Iznos' } });
    pickOption(sub.getByLabelText('Tip / nadređeni domen'), 'long');
    fireEvent.change(sub.getByLabelText('Ograničenje domena'), { target: { value: '>= 0' } });
    fireEvent.click(sub.getByRole('button', { name: 'Sačuvaj' }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'addDomain', domain: { name: 'Iznos', base: 'long', constraint: '>= 0' } });
    expect(form().getByLabelText('Domen').getAttribute('data-value')).toBe('u:Iznos');
    expect(screen.queryByRole('group', { name: 'Novi domen' })).toBeNull();
  });

  it('shows the rejection inline and keeps the domain form open', () => {
    render(<Harness onAction={() => ({ ok: false, message: 'Ime domena je već zauzeto.' })} />);
    openAdd();
    pickOption(form().getByLabelText('Domen'), 'Novi domen…');
    const sub = within(screen.getByRole('group', { name: 'Novi domen' }));
    fireEvent.change(sub.getByLabelText('Naziv domena'), { target: { value: 'Starost' } });
    fireEvent.click(sub.getByRole('button', { name: 'Sačuvaj' }));
    expect(sub.getByText('Ime domena je već zauzeto.')).toBeTruthy();
  });

  it('editing a user-domain attribute preselects the domain', () => {
    render(<Harness onAction={() => okResult} />);
    fireEvent.click(screen.getByTestId('attr-pill-attr:A:Age'));
    expect(form().getByLabelText('Domen').getAttribute('data-value')).toBe('u:Starost');
  });
});
