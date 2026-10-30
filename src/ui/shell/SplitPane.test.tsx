// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_ID, SplitPane } from './SplitPane';

afterEach(cleanup);

describe('SplitPane collapsed (T38)', () => {
  const mk = (collapsed?: boolean) => (
    <SplitPane left={<i>L</i>} right={<b>R</b>} width={420} onWidthChange={vi.fn()} collapsed={collapsed} />
  );

  it('open by default', () => {
    const { container } = render(mk());
    expect(container.querySelector(`#${SIDEBAR_ID}`)?.getAttribute('aria-hidden')).toBeNull();
    expect((container.querySelector('[role="separator"]') as HTMLElement).hidden).toBe(false);
  });

  it('collapsed hides the left pane and the divider and keeps the width', () => {
    const { container } = render(mk(true));
    expect(container.querySelector('.split')?.className).toContain('split--collapsed');
    expect(container.querySelector(`#${SIDEBAR_ID}`)?.getAttribute('aria-hidden')).toBe('true');
    expect((container.querySelector('[role="separator"]') as HTMLElement).hidden).toBe(true);
    expect((container.querySelector('.split') as HTMLElement).style.getPropertyValue('--left-w')).toBe('420px');
  });
});
