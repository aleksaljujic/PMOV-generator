// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Combobox, filterOptions, fold, type ComboOption } from './index';

afterEach(cleanup);

const OPTIONS: ComboOption[] = [
  { value: 'long', label: 'long' },
  { value: 'string', label: 'string' },
  { value: 'u:Sifra', label: 'Šifra', group: 'Korisnički' },
  { value: 'u:Starost', label: 'Starost', group: 'Korisnički', disabled: true },
  { value: '__new__', label: 'Novi domen…', pinned: true },
];

function Harness(props: { onChange?(v: string): void }) {
  const [v, setV] = useState('long');
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Combobox
        aria-label="Domen"
        options={OPTIONS}
        value={v}
        onChange={(x) => {
          setV(x);
          props.onChange?.(x);
        }}
      />
    </form>
  );
}
const input = () => screen.getByLabelText('Domen', { selector: 'input' }) as HTMLInputElement;
const labels = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('fold / filterOptions', () => {
  it('ignores case and diacritics', () => {
    expect(fold('Šifra Đak')).toBe('sifra dak');
    expect(filterOptions(OPTIONS, 'SIF').map((o) => o.value)).toEqual(['u:Sifra', '__new__']);
    expect(filterOptions(OPTIONS, '  ').length).toBe(OPTIONS.length);
  });
});

describe('Combobox', () => {
  it('shows the selected label and lists everything on open', () => {
    render(<Harness />);
    expect(input().value).toBe('long');
    expect(input().getAttribute('data-value')).toBe('long');
    expect(labels()).toEqual([]);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(labels()).toEqual(['long', 'string', 'Šifra', 'Starost', 'Novi domen…']);
    expect(screen.getByText('Korisnički')).toBeTruthy();
  });

  it('filters while typing and picks with Enter', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: 'sif' } });
    expect(labels()).toEqual(['Šifra', 'Novi domen…']);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('u:Sifra');
    expect(input().value).toBe('Šifra');
    expect(labels()).toEqual([]);
  });

  it('skips disabled options with the arrows and does not pick them by click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(input(), { key: 'ArrowDown' }); // open, active = current (long)
    fireEvent.keyDown(input(), { key: 'ArrowDown' }); // string
    fireEvent.keyDown(input(), { key: 'ArrowDown' }); // Šifra
    fireEvent.keyDown(input(), { key: 'ArrowDown' }); // Starost is disabled → Novi domen…
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('__new__');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Starost'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps pinned options, and Escape closes without changing the value', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(input(), { target: { value: 'zzz' } });
    expect(labels()).toEqual(['Novi domen…']);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => void input().dispatchEvent(esc));
    expect(esc.defaultPrevented).toBe(true);
    expect(input().value).toBe('long');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets Enter through when the list is closed (form submit)', () => {
    render(<Harness />);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => void input().dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
  });

  it('picks with a click and closes on blur', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.mouseDown(input());
    fireEvent.click(screen.getByText('string'));
    expect(onChange).toHaveBeenCalledWith('string');
    fireEvent.mouseDown(input());
    expect(labels().length).toBe(5);
    fireEvent.blur(input());
    expect(labels()).toEqual([]);
  });

  it('says "No matches" in English', () => {
    render(<Combobox aria-label="Domain" locale="en" options={[{ value: 'a', label: 'a' }]} value="a" onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Domain', { selector: 'input' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No matches')).toBeTruthy();
  });
});
