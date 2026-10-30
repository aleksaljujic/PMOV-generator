// FILE: src/lang/diagnostics.ts
// CONTRACT C01 — frozen. Change only via spec/contracts/CHANGELOG.md.

export interface SourceSpan {
  /** 0-based UTF-16 offset of the first character (CodeMirror position). */
  from: number;
  /** 0-based UTF-16 offset one past the last character. */
  to: number;
  /** 1-based line of `from`. */
  line: number;
  /** 1-based column of `from` (UTF-16 units). */
  col: number;
  /** 1-based line of `to`. */
  endLine: number;
  /** 1-based column of `to`. */
  endCol: number;
}

/** Placeholder span for synthesized nodes and hand-written fixtures. */
export const NO_SPAN: SourceSpan = { from: 0, to: 0, line: 0, col: 0, endLine: 0, endCol: 0 };

export function joinSpans(a: SourceSpan, b: SourceSpan): SourceSpan {
  const first = a.from <= b.from ? a : b;
  const last = a.to >= b.to ? a : b;
  return { from: first.from, line: first.line, col: first.col, to: last.to, endLine: last.endLine, endCol: last.endCol };
}

export type Severity = 'error' | 'warning';

export type SyntaxCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06';
export type ErrorCode =
  | 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08' | 'E09' | 'E10' | 'E11' | 'E12'
  // C10 (domains and cross-table constraints): E13–E17 from src/lang, E18–E20 from src/rm.
  | 'E13' | 'E14' | 'E15' | 'E16' | 'E17' | 'E18' | 'E19' | 'E20';
export type WarningCode = 'W01' | 'W02' | 'W03' | 'W04' | 'W05' | 'W06';
export type DiagnosticCode = SyntaxCode | ErrorCode | WarningCode;

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Message body in the requested locale (default Serbian Latin), WITHOUT the "greška E04 (red …)" prefix. */
  message: string;
  /** Where the squiggle goes. Points at the most specific token (name, cardinality, attribute …). */
  span: SourceSpan;
  /** Id of the IR element (C03) that should get a red outline; null for syntax errors / no owner. */
  elementId: string | null;
}

export function severityOf(code: DiagnosticCode): Severity {
  return code.startsWith('W') ? 'warning' : 'error';
}

/** Language of UI text and diagnostic messages. Codes, spans and the DSL itself do not depend on it. */
export type Locale = 'sr' | 'en';
export const LOCALES: readonly Locale[] = ['sr', 'en'];
export const DEFAULT_LOCALE: Locale = 'sr';

/** Options accepted by `lex`, `parse` and `compile`; omitted ⇒ Serbian messages. */
export interface LangOptions {
  locale?: Locale;
}

/** sr: "greška E04 (red 12, kol 1): veza 'Overe' ima 3 učesnika, …"
 *  en: "error E04 (line 12, col 1): relationship 'Overe' has 3 participants, …" */
export function formatDiagnostic(d: Diagnostic, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'en') {
    const prefix = d.severity === 'error' ? 'error' : 'warning';
    return `${prefix} ${d.code} (line ${d.span.line}, col ${d.span.col}): ${d.message}`;
  }
  const prefix = d.severity === 'error' ? 'greška' : 'upozorenje';
  return `${prefix} ${d.code} (red ${d.span.line}, kol ${d.span.col}): ${d.message}`;
}
