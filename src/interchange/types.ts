// FILE: src/interchange/types.ts
// CONTRACT C13 — frozen. Change only via spec/contracts/CHANGELOG.md.
import type { Locale } from '../lang/diagnostics';
import type { PmovIR } from '../lang/ir';
import type { DiagramEdge, DiagramGraph, DiagramNode, PositionMap } from '../render/graph/types';
import type { Dg0Mode, SqlDialect } from '../rm/types';

export const PMOV_JSON_FORMAT = 'pmov-diagram';
export const PMOV_JSON_VERSION = 1;
export const PMOV_JSON_GENERATOR = 'PMOV editor';
/** Files larger than this are rejected before they are read (checked by the shell against `File.size`). */
export const PMOV_JSON_MAX_BYTES = 5 * 1024 * 1024;

/** `T` with every `span` and `*Span` key removed, recursively (the shape `stripSpans` from src/fixtures/ir.ts produces). */
export type WithoutSpans<T> = T extends readonly (infer U)[]
  ? WithoutSpans<U>[]
  : T extends object
    ? { [K in keyof T as K extends 'span' | `${string}Span` ? never : K]: WithoutSpans<T[K]> }
    : T;

/** The `model` section: C03 `PmovIR` without spans, same omit-when-empty rule as the IR. */
export type PmovJsonModel = WithoutSpans<PmovIR>;

export interface PmovJsonOptions {
  dg0Mode: Dg0Mode;
  sqlDialect: SqlDialect;
}

/** A `DiagramGraph` node with its top-left position merged in; `x`/`y` absent when `positions` has no entry for it. */
export interface PmovJsonDiagramNode extends DiagramNode {
  x?: number;
  y?: number;
}

export interface PmovJsonDiagram {
  nodes: PmovJsonDiagramNode[];
  edges: DiagramEdge[];
}

/** The file, version 1. Key order on export is exactly the order below. */
export interface PmovJsonFile {
  format: typeof PMOV_JSON_FORMAT;
  version: typeof PMOV_JSON_VERSION;
  generator: string;
  /** ISO 8601 (`Date.prototype.toISOString`). */
  exportedAt: string;
  locale: Locale;
  /** Always written on export; optional on import (a model-only file has none). */
  source?: string;
  positions: PositionMap;
  options: PmovJsonOptions;
  /** null when the source has syntax errors (no IR). */
  model: PmovJsonModel | null;
  /** null when there is no graph. Export-only: never read on import. */
  diagram: PmovJsonDiagram | null;
}

export interface ExportJsonInput {
  source: string;
  ir: PmovIR | null;
  graph: DiagramGraph | null;
  /** Current positions of all nodes (`DiagramView.getPositions()`), written as given. */
  positions: PositionMap;
  options: PmovJsonOptions;
  locale: Locale;
  /** Export time, passed in so the output is deterministic. */
  now: Date;
}

export type JsonImportError =
  | { code: 'tooLarge' }
  | { code: 'readError' }
  | { code: 'notJson' }
  /** Top level not an object → field ''. */
  | { code: 'missingField'; field: string }
  | { code: 'wrongFormat'; value: string }
  | { code: 'newerVersion'; version: number }
  /** A present field with the wrong type (`version` not an integer, `source` not a string, `positions` not an object). */
  | { code: 'badField'; path: string }
  /** First structural problem in `model`, e.g. `model.elements[3].participants[0].card`. */
  | { code: 'badModel'; path: string };

export type JsonImportResult =
  | {
      ok: true;
      /** `file.source`, or `modelToSource(file.model, file.locale)` when there is no source. */
      source: string;
      /** Valid entries only; `{}` when absent. */
      positions: PositionMap;
      /** Only keys present in the file with a valid value. */
      options: Partial<PmovJsonOptions>;
      /** true when `source` was generated from `model`. */
      fromModel: boolean;
    }
  | { ok: false; error: JsonImportError };
