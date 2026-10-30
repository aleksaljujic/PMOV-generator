# C08 — UI components, storage, examples

Owners: **T05** (`src/render/flow/`), **T07** (`src/ui/editor/`), **T08** (`src/ui/tabs/`), **T09** (`src/ui/shell/`), **T00** (`src/examples/`, frozen).
Consumer: **T09** wires everything together in `App.tsx`.

Every component is self-contained: it receives data via props and reports user intent via callbacks.
No component reads localStorage or calls `compile()` except where stated (only T09 does).

## Examples (T00 writes verbatim; content is fixed by requrement.md)

```ts
// FILE: src/examples/index.ts
export interface Example { id: string; title: string; source: string; titleEn?: string; sourceEn?: string }

export const EXAMPLES: Example[] = [
  { id: 'osnovni', title: 'Osnovni primer', source: /* main example from requrement.md, verbatim, ending with "\n" */ '' },
  { id: 'specijalizacija', title: 'Specijalizacija i rekurzivna veza', source: /* second example, verbatim */ '' },
];

export const DEFAULT_EXAMPLE_ID = 'osnovni';
```

```ts
// src/lang/semantic/errorFixtures.ts   (T02; imported by tests directly, not exported from src/lang)
import type { DiagnosticCode } from '../diagnostics';
/** One minimal source per E/W code that produces that code (and, for E-codes, no other E-code).
 *  Used by tests only (not shown in the "Primeri" dropdown). */
export const ERROR_FIXTURES: { code: DiagnosticCode; title: string; source: string }[];
```

## Editor (T07)

```ts
// src/ui/editor/index.ts
import type { Diagnostic } from '../../lang/diagnostics';

export interface EditorHandle {
  /** Move cursor to 1-based line/col, scroll into view, focus. */
  jumpTo(line: number, col: number): void;
  /** Select/scroll to an offset range without stealing focus from the diagram. */
  revealRange(from: number, to: number): void;
  focus(): void;
}

export interface EditorProps {
  value: string;
  /** Fires on every change; the App debounces compilation. */
  onChange(value: string): void;
  /** May be stale relative to `value` (debounce) — the editor must clamp spans to the document length. */
  diagnostics: Diagnostic[];
  /** Background highlight of a block (diagram → editor sync); null = none. */
  highlightRange: { from: number; to: number } | null;
  /** Cursor (main selection head) moved — used for editor → diagram sync. */
  onCursorChange?(offset: number): void;
}

export const Editor: React.ForwardRefExoticComponent<EditorProps & React.RefAttributes<EditorHandle>>;
```

Behaviour: CodeMirror 6, PMOV syntax highlighting (block kinds, roles, domains, comments, `#`, cardinalities,
quoted names), lint diagnostics with squiggles (error = red, warning = yellow), message text =
`formatDiagnostic(d)`. Controlled: when `value` changes from outside (example picked) the doc is replaced; typing
must not reset the cursor.

## DiagramView (T05)

```ts
// src/render/flow/index.ts
import type { DiagramGraph, Point, PositionMap } from '../graph/types';

export interface DiagramViewHandle {
  fitView(): void;
  /** Positions currently on screen (after layout + drags) — used for SVG/PNG export. */
  getPositions(): PositionMap;
}

export interface DiagramViewProps {
  /** null → empty state ("Nema dijagrama"). Keep showing the previous graph is the App's job. */
  graph: DiagramGraph | null;
  /** User-dragged positions; override layout for those ids. */
  savedPositions: PositionMap;
  /** Incremented by "Ponovo rasporedi": forces a fresh layout and fitView. */
  layoutNonce: number;
  /** Element ids whose nodes get the red outline. */
  errorElementIds: ReadonlySet<string>;
  /** Element whose node(s) get the selection outline. */
  selectedElementId: string | null;
  onElementClick(elementId: string): void;
  /** Drag stop of one node (top-left position). The App persists it. */
  onNodeMoved(nodeId: string, position: Point): void;
}

export const DiagramView: React.ForwardRefExoticComponent<DiagramViewProps & React.RefAttributes<DiagramViewHandle>>;
```

Behaviour: wraps its own `ReactFlowProvider`; zoom/pan, `<Controls>`, `<MiniMap>`, fit view on first layout;
re-layout (async `layoutDiagram`) when the *structure* of the graph changes (set of node ids/edge ids or node
sizes) — not on every keystroke that leaves the structure equal; existing node positions are kept for nodes that
still exist.

```ts
// src/render/flow/index.ts (also exported) — pure, tested (requirement "IR → React Flow mapping")
import type { Edge, Node } from '@xyflow/react';
export interface PmovNodeData extends Record<string, unknown> { node: DiagramNode; hasError: boolean; selected: boolean }
export interface PmovEdgeData extends Record<string, unknown> { edge: DiagramEdge }
export function toReactFlow(
  graph: DiagramGraph, positions: PositionMap,
  errorElementIds: ReadonlySet<string>, selectedElementId: string | null,
): { nodes: Node<PmovNodeData>[]; edges: Edge<PmovEdgeData>[] };
```
React Flow node `type` = `DiagramNode.type`; edge `type` = `'pmov'`.

## Output tabs (T08)

```ts
// src/ui/tabs/index.ts
export function DomainTab(props: { ir: PmovIR | null }): JSX.Element;
export function RelationalTab(props: {
  ir: PmovIR | null;
  hasErrors: boolean;               // true → show "Ispravite greške da bi se generisao relacioni model."
  dg0Mode: Dg0Mode;
  onDg0ModeChange(mode: Dg0Mode): void;
}): JSX.Element;
export function SqlTab(props: { ir: PmovIR | null; hasErrors: boolean; dg0Mode: Dg0Mode }): JSX.Element;
```

RelationalTab renders `Radnik(<u>Mlb</u>, ImeR, …, <i>SifOd</i>)` (pk underlined, `fk && !pk` italic), has the
radio toggle "Veze sa DG=0: posebna relacija / strani ključ" (visible only if `dg0ToggleableVezas(ir)` is
non-empty) and a "Kopiraj kao tekst" button (`navigator.clipboard.writeText(formatModelText(rm))`).
SqlTab shows `generateSql` in a monospace `<pre>` with a "Kopiraj" button.

## App-level pieces (T09)

```ts
// src/ui/shell/storage.ts — every access wrapped in try/catch; failures fall back to defaults
export const STORAGE_KEYS = {
  source: 'pmov.source.v1',
  positions: 'pmov.positions.v1',     // PositionMap JSON
  dg0Mode: 'pmov.dg0Mode.v1',
  editorWidth: 'pmov.editorWidth.v1', // number, px
} as const;
export function loadSource(): string | null;
export function saveSource(source: string): void;
export function loadPositions(): PositionMap;
export function savePositions(p: PositionMap): void;
export function clearPositions(): void;
export function loadDg0Mode(): Dg0Mode;
export function saveDg0Mode(m: Dg0Mode): void;

// src/ui/shell/ErrorPanel.tsx
export function ErrorPanel(props: { diagnostics: Diagnostic[]; onSelect(d: Diagnostic): void }): JSX.Element;
```

Selection sync (owned by App):

- cursor offset → `findElementAtOffset(lastValidIr, offset)` → `selectedElementId` → DiagramView.
- node click → `selectedElementId` + `highlightRange = element.span` → Editor (`revealRange`).
- error panel click → `editor.jumpTo(d.span.line, d.span.col)`.
- `errorElementIds` = `elementId`s of diagnostics with severity `error`.
- On syntax errors (`ir === null`) the App keeps passing the last valid graph to DiagramView.

## UI strings (Serbian, Latin) — use exactly these

`Dijagram`, `Domeni`, `Relacioni model`, `SQL`, `Primeri`, `Ponovo rasporedi`, `Izvezi SVG`, `Izvezi PNG`,
`Kopiraj kao tekst`, `Kopiraj`, `Veze sa DG=0:`, `posebna relacija`, `strani ključ`, `Greške i upozorenja`,
`Nema grešaka.`, `Nema dijagrama`, table headers `ATRIBUT`, `DOMEN`, `OGRANIČENJE`.

## Additions for the interactive builder (T13, additive; see C09)

- `DiagramViewProps` gets optional `renderNodeOverlay`, `renderEdgeOverlay`, `onEdgeLabelClick`, `onNodeDoubleClick`,
  `onCanvasClick`, `pickMode`, `placeholderIds`; `DiagramViewHandle` gets `centerOnElement(elementId)`.
  Omitted props leave DiagramView unchanged. Exact signatures: C09 §DiagramView additions.
- `STORAGE_KEYS.mode = 'pmov.mode.v1'` (`'tekst' | 'interaktivno'`, default `'tekst'`) with `loadMode()` / `saveMode()`.
- Toolbar gets optional mode switch, "Novi dijagram", "Poništi" / "Ponovi" props. Since Wave 11 (T38) the mode
  switch is one sidebar toggle button, see §Additions for the sidebar toggle.

## Additions for the editor fix and the English option (spec/fix_editor.md, CHANGELOG 2026-10-30; additive)

Every new prop is optional. Omitted `locale` means `'sr'`, so today's behaviour and tests are unchanged.
`Locale` comes from `src/lang` (C01). Each folder keeps its own UI strings in a local `strings.ts` with an `sr` and
an `en` table and a test that both tables have the same keys. There is no shared dictionary module.

- **Examples:** `Example.titleEn?` / `Example.sourceEn?` (all four examples have them). In EN the "Examples" menu
  shows `titleEn ?? title` and loads `sourceEn ?? source`.
- **Editor (T14):**
  - `EditorProps.locale?: Locale` is used for the lint message text (`formatDiagnostic(d, locale)`).
  - Tab / Shift+Tab indent / dedent the line or the selected lines by 2 spaces (`indentWithTab`,
    `indentUnit.of('  ')`). Enter keeps the indentation and adds a level after `{`. Typing `}` at the start of a
    line dedents it. Esc then Tab leaves the editor.
  - Keyword aliases (C02 §Keyword aliases) are highlighted like their canonical words.
- **Output tabs (T17):** `locale?: Locale` on `DomainTab`, `RelationalTab`, `SqlTab`.
- **DiagramView (T19, additive exception in `src/render/flow/`):** `DiagramViewProps.locale?: Locale` (empty state
  text and any aria labels).
- **Shell (T19):**
  - `STORAGE_KEYS.lang = 'pmov.lang.v1'` (`'sr' | 'en'`, default `'sr'`; unknown values fall back to `'sr'`), with
    `loadLang(): Locale` / `saveLang(l: Locale): void`.
  - `ErrorPanel` props get `locale?: Locale`.
  - Toolbar gets an optional `locale` and `onLocaleChange`, and shows the SR | EN switch only when `onLocaleChange`
    is given.
  - The App passes the locale to `compile`, Editor, tabs, ErrorPanel, DiagramView, the builder
    (`applyBuilderAction(…, { locale })`, `UseBuilderOptions.locale`), and sets `document.documentElement.lang`.

### UI strings, English (the Serbian ones above stay exactly as they are)

| sr | en |
|---|---|
| Dijagram | Diagram |
| Domeni | Domains |
| Relacioni model | Relational model |
| SQL | SQL |
| Primeri | Examples |
| Ponovo rasporedi | Re-layout |
| Izvezi SVG / Izvezi PNG | Export SVG / Export PNG |
| Kopiraj kao tekst / Kopiraj | Copy as text / Copy |
| Veze sa DG=0: / posebna relacija / strani ključ | Relationships with DG=0: / separate relation / foreign key |
| Greške i upozorenja | Errors and warnings |
| Nema grešaka. | No errors. |
| Nema dijagrama | No diagram |
| ATRIBUT / DOMEN / OGRANIČENJE | ATTRIBUTE / DOMAIN / CONSTRAINT |
| Tekst / Interaktivno / Režim | Text / Interactive / Mode |
| Novi dijagram | New diagram |
| Poništi / Ponovi | Undo / Redo |
| Ispravite greške da bi se generisao relacioni model. | Fix the errors to generate the relational model. |
| Nema podataka. Unesite dijagram u editor. | No data. Enter a diagram in the editor. |

Strings that are not listed are translated by the owning agent in the same style and recorded in its task file.

## Additions for domains and constraints (T25, C10 §4; additive)

- `DomainTab` props: `{ ir, locale?, onAction?: TabAction, highlight?: TabHighlight }`; new `ConstraintsTab` props: `{ ir, hasErrors, dg0Mode, locale?, onAction?, highlight? }`. `TabAction = (a: BuilderAction) => BuilderResult | void`; `TabHighlight = { kind: 'domain' | 'constraint'; name: string } | null`. All exported from `src/ui/tabs/index.ts`. Without `onAction` the tabs are read-only.
- `SqlTab` calls `generateSql(rm, ir, locale)`.

## Additions for the sidebar toggle (spec/feature_text2interactive.md, Wave 11, T38; additive)

- The Toolbar's mode control is one icon button **☰** at the far left (before the title) instead of the
  "Tekst | Interaktivno" segmented switch. Same props: `mode` / `onModeChange`. `aria-expanded` = `mode === 'tekst'`;
  label/title `Sakrij tekst (Ctrl+B)` (open) / `Prikaži tekst (Ctrl+B)` (closed), EN `Hide text (Ctrl+B)` /
  `Show text (Ctrl+B)`. Clicking calls `onModeChange` with the other mode.
- `pmov.mode.v1` is unchanged: `'tekst'` = sidebar open, `'interaktivno'` = sidebar closed. No new storage key.
- `SplitPane` gets optional `collapsed?: boolean` (left pane and divider hidden, `width` kept for reopening).
- Ctrl+B / Cmd+B toggles the mode app-wide (also from the editor), not inside builder inline text fields.
- Strings: `Prikaži tekst (Ctrl+B)` / `Show text (Ctrl+B)`, `Sakrij tekst (Ctrl+B)` / `Hide text (Ctrl+B)`.
  `Tekst` / `Interaktivno` are no longer shown in the toolbar.
