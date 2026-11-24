// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

afterEach(cleanup);
const base = { onPickExample: vi.fn(), onRelayout: vi.fn(), onExportSvg: vi.fn(), onExportPng: vi.fn() };

describe('Toolbar layout controls (T49)', () => {
  it('shows nothing without callbacks', () => {
    render(<Toolbar {...base} />);
    expect(screen.queryByRole('combobox', { name: 'Raspored' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Poravnaj na mrežu' })).toBeNull();
  });

  it('renders in sr, reflects state and fires callbacks', () => {
    const onLayoutChange = vi.fn();
    const onLock = vi.fn();
    const onSnap = vi.fn();
    render(
      <Toolbar {...base} layout="grid" onLayoutChange={onLayoutChange} lockAttributes onLockAttributesChange={onLock}
        snapToGrid={false} onSnapToGridChange={onSnap} />,
    );
    const sel = screen.getByRole('combobox', { name: 'Raspored' }) as HTMLSelectElement;
    expect(sel.value).toBe('grid');
    expect([...sel.options].map((o) => o.text)).toEqual(['Mreža', 'Slobodan']);
    fireEvent.change(sel, { target: { value: 'free' } });
    expect(onLayoutChange).toHaveBeenCalledWith('free');
    const lock = screen.getByRole('button', { name: 'Atributi prate objekat' });
    expect(lock.getAttribute('aria-pressed')).toBe('true');
    expect(lock.title).toContain('Alt + prevuci: pomeri samo atribut');
    fireEvent.click(lock);
    expect(onLock).toHaveBeenCalledWith(false);
    const snap = screen.getByRole('button', { name: 'Poravnaj na mrežu' });
    expect(snap.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(snap);
    expect(onSnap).toHaveBeenCalledWith(true);
  });

  it('renders in en', () => {
    render(
      <Toolbar {...base} locale="en" layout="free" onLayoutChange={vi.fn()} onLockAttributesChange={vi.fn()} onSnapToGridChange={vi.fn()} />,
    );
    expect((screen.getByRole('combobox', { name: 'Layout' }) as HTMLSelectElement).value).toBe('free');
    expect(screen.getByRole('button', { name: 'Attributes follow object' }).title).toContain('Alt + drag: move only the attribute');
    expect(screen.getByRole('button', { name: 'Snap to grid' })).toBeTruthy();
  });
});
