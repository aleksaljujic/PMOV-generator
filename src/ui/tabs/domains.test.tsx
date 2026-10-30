// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DOMAIN_EXAMPLE_IR, DOMAIN_EXAMPLE_REFERENTIAL, DOMAIN_EXAMPLE_STRUCTURE } from '../../fixtures/domains';
import type { PmovIR } from '../../lang/ir';
import { NO_SPAN } from '../../lang/diagnostics';
import type { Relation, RelationalModel } from '../../rm';
import { DomainTab } from './index';
import type { TabAction } from './index';
import { forbiddenParents } from './DomainTab';
import { ConstraintsView, nullifiesReason, relationsInCondition, suggestRefs } from './ConstraintsTab';
import { en, sr, tabStrings } from './strings';

afterEach(cleanup);

const rel = (name: string, attrs: string[]): Relation =>
  ({
    name,
    elementId: name,
    attributes: attrs.map((a) => ({ name: a, domain: null, constraint: null, pk: false, fk: false, nullable: false, references: null })),
  }) as unknown as Relation;

const RM: RelationalModel = {
  relations: [rel('Radnik', ['Mlb', 'Plata', 'SifOd']), rel('Odeljenje', ['SifOd']), rel('Isplata', ['Mlb', 'Iznos'])],
  referential: DOMAIN_EXAMPLE_REFERENTIAL,
  general: [
    {
      name: 'IsplataDoPlate',
      constraintId: 'IsplataDoPlate',
      condition: 'Isplata.Iznos <= Radnik.Plata',
      checks: [
        { relation: 'Isplata', ops: ['insert', 'update'] },
        { relation: 'Radnik', ops: ['update'] },
      ],
    },
  ],
};

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

describe('DomainTab: Struktura domena', () => {
  it('shows one row per domain, in order', () => {
    const { container } = render(<DomainTab ir={DOMAIN_EXAMPLE_IR} />);
    const rows = [...container.querySelectorAll('.pmov-tabs-domains tbody tr')].map((r) => r.querySelector('td')?.textContent);
    expect(rows).toEqual(DOMAIN_EXAMPLE_STRUCTURE.map((r) => r.domain));
    expect(screen.getByText('Struktura domena')).toBeTruthy();
    expect(screen.getByText('Atributi')).toBeTruthy();
  });

  it('shows the inherited line of a derived domain', () => {
    const ir: PmovIR = {
      ...DOMAIN_EXAMPLE_IR,
      domains: [
        { name: 'A', parent: null, base: 'short', length: null, constraint: '>= 0', effectiveConstraint: '>= 0', span: NO_SPAN, nameSpan: NO_SPAN },
        { name: 'B', parent: 'A', base: 'short', length: null, constraint: '< 9', effectiveConstraint: '>= 0 And < 9', span: NO_SPAN, nameSpan: NO_SPAN },
      ],
    };
    render(<DomainTab ir={ir} />);
    expect(screen.getByText(/nasleđeno: >= 0/)).toBeTruthy();
  });

  it('shows the hint when there are no domains', () => {
    const { domains: _d, ...rest } = DOMAIN_EXAMPLE_IR;
    render(<DomainTab ir={rest as PmovIR} />);
    expect(screen.getByText('Nema korisničkih domena.')).toBeTruthy();
  });

  it('is read-only without onAction', () => {
    const { container } = render(<DomainTab ir={DOMAIN_EXAMPLE_IR} />);
    expect(container.querySelectorAll('button, select, input, form').length).toBe(0);
  });

  it('highlights the domain row', () => {
    const { container } = render(<DomainTab ir={DOMAIN_EXAMPLE_IR} highlight={{ kind: 'domain', name: 'Iznos' }} />);
    expect(container.querySelector('.pmov-tabs-highlight')?.getAttribute('data-domain')).toBe('Iznos');
  });
});

describe('DomainTab: editing', () => {
  it('adds a domain through the form', () => {
    const onAction = vi.fn<TabAction>(() => ({ ok: true, source: '' }));
    render(<DomainTab ir={DOMAIN_EXAMPLE_IR} onAction={onAction} />);
    fireEvent.click(screen.getByText('+ domen'));
    fireEvent.change(screen.getByLabelText('Naziv'), { target: { value: 'Pol' } });
    pickOption(screen.getByLabelText('Tip / naddomen'), 'string');
    fireEvent.change(screen.getByLabelText('Dužina'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Sačuvaj'));
    expect(onAction).toHaveBeenCalledWith({
      kind: 'addDomain',
      domain: { name: 'Pol', base: 'string', length: 1, constraint: null },
    });
    expect(screen.queryByLabelText('Naziv')).toBeNull();
  });

  it('shows the message inline and keeps the form on failure', () => {
    const onAction: TabAction = () => ({ ok: false, message: 'Ime domena je već zauzeto.' });
    render(<DomainTab ir={DOMAIN_EXAMPLE_IR} onAction={onAction} />);
    fireEvent.click(screen.getByText('+ domen'));
    fireEvent.click(screen.getByText('Sačuvaj'));
    expect(screen.getByRole('alert').textContent).toBe('Ime domena je već zauzeto.');
    expect(screen.getByLabelText('Naziv')).toBeTruthy();
  });

  it('excludes cycle-making naddomen choices when editing', () => {
    const d = (name: string, parent: string | null) =>
      ({ name, parent, base: 'short', length: null, constraint: null, effectiveConstraint: null, span: NO_SPAN, nameSpan: NO_SPAN }) as const;
    const domains = [d('A', null), d('B', 'A'), d('C', 'B'), d('D', null)];
    expect([...forbiddenParents(domains, 'A')].sort()).toEqual(['A', 'B', 'C']);
    const ir: PmovIR = { ...DOMAIN_EXAMPLE_IR, domains };
    render(<DomainTab ir={ir} onAction={() => undefined} />);
    fireEvent.click(document.querySelector('[data-domain="A"]') as Element);
    const opts = optionLabels(screen.getByLabelText('Tip / naddomen'));
    expect(opts).toEqual(['long', 'short', 'string', 'date', 'D']);
  });

  it('editing sends editDomain; delete with usages asks for confirmation, then replaces', () => {
    const calls: unknown[] = [];
    const onAction: TabAction = (a) => {
      calls.push(a);
      if (a.kind === 'deleteDomain' && !a.replace) {
        return { ok: false, message: 'Domen se koristi u 2 atributa/domena. Zameniti ga osnovnim tipom?', needsConfirmation: { dependents: [], usages: 2 } };
      }
      return { ok: true, source: '' };
    };
    render(<DomainTab ir={DOMAIN_EXAMPLE_IR} onAction={onAction} />);
    fireEvent.click(document.querySelector('[data-domain="Ocena"]') as Element);
    fireEvent.click(screen.getByText('Obriši'));
    expect(calls).toEqual([{ kind: 'deleteDomain', name: 'Ocena', replace: false }]);
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toContain('Domen se koristi u 2');
    fireEvent.click(within(dlg).getByText('Da'));
    expect(calls[1]).toEqual({ kind: 'deleteDomain', name: 'Ocena', replace: true });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('"Izdvoj u domen" only on built-in attributes, sends owner + index', () => {
    const onAction = vi.fn<TabAction>(() => ({ ok: true, source: '' }));
    render(<DomainTab ir={DOMAIN_EXAMPLE_IR} onAction={onAction} />);
    const btns = screen.getAllByText('Izdvoj u domen');
    // Radnik: Mlb (long) is first built-in attribute.
    fireEvent.click(btns[0] as HTMLElement);
    expect(onAction).toHaveBeenCalledWith({ kind: 'extractDomain', owner: 'Radnik', index: 0 });
  });
});

describe('ConstraintsView', () => {
  it('renders referential cards then general cards, with badge and bold cells', () => {
    const { container } = render(<ConstraintsView rm={RM} />);
    const names = [...container.querySelectorAll('.pmov-tabs-card')].map((c) => c.getAttribute('data-constraint'));
    expect(names).toEqual([...DOMAIN_EXAMPLE_REFERENTIAL.map((c) => c.name), 'IsplataDoPlate']);
    expect(container.querySelectorAll('.pmov-tabs-badge').length).toBe(4);
    const bold = [...container.querySelectorAll('.pmov-tabs-bold')];
    expect(bold.length).toBe(1); // IsplateRadnika parentDelete RESTRICTED vs slab default CASCADES
    expect(screen.getByText('Radnik.SifOd ⊆ Odeljenje.SifOd')).toBeTruthy();
    expect(container.querySelector('code')?.textContent).toBe('Isplata.Iznos <= Radnik.Plata');
  });

  it('bolds cells that differ from the default', () => {
    const c = { ...DOMAIN_EXAMPLE_REFERENTIAL[2]!, actions: { ...DOMAIN_EXAMPLE_REFERENTIAL[2]!.actions, parentDelete: 'restricted' as const } };
    const { container } = render(<ConstraintsView rm={{ relations: RM.relations, referential: [c] }} />);
    expect(container.querySelectorAll('.pmov-tabs-bold').length).toBe(1);
  });

  it('is read-only without onAction', () => {
    const { container } = render(<ConstraintsView rm={RM} />);
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Kopiraj kao tekst']);
    expect(container.querySelectorAll('select, input').length).toBe(0);
  });

  it('changing a cell sends setReferentialAction with attrs and constraint from the RM entry', () => {
    const onAction = vi.fn<TabAction>(() => ({ ok: true, source: '' }));
    render(<ConstraintsView rm={RM} onAction={onAction} />);
    fireEvent.change(screen.getByLabelText('RadnikUOdeljenju parentDelete'), { target: { value: 'cascades' } });
    expect(onAction).toHaveBeenCalledWith({
      kind: 'setReferentialAction',
      child: 'Radnik',
      parent: 'Odeljenje',
      attrs: ['SifOd'],
      cell: 'parentDelete',
      action: 'cascades',
      constraint: 'RadnikUOdeljenju',
    });
    fireEvent.change(screen.getByLabelText('fk_Odeljenje_Radnik childInsert'), { target: { value: 'default' } });
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ constraint: null, attrs: ['Mlb'], cell: 'childInsert' }));
  });

  it('disables NULLIFIES on a non-nullable FK, with a tooltip', () => {
    render(<ConstraintsView rm={RM} onAction={() => undefined} />);
    const sel = screen.getByLabelText('fk_Odeljenje_Radnik parentDelete') as HTMLSelectElement;
    const opt = [...sel.options].find((o) => o.value === 'nullifies')!;
    expect(opt.disabled).toBe(true);
    expect(opt.title).toBe('Strani ključ nije opcioni.');
    const pk = screen.getByLabelText('IsplateRadnika parentDelete') as HTMLSelectElement;
    expect([...pk.options].find((o) => o.value === 'nullifies')!.title).toBe('Strani ključ je deo primarnog ključa.');
    expect(nullifiesReason({ ...DOMAIN_EXAMPLE_REFERENTIAL[0]!, fkKind: 'nullable' }, sr)).toBeNull();
  });

  it('enables NULLIFIES on a nullable FK', () => {
    const c = { ...DOMAIN_EXAMPLE_REFERENTIAL[0]!, fkKind: 'nullable' as const };
    render(<ConstraintsView rm={{ relations: RM.relations, referential: [c] }} onAction={() => undefined} />);
    const sel = screen.getByLabelText('RadnikUOdeljenju parentDelete') as HTMLSelectElement;
    expect([...sel.options].find((o) => o.value === 'nullifies')!.disabled).toBe(false);
  });

  it('"Vrati podrazumevano" only on explicit constraints', () => {
    const onAction = vi.fn<TabAction>(() => ({ ok: true, source: '' }));
    render(<ConstraintsView rm={RM} onAction={onAction} />);
    const btns = screen.getAllByText('Vrati podrazumevano');
    expect(btns.length).toBe(2);
    fireEvent.click(btns[0] as HTMLElement);
    expect(onAction).toHaveBeenCalledWith({ kind: 'resetReferential', constraint: 'RadnikUOdeljenju' });
  });

  it('deletes and adds a general constraint', () => {
    const onAction = vi.fn<TabAction>(() => ({ ok: true, source: '' }));
    render(<ConstraintsView rm={RM} onAction={onAction} />);
    fireEvent.click(screen.getAllByText('Obriši')[0] as HTMLElement);
    expect(onAction).toHaveBeenCalledWith({ kind: 'deleteConstraint', name: 'IsplataDoPlate' });
    fireEvent.click(screen.getByText('+ ograničenje'));
    fireEvent.change(screen.getByLabelText('Naziv'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Uslov'), { target: { value: 'Isplata.Iznos > 0' } });
    fireEvent.click(screen.getByLabelText('UPDATE')); // uncheck UPDATE
    fireEvent.click(screen.getByText('Sačuvaj'));
    expect(onAction).toHaveBeenLastCalledWith({
      kind: 'addConstraint',
      spec: { name: 'X', condition: 'Isplata.Iznos > 0', checks: [{ relation: 'Isplata', ops: ['insert'] }] },
    });
  });

  it('helpers: relations in condition and autocomplete', () => {
    expect(relationsInCondition('Isplata.Iznos <= Radnik.Plata and Foo.X', RM)).toEqual(['Isplata', 'Radnik']);
    expect(suggestRefs('Isplata.Iz', RM)).toEqual(['Isplata.Iznos']);
    expect(suggestRefs('1 + Rad', RM)).toEqual(['Radnik.Mlb', 'Radnik.Plata', 'Radnik.SifOd']);
    expect(suggestRefs('x = ', RM)).toEqual([]);
  });

  it('highlights a card', () => {
    const { container } = render(<ConstraintsView rm={RM} highlight={{ kind: 'constraint', name: 'IsplataDoPlate' }} />);
    expect(container.querySelector('.pmov-tabs-highlight')?.getAttribute('data-constraint')).toBe('IsplataDoPlate');
  });

  it('English strings', () => {
    render(<ConstraintsView rm={RM} locale="en" onAction={() => undefined} />);
    expect(screen.getByText('+ constraint')).toBeTruthy();
    expect(screen.getAllByText('Reset to default').length).toBe(2);
    expect(screen.getAllByText('default').length).toBe(4);
  });
});

describe('strings', () => {
  it('sr and en have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sr).sort());
    expect(tabStrings('en')).toBe(en);
  });
});
