# PRD — Bulk Action Bar

## Problem

Every list-style overview/editor acts on one entity at a time. Deleting twelve states
means twelve trash clicks and twelve confirmations. The same holds for burgs, provinces,
cultures, religions, regiments, markers, routes, zones, markets, and rivers.

## Solution

A single reusable multi-select control on each list menu. A bulk button in the menu's
footer button row toggles bulk mode, which shows per-row checkboxes plus inline footer
controls: Select all, a selected-count, and Delete / Lock / Unlock / Set color (only the
actions the entity type supports). Selection is scoped to the open menu and kept across
actions, so they can be chained.

Bulk delete shows one confirmation summarizing the cascade (entities removed, dependents
reassigned or removed) and reports any locked rows it will skip. Locked rows are protected
from bulk delete — the safety model, since there is no undo. For States and Provinces an
optional "also delete contained burgs" choice is offered.

## Non-goals

- Cross-type selection (selecting states and markers together).
- Bulk edits beyond Lock / Unlock / Set color.
- Undo/redo. Lock-protection plus an explicit confirmation are the safety model.

## Architecture

The generic, type-agnostic machinery lives in `src/controllers/bulk-action/`:

- `bulk-selection.ts` — `BulkSelection`, a pure selection set with a `canSelect` predicate.
- `bulk-entity-adapter.ts` — the `BulkEntityAdapter` interface, the per-type seam.
- `bulk-action-bar.ts` — `BulkActionBar`, the DOM glue: one instance per menu, adds the
  footer button + inline controls, applies row checkboxes, re-syncs after each re-render.
- `bulk-delete-confirm.ts` — builds the confirmation from a cascade summary.

Each menu supplies a `BulkEntityAdapter`. **The adapter's logic lives in that menu's own
controller**, not in the generic module: a migrated menu's controller assembles the adapter
inline and passes it to `BulkActionBar`, with its delete cascade and summary kept in a
co-located, unit-tested `*-cascade.ts` that single-delete reuses too (so the two delete
paths can't diverge).

Legacy plain-JS menus (`public/modules/ui/*.js`) load as `<script>` tags and can't import
ES modules, so they reach the bar through `legacy-bridge.ts`, which registers
`window.bulkBars` — the same `window.X` pattern already used for `window.tip`/`window.COA`.
A legacy menu calls `window.bulkBars.mount(type, {redraw})` on open and
`window.bulkBars.sync(type)` after each row-render. Their adapters still sit under
`bulk-action/adapters/`; that, and the bridge itself, are removed when each menu migrates
to TS.

## Cascade fidelity

For migrated menus (States, Cultures, Religions, Regiments) the single-delete data
mutations were extracted into the pure `*-cascade.ts` now shared by single and bulk delete.
Provinces' single delete was a legacy closure that couldn't be imported, so its mutations
are reimplemented in its adapter and matched against the original. Burgs, Markers, Routes,
Zones, Markets, and Rivers delegate to their existing remove functions.

A regiment's `i` is unique only within its state, so regiment rows encode a composite id
(`stateId * 100000 + regimentId`) the adapter decodes.

## Data model

- `Route` gains an optional `lock?: boolean` so routes can be bulk locked/unlocked.

## Removed

- Burgs "Remove All" button — replaced by "select all → Delete".
- Zones erase-mode toggle, its `dragZoneBrush` erase branch, and its orphaned Ctrl hotkey.

(The Rivers "Remove all" button is kept.)

## Acceptance criteria

- Each menu's footer has one bulk button; toggling it shows row checkboxes and the inline
  Select-all / count / action controls, and hides them again.
- Bulk delete shows the cascade summary, skips locked rows, and redraws once.
- "Also delete contained burgs" appears in States and Provinces only; default delete
  reassigns burgs to neutral.
- Lock/Unlock and Set color apply to the whole selection; Set color repaints the map.
- Non-deletable special rows (neutral state, "no religion"/"no market", capitals) are
  excluded from selection and select-all.
- `BulkSelection` and every menu's cascade/predicates are unit-tested.
