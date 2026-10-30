// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

afterEach(cleanup);
const base = { onPickExample: vi.fn(), onRelayout: vi.fn(), onExportSvg: vi.fn(), onExportPng: vi.fn() };

describe('Toolbar sidebar toggle (T38)', () => {
  it('has one expanded burger button and no Tekst / Interaktivno buttons; click asks for the other mode', () => {
    const onModeChange = vi.fn();
    render(<Toolbar {...base} mode="tekst" onModeChange={onModeChange} />);
    const b = screen.getByRole('button', { name: 'Sakrij tekst (Ctrl+B)' });
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(b.getAttribute('aria-controls')).toBeTruthy();
    expect(b.className).toContain('is-active');
    expect(screen.queryByRole('button', { name: 'Tekst' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Interaktivno' })).toBeNull();
    fireEvent.click(b);
    expect(onModeChange).toHaveBeenCalledWith('interaktivno');
  });

  it('closed state and English labels', () => {
    const onModeChange = vi.fn();
    const { rerender } = render(<Toolbar {...base} mode="interaktivno" onModeChange={onModeChange} />);
    const b = screen.getByRole('button', { name: 'Prikaži tekst (Ctrl+B)' });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.className).not.toContain('is-active');
    fireEvent.click(b);
    expect(onModeChange).toHaveBeenCalledWith('tekst');
    rerender(<Toolbar {...base} mode="interaktivno" onModeChange={onModeChange} locale="en" />);
    expect(screen.getByRole('button', { name: 'Show text (Ctrl+B)' }).title).toBe('Show text (Ctrl+B)');
    rerender(<Toolbar {...base} mode="tekst" onModeChange={onModeChange} locale="en" />);
    expect(screen.getByRole('button', { name: 'Hide text (Ctrl+B)' })).toBeTruthy();
  });
});
