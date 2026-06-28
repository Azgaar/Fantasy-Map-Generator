# PRD — Bulk Action Bar

## Background

Every list-style overview/editor dialog acts on one entity at a time. Deleting twelve states
means opening the States editor and clicking the trash icon twelve times, confirming each.
The same holds for burgs, provinces, cultures, religions, regiments, markers, routes, zones,
and markets. Two menus had grown inconsistent one-off shortcuts — a "Remove All" button in
Burgs and an erase-mode toggle in Zones — that exist nowhere else and are all-or-nothing.

## Goals

- A single reusable multi-select control on every list menu: reveal per-row checkboxes and a
  filter-aware "select all", then apply a bulk action to the selection.
- Bulk **Delete**, **Lock**, **Unlock**, and **Set color** (color only where the entity type
  has one).
- Bulk delete reuses each type's existing single-delete cascade, behind one confirmation
  dialog that summarizes the effect (counts + cascade) and reports locked rows it will skip.
- Locked rows are protected from bulk delete (a cheap safety net given there is no undo).
- For States and Provinces, an optional "also delete contained burgs" choice.
- The selection logic and the destructive cascades are unit-tested independently of the DOM.

## Non-goals

- Cross-type selection (selecting states and markers together). Selection is scoped to the
  open menu.
- Type-specific bulk edits beyond Lock/Unlock/Set color (e.g. reassigning burgs to another
  state, bulk culture/religion changes).
- A real undo/redo system. Lock-protection plus an explicit confirmation are the safety model.

## Architecture

New shared module `src/controllers/bulk-action/`:

- **`bulk-selection.ts`** — `BulkSelection`, a pure, DOM-free selection set: toggle/add/remove,
  filter-aware select-all over a supplied id set, `isSelected`/`getSelected`/count, with a
  `canSelect` predicate that keeps non-deletable rows (e.g. neutral state 0) out of any
  selection.
- **`bulk-entity-adapter.ts`** — `BulkEntityAdapter`, the per-type seam (the only
  type-specific code). Each adapter exposes `type`, `containerId`, `getRowId(row)`,
  `isDeletable(id)`, `isLocked(id)`, optional `setLock`/`setColor`/`supportsColor`/`childKind`,
  `deleteEntity(id, options)`, `describeCascade(ids, options)`, and an injected `redraw`.
- **`bulk-action-bar.ts`** — `BulkActionBar`, the DOM glue. Adds a top-right "Bulk Options"
  toggle that reveals per-row checkboxes plus an inline toolbar (Select all / N selected /
  Delete / Lock / Unlock / Set color, as the adapter supports). The toolbar persists across
  actions and the selection is kept (deleted rows drop off), so actions can be chained. One
  instance per menu; re-syncs after the list re-renders.
- **`bulk-delete-confirm.ts`** — builds the confirmation dialog from a cascade summary; for
  types with a `childKind`, offers an "also delete contained &lt;child&gt;" checkbox with a
  live-updating summary.
- **`adapters/`** — one adapter per type.

### Attaching to two layers

The target menus are split between migrated TypeScript controllers (`src/controllers/`) and
legacy plain-JS modules (`public/modules/ui/*.js`) that load as `<script>` tags and cannot
import ES modules. Migrated menus construct a `BulkActionBar` directly. Legacy menus reach it
through `src/controllers/bulk-action/legacy-bridge.ts`, which registers `window.bulkBars`
(eagerly, via `src/controllers/index.ts`) — the same `window.X` cross-layer pattern already
used for `window.COA`, `window.tip`, `window.ensureEl`. A legacy menu calls
`window.bulkBars.mount(type, {redraw})` on open and `window.bulkBars.sync(type)` after each
row-render. The bridge is a deliberate, temporary seam: a menu drops it for the direct path
once migrated to TS, and the bridge is removed once all are migrated.

## Cascade fidelity

Bulk delete must match single delete exactly. For each migrated type the single-delete data
mutations were extracted into a pure, DOM-free `*-cascade.ts` now shared by both the editor's
single delete and the adapter's bulk delete (States, Cultures, Religions, Regiments), so the
two cannot diverge. Provinces' single delete lived in a legacy closure that could not be
imported; its data mutations are reimplemented in the adapter and matched against the original
(cell release, owner-state list, emblem/COA/SVG cleanup, `removed` marking). Burgs, Markers,
Routes, Zones, and Markets delegate to their existing global/module remove functions.

A regiment's `i` is unique only within its owning state, so regiment rows encode a composite
id (`stateId * 100000 + regimentId`) that the adapter decodes.

## Shared edits

- **Lock / Unlock** are explicit, separate actions (a selection may mix locked and unlocked
  rows) applied to every selected row, available wherever the type has a lock field.
- **Set color** opens one color picker and applies the chosen color to every selected entity.
  Offered only for color-bearing types (States, Provinces, Cultures, Religions, Zones,
  Markets). Each type's bulk redraw repaints its map layer so the change shows immediately, not
  just in the list swatch.
- Bulk delete skips locked rows and reports how many were skipped in the confirmation.
- Deleting a state/province reassigns its burgs to neutral by default; the "also delete
  contained burgs" option removes them instead. A deleted state's former capital is re-grouped
  out of the capital group so its icon is demoted to a regular burg.

## Data model changes

- `Route` gains an optional `lock?: boolean` (`src/generators/routes-generator.ts`) so routes
  can participate in bulk Lock/Unlock.

## Backward compatibility

The bar replaces and removes two ad-hoc controls:

- Burgs "Remove All" button and `triggerAllBurgsRemove` — reproduced by "select all → Delete".
- Zones erase-mode toggle (`zonesRemove`), its `dragZoneBrush` erase branch, and the orphaned
  Ctrl hotkey handler.

Non-deletable special rows (the neutral state, "no religion"/"no market" id 0, capitals in
Burgs) stay excluded from selection, matching existing single-delete rules.

## Out of scope / future work

- Migrating the legacy menus to TS (which would delete `window.bulkBars`).
- Cross-type selection; type-specific bulk edits; undo/redo.

## Files affected

### Added — `src/controllers/bulk-action/`
- `bulk-selection.ts`, `bulk-entity-adapter.ts`, `bulk-action-bar.ts`, `bulk-delete-confirm.ts`,
  `legacy-bridge.ts`
- `adapters/{states,cultures,religions,regiments,markets,burgs,provinces,markers,routes,zones}-adapter.ts`
- `adapters/{states,cultures,religions,regiments}-cascade.ts`

### Modified
- `src/controllers/index.ts` (eager bridge import)
- `src/controllers/{states,cultures,religions}-editor.ts`, `regiment-editor.ts`,
  `regiments-overview.ts`, `markets-overview.ts` (extract cascade / attach bar)
- `src/generators/routes-generator.ts` (`lock` field)
- `src/index.html` (drop `burgsRemoveAll`, `zonesRemove` buttons)
- `public/index.css` (bar styles)
- `public/modules/ui/{burgs-overview,provinces-editor,markers-overview,routes-overview,zones-editor,hotkeys}.js`
  (bridge mount/sync; remove ad-hoc controls)

### Docs
- `docs/architecture/architecture.md` (the `window.bulkBars` bridge)
- `docs/domain/glossary.md` (Bulk Action Bar term)

### Tests
- `bulk-selection.test.ts` and a `*.test.ts` per adapter/cascade (selection behavior, cascade
  summaries, lock-resists-delete, child-burg counts).

## Acceptance criteria

- In each menu, "Bulk Options" reveals per-row checkboxes, filter-aware select-all works, and
  the toolbar toggles.
- Bulk delete shows the cascade summary, skips locked rows, and redraws once.
- The "also delete contained burgs" option appears in States and Provinces only and behaves as
  described; default delete reassigns burgs to neutral.
- Lock/Unlock and Set color apply to the whole selection; Set color repaints the map.
- Non-deletable special rows are excluded from selection and select-all.
- The old Burgs "Remove All" and Zones erase-mode are gone with no dangling references.
- `BulkSelection` and every adapter/cascade are unit-tested.
