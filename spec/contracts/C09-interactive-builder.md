# C09 — Interactive builder

Owner: **T13** (`src/builder/`, `src/ui/builder/`, plus additive edits in `src/render/flow/` and `src/ui/shell/`).
Consumers: T13 itself (shell wiring). Feature spec: [`../feature_interactive_pmov.md`](../feature_interactive_pmov.md).

The DSL text is the only model. Every builder action is a pure text edit: `(source, action) → new source`.
`src/builder/` has no React. `src/ui/builder/` never edits text; it only calls `onAction(action)`.

## Pure API (`src/builder/index.ts`)

```ts
import type { Domain, ElementKind, PmovIR } from '../lang';

export interface AttributeSpec {
  name: string;                      // quoted automatically when it is not a plain identifier
  id: boolean;                       // '#'
  domain?: Domain | null;
  constraint?: string | null;        // ignored when there is no domain (the grammar has no constraint without a domain)
}
export type NewObject = { newObject: true };

export type BuilderAction =
  | { kind: 'newModel' }
  | { kind: 'addObject'; near: string }
  | { kind: 'addVeza'; from: string; to: string | NewObject }
  | { kind: 'addSlab'; parent: string }
  | { kind: 'addAgregacija'; first: string; second: string | NewObject }
  | { kind: 'addComponent'; agregacija: string; component: string | NewObject }
  | { kind: 'addSpecijalizacija'; nadtip: string }
  | { kind: 'addPodtip'; specijalizacija: string; podtip: string | NewObject }
  | { kind: 'removePodtip'; specijalizacija: string; podtip: string; withDependents: boolean }
  | { kind: 'addAttribute'; owner: string; attr: AttributeSpec }
  | { kind: 'editAttribute'; owner: string; index: number; attr: AttributeSpec }
  | { kind: 'deleteAttribute'; owner: string; index: number }
  | { kind: 'rename'; element: string; newName: string }
  | { kind: 'setCardinality'; element: string; participantIndex: number; dg: 0 | 1; gg: '1' | 'M' }
  | { kind: 'setMappingName'; element: string; participantIndex: number; name: string | null }
  | { kind: 'deleteElement'; element: string; withDependents: boolean };

/** Where the shell should save a position for a node that does not exist yet (node ids per C05). */
export interface Placement { id: string; near: string; dir: 'right' | 'below' }

export type BuilderResult =
  | {
      ok: true;
      source: string;
      /** Element id to select afterwards (the new element, or the owner for attribute edits). */
      select?: string;
      /** Node ids that changed (rename / attribute rename): the shell moves saved positions `from` → `to`. */
      renames?: { from: string; to: string }[];
      placeAt?: Placement[];
    }
  | {
      ok: false;
      message: string;                  // Serbian, see UI strings
      /** Present when the user must confirm deleting dependents first; repeat the action with withDependents: true. */
      needsConfirmation?: { dependents: { id: string; kind: ElementKind }[] };
    };

export function applyBuilderAction(source: string, action: BuilderAction): BuilderResult;

export type PlaceholderKind = 'objekat' | 'slab' | 'agregacija' | 'specijalizacija' | 'podtip';
/** First free `ObjekatN` / `SlabN` / `AgregacijaN` / `VrstaN` / `PodtipN` (N ≥ 1) w.r.t. the element ids of `ir`. */
export function placeholderName(ir: PmovIR | null, kind: PlaceholderKind, alsoTaken?: Iterable<string>): string;
export function isPlaceholderName(name: string): boolean;     // /^(Objekat|Slab|Agregacija|Vrsta|Podtip)\d+$/

export type PickPurpose =
  | { kind: 'veza'; from: string }
  | { kind: 'agregacija'; first: string }
  | { kind: 'component'; agregacija: string }
  | { kind: 'podtip'; specijalizacija: string };
/** null = candidate may be picked; otherwise the Serbian reason shown in the status line. */
export function pickRejection(ir: PmovIR, purpose: PickPurpose, candidate: string): string | null;
```

### Semantics

- `applyBuilderAction` parses the source. If it has any syntax (S) diagnostic it returns
  `{ ok: false, message: 'Dijagram ima sintaksne greške. Ispravite ih u tekstualnom režimu.' }`
  (`newModel` does not look at the source). If an element/index is not found, or the edited text would not parse,
  it returns `Izmena nije uspela, pokušajte ponovo.`; the source is never half-edited.
- Edits are minimal splices on AST spans. Comments, formatting and block order stay. New blocks are appended at the
  end, one blank line before them. Order: new objects first, then the connecting block.
- `newModel` → exactly `objekat Objekat1 {\n}\n`.
- `addObject` → `objekat ObjekatN {\n}`; placed right of `near`.
- `addVeza` → `veza _ { X (1,1) / Y (0,M) }`, columns aligned. `from === to` (recursive): `Uloga1` / `Uloga2` are added.
  New object is created for `{ newObject: true }`. Placement: veza right of `from`, new object right of the veza.
- `addSlab` → `slab SlabN { nadređeni X (0,M) / Rb# }`, placed right of X. X may be objekat, slab or agregacija.
- `addAgregacija` → `agregacija AgregacijaN { X (0,M) / Y (0,M) }`; `first === second` is rejected
  (`Komponente moraju biti različiti elementi.`). `addComponent` appends `Y (0,M)` (self and duplicates rejected).
- `addSpecijalizacija` (nadtip must be an objekat) → `Podtip1`, `Podtip2` (first free numbers) + `specijalizacija VrstaN`
  with `nadtip X (0,M)`. Placement: spec diamond below X, junction below the diamond, subtypes in a row below the junction.
- `addPodtip` appends `podtip Y`. Rejections: `Podtip ne može biti sam nadtip.`, `Objekat je već podtip.`,
  `Ovo bi napravilo ciklus specijalizacije.` (E09).
- `removePodtip` deletes the `podtip` line. If fewer than 2 would remain, the specijalizacija is a dependent: without
  `withDependents` the result is `ok:false` with `needsConfirmation`; with it, the whole specijalizacija block is deleted.
- Attribute actions: `index` is the position in the flat attribute list of the element (IR order). Line format
  `Name[#] [: domain [constraint]]`. Adding to a multi-line block inserts a line (aligned to the colon column of the
  previous attribute line); a single-line block is expanded to multi-line first. Edit/delete of an attribute in a
  comma-separated line touches only that item. A constraint swallows the rest of its line in the grammar, so setting one
  on a non-last item of a comma line splits that line into one attribute per line.
- `rename` changes the block name and every participant reference. Rejections: `Ime je već zauzeto.` (E01),
  `Neispravno ime.` (empty, contains `"` or a line break; `_` for non-veza). Empty name for a `veza` becomes `_`.
  `renames` lists every node id that changes (`el`, `spec:el`, `junction:el`, `attr:el:*`).
- `setCardinality` / `setMappingName`: `participantIndex` counts participant lines of the block (veza, agregacija);
  for `slab` and `specijalizacija` index 0 is the `nadređeni` / `nadtip` line. Edge ids (C05) map as
  `e:<veza>:<i>` → i, `e:<agg>:<i>` → i, `e:<slab>:owner` → 0, `e:<spec>:super` → 0. Mapping name `null` clears it.
- `deleteElement`: removes the block. Dependents removed with it: veza that references it (silently), podtip lines,
  agregacija components while ≥ 2 components remain (silently). **Hard dependents** need confirmation
  (`needsConfirmation`, message `Obrisati i zavisne elemente (N)?`): slab whose nadređeni is deleted, agregacija left
  with < 2 components, specijalizacija whose nadtip is deleted or that is left with < 2 podtipovi — transitively.
  Subtype objects of a deleted specijalizacija stay.
- Placeholder names (`isPlaceholderName`) are drawn in grey italics until renamed.

## DiagramView additions (C08 additive; all optional, omitted ⇒ behaviour unchanged)

```ts
// src/render/flow/index.ts
export interface DiagramViewProps {
  /* … existing props … */
  // DiagramViewHandle also gets centerOnElement(elementId): pans to the element's main node (keeps zoom).
  /** Rendered inside every node's box (absolutely positioned, pointer-events up to the renderer). */
  renderNodeOverlay?(node: DiagramNode, state: { selected: boolean; hasError: boolean }): ReactNode;
  /** Rendered next to an edge label (inside the label's anchor), for pickers. */
  renderEdgeOverlay?(edge: DiagramEdge): ReactNode;
  /** Makes edge labels clickable. */
  onEdgeLabelClick?(edgeId: string): void;
  onNodeDoubleClick?(node: DiagramNode): void;
  /** Click on empty canvas. */
  onCanvasClick?(): void;
  /** Pick mode: nodes whose elementId is in validIds are highlighted, all others dimmed. */
  pickMode?: { validIds: ReadonlySet<string> } | null;
  /** Element ids drawn with grey italic names (objekat, slab, agregacija only). */
  placeholderIds?: ReadonlySet<string>;
}
```

Implementation detail: the optional props are delivered to node/edge components through a React context that is `null`
when none is passed.

## Storage and shell

`STORAGE_KEYS.mode = 'pmov.mode.v1'` (`'tekst' | 'interaktivno'`, default `'tekst'`), with `loadMode()` / `saveMode()`
in `src/ui/shell/storage.ts`.

## UI strings (Serbian, Latin)

As listed in the feature spec §UI strings. Additional strings added by this task: `Komponente moraju biti različiti
elementi.`, `Element je već komponenta.`, `Preslikavanje`, `Kardinalnost`, `Ime`, `Potvrda`.

## Additions for the English option (spec/fix_editor.md, CHANGELOG 2026-10-30; additive, owner T18)

Every new parameter is optional and defaults to `'sr'`, so existing calls and tests are unchanged.

```ts
import type { Locale } from '../lang';

export interface BuilderOptions { locale?: Locale }
export function applyBuilderAction(source: string, action: BuilderAction, options?: BuilderOptions): BuilderResult;
export function placeholderName(ir: PmovIR | null, kind: PlaceholderKind, alsoTaken?: Iterable<string>, locale?: Locale): string;
/** Recognises both languages: /^(Objekat|Slab|Agregacija|Vrsta|Podtip|Object|Weak|Aggregation|Kind|Subtype)\d+$/ */
export function isPlaceholderName(name: string): boolean;
export function pickRejection(ir: PmovIR, purpose: PickPurpose, candidate: string, locale?: Locale): string | null;
```

- **Locale `en`:**
  - New blocks and participant lines use `BLOCK_KIND_KEYWORDS.en` / `ROLE_KEYWORDS.en` (`object`, `weak`,
    `owner`, …).
  - Placeholder names are `ObjectN`, `WeakN`, `AggregationN`, `KindN`, `SubtypeN`.
  - The default partial identifier of a new weak object is `No#`.
  - `message` and rejection reasons are in English.
- **Any locale:** existing lines keep their keyword spelling. The builder never rewrites a keyword it did not insert.
  Placeholder numbering counts only the requested locale's prefix (with `Objekat1` taken, the EN name is `Object1`;
  with `Object1` taken, it is `Object2`). Clarified 2026-10-30 after T18.
- `UseBuilderOptions.locale?: Locale` (`src/ui/builder/`): all overlay strings (the + menu, forms, hints, confirms,
  pick status line) come from the folder's `strings.ts`.
- T18 final: `BuilderOptions` is also exported from `src/builder/index.ts`, as is `BUILDER_MESSAGES_BY_LOCALE` (`Record<Locale, ...>`). `BuilderController` gains `locale: Locale` (read by `BuilderOverlay`). Placeholder numbering checks only the requested locale's prefix (as in the examples above).

## Additions for domains and constraints (C10 §5, CHANGELOG 2026-10-30, owner T26)

- `BuilderAction` has the nine C10 variants (`addDomain` … `deleteConstraint`); `AttributeSpec.userDomain?` / `length?`;
  `deleteAttribute` gains optional `withDependents?`. `BuilderResult.needsConfirmation` gains `usages?` and `constraints?`.
- Message keys added to `BUILDER_MESSAGES_BY_LOCALE` (sr + en): `domainTaken`, `domainCycle`, `domainUsed`, `noDomain`,
  `unknownDomain`, `constraintTaken`, `badCondition`, `cellNotSettable`, `actionNotAllowed`, `noConstraint`, `confirmConstraints`.
- `src/builder` imports `generateRelationalModel` from `src/rm` (index) to find FK attributes that borrow an attribute name.
- `src/ui/builder`: `BuilderController.confirm` has optional `constraints?: string[]`. Details in the T26 task file.
