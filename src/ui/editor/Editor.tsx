// Owned by T07. Contract C08 §Editor.
import { forwardRef } from 'react';
import type { Diagnostic } from '../../lang';

export interface EditorHandle {
  jumpTo(line: number, col: number): void;
  revealRange(from: number, to: number): void;
  focus(): void;
}

export interface EditorProps {
  value: string;
  onChange(value: string): void;
  diagnostics: Diagnostic[];
  highlightRange: { from: number; to: number } | null;
  onCursorChange?(offset: number): void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor() {
  return <div>not implemented: T07</div>;
});
