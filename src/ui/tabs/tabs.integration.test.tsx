// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MAIN_EXAMPLE_IR } from '../../fixtures/ir';
import { DomainTab, RelationalTab, SqlTab } from './index';

afterEach(cleanup);

describe('tabs with real generator', () => {
  it('renders all three tabs for the main example', () => {
    const d = render(<DomainTab ir={MAIN_EXAMPLE_IR} />);
    expect(d.container.textContent).toContain('Mlb');
    cleanup();
    const r = render(<RelationalTab ir={MAIN_EXAMPLE_IR} hasErrors={false} dg0Mode="fk" onDg0ModeChange={() => {}} />);
    expect([...r.container.querySelectorAll('u')].map((e) => e.textContent)).toContain('Mlb');
    expect(r.container.textContent).toContain('Radnik(');
    cleanup();
    const s = render(<SqlTab ir={MAIN_EXAMPLE_IR} hasErrors={false} dg0Mode="fk" />);
    expect(s.container.querySelector('pre')?.textContent).toMatch(/CREATE TABLE/i);
  });
});
