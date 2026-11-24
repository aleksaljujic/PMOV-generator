// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_PANEL_ID, HelpPanel } from './HelpPanel';
import { HELP_STRINGS } from './helpStrings';
import { Toolbar } from './Toolbar';

afterEach(cleanup);
const base = { onPickExample: vi.fn(), onRelayout: vi.fn(), onExportSvg: vi.fn(), onExportPng: vi.fn() };

describe('Toolbar help button (T51)', () => {
  it('is hidden without onHelpToggle', () => {
    render(<Toolbar {...base} />);
    expect(screen.queryByRole('button', { name: '? Pomoć' })).toBeNull();
  });

  it('toggles and reflects the open state, sr and en', () => {
    const onHelpToggle = vi.fn();
    const { rerender } = render(<Toolbar {...base} onHelpToggle={onHelpToggle} />);
    const b = screen.getByRole('button', { name: '? Pomoć' });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-controls')).toBe(HELP_PANEL_ID);
    fireEvent.click(b);
    expect(onHelpToggle).toHaveBeenCalledTimes(1);
    rerender(<Toolbar {...base} onHelpToggle={onHelpToggle} helpOpen locale="en" />);
    const en = screen.getByRole('button', { name: '? Help' });
    expect(en.getAttribute('aria-expanded')).toBe('true');
    expect(en.className).toContain('is-active');
  });
});

describe('HelpPanel (T51)', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<HelpPanel open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows every section with Serbian keywords and closes with × and Esc', () => {
    const onClose = vi.fn();
    render(<HelpPanel open onClose={onClose} />);
    const panel = screen.getByRole('complementary', { name: 'Pomoć za sintaksu' });
    expect(panel.id).toBe(HELP_PANEL_ID);
    for (const s of HELP_STRINGS.sr.sections) expect(screen.getByRole('heading', { name: s.title })).toBeTruthy();
    expect(panel.textContent).toContain('nadređeni Radnik (0,M)');
    expect(panel.textContent).toContain('specijalizacija Vrsta');
    const close = screen.getByRole('button', { name: 'Zatvori pomoć' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('uses English keywords in EN', () => {
    render(<HelpPanel open onClose={vi.fn()} locale="en" />);
    const panel = screen.getByRole('complementary', { name: 'Syntax help' });
    expect(panel.textContent).toContain('owner Employee (0,M)');
    expect(panel.textContent).toContain('supertype Person (0,M)');
  });
});
