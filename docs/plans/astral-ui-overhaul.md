# Plan — Astral UI Overhaul: Nebulae, Density and the Star Chart

Updated: 2026-10-22. Inputs: [docs/astral/README.md](../astral/README.md),
[mod-merge-plan.md](mod-merge-plan.md), [layers-management.md](../prd/layers-management.md),
[style.md](../architecture/style.md).

## Goal

Make Astral Cartographer a **view of the map**, not only a set of names. A new **Astral** button
under _Layers → View mode_ turns the fantasy map into a science-fiction star chart:

- the map is a **chosen sector of space**, not a whole galaxy;
- the void is deep space, with a starfield;
- the land becomes a starry dust sheet: the existing `texture` layer carries the starfield PNG,
  masked to land;
- **nebulae** are seeded clouds over the sector;
- a **stellar density** heatmap shows where systems cluster;
- **star systems** are drawn as class-coloured markers instead of burg icons;
- the existing political geometry is read as empires, sectors, borders and hyperspace lanes.

The mode also **swaps the Layers tab buttons**: the fantasy layer buttons are hidden and a short
Astral list takes their place. Only the Layers tab list is filtered; the rest of the Options menu and
the editing tools stay where they are. Nothing about standard FMG changes while the mode is off.

## Non-negotiables

- **No generator changes.** Density, nebulae and star markers are derived from `pack` and `grid`.
  Nothing is written back to the world.
- **No new production dependencies.** All rendering is SVG and plain markup.
- **No new `.map` records.** The mode flag is a settings key, layers stay in `data[50]`, styles stay
  in `data[48]`.
- **No standard-mode regression.** New layers are off by default and absent from the standard
  `LAYER_TOGGLES` map. A standard world renders and behaves exactly as it does today.
- **Renderers stay read-only and idempotent.** Same `pack`, `grid`, `styles` and seed → same SVG.
  Repeated draws replace, never append.
- **Determinism.** Nebula and plane shapes come from `options.map.seed`, not `Math.random`, so a
  saved map reproduces its own sky.

## The view mode

### Button

Add a fourth button to `#viewMode` in `src/components/options/tabs/layers-tab.ts`:

```html
<button data-tip="Astral view: star chart layers, nebulae and systems" id="viewAstral">Astral</button>
```

`changeViewMode()` in `src/components/options/view-mode.ts` gets one new branch:

- `viewAstral` → `Controllers.AstralMode.toggle()`;
- clicking `Standard`, `3D scene` or `Globe` while Astral is active exits Astral first;
- entering Astral while a 3D view is open tears the 3D view down with `Controllers.View3d.enterStandard()`.

The Astral button is pressed only while the mode is active. Standard and Astral are mutually
exclusive; 3D and Astral are mutually exclusive.

### State

`view-mode.ts` gains a second flag, separate from the 2D/3D mode:

```ts
type Cartography = "standard" | "astral";
let cartography: Cartography = "standard";
export const isAstralView = () => cartography === "astral";
export function setAstralView(on: boolean): void;
export function subscribeAstralView(listener: () => void): () => void;
```

The mode is **map presentation state**, so it is persisted in `options.map.astral` (new boolean,
default `false`). This is the smallest honest place for it: the saved style and layer set already
depend on the mode, and without the flag a reload cannot know to show the Astral button list.
`Options.randomize()` carries it across regeneration, next to `map.style`, so regenerating while in
Astral keeps the chart.

`Layers` stays unaware of the word "Astral". The mode is a UI/controller concern; the registry only
sees normal layer ids.

### Entering and leaving

`src/controllers/astral-mode.ts` owns the transition. It snapshots the standard profile, applies the
Astral profile, and restores the snapshot on exit:

| Concern | Enter Astral | Leave Astral |
|---|---|---|
| Mode | `options.map.astral = true`; `setAstralView(true)` | `options.map.astral = false`; `setAstralView(false)` |
| Layers | `Layers.restore({order, active: ASTRAL_PRESETS.astral.layers})`, then `Layers.drawAll()` | restore the snapshotted `LayersState`, then `Layers.drawAll()` |
| Style | apply `public/styles/astral.json`; set `options.map.style.preset = "astral"` | apply the previous style record; restore the previous preset name |
| 3D | `Controllers.View3d.enterStandard()` | — |
| UI | press `viewAstral`, redraw the Layers tab | press `viewStandard`, redraw the Layers tab |

Rules:

- The full previous style **record** is kept in memory for the session. Across a reload only the
  previous preset **name** and layer state are kept, in `localStorage` under `fmg-astral-previous-*`;
  unsaved style edits cannot survive a reload and are documented as such.
- If the previous preset is gone, exit falls back to `default` and says so with a tip.
- Entering while `customization` is active (heightmap or another map-editing mode) is refused with a
  tip. The mode is a presentation view, not an editing mode.
- Double-clicks and slow preset fetches are guarded by a generation token: only the latest enter/exit
  transition may write state.
- Leaving Astral is a restore, not a second style choice. A user who wants the look permanently
  picks **Astral** in the Style tab; the preset is a normal system preset.
- On boot and after `map:generated`, `AstralMode.hydrate()` reads `options.map.astral` and sets the
  button/mode without re-applying anything — a loaded map already carries its saved layers and
  style.

## Layers and z-order

### New layers

Three new ids, registered in the core list in `src/components/layers.ts` at the positions below.
Registration order is z-order, so the positions are part of the design.

| id | Label | Position | Purpose |
|---|---|---|---|
| `nebulae` | Nebulae | after `texture`, before `heightmap` | Seeded gas clouds over the sector |
| `starDensity` | Star Density | after `nebulae`, before `heightmap` | System-density heatmap |
| `systems` | Systems | after `burgIcons`, before `labels` | Star markers by spectral class |

There is **no galactic core and no spiral arms**: the map is one chosen sector, not a galaxy. The
land is a starry dust sheet drawn through the existing `texture` layer, masked to `#land` and filled
with the same starfield PNG as the void. The ocean is the void: near-black base plus the starfield
pattern. `landmass` is a dark base under the dust.

Each layer declares its styled child groups in the registry so `Styles.write` can reach them:

```ts
children: ["ion", "dust", "neutral"].map(id => ({ id, tag: "g" }))      // nebulae
children: ["band1", "band2", "band3", "band4", "band5", "band6"]...     // starDensity
```

`systems` has no fixed children: its renderer recreates one `data-group` per spectral class
(`G`, `F`, `K`, `A`, `B`, `M`) on every reconcile, like `draw-burg-icons` does for burg groups.

### What the Astral list shows

`src/data/astral-layer-labels.ts` holds `ASTRAL_LAYER_TOGGLES`, a `Map<LayerId, LayerButton>` in the
same shape as `LAYER_TOGGLES`. The Layers tab renders from the active map, not from both. The Astral
list contains:

| Group | Buttons |
|---|---|
| Background | **Sector Dust** (`texture`), **Nebulae**, **Population** (`starDensity`), **Star Systems** |
| Political | **Empires** (`states`), **Sectors** (`provinces`), **Borders**, **Zones** (`zones`) |
| Routes | **Hyperlanes** (`routes`), **Anomalies** (`markers`) |
| Labels | **Labels** |
| Chart furniture | **Sensor Grid** (`coordinates`), **Scale Bar** |

Vignette has no Astral button: the mode is a flat chart, so the frame stays a Standard-mode layer.

**Borders** keeps its button but starts off, and in Astral it switches something else. The shared `#stateBorders` path cannot be per-state coloured — `drawBorders` writes every border into one path — so the Astral style fades both border groups to opacity 0 and the button instead drives the state halo: one path per empire, stroked `darker(state.color)` and clipped to that empire, so each side of a boundary shows its own darker edge. Visibility is `isAstralView() ? Layers.isOn("borders") : options.app.performance.stateHalos` (`performance.ts`), which keeps the `stateHalos` quality setting authoritative in Standard and the Borders button authoritative in Astral.

The other standard layer buttons are **not rendered** in Astral mode: heightmap, lakes, biomes, cells,
grid, compass, rivers, relief, religions, cultures, temperature, ice, goods, markets, trade,
precipitation, population, emblems, icons, military, journeys, rulers. Their layers may still be
active in the registry; the mode only removes their buttons and the Astral preset turns them off.

`layerLabel()` checks the active mode's map first and the other map as a fallback, so the Style tab
says "Empires" for `states` in Astral and "States" in Standard, while an Astral-only layer still gets
a name outside the mode. Hotkeys resolve through the active map, so a key freed by a hidden standard
layer can be reused by an Astral layer; each map has no duplicate shortcut.

### Layer presets

`src/data/astral-layers.ts` defines the `ASTRAL_PRESETS` record shown in the Layers tab while the
mode is active:

| Preset | Layers |
|---|---|
| **Astral chart** (default) | states, routes, systems, labels, scaleBar |
| **Empires** | texture, nebulae, states, provinces, borders, labels, scaleBar |
| **Survey scan** | texture, density, coordinates, scaleBar |
| **Systems and lanes** | texture, nebulae, systems, routes, labels, scaleBar |

`layers-presets.ts` becomes mode-aware for reading and applying presets. The standard preset table is
unchanged. Entering Astral selects **Astral chart**; changing the select inside the mode applies the
chosen Astral preset. Custom Astral presets are out of scope for the first pass; the save/remove
preset buttons are hidden while the mode is active.

## Renderers

All three live under `src/renderers/astral/`. The DOM writers keep the `draw-` prefix; pure shape and
field generation sits in sibling modules without it, per the renderer rules.

The sector needs no dedicated background renderer. `texture` is the land's starry dust (starfield
PNG, `mask: url(#land)`), and the `ocean` pattern is the void's starfield.

### Nebulae — `draw-nebulae.ts` + `nebula-shapes.ts`

- Seeded from `aleaPRNG(`${options.map.seed}|astral|nebulae`)`; no `Math.random`.
- A handful of cloud clusters (`options.count`, `options.size`), each made of overlapping ellipses
  along a short random walk, emitted into `ion`, `dust` and `neutral` groups by a seeded palette pick.
- One shared turbulence/blur filter per cluster, not per ellipse. In the `speed` performance preset,
  the renderer uses plain radial gradients and skips the turbulence filter.
- `pointer-events: none`; the layer is decorative.
- Erase removes its defs as well as its content.

### Stellar density — `draw-star-density.ts` + `star-density-field.ts`

- The pure field builder takes `pack.burgs`, the cell grid and `options.reach`. For each system it
  touches only cells inside its kernel radius, accumulating a population-weighted count. This is
  O(systems × cells in reach) rather than O(systems × all cells).
- The field is quantised into `options.levels` bands (1..6). Cells below the first threshold are
  `0` and get no isoline.
- The DOM renderer calls `getIsolines(pack, cellId => band, { fill: true })` and writes each band's
  paths into its `bandN` child group, so colour and opacity come from
  `styles.starDensity.groups.bandN`.
- Empty on a map with no burgs; no throw.
- Default reach is a fraction of the map's smaller side, so the same style works on small and large
  graphs.

### Systems — `draw-systems.ts`

- A **viewport layer** registered with `ViewportLayers`, like `burgIcons`, so it culls to the visible
  bounds and follows zoom.
- Reads `systemsOf()` from `src/generators/astral-naming.ts`; no new state and no second population
  calculation.
- One marker per non-removed burg, `id="system{id}"`, `data-id="{id}"`.
- Spectral class comes from `starClass(system.population)`:
  `G` yellow, `F` white-yellow, `K` orange, `A` white, `B` blue, `M` red.
- Size is a log scale of population, clamped; capitals get a ring, ports a small orbit tick.
- Group attrs and per-class size/glow come from `styles.systems.groups.<class>`.
- Clicking a marker opens the Burg Editor, and the tooltip reads it as a system:
  "G-class yellow dwarf. Shipyard, bastion. Click to edit".
  This needs three small seams:
  - `map-tooltip.ts` accepts `#systems [data-id]` as a burg target and renders class/traits in
    Astral mode;
  - `map-entities.ts` adds `/^system(\d+)$/` to `ELEMENT_PATTERNS`, maps it to the burg ref, and
    extends the `#burgIcons` special case to `#burgIcons, #systems`;
  - the burg entity's reveal layers are mode-aware (`systems` in Astral, `burgIcons` otherwise), and
    its highlight selector covers both `#burg{id}` and `#system{id}`.

### Void and chart furniture

The style preset does most of the reskin without new renderers:

- `ocean` becomes the void: near-black base, a tiled starfield pattern, waves and bands off, faint
  outline.
- `texture` becomes the sector dust: the same starfield PNG, masked to land, at a denser opacity than
  the void.
- `landmass` is a dark base under the dust; no core, no arms.
- `coastline` becomes a dim rift glow rather than a hard shore.
- `states` body opacity is low; `borders` are bright dashed territory lines.
- `routes` become hyperspace lanes: cyan and violet dashes, gentle glow.
- `labels` use the existing Orbitron font with a spaced, glowing treatment.
- `coordinates` becomes a sensor grid if shown; `compass` is hidden.

## Style system

Three new style elements, declared in `src/generators/styles-schema.ts` and initialised in
`src/generators/default-styles.json`. The land dust uses the existing `texture` element; the void
uses the existing `ocean` pattern.

| Element | `attrs` | `options` | Fixed groups |
|---|---|---|---|
| `nebulae` | `opacity`, `filter`, `mask` | `count`, `size`, `softness` | `ion`, `dust`, `neutral` |
| `starDensity` | `opacity`, `filter`, `mask` | `levels`, `reach`, `populationWeight` | `band1` … `band6` |
| `systems` | `opacity`, `filter` | `glow` | `G`, `F`, `K`, `A`, `B`, `M` |

Each group carries the same bags as the rest of the record: `attrs` (`fill`, `stroke`, `opacity`,
`filter`) and `options` (`size`, `ring`, `glow`) where the class needs them. `Styles.parse` already
repairs missing sections from defaults, so old `.map` files and old style presets gain the new
sections without a migration.

### The Astral style preset

Add `public/styles/astral.json` and list `astral` in:

- `SYSTEM_PRESETS` (`src/services/style-presets.ts`);
- the preset list in `scripts/render-style-thumbnails.mjs`, then regenerate
  `public/images/style-presets/astral.avif` with the script;
- the user-facing preset list in `docs/wiki/User-Interface.md`.

The preset is a complete record in the existing format. It starts from `cyberpunk.json` (already
Orbitron-based) and changes the palette to a colder deep-space one, then fills the three new elements.
Running `scripts/convert-style-presets.mjs` adds the new default sections to every shipped preset so
the style editor previews agree.

## UI and wiring

### Layer tab

`src/components/options/tabs/layers-tab.ts`:

- add the Astral button;
- choose `LAYER_TOGGLES` or `ASTRAL_LAYER_TOGGLES` per render;
- subscribe to the Astral-view state as well as `Layers`, so the button list swaps immediately;
- render the preset select from the active preset table;
- hide the save/remove preset buttons in Astral mode (built-in Astral presets only).

`src/components/layers-presets.ts` uses the active preset table for `applyPreset`, `savePreset`,
`highlightCurrentPreset` and `applyLayersPreset`, so a generation/load in Astral does not fall back
to the political layer set.

### Controller and commands

- `src/controllers/astral-mode.ts` — `enter`, `exit`, `toggle`, `hydrate`; registered as
  `Controllers.AstralMode` in `src/controllers/index.ts`.
- `src/components/map-commands.ts` — one command, `viewAstral`, name "Toggle Astral View", aliases
  "view mode astral star chart sci-fi nebula".
- `src/components/options/view-mode.ts` — the mode flag, subscription and the `viewAstral` branch.
- `src/components/lifecycle.ts` / boot — call `AstralMode.hydrate()` after `Options.restore()`.
- `src/components/options-model.ts` — `astral: false` in defaults and `map.astral = previous.astral`
  in `randomize()`.
- `src/components/options-schema.ts` — `astral: z.boolean().default(false)` in `mapSchema`.

No Tools-tab button is added: the Astral Names and Star Systems tools stay where they are, and the
new entry point is the View mode button.

## Save, load and compatibility

| Concern | Decision |
|---|---|
| Mode flag | `options.map.astral`; absent in old maps, schema default `false` |
| Layers | Existing `data[50]`; the Astral layer ids are ordinary ids, and unknown ids are ignored on restore |
| Style | Existing `data[48]`; new sections are repaired from defaults on load |
| Preset name | `options.map.style.preset` is `astral` while in the mode and is restored on exit |
| Standard maps | No new layers active, no style change, no new buttons |
| Regeneration | `randomize()` carries `astral`, so the mode survives a new world |
| Reload | `hydrate()` restores the mode from the flag; layers and style come from the file |
| Export | SVG/PNG export already serialises the live SVG and `styles`; the Astral layers are ordinary SVG |

## Files

### New

```
src/controllers/astral-mode.ts
src/data/astral-layers.ts
src/data/astral-layer-labels.ts
src/renderers/astral/draw-nebulae.ts
src/renderers/astral/nebula-shapes.ts
src/renderers/astral/draw-star-density.ts
src/renderers/astral/star-density-field.ts
src/renderers/astral/draw-systems.ts
src/renderers/astral/system-markers.ts
public/styles/astral.json
public/images/style-presets/astral.avif
public/images/textures/starfield.png
```

### Modified

```
src/components/layers.ts                  three new layers at their z positions
src/components/layers-presets.ts          mode-aware preset table
src/components/options/tabs/layers-tab.ts Astral button, toggle map, preset options
src/components/options/view-mode.ts       astral flag, subscription, button branch
src/components/options-model.ts           map.astral default and carry
src/components/options-schema.ts          map.astral
src/components/lifecycle.ts               hydrate after options restore
src/generators/astral-naming.ts          StarSystem coordinates, the tooltip line
src/components/map-commands.ts            viewAstral command
src/components/map-tooltip.ts             systems as burg targets
src/components/map-entities.ts            system element and reveal/highlight
src/components/viewbox-events.ts          a marker click opens the Burg Editor
src/components/viewport.ts                the systems zoom curve
src/controllers/index.ts                  AstralMode registry entry
src/data/layer-labels.ts                  layerLabel checks the Astral map
src/data/ocean-patterns.ts                starfield pattern
src/generators/styles-schema.ts           three new style elements
src/generators/default-styles.json        their defaults
src/services/style-presets.ts             astral in SYSTEM_PRESETS
scripts/render-style-thumbnails.mjs        astral thumbnail
docs/astral/README.md                     visual-mode section and roadmap
docs/wiki/User-Interface.md               Astral view and preset
MERGING.md                                new touch points
```

## Phases

### Phase 1 — Mode and button swap ✅

- mode flag, button, controller skeleton, mode-aware layer tab and presets;
- Astral layer ids registered with placeholder renderers;
- persistence through `options.map.astral` and hydration on boot/load.

Shipped: `AstralMode`, the `Astral` button, the mode-aware layer/preset list, the three layer ids,
`options.map.astral`, and the boot/load hydration.

**Acceptance:** clicking Astral hides the standard layer buttons and shows the Astral list; leaving
restores the previous list, style and layers; a reload of a saved Astral map shows the Astral list;
standard maps are untouched.

### Phase 2 — Sector dust, void and style ✅

- three style elements and defaults;
- `astral.json` preset and thumbnail;
- sector dust and void starfields, and the coast palette;
- states, borders, routes and labels reskinned by the preset.

Shipped: the `nebulae`, `starDensity` and `systems` style sections, the starfield asset, the
`astral` preset and its thumbnail. Re-run the thumbnail script when the preset changes.

**Acceptance:** the map reads as a sector chart, not a parchment map; the land uses the starfield PNG;
the void has its own starfield; there is no core or spiral arm; the style editor exposes the new
elements.

### Phase 3 — Nebulae and density ✅

- seeded nebula shapes and defs;
- density field and banded heatmap;
- performance-mode fallback.

Shipped: `draw-nebulae` (seeded ellipse clusters, one turbulence filter per cluster, fade gradients
in the `speed` preset), `draw-star-density` (population-weighted sparse kernel, banded through
`getIsolines`), and the layer wiring in the registry.

**Acceptance:** the same seed yields the same sky; nebulae and density toggle cleanly; a 100k-cell
map draws both without blocking the UI for an unreasonable time.

### Phase 4 — Systems and interaction ✅

- star marker renderer;
- tooltip, click, reveal and highlight seams;
- class colours and capital/port accents.

Shipped: `draw-systems` (a `ViewportLayers` layer like `burgIcons`, one `data-group` per spectral
class, marker size on a log population ladder, capital rings and port orbit ticks, style-gated
glow), the `systems` zoom curve in `viewport.ts`, and the three seams — `map-tooltip.ts` reads
`#systems [data-id]` and names the class and traits, `map-entities.ts` maps `system{id}` to the
burg with mode-aware reveal layers and a two-selector highlight, and a click on a marker opens the
Burg Editor.

**Acceptance:** every burg is a marker with the right class colour and size; clicking it opens the
Burg Editor; the map tooltip names the class and traits; zoom culling works.

### Phase 5 — Polish and docs ✅

- Astral layer preset table; save/remove hidden in the mode;
- e2e coverage, README and wiki updates, `MERGING.md` checklist;
- a "Apply Astral naming" hint in the mode, and a second `astralSchematic` preset.

Shipped: the e2e specs (`astral-mode`, `astral-systems`, `astral-round-trip`), the one-per-session
naming hint shown on entering the mode, the `astralSchematic` blueprint preset and its registration,
and the README, wiki and `MERGING.md` updates.

**Acceptance:** lint, unit tests, build and the new e2e specs pass; the README roadmap links this
plan.

## Testing

- **Unit (pure):** `star-density-field` bands and kernel reach; nebula determinism for a seed;
  `astral-layers` presets reference registered ids; every Astral layer has a button and a style
  element.
- **DOM:** each renderer replaces rather than appends on a second draw, removes its defs on erase,
  and emits no marker for removed burgs. Follow the existing `*.dom.test.ts` pattern.
- **Controller:** enter/exit applies and restores the layer state and style; double enter is a no-op;
  a failed `astral` fetch leaves the current style and still swaps the buttons; 3D → Astral and
  Astral → 3D leave no stale pressed button.
- **E2E:** `astral-mode.spec.ts` (button swap, plane/nebula/density/systems present, back to
  standard); `astral-systems.spec.ts` (tooltip, click, reveal, zoom); `astral-round-trip.spec.ts`
  (save in Astral, reload, same layers and style); export smoke test.
- **Standard guard:** run the existing layer and style suites unchanged; a standard map must not
  gain Astral layers or style sections it did not have.

## Risks and open questions

- **Silent style replacement.** Entering Astral applies a preset. The snapshot/restore protects the
  session, but a user who edits style inside the mode and leaves loses those edits. The plan accepts
  this and surfaces it in the mode tip; the Style tab offers Astral as an explicit preset.
- **Filter cost.** Turbulence filters are expensive. The plan keeps one per nebula cluster and drops
  them in the `speed` performance preset. If export or zoom performance regresses, replace the
  filter with more gradient ellipses.
- **`getIsolines` at large sizes.** The sparse kernel keeps field building cheap, but the isoline
  pass is still O(cells). Cache the field per `pack` identity if profiling shows it.
- **Layer order is upstream-touched.** Three entries in `src/components/layers.ts` are a real edit to
  a stock file. Keep them as one contiguous, append-only block with a comment and record it in
  `MERGING.md`.
- **Hit-testing parity.** `systems` is a second visual representation of a burg. The `system{id}`
  element, tooltip and reveal seams must stay in step with `burgIcons`; the e2e spec is the guard.
- **New style sections touch a stock schema.** Add them in one block and run the preset converter;
  `Styles.parse` is the compatibility path for old maps. Record the touch point for upstream merges.
- **Starfield asset.** A tiled PNG is proposed. If a binary asset is unwanted, the same pattern can be
  emitted as an SVG `<pattern>` by a small `starfield` renderer instead; decide before Phase 2.

## Out of scope

- Changing generation so land becomes a galactic structure or burgs become clusters.
- Applying Astral naming automatically; the naming action stays explicit under Tools.
- Animated nebulae, warp travel, or trade animation in Astral mode.
- A 3D Astral scene.
- Custom Astral layer presets and user-generated sci-fi style galleries.
- Reworking the 3D/Globe buttons or the rest of the Options menu.