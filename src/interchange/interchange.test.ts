import { describe, expect, it } from 'vitest';
import {
  JSON_EXPORT_NOW,
  JSON_INVALID_FILES,
  JSON_LENIENT_EXPECTED,
  JSON_LENIENT_FILE_TEXT,
  JSON_MODEL,
  JSON_MODEL_ONLY_FILE_TEXT,
  JSON_TINY_FILE_TEXT,
  JSON_TINY_GRAPH,
  JSON_TINY_MODEL,
  JSON_TINY_OPTIONS,
  JSON_TINY_POSITIONS,
  JSON_TINY_SOURCE,
} from '../fixtures/json';
import { exportDiagramJson, formatJsonImportError, parseDiagramJson, type JsonImportError } from './index';

const tinyInput = {
  source: JSON_TINY_SOURCE,
  ir: JSON_TINY_MODEL as never,
  graph: JSON_TINY_GRAPH,
  positions: JSON_TINY_POSITIONS,
  options: JSON_TINY_OPTIONS,
  locale: 'sr' as const,
  now: JSON_EXPORT_NOW,
};

describe('exportDiagramJson', () => {
  it('matches the golden text byte for byte', () => {
    expect(exportDiagramJson(tinyInput)).toBe(JSON_TINY_FILE_TEXT);
  });
  it('writes null model and diagram without ir / graph', () => {
    const file = JSON.parse(exportDiagramJson({ ...tinyInput, ir: null, graph: null }));
    expect(file.model).toBeNull();
    expect(file.diagram).toBeNull();
    expect(file.source).toBe(JSON_TINY_SOURCE);
    expect(file.positions).toEqual(JSON_TINY_POSITIONS);
    expect(Object.keys(file)).toEqual(['format', 'version', 'generator', 'exportedAt', 'locale', 'source', 'positions', 'options', 'model', 'diagram']);
  });
});

describe('parseDiagramJson', () => {
  it.each(JSON_INVALID_FILES)('rejects: $name', ({ text, error }) => {
    expect(parseDiagramJson(text)).toEqual({ ok: false, error });
  });
  it('is lenient about positions, options and unknown keys', () => {
    expect(parseDiagramJson(JSON_LENIENT_FILE_TEXT)).toEqual(JSON_LENIENT_EXPECTED);
  });
  it('round-trips an export', () => {
    expect(parseDiagramJson(exportDiagramJson(tinyInput))).toEqual({
      ok: true,
      source: JSON_TINY_SOURCE,
      positions: JSON_TINY_POSITIONS,
      options: JSON_TINY_OPTIONS,
      fromModel: false,
    });
  });
  it('imports a model-only file with fromModel', () => {
    const r = parseDiagramJson(JSON_MODEL_ONLY_FILE_TEXT);
    expect(r.ok && r.fromModel).toBe(true);
    expect(r.ok && r.source).toContain('objekat Radnik {');
    expect(r.ok && r.positions).toEqual({});
    expect(r.ok && r.options).toEqual({});
  });
  it('uses the English keywords for locale en and tolerates a missing locale', () => {
    const en = parseDiagramJson(JSON_MODEL_ONLY_FILE_TEXT.replace('"sr"', '"en"'));
    expect(en.ok && en.source).toContain('object Radnik {');
    const none = parseDiagramJson(JSON_MODEL_ONLY_FILE_TEXT.replace('  "locale": "sr",\n', ''));
    expect(none.ok && none.source).toContain('objekat Radnik {');
  });
  it('never throws on odd input', () => {
    for (const t of ['', 'null', '5', '"x"', '{}', '{"format":"pmov-diagram","version":0}', '{"format":"pmov-diagram","version":1.5}']) {
      expect(() => parseDiagramJson(t)).not.toThrow();
    }
    expect(parseDiagramJson('{"format":"pmov-diagram","version":0}')).toEqual({ ok: false, error: { code: 'badField', path: 'version' } });
  });
  it('reports a bad constraint rule path', () => {
    const model = { elements: [], constraints: [{ kind: 'general', id: 'c', name: 'c', condition: '', rules: [{ relation: 'A', op: 'insert', action: 'boom' }] }] };
    const r = parseDiagramJson(JSON.stringify({ format: 'pmov-diagram', version: 1, model }));
    expect(r).toEqual({ ok: false, error: { code: 'badModel', path: 'model.constraints[0].rules[0].action' } });
    expect(JSON_MODEL.elements.length).toBeGreaterThan(0);
  });
});

describe('formatJsonImportError', () => {
  const errors: JsonImportError[] = [
    { code: 'tooLarge' },
    { code: 'readError' },
    { code: 'notJson' },
    { code: 'missingField', field: '' },
    { code: 'missingField', field: 'format' },
    { code: 'wrongFormat', value: 'drawio' },
    { code: 'newerVersion', version: 2 },
    { code: 'badField', path: 'positions' },
    { code: 'badModel', path: 'model.elements[3].participants[0].card' },
  ];
  it.each(errors)('formats %j in sr and en', (error) => {
    const sr = formatJsonImportError(error, 'sr');
    const en = formatJsonImportError(error, 'en');
    expect(sr).not.toBe(en);
    if (error.code !== 'newerVersion') {
      expect(sr.startsWith('Uvoz nije uspeo: ')).toBe(true);
      expect(en.startsWith('Import failed: ')).toBe(true);
    }
  });
  it('uses the spec wording', () => {
    expect(formatJsonImportError({ code: 'notJson' }, 'sr')).toBe('Uvoz nije uspeo: datoteka nije ispravan JSON');
    expect(formatJsonImportError({ code: 'missingField', field: '' }, 'en')).toBe('Import failed: the file is not a valid PMOV JSON');
    expect(formatJsonImportError({ code: 'missingField', field: 'format' }, 'sr')).toBe('Uvoz nije uspeo: datoteka nije ispravan PMOV JSON (nedostaje polje „format”)');
    expect(formatJsonImportError({ code: 'newerVersion', version: 2 }, 'en')).toBe('The file comes from a newer version of the app (version 2).');
  });
});
