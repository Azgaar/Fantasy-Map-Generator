# PRD — Geographical Features Overview

## Background

`pack.features` holds every island, lake and ocean, but there is no place to see them as a list.
Lakes are reachable only by clicking one on the map (Lakes Editor); islands have no editor at all
since the Coastline Editor became a coast-shape tool; oceans have no UI anywhere.

The data model around features has drifted (see [glossary](../domain/glossary.md): Feature Type /
Subtype / Group):

- **Subtype is domain-meaningful, group is rendering-only** — generators read `subtype`
  (`population-generator.ts`, `goods-generator.ts`, `markers-generator.ts`, `provinces-generator.ts`),
  renderers read `group`. Two places violate this:
  - `lakes-editor.ts` `assignGroup`: picking a stock group silently rewrites `subtype`.
  - `NON_NAVIGABLE_LAKE_GROUPS` (`features.ts`, used in `burgs-generator.ts`) decides port
    navigability from `group`.
- **Custom lake groups are half-broken.** The Lakes Editor creates `<g>` elements under `#lakes`,
  but `stylesSchema.lakes` is a `strictObject` of the six stock groups, so a custom group's style is
  never persisted. `isLakeType` treats any `#lakes > g` as a stock group, so custom groups can't be
  removed and their name leaks into `subtype`.
- **Oceans are second-class.** `Features.defineGroups` skips them (`defineOceanSubtype` is dead
  code): no subtype, no group, no `#feature_N` path, excluded from `MapEntities.collect("feature")`.
- `data-model.md` still says features can be moved between groups in the Coastline Editor.

## Goals

1. A standard overview dialog listing every feature — islands, lakes and oceans — with name,
   type, subtype, group, area and a note action.
2. Rename any feature; change subtype (from the fixed set) and group (lakes only, existing groups).
3. Two-way highlight: hover a row → outline on the map; hover the map → row highlight.
4. Make group purely a rendering parameter everywhere: drop the subtype rewrite in the Lakes
   Editor, move navigability to `subtype`.
5. Make custom lake groups first-class in the styles store, the same way route groups are.

## Non-goals

- Adding or removing features — that is the Heightmap Editor's job.
- User-defined subtypes. The subtype set is fixed per type.
- Editing island groups. `sea_island` / `lake_island` stay derived from geography.
- Promoting oceans to first-class (subtype, outline, children such as seas and gulfs). Oceans are
  listed read-only; a later feature hierarchy may build on this.
- Feature labels on the map. Feature names are data only (tooltips, notes, omnibar).

## Data model

No new fields. Rules made explicit:

- `feature.subtype` — fixed set per type. Island: `continent | island | isle | lake_island`.
  Lake: `freshwater | salt | dry | sinkhole | frozen | lava`. Ocean: unset.
- `feature.group` — lake: any `#lakes > g` id (stock or custom); island: `sea_island` or
  `lake_island`, derived; ocean: unset.
- `feature.name` — optional; deleted when renamed to empty. Display name falls back to
  `MapEntities.getName` → `"{subtype || type} {id}"`.
- Changing subtype has **no cascade**: ports, goods, markers stay as they are until the user
  regenerates them, like every other editor.

### Styles

`styles.lakes` becomes `{ groups: Record<string, LakeStyle> }` (mirrors `routes`, `labels`):

- `styles-schema.ts`: `lakes: z.strictObject({ groups: z.record(z.string(), lake) })`.
- `default-styles.json`, `styles-legacy.ts` path map (`#freshwater` → `["lakes","groups","freshwater"]`),
  legacy harvesting of `#lakes > g` (as done for `#routes > g`), fixtures.
- Lakes Editor create/rename/remove group also writes/deletes `styles.lakes.groups[name]`, seeded
  from `freshwater` (route-groups-editor pattern). `isLakeType` → `Object.keys(Styles.defaults.lakes.groups)`.
- Style Editor: no change — it already reads lake groups from the DOM.

## UI

Controller `src/controllers/features-overview.ts`, `Controllers.FeaturesOverview`, dialog id
`featuresOverview`. Built on `initEditorTable` / `renderEditorHeader` / `applyLineHighlighting`
like `rivers-overview.ts`.

Entry points: Tools tab button `overviewFeaturesButton` ("Features"), command
"Open Geographical Features Overview" (aliases: islands lakes oceans landmasses water bodies),
hotkey `Shift + F`. Dialog title "Geographical Features Overview".

### Columns

| Column | Content | Editable |
| --- | --- | --- |
| locate | zoom to the feature's vertex bbox (`highlightArea`) | islands, lakes |
| name | text input, placeholder `{subtype \|\| type} {id}` | all |
| type | `island` / `lake` / `ocean` | no |
| subtype | select from the fixed set | islands (except `lake_island`, shown as text), lakes |
| group | select of existing `#lakes > g` ids | lakes only; islands show text, oceans blank |
| area | `getArea(feature.area)` + unit | no |
| note | `Notes.getIcon` → Notes Editor `{type:"feature", id}` | all |
| edit | opens the Lakes Editor on the lake's `<use>` | lakes only |

Default sort: area desc. Footer: `n of total`, total area of the filtered set.

### Filters

- Type select: `all | island | lake | ocean`.
- Subtype select: options depend on the chosen type; `all` when type is `all`.
- Search: matches name (or placeholder), type and subtype.

Filter state persists through `dialogState` like the other overviews.

### Highlight

- Row hover → `highlightOutline(#feature_N d)`; nothing for oceans (no path).
- Map hover → `applyLineHighlighting(dialogId, ({cellId}) => pack.cells.f[cellId])`; works for
  oceans too.

### Edits

- Rename: writes `feature.name`, deletes it when empty.
- Subtype: writes `feature.subtype` only.
- Group (lake): writes `feature.group`, moves the `<use>` to the new `<g>` (or `Layers.draw("lakes")`).

## Related changes

- Lakes Editor: "Type" select relabelled "Group"; `assignGroup` no longer touches `subtype`; new
  "Subtype" select; group create/remove keep `styles.lakes.groups` in sync.
- `NON_NAVIGABLE_LAKE_GROUPS` → `NON_NAVIGABLE_LAKE_SUBTYPES`, read from `subtype`.
- `MapEntities.feature.collect` stops excluding oceans so they can carry notes.
- `data-model.md` feature section: group is rendering-only, editable in the Lakes Editor and the
  Features Overview; subtype is the classification.

## Open questions

None.
