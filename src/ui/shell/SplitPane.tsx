// Owned by T09. Horizontal split with a draggable divider (stacks vertically below 900px via CSS).
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Left pane width in px. */
  width: number;
  onWidthChange(px: number): void;
  minLeft?: number;
  minRight?: number;
}

export function clampWidth(w: number, total: number, minLeft: number, minRight: number): number {
  const max = Math.max(minLeft, total - minRight);
  return Math.min(Math.max(w, minLeft), max);
}

export function SplitPane({ left, right, width, onWidthChange, minLeft = 280, minRight = 320 }: SplitPaneProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const total = () => rootRef.current?.getBoundingClientRect().width ?? 0;

  const move = useCallback(
    (clientX: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onWidthChange(clampWidth(clientX - rect.left, rect.width, minLeft, minRight));
    },
    [onWidthChange, minLeft, minRight],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) move(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [move]);

  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.classList.add('is-resizing');
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 20;
    const t = total();
    if (e.key === 'ArrowLeft') onWidthChange(clampWidth(width - step, t || Infinity, minLeft, minRight));
    else if (e.key === 'ArrowRight') onWidthChange(clampWidth(width + step, t || Infinity, minLeft, minRight));
  };

  return (
    <div className="split" ref={rootRef} style={{ ['--left-w' as string]: `${width}px` }}>
      <div className="split__left">{left}</div>
      <div
        className="split__divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Promeni širinu editora"
        tabIndex={0}
        onPointerDown={onDown}
        onKeyDown={onKey}
      />
      <div className="split__right">{right}</div>
    </div>
  );
}
