# PRD — Relief Icon Pools

Updated: 2026-09-27. Status: implemented. Follows [Icon Library](icon-library.md), which made every icon slot a bare icon reference
and left relief out of it ("a relief feature cannot take a Custom icon or a glyph"). Terms follow the
glossary: Icon Library, Icon Set, Glyph, Custom icon, Icon reference; new terms are defined below.

## Problem Statement

A map author who draws or finds their own relief art — a hand-drawn forest, a stylised dune, a pictogram
for a swamp — cannot put it on the map in a way that lasts:

- **Individual relief icons** can only be a type slot (`mount`, `conifer`, …) drawn from one of the five
  built-in relief sets. A Custom icon, a glyph or another set's art (a goods tree, a burg ruin) cannot be
  placed as relief at all.
- **Generated relief** comes from each biome's icon pool, a hard-coded table (`weightedIcons` in
  `biomes-generator.ts`): Hot desert places dunes, cacti and dead trees in fixed proportions; Taiga places
  only snowy conifers. The pool is stored with the map (`pack.biomes[].icons`) but nothing in the interface
  shows or edits it, and neither is the biome's relief density (`iconsDensity`). A custom biome is created
  with an empty pool and a density of 0, so it never gets relief.
- The pool is stored as a list with repeats (`["dune", "dune", "dune", "cactus", …]`), a format that is
  awkward to read and to edit.

So an author cannot have their own forests at all, nor change what a biome grows, and an author who adds
a custom biome cannot give it vegetation. It is a long-standing request.

## Solution

Two complementary ways to use any icon from the Icon Library as relief:

1. **Per icon** — a relief icon holds either a relief type slot, as today, or an **icon reference** to
   anything in the Icon Library. A button in the Relief Editor's bottom line opens the shared icon picker
   and gives the selected relief icon the picked icon.
2. **Per biome** — every biome's **relief pool** becomes editable in the Biome Editor: which entries a
   biome's lowland relief is generated from, with a weight each, and how dense it is. An entry is a relief
   type (drawn in whatever set the style uses) or any icon reference. Generation draws from the pool, so a
   regenerated map keeps the author's art; the author can re-place one biome's relief after changing its
   pool without losing edits elsewhere.

This replaces per-type icon overrides in the relief style, which were prototyped and dropped: the biome is
the right owner, because the pool is where generation already decides what grows where.

## Glossary additions

- **Relief pool**: A biome's weighted list of what its lowland relief is generated from. Each **pool entry**
  is a relief type or an icon reference, with a positive integer weight. _Avoid_: weighted icons, icon list
- **Relief density**: How packed a biome's lowland relief is (`iconsDensity`); 0 places none.
- **Lowland relief**: The relief a biome's pool places, on land below height 50. Hills and mountains above
  it are placed by elevation, not by biome.

## User Stories

1. As a map author, I want to give a single relief icon a Custom icon, so that I can place my own art as
   relief.
2. As a map author, I want to give a relief icon any icon from the library — a glyph, a goods or burg
   icon — so that I can reuse art the app already ships.
3. As a map author, I want one button in the Relief Editor for picking any icon, so that the editor stays
   as simple as it is for the built-in types.
4. As a map author, I want the relief type tiles in the Relief Editor unchanged, so that the common case
   costs nothing new.
5. As a map author, I want generated relief, not brushing, to be how my art covers large areas, so that it
   follows the biomes and survives regeneration.
6. As a map author, I want to see each biome's relief pool in the Biome Editor, so that I know why a
   biome looks the way it does.
7. As a map author, I want to add a relief type to a biome's pool, so that, for example, my grassland
   also grows a few deciduous trees.
8. As a map author, I want to add any icon from the library to a biome's pool, so that generated relief
   uses my own art.
9. As a map author, I want to set a weight for each pool entry, so that I control how common each icon is.
10. As a map author, I want to remove an entry from a pool, so that a biome stops growing something.
11. As a map author, I want a relief type in a pool to follow the style's relief set, so that switching the
    set restyles generated relief exactly as it does today.
12. As a map author, I want to set a biome's relief density, so that a sparse steppe and a dense jungle
    look different.
13. As a map author, I want to give a custom biome a pool and a density, so that it gets relief like the
    built-in biomes.
14. As a map author, I want to re-place one biome's relief after editing its pool, so that I see the result
    without losing manual edits in other biomes.
15. As a map author, I want pool changes to stay out of the map until I ask, so that editing a pool never
    discards my hand-placed relief silently.
16. As a map author, I want a regenerated relief layer to use my pools, so that my art survives a density
    change or a heightmap edit.
17. As a map author, I want my pools saved with the map, so that a shared map regenerates with the same art.
18. As a map author, I want old maps to open with the same relief pools they had, so that nothing changes
    on upgrade.
19. As a map author, I want a map generated with the default pools to look exactly as it did before this
    change, so that seeds keep reproducing the same map.
20. As a map author, I want removing a Custom icon to tell me how many relief icons, relief pools and
    relief rules use it, so that I know what will lose its art.
21. As a map author, I want "Restore defaults" in the Biome Editor to restore the default pools and
    densities too, so that I can undo my relief setup.
22. As a contributor, I want the relief type tiles to be one shared module used by the Relief Editor and
    the pool dialog, so that both show relief the same way.

## Implementation Decisions

### Per-icon references

- `ReliefIcon` is a type slot or a library reference plus its placement:
  `({ type, variant?, set? } | { icon: string }) & { x, y, s }`. A library reference is any icon reference;
  it is drawn as it is and ignores the style's set. Stored as plain JSON in `pack.relief`, as today.
- `Relief.symbolId(icon, styleSet)` returns the reference a feature draws: its own `icon`, else the slot in
  its pinned set or the style's set. The renderer writes every `<use>` through `Icons.href`, cached per draw,
  so a set icon from another family starts its chunk; `requiredIconSets` still covers only relief sets.
- Custom icons are fitted to their frame, so the renderer's square box holds them as it holds set art. A
  Custom icon keeps its own paint; art that leaves paint open inherits the relief group's stroke, as every
  styled slot does.
- Relief Editor: one button in the bottom line opens the shared icon picker for the selected icon (current:
  its reference, if it has one) and replaces it in place with the picked reference. The type tiles and the
  brushes are unchanged; the set selector does nothing for an icon drawn with a reference (there is no set
  to pin). Bulk removal by a type tile never matches a reference, and "Any" removes it with the rest.
- `Icons.uses` counts relief icons (`relief`) so removing a Custom icon reports them.

### Relief pool model

- `Biome.icons` becomes a weight record, `Record<string, number>`: `{ dune: 3, cactus: 6, deadTree: 1 }`,
  `{ grass: 8, "custom-1a2b3c4d": 2 }`. Keys are unique by construction, the order is the author's
  insertion order, and weights are positive integers. `iconsDensity` keeps its name and meaning.
- A key is a **relief type** when `Relief.isType(key)` holds, else an icon reference. The namespaces cannot
  collide: types carry no `-`, every icon reference does.
- The default pools in `biomes-generator.ts` become records directly; the expansion into a repeated list
  is deleted.
- An empty pool places no lowland relief, whatever the density. (Today an empty pool with a non-zero
  density falls back to grass; no shipped biome reaches that path.)

### Generation

- `Relief.generate` picks a pool entry with **one** random roll against the cumulative weights in record
  order. For a default pool this selects the same entry as the current index into the repeated list, so
  default maps reproduce exactly; a type entry then rolls its variant as today. A reference entry yields
  `{ icon }` and makes no variant roll.
- Elevation relief (hills, mountains, snowy mountains on height ≥ 50) is unchanged and not pool-driven.
- `Relief.generate` gains a scope: re-placing a biome removes the icons whose anchor cell is in that biome
  and below height 50, places new ones for those cells from the current pool and density, and inserts them
  by anchor so the array stays the z-order. Icons elsewhere, including hand-placed ones, are kept. A full
  regeneration (the style's density slider, heightmap edits) uses the pools too.

### Biome Editor and the pool dialog

- A **Relief** column in the Biome Editor shows each biome's pool as up to three small tiles in weight
  order, a `+n` for the rest, and the density; an empty pool shows a dash. Clicking it opens the pool
  dialog for that biome. The column is hidden with the others in compact views, like `habitability`.
- The **pool dialog** (a controller of its own, injected into `#dialogs` on open):
  - Density: a number input (0–250, the shipped Wetland uses 250).
  - Entries: one line each — tile, name (a type's label or `Icons.name`), weight input, remove button.
  - Add: the relief type tiles drawn in the style's set, one per type (not per variant: a pool entry is a
    type, and the variant is rolled on placement); and an **Any icon…** button that opens the shared icon
    picker. Adding an entry that is already in the pool raises its weight by 1.
  - Buttons: **Apply** writes the pool and density; **Apply and re-place** also re-places the biome's
    lowland relief after a confirmation that names how many icons it will replace; **Cancel**.
- **Why a relief-specific chooser for types, and the shared picker for the rest**: the picker's Relief
  section lists concrete set symbols (`relief-gray-conifer-1`); picking one would pin the entry to one set
  and one variant, so it would stop following the style and lose variety. Types therefore come from relief
  tiles; everything else — Custom icons, glyphs, other sets, and a deliberately pinned set symbol — comes
  from the picker, unchanged.
- Relief art sits small in its frame (vegetation fills 10–40% of it), so previews of a type are cropped to
  the drawn art once its set is in the page, and painted in the relief style
  (`controllers/relief-previews.ts`, shared by the Relief Editor tiles, the pool dialog and the Biome Editor
  column).
- "Restore defaults" in the Biome Editor restores the default pools and densities with the rest of the
  biome data, as it does today; it does not re-place relief.
- A new custom biome still starts with an empty pool and density 0; the author fills it in the dialog.

### Icon uses

- `Icons.uses` adds a `biome` kind: the pools whose record has the reference as a key, and a `reliefRule`
  kind for the relief rules' icons. The picker's removal confirmation names them ("biome relief pool",
  "relief rule"). A removed Custom icon's pool entries stay and draw nothing, as references do in every
  other slot.

### Save, load and migration

- `pack.biomes` is already saved whole as JSON (field 3); no format change beyond the `icons` shape.
- The release's auto-update step converts an array pool to a record by counting repeats in order of first
  appearance. It runs after the 1.139.0 biome step (which builds biomes from the current defaults, already
  records), so it converts only arrays and leaves records alone.
- Superseded prototype: the relief style's `options.icons` field never shipped, so it needs no migration;
  it is removed from the schema, `default-styles.json` and the shipped presets.

### Delivery

Implemented on `icon-library` in three steps:

1. **Per-icon references.** The `ReliefIcon` union, the renderer through `Icons.href`, the Relief Editor's
   any-icon button, `Icons.uses` for relief.
2. **Pool model and generation.** The weight record, default pools as records, the one-roll weighted pick,
   reference entries, the empty-pool rule, the scoped re-place (`Relief.regenerateBiome`,
   `Relief.lowlandIcons`, `Relief.insert`), the migration and the `biome` use kind.
3. **Biome Editor.** The Relief column, the pool dialog (`controllers/relief-pool-editor.ts`), fitted
   previews, Apply and re-place.

## Testing Decisions

- Tests exercise behaviour through public interfaces: what ends up in `pack.relief` and `pack.biomes`, what
  the renderer draws, what the dialogs render and write.
- **Reproducibility:** a seeded map generated with the default pools yields the same `pack.relief` before
  and after the change (per-stage fingerprint against a master worktree, `CI=1`). Prior art: the seeded
  PRNG comparison tests.
- **Weighted pick:** with a stubbed roll, each entry is chosen across exactly its share of `[0, 1)`; a
  reference entry yields `{ icon }` with no variant roll; an empty pool places nothing.
- **Re-place:** only the chosen biome's lowland icons change; hand-placed icons in other biomes and all
  elevation relief keep identity and order; the array stays sorted by anchor.
- **Rendering:** a library icon draws its own reference; a type draws its pinned or the style's set.
  Prior art: `draw-relief-icons.test.ts`.
- **Relief Editor:** the any-icon button replaces the selected icon in place with the picked reference.
  Prior art: `relief-editor.test.ts`.
- **Pool dialog (DOM):** renders entries with their weights; adding a type adds a type key, adding a
  picked icon adds a reference key, adding an existing entry raises its weight; Apply writes the record
  and density; Cancel writes nothing.
- **Migration:** an array pool becomes the record with the same weights and first-appearance order; a record
  is left alone. Prior art: the auto-update tests.
- **Uses:** a reference used by relief icons and pools is counted in both kinds.
- The full unit and browser suites, `tsc` and Biome must pass; placing, brushing, pool editing, re-placing,
  save and reload, and a raster export with a Custom icon in relief are checked in the browser.

## Out of Scope

- **Elevation relief pools.** Hills and mountains stay type-driven; custom mountain art is placed per
  icon. A later "highland pool" per biome can extend the same model.
- **Per-type overrides in the relief style** (the prototype this replaces).
- **Carrying pools to a new map.** Biomes are map state and a new map starts from the default biomes, as
  their names, colours and habitability already do.
- **Pool entries pinned to a set by type** (`conifer` in the gray set): a pinned set symbol from the picker
  covers the need for a single variant.
- **Biome CSV export and import** of pools.
- **Per-entry size or spacing**; all entries share the biome's density and the generated size.

## Further Notes

- `docs/architecture/data-model.md` documents `iconsDensity` as `0` to `150`, but the shipped Wetland uses
  250; the pool dialog allows 250 and the doc should say so.
- The relief-specific chooser is deliberately small: once the shared picker can return a logical relief
  type, the pool dialog could use it alone. That needs the picker to know about slots that want types,
  which the Icon Library PRD ruled out ("the picker has no per-slot variations"), so it is not proposed here.
