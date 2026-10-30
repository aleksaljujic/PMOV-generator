// T37 / C13 §3: JSON export -> import pipeline over every example (sr and en), with the real lang/render/interchange code.
import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { compile, type Locale } from '../src/lang';
import { stripSpans } from '../src/fixtures/ir';
import { buildDiagramGraph } from '../src/render/graph';
import { layoutDiagramSync } from '../src/render/layout';
import { exportDiagramJson, modelToSource, parseDiagramJson } from '../src/interchange';

const NOW = new Date('2026-10-30T12:00:00.000Z');
const cases = EXAMPLES.flatMap((e) => {
  const out: { name: string; source: string; locale: Locale }[] = [{ name: `${e.id} (sr)`, source: e.source, locale: 'sr' }];
  if (e.sourceEn) out.push({ name: `${e.id} (en)`, source: e.sourceEn, locale: 'en' });
  return out;
});

describe('JSON pipeline over all examples', () => {
  it('covers sr and en for every example', () => {
    expect(cases.length).toBeGreaterThanOrEqual(EXAMPLES.length * 2);
  });

  for (const c of cases) {
    describe(c.name, () => {
      const { ir } = compile(c.source, { locale: c.locale });
      it('compiles', () => expect(ir).not.toBeNull());
      const graph = buildDiagramGraph(ir!);
      const laid = layoutDiagramSync(graph);
      // hand-made drag: move first two nodes
      const positions = { ...laid };
      const ids = Object.keys(positions).slice(0, 2);
      ids.forEach((id, i) => (positions[id] = { x: 111.5 + i, y: -22.25 - i }));
      const options = { dg0Mode: 'relation' as const, sqlDialect: 'oracle' as const };

      it('export -> parse gives the same source, positions and options', () => {
        const text = exportDiagramJson({ source: c.source, ir, graph, positions, options, locale: c.locale, now: NOW });
        const r = parseDiagramJson(text);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.source).toBe(c.source);
        expect(r.positions).toEqual(positions);
        expect(r.options).toEqual(options);
        expect(r.fromModel).toBe(false);
      });

      it('model-only file compiles back to the same stripped IR', () => {
        const text = exportDiagramJson({ source: c.source, ir, graph, positions, options, locale: c.locale, now: NOW });
        const file = JSON.parse(text);
        expect(file.model).toEqual(stripSpans(ir));
        delete file.source;
        const r = parseDiagramJson(JSON.stringify(file));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.fromModel).toBe(true);
        expect(r.source).toBe(modelToSource(file.model, c.locale));
        const back = compile(r.source, { locale: c.locale });
        expect(back.ir).not.toBeNull();
        expect(stripSpans(back.ir)).toEqual(stripSpans(ir));
      });

      it('diagram section carries node coordinates', () => {
        const file = JSON.parse(exportDiagramJson({ source: c.source, ir, graph, positions, options, locale: c.locale, now: NOW }));
        const n = file.diagram.nodes.find((x: { id: string }) => x.id === ids[0]);
        expect(n.x).toBe(111.5);
      });
    });
  }

  it('a source with syntax errors exports model: null and still imports', () => {
    const source = 'objekat Radnik {\n  Mlb# : \n';
    const res = compile(source);
    expect(res.ir).toBeNull();
    const text = exportDiagramJson({
      source, ir: null, graph: null, positions: { A: { x: 1, y: 2 } },
      options: { dg0Mode: 'fk', sqlDialect: 'postgres' }, locale: 'sr', now: NOW,
    });
    const file = JSON.parse(text);
    expect(file.model).toBeNull();
    expect(file.diagram).toBeNull();
    const r = parseDiagramJson(text);
    expect(r.ok && r.source).toBe(source);
    expect(r.ok && r.positions).toEqual({ A: { x: 1, y: 2 } });
  });

  it('invalid inputs never throw and give an error', () => {
    for (const t of ['', 'nope', '[]', '{}', '{"format":"x","version":1}', '{"format":"pmov-diagram","version":2,"source":""}']) {
      expect(parseDiagramJson(t).ok).toBe(false);
    }
  });
});
