// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuilderAction, BuilderResult } from '../../builder';
import { compile } from '../../lang';
import { buildDiagramGraph } from '../../render/graph';
import { BuilderOverlay, useBuilder } from './index';
import { BUILDER_STRINGS } from './strings';

afterEach(cleanup);

const ir = compile('objekat A {\n  X# : long\n}\nobjekat B {\n}\nagregacija G {\n  A (0,M)\n  B (0,M)\n}\n').ir!;
const graph = buildDiagramGraph(ir);
const ok: BuilderResult = { ok: true, source: '' };

function Harness(props: { onAction(a: BuilderAction): BuilderResult }): JSX.Element {
  const b = useBuilder({
    ir, graph, disabled: false, selectedElementId: null, autoRenameId: null,
    onAutoRenameHandled: () => {}, onAction: props.onAction, locale: 'en',
  });
  return (
    <div>
      {graph.nodes.map((n) => (
        <div key={n.id} data-testid={`host-${n.id}`}>{b.diagramProps.renderNodeOverlay?.(n, { selected: true, hasError: false })}</div>
      ))}
      <BuilderOverlay builder={b} />
    </div>
  );
}

describe('builder strings', () => {
  it('sr and en tables have identical keys', () => {
    expect(Object.keys(BUILDER_STRINGS.en).sort()).toEqual(Object.keys(BUILDER_STRINGS.sr).sort());
  });
});

describe('English overlay', () => {
  it('shows the + menu and attribute button in English', () => {
    render(<Harness onAction={vi.fn(() => ok)} />);
    const host = within(screen.getByTestId('host-G'));
    expect(host.getByRole('button', { name: '+ attribute' })).toBeTruthy();
    fireEvent.click(host.getByRole('button', { name: 'Add' }));
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent)).toEqual([
      'Object', 'Relationship', 'Weak object', 'Aggregation', 'Add component', 'Delete',
    ]);
  });

  it('shows the attribute form and delete confirmation in English', () => {
    const onAction = vi.fn((a: BuilderAction): BuilderResult =>
      a.kind === 'deleteElement' && !a.withDependents
        ? { ok: false, message: 'Also delete dependent elements (1)?', needsConfirmation: { dependents: [{ id: 'G', kind: 'agregacija' }] } }
        : ok);
    render(<Harness onAction={onAction} />);
    fireEvent.click(within(screen.getByTestId('host-B')).getByRole('button', { name: '+ attribute' }));
    expect(screen.getByRole('dialog', { name: 'Attribute' })).toBeTruthy();
    expect(screen.getByText('Identifier (#)')).toBeTruthy();
    cleanup();
    render(<Harness onAction={onAction} />);
    fireEvent.click(within(screen.getByTestId('host-B')).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dlg = screen.getByRole('alertdialog', { name: 'Confirmation' });
    expect(within(dlg).getByText('aggregation G')).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
