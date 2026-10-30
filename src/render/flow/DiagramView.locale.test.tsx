// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView } from './DiagramView';

afterEach(cleanup);
const base = {
  graph: null,
  savedPositions: {},
  layoutNonce: 0,
  errorElementIds: new Set<string>(),
  selectedElementId: null,
  onElementClick: vi.fn(),
  onNodeMoved: vi.fn(),
};

describe('DiagramView locale', () => {
  it('shows "No diagram" with locale="en"', () => {
    render(<DiagramView {...base} locale="en" />);
    expect(screen.getByText('No diagram')).toBeTruthy();
  });
  it('keeps the Serbian text without the prop or with sr', () => {
    const { unmount } = render(<DiagramView {...base} />);
    expect(screen.getByText('Nema dijagrama')).toBeTruthy();
    unmount();
    render(<DiagramView {...base} locale="sr" />);
    expect(screen.getByText('Nema dijagrama')).toBeTruthy();
  });
});
