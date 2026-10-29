// Owned by T09. Contract C08 §App-level pieces. Every access is wrapped in try/catch; failures fall back to defaults.
import type { PositionMap } from '../../render/graph/types';
import type { Dg0Mode } from '../../rm/types';

export const STORAGE_KEYS = {
  source: 'pmov.source.v1',
  positions: 'pmov.positions.v1',
  dg0Mode: 'pmov.dg0Mode.v1',
  editorWidth: 'pmov.editorWidth.v1',
} as const;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / privacy mode: ignore */
  }
}
function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadSource(): string | null {
  return read(STORAGE_KEYS.source);
}
export function saveSource(source: string): void {
  write(STORAGE_KEYS.source, source);
}

export function loadPositions(): PositionMap {
  const raw = read(STORAGE_KEYS.positions);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: PositionMap = {};
    for (const [id, p] of Object.entries(parsed as Record<string, unknown>)) {
      const pt = p as { x?: unknown; y?: unknown } | null;
      if (pt && typeof pt.x === 'number' && typeof pt.y === 'number' && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        out[id] = { x: pt.x, y: pt.y };
      }
    }
    return out;
  } catch {
    return {};
  }
}
export function savePositions(p: PositionMap): void {
  try {
    write(STORAGE_KEYS.positions, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
export function clearPositions(): void {
  remove(STORAGE_KEYS.positions);
}

export function loadDg0Mode(): Dg0Mode {
  const raw = read(STORAGE_KEYS.dg0Mode);
  return raw === 'relation' || raw === 'fk' ? raw : 'fk';
}
export function saveDg0Mode(m: Dg0Mode): void {
  write(STORAGE_KEYS.dg0Mode, m);
}

/** Extra (not in C08): persisted editor pane width in px; null when absent/invalid. */
export function loadEditorWidth(): number | null {
  const raw = read(STORAGE_KEYS.editorWidth);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function saveEditorWidth(px: number): void {
  write(STORAGE_KEYS.editorWidth, String(Math.round(px)));
}
