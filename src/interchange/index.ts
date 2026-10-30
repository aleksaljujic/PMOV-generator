// Public entry point of src/interchange (contract C13): JSON export / import and model -> DSL. Pure, React-free.
import type { Locale } from '../lang/diagnostics';
import { SQL_DIALECTS, type Dg0Mode, type SqlDialect } from '../rm/types';
import type { PositionMap } from '../render/graph/types';
import { modelToSource as printModel } from './modelToSource';
import { interchangeStrings } from './strings';
import { isObject, validateModel } from './validate';
import {
  PMOV_JSON_FORMAT,
  PMOV_JSON_GENERATOR,
  PMOV_JSON_VERSION,
  type ExportJsonInput,
  type JsonImportError,
  type JsonImportResult,
  type PmovJsonFile,
  type PmovJsonModel,
  type PmovJsonOptions,
} from './types';

export * from './types';

/** `value` with every `span` / `*Span` key removed, recursively (same as `stripSpans` in src/fixtures/ir.ts). */
function stripSpans<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'span' || k.endsWith('Span') ? undefined : v))) as T;
}

/** Pretty-printed (2 spaces) `PmovJsonFile`, keys in contract order, followed by exactly one `\n`. */
export function exportDiagramJson(input: ExportJsonInput): string {
  const { graph, positions } = input;
  const file: PmovJsonFile = {
    format: PMOV_JSON_FORMAT,
    version: PMOV_JSON_VERSION,
    generator: PMOV_JSON_GENERATOR,
    exportedAt: input.now.toISOString(),
    locale: input.locale,
    source: input.source,
    positions,
    options: { dg0Mode: input.options.dg0Mode, sqlDialect: input.options.sqlDialect },
    model: input.ir ? stripSpans(input.ir) : null,
    diagram: graph
      ? {
          nodes: graph.nodes.map((n) => {
            const pos = Object.prototype.hasOwnProperty.call(positions, n.id) ? positions[n.id] : undefined;
            return pos ? { ...n, x: pos.x, y: pos.y } : { ...n };
          }),
          edges: graph.edges,
        }
      : null,
  };
  return JSON.stringify(file, null, 2) + '\n';
}

const fail = (error: JsonImportError): JsonImportResult => ({ ok: false, error });

/** Parse + validate a file's text. Never throws. */
export function parseDiagramJson(text: string): JsonImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail({ code: 'notJson' });
  }
  if (!isObject(raw)) return fail({ code: 'missingField', field: '' });
  if (raw.format === undefined) return fail({ code: 'missingField', field: 'format' });
  if (raw.format !== PMOV_JSON_FORMAT) return fail({ code: 'wrongFormat', value: String(raw.format) });
  const version = raw.version;
  if (version === undefined) return fail({ code: 'missingField', field: 'version' });
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail({ code: 'badField', path: 'version' });
  }
  if (version > PMOV_JSON_VERSION) return fail({ code: 'newerVersion', version });
  if (raw.source !== undefined && typeof raw.source !== 'string') return fail({ code: 'badField', path: 'source' });
  if (raw.positions !== undefined && !isObject(raw.positions)) return fail({ code: 'badField', path: 'positions' });

  let source: string;
  let fromModel = false;
  if (typeof raw.source === 'string') {
    source = raw.source;
  } else {
    if (raw.model === undefined || raw.model === null) return fail({ code: 'missingField', field: 'model' });
    const bad = validateModel(raw.model);
    if (bad) return fail({ code: 'badModel', path: bad });
    const locale: Locale = raw.locale === 'en' ? 'en' : 'sr';
    source = printModel(raw.model as PmovJsonModel, locale);
    fromModel = true;
  }

  const positions: PositionMap = {};
  if (isObject(raw.positions)) {
    for (const [id, p] of Object.entries(raw.positions)) {
      if (id === '__proto__' || !isObject(p)) continue;
      if (typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)) {
        positions[id] = { x: p.x, y: p.y };
      }
    }
  }

  const options: Partial<PmovJsonOptions> = {};
  if (isObject(raw.options)) {
    const { dg0Mode, sqlDialect } = raw.options;
    if (dg0Mode === 'fk' || dg0Mode === 'relation') options.dg0Mode = dg0Mode as Dg0Mode;
    if (typeof sqlDialect === 'string' && (SQL_DIALECTS as readonly string[]).includes(sqlDialect)) {
      options.sqlDialect = sqlDialect as SqlDialect;
    }
  }
  return { ok: true, source, positions, options, fromModel };
}

/** DSL that compiles back to `model` (spans aside). Keywords in `locale`. */
export function modelToSource(model: PmovJsonModel, locale: Locale): string {
  return printModel(model, locale);
}

/** The full user-facing message, e.g. "Uvoz nije uspeo: datoteka nije ispravan JSON". */
export function formatJsonImportError(error: JsonImportError, locale: Locale): string {
  const s = interchangeStrings(locale);
  let detail: string;
  switch (error.code) {
    case 'newerVersion':
      return s.newerVersion(error.version);
    case 'tooLarge':
      detail = s.tooLarge;
      break;
    case 'readError':
      detail = s.readError;
      break;
    case 'notJson':
      detail = s.notJson;
      break;
    case 'missingField':
      detail = error.field === '' ? s.notPmov : s.missingField(error.field);
      break;
    case 'wrongFormat':
      detail = s.wrongFormat(error.value);
      break;
    case 'badField':
      detail = s.badField(error.path);
      break;
    case 'badModel':
      detail = s.badModel(error.path);
      break;
  }
  return `${s.prefix}: ${detail}`;
}
