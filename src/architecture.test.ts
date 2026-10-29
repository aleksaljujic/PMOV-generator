// FROZEN (T00). Enforces contract C00 §Import rules and §One folder = one agent.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname);

/** Folders owned by exactly one agent (C00). */
const AGENT_FOLDERS = [
  'lang/syntax',
  'lang/semantic',
  'rm',
  'render/graph',
  'render/layout',
  'render/geometry',
  'render/flow',
  'render/svg',
  'ui/editor',
  'ui/tabs',
  'ui/shell',
];

/** Frozen contract files anyone may import directly (paths without extension, relative to src). */
const FROZEN_PUBLIC = new Set([
  'lang/diagnostics',
  'lang/ast',
  'lang/ir',
  'lang/index',
  'rm/types',
  'render/graph/types',
  'render/style',
]);
const FREE_PREFIXES = ['examples/', 'fixtures/'];

const NO_REACT_PREFIXES = [
  'lang/',
  'rm/',
  'render/graph/',
  'render/layout/',
  'render/geometry/',
  'render/svg/',
  'render/style',
  'examples/',
  'fixtures/',
];
const REACT_PACKAGES = /^(react|react-dom|@xyflow\/react|codemirror|@codemirror\/.*)(\/.*)?$/;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function importsOf(code: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\b(?:import|export)\s[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) if (m[1]) specs.push(m[1]);
  }
  return specs;
}

/** Resolve a relative import to a src-relative module path without extension ('dir' → 'dir/index'). */
function resolveModule(fromFile: string, spec: string): string {
  const abs = resolve(dirname(fromFile), spec);
  const rel = toPosix(relative(SRC, abs)).replace(/\.(ts|tsx|js)$/, '');
  for (const ext of ['.ts', '.tsx']) {
    try {
      if (statSync(join(SRC, rel + ext)).isFile()) return rel;
    } catch {
      /* not this one */
    }
  }
  return `${rel}/index`;
}

function agentOf(srcRel: string): string | null {
  return AGENT_FOLDERS.find((f) => srcRel === f || srcRel.startsWith(`${f}/`)) ?? null;
}

const files = listSourceFiles(SRC).map((abs) => ({
  abs,
  rel: toPosix(relative(SRC, abs)).replace(/\.(ts|tsx)$/, ''),
  code: readFileSync(abs, 'utf8'),
}));

describe('architecture (C00)', () => {
  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('keeps React out of the pure layers', () => {
    const violations: string[] = [];
    for (const f of files) {
      if (!NO_REACT_PREFIXES.some((p) => f.rel.startsWith(p))) continue;
      for (const spec of importsOf(f.code)) {
        if (REACT_PACKAGES.test(spec)) violations.push(`${f.rel} imports ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('src/lang imports nothing outside src/lang', () => {
    const violations: string[] = [];
    for (const f of files) {
      if (!f.rel.startsWith('lang/')) continue;
      for (const spec of importsOf(f.code)) {
        if (!spec.startsWith('.')) continue;
        const target = resolveModule(f.abs, spec);
        if (!target.startsWith('lang/')) violations.push(`${f.rel} imports ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('pure render layers never import flow or ui', () => {
    const violations: string[] = [];
    for (const f of files) {
      if (!/^render\/(graph|layout|geometry|svg)\//.test(f.rel)) continue;
      for (const spec of importsOf(f.code)) {
        if (!spec.startsWith('.')) continue;
        const target = resolveModule(f.abs, spec);
        if (target.startsWith('render/flow') || target.startsWith('ui/')) violations.push(`${f.rel} imports ${target}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("crosses into another agent's folder only through its index.ts or a frozen contract file", () => {
    const violations: string[] = [];
    for (const f of files) {
      const own = agentOf(f.rel);
      for (const spec of importsOf(f.code)) {
        if (!spec.startsWith('.')) continue;
        const target = resolveModule(f.abs, spec);
        const targetAgent = agentOf(target);
        if (targetAgent === null || targetAgent === own) continue;
        if (FROZEN_PUBLIC.has(target) || FREE_PREFIXES.some((p) => target.startsWith(p))) continue;
        if (target === `${targetAgent}/index`) continue;
        violations.push(`${f.rel} imports ${target} (use ${targetAgent}/index.ts)`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('fixtures and examples load', async () => {
    const { MAIN_EXAMPLE_IR, SPEC_EXAMPLE_IR } = await import('./fixtures/ir');
    const { MAIN_EXAMPLE_RM } = await import('./fixtures/rm');
    const { EXAMPLES, DEFAULT_EXAMPLE_ID } = await import('./examples');
    expect(MAIN_EXAMPLE_IR.elements).toHaveLength(10);
    expect(SPEC_EXAMPLE_IR.elements).toHaveLength(8);
    expect(MAIN_EXAMPLE_RM.relations).toHaveLength(7);
    expect(EXAMPLES.map((e) => e.id)).toContain(DEFAULT_EXAMPLE_ID);
  });
});
