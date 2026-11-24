# Feature: grid layout, attribute cards, locked attributes

Status: **approved** (2026-11-04, the user said "make tasks"; the recommended answers to the open decisions are taken). Wave 13, tasks T45–T50. It builds on Wave 12 (`spec/feature_dense_nodes.md`): ports and
collision-checked labels (T40) stay; the attribute fans (T41) and the size-by-degree rule (T39) are replaced.

## Problem

Even after Wave 12, `proizvodnja` still has overlaps: 3 label × label, 6 label × core box and 2 endpoint pairs closer
than 8 px. The root cause is the layout model:

- **Stress layout places nodes freely.** It keeps them apart only by a repair pass after the fact, so nothing
  *guarantees* free space.
- **Attributes are placed after the layout**, in whatever space is left, so they compete with lines and labels.
- **Dragging an object leaves its attributes behind.** `onNodesChange` moves only the dragged node, so the user must
  move every pill by hand.

Mermaid-style diagrams look tidy because they use a **layered (rank) layout** of fixed-size blocks. Each block gets
its own cell, and lines run between ranks. Nothing is placed after the layout, so nothing can overlap.

## Proposal in one paragraph

Treat an object **and its attributes as one rigid block** (a *card*). In a card, the attributes sit at 90° to the
box sides, and the box grows to fit them. Lay the cards out on a **layered grid** (ELK `layered`) in which every veza
sits between its two participants. Snap manual drags to a grid. Attributes are **locked** to their object by
default: dragging the object moves the whole card.

## 1. Attribute card (attributes at 90°, box grows)

```
            ┌────────────────────────┐
 (Mlb#)─────┤                        ├─────(Adresa)
 (ImeR)─────┤        Radnik          ├─────(Starost)
 (Plata)────┤                        ├─────(Email)
            └───────────┬────────────┘
                     relationship lines leave top / bottom
```

**Rules (C05 / C06 change):**

- Attributes go in **columns on the left and right sides** of the box, each with a horizontal stub. The stub length
  is `ATTR_STUB = 24` px and the pitch is pill height + 8 = 32 px. `#` attributes come first, on the left, in source
  order.
- **The box grows to fit:** `height = max(44, rows · 32 + 12)`, where `rows = ceil(n / 2)`. Width stays as today,
  because the label sets it.
- **More than 6 rows per side:** use two staggered columns per side. The inner pill has a short stub and the outer
  pill a long stub that passes between inner pills. Lines stay at 90°, and the height halves.
- **Top and bottom are left free for relationship lines.** This fits the layered layout (§2), where neighbours are
  above and below. If a card has more than 4 relationship lines and few attributes, a side column may also take
  relationship ports (T40 port logic).
- **The card's bounding box** (box + stubs + pills) is the node size that layout sees. Attributes are no longer
  placed after the layout.
- Applies to `objekat`, `slab` and `agregacija`. For `agregacija`, the outer rectangle is the box.

Example `RadniNalog` (17 attributes): 9 rows → two staggered columns → 5 rows → box about 130 × 188, card about
500 × 188. That is larger than today's box, but nothing crosses it.

## 2. Layered grid layout ("like Mermaid")

**Why the old layered layout failed.** Every edge pointed object → veza, so all objects landed in rank 0 and all
vezas in rank 1. The fix is to **orient each veza's edges as a chain:** `participant₁ → veza → participant₂`. Then a
veza always sits *between* its participants, one rank apart.

- **Algorithm:** `elk.algorithm = layered`, direction `DOWN` (option `RIGHT`). Nodes are cards (§1), spec blocks
  stay as today (S diamond → junction → podtipovi row), `elk.spacing.nodeNode = 40`,
  `elk.layered.spacing.nodeNodeBetweenLayers = 60`, and `elk.layered.considerModelOrder.strategy = NODES_AND_EDGES`,
  so the source order stays stable.
- **Edge orientation:**
  - veza: first participant → veza → second.
  - slab: owner → slab node.
  - agregacija: component → agregacija.
  - specijalizacija: supertype → S → junction → podtip.
  - Recursive veza: both edges object → veza (loops stay as today).
- **Wide models:** `elk.aspectRatio = 1.6` with `elk.layered.wrapping.strategy = MULTI_EDGE`, so long chains wrap
  into several bands instead of one tall column.
- **Grid:** final positions are rounded to `GRID = 10` px. ELK's layered algorithm already guarantees that blocks
  don't overlap, so no repair pass is needed.
- **Lines** stay straight and use the Wave 12 ports and labels. Labels now have a free lane between ranks.
- **Stress is kept as an option.** Layout option `algorithm: 'grid' | 'free'`, toolbar select "Raspored:
  Mreža | Slobodan", default `grid`, stored as `pmov.layout.v1`.

**Out of scope for now:** orthogonal (right-angle) relationship lines with ELK bend points. They need edge routes
in the layout output, which is a frozen-type change (`PositionMap` holds node positions only). This would be a
possible phase 2.

## 3. Locked attributes (move the whole object)

- **Default: locked.** Dragging an object, slab or agregacija moves its attribute pills by the same delta, live
  while dragging. On drop, all moved positions are saved in **one** history step.
- **Dragging a single pill while locked** moves the whole card (the pill acts as a handle). **Alt + drag** moves just
  that one pill; its offset from the owner is kept from then on.
- **Unlock:** a toolbar toggle "🔒 Atributi prate objekat" / "🔒 Attributes follow object" turns locking off, which
  restores today's behaviour (every pill moves freely). Stored as `pmov.attrLock.v1`.
- **Data:** `PositionMap` stays absolute, so there is no frozen-type change and JSON export / import is unchanged.
  The offset is computed at drag time as `attr − owner`.
- **New layout** ("Rasporedi" / Novi dijagram) resets the cards to the §1 rule. With saved positions, a moved owner
  keeps its pills' saved offsets.

## 4. Snap to grid on manual drag

- React Flow `snapToGrid` with `[10, 10]`, and a light dot background (`<Background variant="dots" gap={20}>`).
- **On drop:** if the dropped card overlaps another card, nudge it to the nearest free spot on the grid (spiral
  search over 10 px steps, at most 300 px). If none is free, leave it and outline the overlap.
- The toggle lives in the same toolbar menu as the lock: "Poravnaj na mrežu" / "Snap to grid", on by default.

## What changes where (one agent per folder)

| Folder | Change | Contract |
|---|---|---|
| `src/render/graph/` | Card sizing: box height from attribute rows; drop the size-by-degree rule | C05 |
| `src/render/layout/` | Card geometry (pills at 90°, staggered columns); ELK `layered` with chain orientation, wrapping, grid rounding; keep stress as `free`; `LayoutOptions.algorithm` | C06 |
| `src/render/geometry/` | Attribute edges become 90° stubs (straight, already); relationship ports prefer top/bottom on cards | C06 |
| `src/render/flow/` | Locked drag (delta to pills, Alt-drag one pill), snap to grid, dot background, overlap nudge on drop, `onNodesMoved` batch callback | C08 |
| `src/ui/shell/` | Toolbar: Raspored select, lock toggle, snap toggle; storage keys; one history step per drag | C08 |
| `src/render/svg/` | Nothing (it already draws from positions + geometry) | – |
| `e2e/` | Acceptance: metrics = 0 on every example, card drag moves pills, saved offsets survive reload and JSON round trip | – |

New contract additions: `LayoutOptions.algorithm?: 'grid' | 'free'`; `DiagramViewProps.lockAttributes?`,
`snapToGrid?`, `onNodesMoved?(moves: Record<string, Point>)`; storage `pmov.layout.v1`, `pmov.attrLock.v1`,
`pmov.snap.v1`. No frozen type changes.

## Done when

- **Every built-in example and the 17-attribute / 10-veza stress model**, with the `grid` layout: 0 label × label,
  0 label × box, 0 label × pill, 0 close endpoints, 0 card overlaps, and every attribute stub at exactly 90°.
- **Dragging an object moves all its pills,** with one undo step; Alt-drag moves one pill; lock off restores today's
  behaviour.
- **Snap and nudge:** a drop onto another card ends on a free grid spot.
- **Old diagrams keep working:** JSON files and saved positions from before still load unchanged.
- `npm test`, `npm run typecheck`, `npm run build` green.

## Decisions (recommended answers taken, 2026-11-04)

The user replied "make tasks" without picking, so the recommended options apply: 1 = `grid` default, 2 = left/right
columns only, 3 = pill drag while locked moves the whole card, 4 = no orthogonal relationship lines in this wave.
Exact numbers and formulas are in C05 / C06 / C08 §Additions for the grid layout (they win over this file).

### Open decisions as originally asked

1. **Default layout:** `grid` (layered, recommended) or keep `free` (stress) as the default?
2. **Attribute sides:** left/right columns only (recommended, top/bottom free for lines), or all four sides?
3. **Pill drag while locked:** moves the whole card (recommended), or moves only the pill?
4. **Orthogonal relationship lines** (phase 2, frozen-type change): wanted later or not?

## Effort

Five agents in parallel (graph, layout, geometry, flow, shell), then one acceptance agent. The layout task is the
large one. Wave 12's T44 is not needed separately; this wave's acceptance replaces it.
