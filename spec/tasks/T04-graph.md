# T04 — Diagram graph (IR → DiagramGraph)

**Wave:** 1 (parallel). **Implements:** C05. **Consumes:** C03.
**Folder (owns everything inside):** `src/render/graph/` — read its `AGENT.md`. `types.ts` there is frozen contract code.
Public entry: `src/render/graph/index.ts` (`buildDiagramGraph`, `estimateTextWidth`, `attributeNodeId`).

Layout moved to **T11** (`src/render/layout/`), geometry to **T12** (`src/render/geometry/`).

## Goal

Turn the IR into the renderer-neutral `DiagramGraph`: node ids, labels, sizes, and edges with labels, arrows and
routes. Every renderer and the layout read from this.

## Steps

1. **`estimateTextWidth(text, fontSize)`**: a deterministic per-character width table (narrow `iljtf.,:()|`, wide
   `MWmwŠŽ`, uppercase ≈ 0.68·fs, digits ≈ 0.56·fs, default ≈ 0.55·fs). No DOM, so it works in Node.
2. **`attributeNodeId`**: `attr:<ownerId>:<name>`, or `…~N` for the N-th duplicate (N ≥ 2).
3. **`buildDiagramGraph`**: apply the C05 tables exactly (node ids, order, labels, `elementId`, `layoutRole`,
   `ownerNodeId`, sizes, edge ids/direction/label/arrow/route).
   - Recursive veza (both participants have the same ref): i=0 `loopTop`, i=1 `loopBottom`.
   - IR with errors: a veza with 1 or 3 participants yields 1 or 3 edges. A spec without a supertype still emits the
     spec node, the junction and the subtype edges. Never throw.

## Tests (fixtures only, no dependency on other agents)

- C05 golden counts for `MAIN_EXAMPLE_IR` and `SPEC_EXAMPLE_IR` (by node type, by edge kind, number of arrows).
- Labels: `e:Zapošljavanje:0` → `(1,1) Radi`; `e:Overe:0` → `(1,1)`; `e:Isplata:owner` → `(0,M)` with an arrow;
  `e:Vrsta:super` → `Vrsta (0,M)`; `e:Vrsta:sub:0` → `busDown` with an arrow; Struktura → `loopTop` and `loopBottom`.
- Attribute nodes: `Mlb#` label with `isIdentifier`; duplicates get `~2`; the agregacija's attributes are owned by
  `Prijava`.
- Node order: each element is followed by its attributes.
- Sizes follow the C05 formulas; `estimateTextWidth` is monotonic in length and deterministic.

## Definition of done

- [ ] C05 signatures are exact, the stubs are removed, the tests pass, and the code works in Node.

## Status

Done. 11 tests pass, tsc clean in folder. See spec/sessions/T04.md.

## Contract notes

_none_
