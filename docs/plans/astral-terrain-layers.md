# Plan — Astral Terrain Layers: Dust Density, Composition, Remnants, Core–Rim, Currents

Updated: 2026-10-24. Follows [astral-ui-overhaul.md](astral-ui-overhaul.md) (all its phases shipped).
Inputs: [docs/astral/README.md](../astral/README.md), [glossary](../domain/glossary.md),
[layer management PRD](../prd/layers-management.md).

## Goal

The star chart currently reads only the political geometry (empires, sectors, lanes) and the burg
system. The terrain the fantasy map was built from — elevation, biomes, rivers — is generated,
persisted, and then ignored by the Astral view. This plan reintroduces it as five reinterpretations:

The keystone framing: **land is the dust sheet, ocean is the void, so elevation is matter density.**
Everything below follows from that.

| Source data | Layer | Represents |
|---|---|---|
| `pack.cells.h` | **Dust Density** | thickness of the dust sheet; the highest bands are stellar nurseries |
| `pack.cells.biome` → `pack.biomes` | **Composition** | gas composition of a region — what it harvests |
| `pack.relief` (mount family) + `pack.cells.h` | **Remnants** | collapsed objects where matter piled thickest: black holes, pulsars, neutron stars |
| `grid.cells.temp` | **Core–Rim** | where the sector sits: core-ward heat against rim-ward cold |
| `pack.rivers` | **Currents** | natural hyperspace flows — **part of the Hyperlanes layer, not its own layer** |

Two facts from the code that make this worth doing:

1. **The hyperlanes already bend around terrain.** `routes-generator.ts` applies a height cost
   multiplier `[1,3]` above `h = 25`, and is river-aware besides. The lanes are *already* avoiding
   thick dust and following rivers — the chart just never says so. These layers make existing
   geometry readable as lore.
2. **Terrain is a genuinely unused input.** The Population heatmap (`starDensity`) is
   burg/population-driven (`buildDensityField(cells, burgs, …, {populationWeight})`). No Astral
   renderer reads `h`, `biome`, or `temp` today.

## Non-negotiables

Inherited from the overhaul plan, restated where they bite:

- **No generator changes.** Every layer below is a read-only reinterpretation of `pack`/`grid`.
  Nothing is written back to the world.
- **Rivers are not a layer.** Currents are drawn by the Hyperlanes (`routes`) layer. There is no
  new button, no new preset entry, no new id for them.
- **No standard-mode regression.** The four new ids are absent from `LAYER_TOGGLES`, off by
  default, and the standard layer buttons do not change. `drawRoutes` emits currents only while
  `isAstralView()` — mode-aware branching in renderers is established precedent (`draw-scalebar`
  relabels to `ly`; the state halo gates on the mode).
- **Renderers stay read-only and idempotent.** Same `pack`, `grid`, `styles`, seed → same SVG.
  Repeated draws replace, never append.
- **No new `.map` records.** Layers stay in `data[50]`, styles in `data[48]`.
- **No new production dependencies.** SVG and plain markup only; remnant glyphs are hand-drawn
  shapes, not icon-library assets.

## Overview: ids, buttons, z-order

Four new ids registered in the core list in `src/components/layers.ts`. Registration order is
z-order; anchors are existing entries.

| id | Button | Hotkey | Registered position |
|---|---|---|---|
| `coreRim` | Core–Rim | — (none, like Empires) | after `landmass`, before `texture` |
| `composition` | Composition | `KeyC` | after `texture`, before `nebulae` |
| `dustDensity` | Dust Density | `KeyE` | after `starDensity`, before `heightmap` |
| `remnants` | Remnants | `KeyR` | after `systems`, before `labels` |

Rationale for each slot:

- `coreRim` is a wash over the whole field, void included. It must sit above the near-black ocean
  base (a wash *under* it would be invisible) and under the dust sheet, so it tints everything
  without covering anything.
- `composition` tints the dust sheet itself, so it goes directly above `texture` and below the
  nebulae that float over the sector.
- `dustDensity` is a banded heatmap exactly like `starDensity`; it belongs next to its sibling.
- `remnants` are objects in space at the same depth as star markers: above `systems`, below labels.

Hotkeys are free: `KeyE` was released when Star Density became Population (`KeyP`), and `KeyC`/`KeyR`
are unused in `ASTRAL_LAYER_TOGGLES`. The uniqueness test in `astral-layers.test.ts` guards this.

## The layers

### 1. Dust Density — `dustDensity`

The elevation reading, in bands:

| `cells.h` | Standard meaning | Astral meaning |
|---|---|---|
| 20–40 | plains, lowlands | thin old dust — settled, well-charted space |
| 40–70 | hills → highlands | thick dust — active star formation, gas harvesting |
| ≥ 70 | mountains | dense molecular clouds, **stellar nurseries**, navigational hazard |

- **Field:** a pure module `dust-bands.ts` buckets `cells.h` into `options.levels` bands (1–6) with
  equal-width thresholds over the land range. No kernel, no neighbours — each cell maps directly to
  its band, so this is cheaper than the population field.
- **DOM:** a copy of the `draw-star-density.ts` shape — `getIsolines(pack, cellId => band,
  {fill: true})`, each band's paths into its `bandN` child group. Colour and opacity come from
  `styles.dustDensity.groups.bandN`.
- **The payoff:** with the bands on, the hyperlanes' avoidance of them becomes visible lore — "lanes
  bend around the nurseries" is already true in the route graph.
- **Empty on a waterless or flat map?** Never throws; a map with no land above the first threshold
  clears its groups, like `draw-star-density` does.

Style element (mirrors `starDensity`):

| Element | `attrs` | `options` | Fixed groups |
|---|---|---|---|
| `dustDensity` | `opacity`, `filter`, `mask` | `levels` (1–6) | `band1` … `band6` |

Preset palette: a cool, faint ramp — deep indigo at band 1 rising to a bright violet/magenta at the
top band, low opacity throughout so the dust texture stays legible underneath.

### 2. Composition — `composition`

Biomes derive from temperature × precipitation. Reinterpret the axes — precipitation → volatile
abundance, temperature → irradiation — and each biome becomes the resource character of its region.

The 13 standard biomes collapse to four classes:

| Biome ids | Biome | Class | Reads as |
|---|---|---|---|
| 0 | Marine | — (skipped: the void) | — |
| 1, 2 | Hot desert, Cold desert | `irradiated` | thin, radiation-blasted dust |
| 3, 4 | Savanna, Grassland | `arable` | the agrarian belt, arable worlds |
| 5–9 | The five forest biomes, Taiga | `biomass` | heavy organic chemistry, pharma |
| 10–12 | Tundra, Glacier, Wetland | `volatiles` | ice, fuel skimming, swamp gas |

- **DOM:** the same shape as `draw-biomes.ts` — `getIsolines(pack, cellId => cells.biome[cellId],
  {fill: true, waterGap: true})` — but `buildFillPaths` is fed the *class* palette instead of
  `pack.biomes[i].color`, and biome 0 is never emitted.
- **Opacity is the design risk.** This must tint, not paint: layer opacity around 0.12–0.2, each
  class group tunable below that. If the dust sheet is lost, mask the layer to `#land`.
- **Why it earns its button:** next to Empires it gives sectors *content* — a reason why an empire
  holds a volatiles region and fights over an arable one.

Style element:

| Element | `attrs` | `options` | Fixed groups |
|---|---|---|---|
| `composition` | `opacity`, `filter`, `mask` | — | `irradiated`, `arable`, `biomass`, `volatiles` |

### 3. Remnants — `remnants`

The highest cells become individual objects: where matter piled thickest, it collapsed.

- **Positions come for free.** The relief generator already places mount-family icons on the
  highest cells with spacing (its `claim` system prevents crowding). Filter `pack.relief` to
  `mount`, `mountSnow`, `vulcan` and use those cells — no new placement logic. If `pack.relief` is
  empty, call `Relief.generate()` first, exactly as `draw-relief-icons.ts` does; it is pure pack
  data with no asset dependency.
- **Class from elevation at the icon's cell**, deterministic: `cells.h ≥ 80` → black hole,
  `70–79` → pulsar, else → neutron star.
- **No overlap with Anomalies.** Verified: `markers-generator.ts` places volcanoes, mines, brigands
  and the like — it places no mountain markers, and `pack.relief` is a separate system from
  `pack.markers`. Remnants and Anomalies can both be on without double-drawing.
- **Glyphs are hand-drawn SVG**, not icon assets: a ring-with-dot singularity, concentric pulse
  rings, a small diamond. A `ViewportLayers` registration like `systems`, so remnants cull to the
  viewport and follow zoom.
- **Decorative first pass:** `pointer-events: none`, like nebulae. Naming ("PSR-…"), notes and
  click-to-edit are out of scope (below).

Style element:

| Element | `attrs` | `options` | Fixed groups |
|---|---|---|---|
| `remnants` | `opacity`, `filter` | `glow` (flag, as `systems` has) | `blackHole`, `pulsar`, `neutron` |

### 4. Core–Rim — `coreRim`

An honest caveat first: **`grid` temperature is equator-banded**, not one-sided. On the default
northern-hemisphere map (equator at the bottom edge) temperature falls monotonically bottom → top,
which reads perfectly as core-ward (bottom, hot, dense, ancient) against rim-ward (top, cold,
sparse, frontier). On a whole-globe map the banding is U-shaped and the layer instead reads as
*irradiation bands* — still coherent, just a different label. The layer does not pretend otherwise.

- **Rendering is O(1) in map size:** one full-extent `<rect>` filled with a `<linearGradient>`
  whose stops come from the style. No per-cell work, no isolines — the standard temperature
  renderer's per-cell pass on `grid` was considered and rejected: expensive, and a smooth wash
  reads better under the dust.
- **Direction** is derived from where `grid.cells.temp` min and max actually sit, so the hot end
  points core-ward without configuration; a `flip` option covers taste and odd maps.
- **An edge tick** ("COREWARD") is desirable but needs a home for chart furniture; deferred — see
  open questions.

Style element:

| Element | `attrs` | `options` | Fixed groups |
|---|---|---|---|
| `coreRim` | `opacity`, `filter`, `mask` | `flip` (flag), `intensity` (0–1) | — |

### 5. Currents — inside the Hyperlanes layer

Rivers flow downhill to the sea and burgs sit on them. In the chart: **currents flow to the void,
and the systems that sit on them are trade hubs.** The routes generator is already river-aware, so
lanes and currents already interact in the pathfinding.

- **No new layer, no new button.** The `routes` registry entry gains a fourth child group —
  `children: ["trails", "roads", "searoutes", "currents"]` — and the `routes` style element gains a
  matching `currents` group with the standard stroke bag (`stroke`, `opacity`, `stroke-width`,
  `stroke-dasharray`, `stroke-linecap`, `filter`).
- **Renderer:** a small `draw-currents.ts` called from `drawRoutes`, emitting one `<path>` per
  `pack.rivers` river from its `points`/`cells`. Width scales with `discharge` on a clamped log
  ladder (`River` already carries `discharge`, `widthFactor`, `sourceWidth` — no new data).
  A long dash suggests flow toward the mouth.
- **Astral-only:** `drawRoutes` emits the group only while `isAstralView()`, so standard maps keep
  their exact current DOM and no standard preset needs the section visible.

## Buttons and presets

`ASTRAL_LAYER_TOGGLES` gains three entries (Core–Rim takes none, matching Empires):

```ts
["coreRim", { label: "Core–R<u>i</u>m" }],                    // no shortcut, like Empires
["composition", { label: "<u>C</u>omposition", shortcut: "KeyC" }],
["dustDensity", { label: "Dust D<u>e</u>nsity", shortcut: "KeyE" }],
["remnants", { label: "<u>R</u>emnants", shortcut: "KeyR" }],
```

Preset membership — confirmed:

| Preset | Layers |
|---|---|
| **Astral chart** (default) | states, routes, systems, labels, scaleBar — unchanged |
| **Empires** | unchanged |
| **Survey scan** | texture, starDensity, coordinates, scaleBar, **coreRim** |
| **Dust Density** (new) | texture, `dustDensity`, scaleBar |
| **Composition** (new) | texture, `composition`, scaleBar |
| **Systems and lanes** | + `remnants` — hazards on the lane chart |

Each terrain read stands on its own: Core–Rim joins Survey scan, and Dust Density and Composition
get presets of their own. Presets referencing layers from later phases land with those phases.

## Style system work

- Four new elements in `styles-schema.ts` (`coreRim`, `composition`, `dustDensity`, `remnants`) and
  one new group (`currents`) inside `routes`. Add each in one contiguous block; the schema is
  strict, so every shipped preset must gain the new leaf keys.
- `default-styles.json` gains the defaults; run `scripts/convert-style-presets.mjs` so every shipped
  preset (not just the Astral ones) parses and previews.
- `public/styles/astral.json` **and** `astralSchematic.json` gain real values for all five — an
  Astral style missing them would fall back to defaults mid-mode. Regenerate both thumbnails.
- Style-editor labels: "Dust Density", "Composition" with its four class groups, "Remnants" with
  its three classes, "Core–Rim", and "Currents" under Routes.

## Files

### New

```
src/renderers/astral/draw-dust-density.ts
src/renderers/astral/dust-bands.ts
src/renderers/astral/draw-composition.ts
src/renderers/astral/composition-map.ts      biome id → composition class, pure
src/renderers/astral/draw-remnants.ts
src/renderers/astral/remnant-classes.ts      relief icon + height → class, pure
src/renderers/astral/draw-currents.ts
docs/plans/astral-terrain-layers.md          this plan
```

### Modified

```
src/components/layers.ts                  four new ids at their z positions; currents child group
src/data/astral-layer-labels.ts           three new buttons
src/data/astral-layers.ts                 survey / systems preset membership
src/renderers/draw-routes.ts              calls draw-currents in Astral
src/generators/styles-schema.ts           four elements + routes.groups.currents
src/generators/default-styles.json        their defaults
public/styles/astral.json                 values for all new sections
public/styles/astralSchematic.json        same
scripts/render-style-thumbnails.mjs        (only if it enumerates sections, else nothing)
docs/wiki/User-Interface.md               Astral button list
docs/astral/README.md                     roadmap link to this plan
MERGING.md                                new touch points
```

## Phases

Each phase is independently shippable and ends with lint, unit tests, build and the astral e2e
specs green.

### Phase 1 — Dust Density ✅

Field + renderer + style element + button + preset membership; the pipeline-validating phase.

Shipped: `buildDustBands` (equal-width elevation buckets over the land range, void at 0),
`draw-dust-density` (`getIsolines` fills into the band groups), the `dustDensity` style element and
its defaults, the Astral button ("Dust Density", `KeyE`), the layer registered after `starDensity`,
the indigo→magenta ramp in `astral.json` and a cyan ramp in `astralSchematic.json`, and the
standalone **Dust Density** layer preset.

**Acceptance:** the bands toggle on and off; the same map yields the same bands; the top band
outlines the terrain the hyperlanes visibly avoid; Population and Dust Density can be on together
without one erasing the other.

### Phase 2 — Composition ✅

Mapping + renderer + four class groups + button.

Shipped: `biomeClass` (the 13 biomes collapse to four classes; marine is never emitted; custom
biomes fold into volatiles), `draw-composition` (class isoline fills into the
`irradiated`/`arable`/`biomass`/`volatiles` groups), the `composition` style element, the Astral
button ("Composition", `KeyC`) directly above Nebulae, the standalone **Composition** preset
(texture + composition + scaleBar), a light tint in `astral.json` (layer opacity 0.2) and a
desaturated variant in `astralSchematic.json` (0.14), defaults injected into every shipped preset.

**Acceptance:** four tints over the dust sheet, none of them drowning the starfield texture; the
void is untouched (marine never emitted); toggling is clean.

### Phase 3 — Remnants ✅

Classification + viewport renderer + three class groups + button.

Shipped: `remnants.ts` (`isMountFamily` keeps the mount family, the `remnantClass` elevation
ladder, `collectRemnants` resolving each icon's cell through `Pack.findCell`), `draw-remnants.ts`
— a `ViewportLayers` registration mirroring `systems`, glyphs in em of a new `remnants` zoom curve
(ring-with-dot singularity, concentric pulse rings, a rotated diamond; halo while `glow` is on;
culling by viewport bounds with a 1.4em margin), the `remnants` style element with the `Glow`
option, the button ("Remnants", `KeyR`) after Systems, **Systems and lanes** gaining `remnants`,
and a dimmer glow-off variant in `astralSchematic.json`.

**Acceptance:** every mount-family relief icon becomes exactly one remnant, classified by height;
zoom culling works; nothing appears on a map with no mountains; Anomalies and Remnants coexist.

### Phase 4 — Core–Rim ✅

Gradient wash + direction derivation + flip option + button.

Shipped: `core-rim.ts` (`coreRimAxis` reads the argmax/argmin of `grid.cells.temp` over
`grid.points` — first index wins ties, a flat field yields null), `draw-core-rim.ts` — one
full-extent `<rect>` on a `userSpaceOnUse` linearGradient spanning the extent's extreme
projections along the axis, three stops whose opacities scale with `intensity`, coordinates
rounded to map units — the `coreRim` style element (`Flip` + `Intensity`), the button
("Core–Rim", no hotkey, like Empires) at the head of the Astral list, the layer registered
between `landmass` and `texture` with `pointer-events: none`, **Survey scan** gaining `coreRim`,
and dimmer defaults in `astralSchematic.json`.

**Acceptance:** the hot end lands on the warm side of the map; `flip` inverts it; the wash sits
under the dust sheet and never obscures it; a whole-globe map degrades to irradiation bands without
error.

### Phase 5 — Currents and polish

`currents` group in registry + schema + both Astral presets; `drawRoutes` hook; docs and wiki;
roadmap link; `MERGING.md`.

**Acceptance:** rivers render inside the Hyperlanes layer and toggle with it; width tracks
discharge; standard maps are byte-identical to before (no `#currents` node outside Astral).

## Testing

- **Unit (pure):** `dust-bands` thresholds and banding; `composition-map` covers all 13 biomes
  including marine → none; `remnant-classes` boundary heights (70, 80); `astral-layers` presets
  reference registered ids, every Astral layer has a button, shortcuts unique (all existing
  assertions extend automatically).
- **DOM:** each renderer replaces rather than appends on a second draw; empty `pack` (no relief, no
  rivers, no land) draws nothing and does not throw; currents paths count equals `pack.rivers`
  length minus removed.
- **E2E (`astral-mode.spec.ts` extension):** each new button toggles its layer and content appears
  and disappears; currents appear with Hyperlanes on and vanish with it; the standard layer list
  still shows none of the new ids.
- **Standard guard:** the existing layer and style suites run unchanged; a standard map must not
  gain layers, style sections with non-default values, or a `#currents` node.

## Risks and open questions

- **Three more `getIsolines` passes.** `dustDensity` and `composition` are each O(cells) at draw
  time. The density pass already proved acceptable at 100k cells; if profiling disagrees, cache the
  band fields per `pack` identity.
- **Composition opacity balance** is the one genuinely aesthetic risk; the mask-to-land escape
  hatch is in the style.
- **`grid` vs `pack` temperature.** The standard renderer reads `grid.cells.temp`; `pack.cells`
  has no `temp` field. Core–Rim must read `grid`, the one place an Astral renderer touches it.
- **The Core–Rim edge tick** needs chart furniture that does not exist yet (the sensor grid and
  scale bar own their own homes). Deferred unless a cheap anchor presents itself.
- **`layers.ts` is upstream-touched** twice more (four ids, one child group). Keep the four entries
  as one contiguous block with a comment; record in `MERGING.md`.
- **Relief availability.** `pack.relief` is generated lazily; `draw-remnants` must follow the
  `draw-relief-icons.ts` precedent (`Relief.generate()` when absent) rather than silently drawing
  nothing.

## Out of scope

- Editing interactions or names for remnants (click-to-edit, "PSR-…" designations, notes).
- Re-deriving Population from elevation; one meaning per layer — Population stays
  population-driven, Dust Density stays elevation-driven.
- Standard-mode versions of any of these layers.
- Animated currents, flow particles, or travel-time overlays.
- A legend box for composition classes (the Style tab groups serve as the key for now).
