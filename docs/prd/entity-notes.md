# PRD — Notes on Entities

## Background

Notes (legends) live in a global `notes: {id, name, legend}[]` array, keyed by **SVG element id**:
`burg12`, `marker7`, `regiment3-1`, `stateLabel5`, `river22`. The array is a side table — nothing
links a note to the entity it describes except a string convention, and nothing validates that the
string resolves to anything.

The consequences are structural, not incidental:

- **Orphans by deletion.** Only burgs, markers, regiments and added labels clean up their notes.
  Removing a river, route, lake, province or state leaves the note behind. Since ids are indices,
  the orphan then silently re-attaches to whatever new entity takes that index.
- **Manual lifecycle sync.** Roughly ten blocks exist only to keep the side table aligned: burg
  renumbering (`burgs-generator.ts:787-909`), regiment id rewrite on state merge
  (`states-editor.ts:1698`), the duplicate-marker-id patch (`load.ts:641`), marker removal,
  added-label removal, resample splicing.
- **Lake notes are broken.** `draw-lakes.ts:13` renders `<use href="#feature_N" data-f="N">` with no
  `id`, but `lakes-editor.ts:343` still reads `selectedLake.attr("id")` → `null`, and
  `notes-editor.ts:53` then falls back to `notesList[0].id`. The Legend button on a lake edits an
  unrelated note.
- **`note.name` is a shadow name.** `Marker` has no `name` field; five call sites read the note's
  name as the marker's title (`markers-in-radius.ts`, `markers-overview.ts`, `export.ts:759`,
  `zones-generator.ts:440`, `battle-screen.ts:1363`).
- **Duplicate notes.** A river can carry two: `river{i}` from the river editor and `riverLabel{i}`
  from the label editor. Same for routes.
- **Linear lookups.** `markers-in-radius` scans the whole array per marker.

`notes` is touched in 82 places across 31 files.

## Goals

1. Replace the global array with an optional `note?: string` field (HTML) on the entity itself.
2. Delete `globalThis.notes` and the `.map` notes slot.
3. Make unattached notes structurally impossible: no note exists without an entity.
4. Widen note support from 9 entity types to 17, so most user-facing entities can carry one.
5. Give markers a real `name` field.
6. Migrate existing maps in one version step, handing back anything unattachable as a CSV download.

## Non-goals

- Changes to the rich-text editor itself (the Quill rework is a separate branch).
- Preserving `.map` field 4 for third-party tools.
- Notes on configuration objects (burg/route/label groups, transports, name bases).
- Per-note titles independent of the entity name.
- Notes on cells or vertices.

## Data model changes

`note?: string` — optional, absent when empty, HTML as today.

### Tier 1 — migrated from the existing array

| Entity | Field | Old note id |
| --- | --- | --- |
| Burg | `pack.burgs[i].note` | `burg{i}` (and `burgLabel{i}` defensively) |
| Marker | `pack.markers[i].note` | `marker{i}` |
| State | `pack.states[i].note` | `stateLabel{i}` |
| Province | `pack.provinces[i].note` | `provinceLabel{i}` |
| River | `pack.rivers[i].note` | `river{i}` **+** `riverLabel{i}` |
| Route | `pack.routes[i].note` | `route{i}` **+** `routeLabel{i}` |
| Regiment | `pack.states[s].military[j].note` | `regiment{s}-{i}` |
| Added label | `pack.addedLabels[i].note` | `addedLabel{i}` |
| Feature (lake) | `pack.features[i].note` | unreachable — see Background |

### Tier 2 — new, hoverable

These have their own SVG element with a stable id, so they get tooltip + editor button at no extra
resolver cost:

| Entity | Field | Element id |
| --- | --- | --- |
| Zone | `pack.zones[i].note` | `zone{i}` (`draw-zones.ts:19`) |
| Journey | `pack.journeys[i].note` | `journey{i}` (`draw-journeys.ts:33`) |
| Market | `pack.markets[i].note` | `market{i}` (`draw-markets.ts:49`) |
| Feature (island, ocean) | `pack.features[i].note` | `feature_{i}` |

### Tier 3 — new, editor-only

No hoverable element of their own — painted across cells, or drawn per burg. The note is reachable
from the entity's row and from the Notes Editor, never from hover. These are documentation fields,
not legends.

`pack.cultures[i].note`, `pack.religions[i].note`, `pack.biomes[i].note`, `pack.goods[i].note`

### Excluded

`cells`, `vertices`, `ice` (decorative, unnamed), `relief` (scenery), `deals` (derived),
`measurers` (no id, no name — a ruler's text is its own annotation), and every configuration
object. World-level prose already has a home in `options.map.lore.description`.

### `Marker.name`

`Marker` gains `name: string` (required). The ~60 `notes.push({id, name, legend})` calls in
`markers-generator.ts` already compute the name — they set `marker.name` and `marker.note` directly.

## Note resolution

`src/components/map-entities.ts` maps SVG elements to shared entity references and provides names, context, positions, and geometry. Tooltips, the Notes Editor, map search, and migration use this lookup:

```
burg{i} | burgLabel{i}   → burgs[i]
marker{i}                → markers[i]
stateLabel{i}            → states[i]
provinceLabel{i}         → provinces[i]
river{i} | riverLabel{i} → rivers[i]
route{i} | routeLabel{i} → routes[i]
regiment{s}-{i}          → states[s].military[j] where j.i === i
addedLabel{i}            → addedLabels[i]
feature_{i}              → features[i]
zone{i}                  → zones[i]
journey{i} | segment{i}_{j} → journeys[i]
market{i}                → markets[i]
```

A companion `getEntityLabel(ref)` returns the display name (`burg.name`, `state.fullName`,
`regiment.name`, `feature.name`, `addedLabel.label.text`, …). This replaces `note.name` as the
tooltip header and the Notes Editor list label.

Tier 3 entities are absent from the table by design — they have no element to hover.

## Notes Editor

Becomes an aggregate view over the entity collections rather than a view over one array:

- The element `<select>` is built by walking every note-bearing collection, grouped by entity type
  and labelled with `getEntityLabel`. Ordering changes from insertion order to type-grouped.
- The name input is removed; the header shows the entity name, read-only.
- Remove clears the entity's `note` field.
- Focus keeps working — the resolver runs in reverse to produce an element id.
- Download and upload move to CSV with columns `type,id,note`. Upload rejects rows whose entity does
  not exist and reports the count; it can no longer introduce an unattached note.
- The empty state message stays accurate: notes come from entity editors.

## Entity editors

Both button patterns already exist in the codebase, so no new UI vocabulary:

- **Per-entity dialogs** (burg, river, route, lake, marker, regiment, label, journey, market) — an
  `icon-edit` toolbar button, as in `burg-editor.ts:234`.
- **Table editors** (states, provinces, cultures, religions, zones, biomes, goods) — an icon in the
  existing `data-col="actions"` strip, as in `provinces-editor.ts:337`.

The button is always present, since it is the only way to create the first note. It renders
`inactive` when the entity has no note, matching the existing convention
(`icon-pin ${focused ? "" : "inactive"}`).

## Migration

One `isOlderThan("1.152.0")` block in `auto-update.ts`. It runs before `notes` would be assigned at
`load.ts:269`, so it reads `data[4]` directly.

1. Parse `data[4]`. Resolve each note through the resolution table.
2. Concatenate river/route duplicates into the single owner field, in element-then-label order.
3. If `note.name` differs from the owner's name, prepend `<h3>{name}</h3>` to the legend so a
   custom title is never lost.
4. Copy marker note names to `marker.name`. For markers with no note, generate from
   `marker.type` — matching the existing fallback in `markers-in-radius.ts:28`
   (`note?.name || marker.type || "Marker"`).
5. Collect unresolved notes. After load completes, show a dialog offering a CSV download
   (`id,name,legend`) with a Discard option. Do not download silently mid-load.
6. Clear `data[4]`.

Lake notes from old maps are keyed by an element id that has not existed for a long time; they land
in the CSV bucket, which is the honest outcome given the feature has been broken.

## Feature note restoration

`Features.markupPack()` rebuilds features from scratch, so a heightmap edit would drop lake notes.
`heightmap-editor.ts:595` already solves the same problem for zones by snapshotting **grid** cells
(`pack.cells.g[i]`) before the rebuild and restoring after. Reuse that shape:

1. Before `markupPack()`, snapshot each feature that carries anything worth keeping: its grid cells
   plus `{name, note, group}`.
2. After the rebuild, match each snapshot to the new feature holding the most of those grid cells,
   subject to a minimum overlap so a vanished lake cannot claim an unrelated one.
3. Restore on the match; drop the rest.

Feature **names** are lost on heightmap edit today for the same reason. The restore function should
cover `name` alongside `note` — it is the same lookup. Serves `heightmap-editor.ts:608`,
`resample.ts:476` and `load.ts:304`.

## Backward compatibility

- `data[4]` is written as `""` from this version on. Third-party tools reading it break; accepted.
- The gate assumes 1.152.0 is unreleased (master is on 1.151.2). If 1.152.0 ships before this lands,
  the gate must become `isOlderThan("1.152.1")`, or maps saved by released 1.152.0 skip the
  migration and lose every note.
- `export-json.ts` drops its top-level `notes` key; notes ride inside the entity objects in both the
  full and minimal exports.
- GeoJSON marker export (`export.ts:759`) replaces the note spread with `name` and `note` properties.

## Out of scope / future work

- A search across all notes.
- Notes on cells, or on arbitrary map coordinates (an added label already covers "a note here").
- Reworking the AI generator prompt beyond swapping `note.name` for the entity name.
- Restoring feature notes across a **resample** (only the heightmap-edit path is in scope).

## Files affected

### Modified — data model

- `src/generators/markers-generator.ts` — add `name` to `Marker`; set `name`/`note` on the ~60 push
  sites; drop the note removal in `remove`/`deleteMarker`.
- `src/generators/burgs-generator.ts` — add `note?` to `Burg`; delete the note filter and the two id
  remaps at `:787-909`.
- `src/generators/states-generator.ts`, `provinces-generator.ts`, `river-generator.ts`,
  `routes-generator.ts`, `features.ts`, `zones-generator.ts`, `markets-generator.ts`,
  `cultures-generator.ts`, `religions-generator.ts`, `biomes-generator.ts`, `goods-generator.ts`,
  `added-labels.ts`, `src/types/Journey.ts` — add `note?`.
- `src/generators/military-generator.ts` — add `note?` to `Regiment` (`:9`); set it in
  `generateNote`; keep the
  deliberate wipe at `:450` (regenerated regiments cease to exist), now a field reset.
- `src/generators/added-labels.ts:33` — drop the note filter on remove.
- `src/generators/resample.ts` — drop `notes` from the parent-map snapshot type and the splice at
  `:280`.
- `src/generators/features.ts` — feature note/name restoration helper.

### Modified — UI

- `src/controllers/notes-editor.ts` — aggregate list, entity-name header, CSV upload/download.
- `src/controllers/markers-editor.ts`, `markers-overview.ts` — read `marker.name`/`marker.note`;
  drop the note filters at `markers-overview.ts:390,411`.
- `src/controllers/states-editor.ts` — delete the regiment note cleanup at `:985` and the id rewrite
  at `:1698` (the merge already spreads the regiment object, so `note` rides along); add the row
  note button.
- `src/controllers/lakes-editor.ts:343` — resolve the feature via `data-f`, fixing the null-id bug.
- `src/controllers/burg-editor.ts`, `river-editor.ts`, `route-editor.ts`, `regiment-editor.ts`,
  `labels-editor.ts` — pass an entity reference instead of an element id.
- `src/controllers/provinces-editor.ts`, `cultures-editor.ts`, `religions-editor.ts`,
  `biomes-editor.ts`, `zones-editor.ts`, `goods-editor.ts`, `markets-overview.ts`,
  `journey/journey-editor.ts` — new note button.
- `src/controllers/markers-in-radius.ts`, `battle-screen.ts` — read `marker.name`.
- `src/components/map-tooltip.ts:45` — resolve through the new module.
- `src/components/undraw.ts:12`, `globals.ts:7,13` — remove the global.
- `src/controllers/index.ts` — `NotesEditor.open` signature.

### Modified — IO

- `src/services/io/auto-update.ts` — the migration block; update the two legacy note rewrites at
  `:621` and `:1385` to write the entity field.
- `src/services/io/load.ts` — drop `data[4]` parsing and the note patch at `:641`.
- `src/services/io/save.ts` — write `""` for `data[4]`; the used-fonts scan at `:72` walks entities.
- `src/services/io/export-json.ts` — drop the `notes` key.
- `src/services/io/export.ts:759` — GeoJSON marker properties.

### New

- `src/components/notes.ts` — note get/set/clear and aggregation for the editor and font scan.
- `src/components/map-entities.ts` — shared entity definitions, lookup, references, names, context, geometry, and SVG resolution.

### Docs

- `docs/architecture/data-model.md` — replace the Notes section with the per-entity field; add
  `name` to Marker.
- `docs/domain/glossary.md` — Note entry.
- `docs/wiki/Knowledge Base.md` — lines 61, 745: the upload format and the "every map object can
  have a note" claim, now literally true for more objects.

### Tests

- `src/services/io/auto-update.test.ts` — migration: resolution, duplicate concatenation, name
  folding, marker names, orphan collection.
- `src/generators/markers-generator.test.ts` — markers get names.
- `src/generators/resample.test.ts`, `added-labels.test.ts`, `src/services/fonts.test.ts`,
  `src/components/configuration.test.ts` — drop `globalThis.notes`.
- `src/controllers/notes-rich-text.test.ts` — unchanged, verify.
- New: feature note restoration across a heightmap edit.
- `tests/e2e/notes-editor.spec.ts`, `tests/e2e/load-map.spec.ts` — update.

## Acceptance criteria

1. `globalThis.notes` does not exist; `grep -rn "\bnotes\b" src` returns only the migration and CSV
   code paths.
2. Loading a pre-1.152.0 map attaches every resolvable note to its entity, concatenates river and
   route duplicates, and folds divergent note names into the legend as a heading.
3. Loading a map with unresolvable notes offers a CSV download listing exactly those notes; the map
   loads with them dropped.
4. Every marker has a non-empty `name` after migration and after generation.
5. Removing a river, route, lake, province or state removes its note with it; no note survives its
   entity, and a newly created entity at the same index has no note.
6. Merging two states keeps every regiment note.
7. A heightmap edit that preserves a lake's shape preserves its note and name.
8. Hovering an element of any Tier 1 or Tier 2 entity with a note shows the note box, headed by the
   entity name.
9. Every entity type in the table has a working note button in its editor, `inactive` when unset.
10. The Notes Editor lists notes from all collections grouped by type; upload accepts entity-addressed
    CSV rows and reports rejected ones.
11. A saved and reloaded map round-trips every note.
