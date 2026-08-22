# Generation Paths & Their Global Dependencies

There are **four** ways the map is (re)built. All of them mutate the same two
global graphs — `grid` (the raw Voronoi/jittered-square grid) and `pack` (the
repacked graph everything downstream is indexed against) — plus a handful of
loose globals (`seed`, `Math.random`, `mapCoordinates`, the DOM option
inputs). Because the steps communicate almost entirely through these globals
rather than through arguments/return values, the *execution order is the
dependency graph*: a step "depends on" every earlier step that last wrote a
global it reads.

The diagrams below make that implicit coupling explicit. Each node lists the
globals a step **writes**; labelled dotted arrows show a global **flowing** to a
later, non-adjacent consumer (the immediate `next` step is assumed to consume
the previous one).

| # | Path | Entry point | What it does |
|---|------|-------------|--------------|
| 1 | **Full generate** | [`generate()`](../../public/main.js) → `GenerationPipeline.run()` | Build a world from scratch. Source of truth. |
| 2 | **Erase** | [`regenerateErasedData()`](../../src/controllers/heightmap-editor.ts) → `createErasePipeline().runFrom("markupGrid")` | After heightmap edit: throw away all settlement data, re-run phases 3→15. |
| 3 | **Keep** | [`restoreKeptData()`](../../src/controllers/heightmap-editor.ts) | After heightmap edit: copy edited heights into `pack`, regenerate nothing. |
| 4 | **Risk** | [`restoreRiskedData()`](../../src/controllers/heightmap-editor.ts) | After heightmap edit: rebuild the graph, then *remap* preserved entities onto it. |

> Sources: [`public/main.js`](../../public/main.js) `generate()`,
> [`src/generators/generation-pipeline.ts`](../../src/generators/generation-pipeline.ts),
> [`src/controllers/heightmap-editor.ts`](../../src/controllers/heightmap-editor.ts) `finalizeHeightmap()`.
> See also the phase table in [`docs/domain/generation_pipeline.md`](../domain/generation_pipeline.md).

## Global-state legend

| Global | Written by | Notes |
|--------|-----------|-------|
| `seed`, `Math.random` | `setSeed` | Every stochastic step reads `Math.random` implicitly — omitted from edges to avoid clutter. |
| `grid` (points, adjacency) | `generateGrid` | Rebuilt only when the grid size/seed changed. |
| `grid.cells.h` | `heightmap` / heightmap editor | The heightmap. Root dependency of everything. |
| `grid.cells.f/t/b` | `markupGrid` | Feature ids, distance-to-coast type, border flags. |
| `grid.cells.temp` | `temperatures` | |
| `grid.cells.prec` | `precipitation` | |
| `mapCoordinates` | `mapCoordinates` | Latitude band; drives temperature & precipitation. |
| `pack` (whole graph) | `repack` (`reGraph` + `markupPack`) | Repacked cells; **invalidates every pre-repack `pack.cells.*` index.** |
| `pack.cells.r/fl/conf`, `pack.rivers` | `rivers` | |
| `pack.cells.biome` | `biomes` | |
| `pack.cells.s`, `pack.cells.pop` | `rankCells` | Suitability & population. |
| `pack.cultures` | `cultures` / `culturesExpand` | |
| `pack.burgs` | `burgs` / `burgsSpecify` | |
| `pack.states` | `states` / `stateForms` / `stateStatistics` | |
| `pack.provinces` | `provinces` | |
| `pack.routes` | `routes` | |
| `pack.religions` | `religions` | |
| `pack.goods` | `goods` | Map-independent catalogue. |
| `pack.markets`, `pack.deals`, `cells.market` | `markets` / `production` | Economy. |

---

## 1. Full generate (`generate()` → `GenerationPipeline`)

The canonical sequence. Pre-pipeline setup runs inline in `generate()`; the
rest is [`GenerationPipeline`](../../src/generators/generation-pipeline.ts).

```mermaid
flowchart TD
    subgraph pre["generate() — inline setup"]
        seed["setSeed<br/><i>writes: seed, Math.random</i>"]
        size["applyGraphSize<br/><i>writes: graphWidth/Height</i>"]
        rnd["randomizeOptions<br/><i>writes: option globals</i>"]
        gg["generateGrid (if size/seed changed)<br/><i>writes: grid points + adjacency</i>"]
    end
    seed --> size --> rnd --> gg --> hm

    hm["heightmap<br/><i>writes: grid.cells.h; resets pack</i>"]
    mg["markupGrid<br/><i>writes: grid.cells.f/t/b</i>"]
    lakes["addLakesInDeepDepressions +<br/>openNearSeaLakes<br/><i>writes: grid.cells.h/f (lakes)</i>"]
    coord["mapCoordinates<br/><i>writes: mapCoordinates</i>"]
    temp["temperatures<br/><i>writes: grid.cells.temp</i>"]
    prec["precipitation<br/><i>writes: grid.cells.prec</i>"]
    repack["repack (reGraph + markupPack)<br/><i>writes: pack.* (new graph)</i>"]
    ruler["defaultRuler"]
    rivers["rivers<br/><i>writes: pack.rivers, cells.r/fl/conf</i>"]
    biomes["biomes<br/><i>writes: pack.cells.biome</i>"]
    fg["featureGroups"]
    ice["ice"]
    goods["goods<br/><i>writes: pack.goods</i>"]
    rank["rankCells<br/><i>writes: cells.s, cells.pop</i>"]
    cult["cultures + culturesExpand<br/><i>writes: pack.cultures, cells.culture</i>"]
    burgs["burgs<br/><i>writes: pack.burgs</i>"]
    states["states<br/><i>writes: pack.states</i>"]
    routes["routes<br/><i>writes: pack.routes</i>"]
    relig["religions<br/><i>writes: pack.religions</i>"]
    spec["burgsSpecify + stateStatistics + stateForms"]
    prov["provinces + provincePoles<br/><i>writes: pack.provinces</i>"]
    names["riversSpecify + lakeNames"]
    econ["markets + production + taxes<br/><i>writes: pack.markets, deals, cells.market</i>"]
    mil["military + markers + zones + addedLabels"]
    mapname["mapName"]

    hm --> mg --> lakes --> coord --> temp --> prec --> repack --> ruler --> rivers --> biomes --> fg --> ice --> goods --> rank --> cult --> burgs --> states --> routes --> relig --> spec --> prov --> names --> econ --> mil --> mapname

    %% cross-step (non-adjacent) global dependencies
    hm -. "grid.cells.h" .-> temp
    hm -. "grid.cells.h" .-> repack
    coord -. "mapCoordinates" .-> prec
    temp -. "grid.cells.temp" .-> biomes
    temp -. "grid.cells.temp" .-> ice
    prec -. "grid.cells.prec" .-> biomes
    prec -. "grid.cells.prec" .-> rivers
    repack -. "pack.*" .-> rivers
    repack -. "pack.*" .-> rank
    biomes -. "cells.biome" .-> rank
    biomes -. "cells.biome" .-> econ
    rank -. "cells.s / cells.pop" .-> cult
    rank -. "cells.pop" .-> burgs
    cult -. "pack.cultures" .-> burgs
    cult -. "pack.cultures" .-> states
    burgs -. "pack.burgs" .-> states
    burgs -. "pack.burgs" .-> routes
    burgs -. "pack.burgs" .-> econ
    states -. "pack.states" .-> prov
    states -. "pack.states" .-> econ
    goods -. "pack.goods" .-> econ
    routes -. "pack.routes" .-> econ
```

---

## 2. Erase (`regenerateErasedData()` → `createErasePipeline`)

Clears `pack.cultures/burgs/states/provinces/religions`, then runs the *same*
sequence as path 1 **from `markupGrid` onward** — the heightmap is the freshly
edited `grid.cells.h`, and grid/seed/coordinates are untouched. It is a "second
generate" that skips only the seed/grid/coordinate/default-ruler setup. The
`erosionAllowed` flag toggles a few branches.

```mermaid
flowchart TD
    start["finalizeHeightmap (mode = erase)<br/><i>reads: grid.cells.h (edited)</i>"]
    clear["clear pack.cultures/burgs/states/provinces/religions"]
    start --> clear --> mg

    mg["markupGrid<br/><i>writes: grid.cells.f/t/b</i>"]
    lakes["addLakesInDeepDepressions + openNearSeaLakes<br/><i>only if erosionAllowed</i>"]
    temp["temperatures<br/><i>writes: grid.cells.temp</i>"]
    prec["precipitation<br/><i>writes: grid.cells.prec</i>"]
    repack["repack (reGraph + markupPack)<br/><i>writes: pack.* (new graph)</i>"]
    rivers["rivers(erosionAllowed)<br/><i>writes: pack.rivers/r/fl/conf</i><br/>if !erosion: copy grid.h→pack.h"]
    biomes["biomes = Biomes.define()<br/><i>recompute cells.biome, keep catalogue</i>"]
    fg["featureGroups"]
    ice["ice"]
    goods["goods<br/><i>writes: pack.goods</i>"]
    rank["rankCells<br/><i>writes: cells.s, cells.pop</i>"]
    cult["cultures + culturesExpand"]
    burgs["burgs"]
    states["states"]
    routes["routes"]
    relig["religions"]
    spec["burgsSpecify + stateStatistics + stateForms"]
    prov["provinces + provincePoles"]
    names["riversSpecify + lakeNames"]
    econ["markets + production + taxes"]
    overlays["military + markers + zones"]

    mg --> lakes --> temp --> prec --> repack --> rivers --> biomes --> fg --> ice --> goods --> rank --> cult --> burgs --> states --> routes --> relig --> spec --> prov --> names --> econ --> overlays

    %% key non-adjacent dependencies (same shape as path 1)
    temp -. "grid.cells.temp" .-> biomes
    temp -. "grid.cells.temp" .-> ice
    prec -. "grid.cells.prec" .-> rivers
    repack -. "pack.*" .-> rank
    cult -. "pack.cultures" .-> burgs
    burgs -. "pack.burgs" .-> states
    burgs -. "pack.burgs" .-> econ
    states -. "pack.states" .-> econ
    goods -. "pack.goods" .-> econ

    note["Differences vs. path 1:<br/>• no seed/grid/coord/defaultRuler setup<br/>• lakes gated on erosionAllowed<br/>• rivers parameterized; biomes = define() not generate()<br/>• no addedLabels/mapName"]
    style note fill:#fff3cd,stroke:#d39e00
```

---

## 3. Keep (`restoreKeptData()`)

The minimal path. The graph is **not** rebuilt, so no cell reclassification is
possible ("you won't be able to change the coastline"). It only copies the
edited grid heights down into the existing `pack` cells, via the persistent
`pack.cells.g` (pack→grid) mapping. Every other `pack.*` array is left exactly
as it was. The visible refresh (landmass/coastline/lakes layers) happens back in
`finalizeHeightmap`.

```mermaid
flowchart TD
    start["finalizeHeightmap (mode = keep)<br/><i>reads: grid.cells.h (edited)</i>"]
    copy["for each pack cell i:<br/>pack.cells.h[i] = grid.cells.h[ pack.cells.g[i] ]<br/><i>writes: pack.cells.h only</i>"]
    redraw["Layers.draw('landmass','coastline','lakes')<br/><i>in finalizeHeightmap</i>"]
    start --> copy --> redraw

    dep["Dependencies:<br/>reads grid.cells.h + pack.cells.g<br/>writes pack.cells.h<br/>→ NO markup, NO repack, NO regenerators"]
    style dep fill:#d4edda,stroke:#28a745
```

---

## 4. Risk (`restoreRiskedData()`)

The most intricate path: it **rebuilds the graph** (so the coastline can change)
but tries to **preserve** the existing settlement entities by projecting them
onto the new pack. It first snapshots every per-cell array indexed by *grid*
cell (surviving the repack), re-runs hydrology/climate, calls `reGraph`, then
re-attaches the saved data and re-locates each entity's centre in the new pack.
`erosionAllowed` decides whether rivers are regenerated or restored from the
snapshot.

```mermaid
flowchart TD
    start["finalizeHeightmap (mode = risk)<br/><i>reads: grid.cells.h (edited)</i>"]

    subgraph snap["1 · Snapshot (pack → grid arrays)"]
        save["copy pack.cells.{biome,culture,pop,routes,s,<br/>burg,state,province,religion,good} → grid-indexed temp<br/>if !erosion also fl/r/conf<br/>save culture/burg x,y + zone grid cells"]
    end
    start --> save --> guard

    guard["protect burg cells: land under a burg stays land<br/><i>writes: grid.cells.h</i>"]

    subgraph rebuild["2 · Rebuild grid + graph"]
        mg["markupGrid"]
        lakes["addLakesInDeepDepressions<br/><i>if erosionAllowed</i>"]
        temp["temperatures<br/><i>writes: grid.cells.temp</i>"]
        prec["precipitation<br/><i>writes: grid.cells.prec</i>"]
        repack["reGraph + markupPack<br/><i>writes: pack.* (new graph)</i>"]
        gov["GraphOverride.restore()"]
        rivers["Rivers.generate(true) + defineGroups<br/><i>only if erosionAllowed</i>"]
    end
    guard --> mg --> lakes --> temp --> prec --> repack --> gov --> rivers --> reattach

    subgraph remap["3 · Re-attach preserved data to new pack"]
        reattach["re-allocate pack.cells.* arrays<br/>copy snapshot back via pack.cells.g<br/>recompute biome where missing"]
        burgcells["relocate burgs → nearest available land cell<br/>(createAvailableLandCellFinder quadtree)"]
        provcents["relocate province & culture centres (findCell)"]
        statestats["States.getPoles + findNeighbors + collectStatistics"]
        riverspec["Rivers.specify + Lakes.defineNames<br/><i>if erosionAllowed</i>"]
        zones["restore zone cells via grid→pack map"]
    end
    reattach --> burgcells --> provcents --> statestats --> riverspec --> zones --> economy

    subgraph econ["4 · Economy + climate art"]
        economy["if pack.goods exist: filter markets, regenerateEconomy<br/>else: goods + markets + production + taxes"]
        ice["Ice.generate"]
    end
    economy --> ice

    %% dependency highlights
    temp -. "grid.cells.temp" .-> ice
    save -. "saved culture/burg x,y" .-> burgcells
    save -. "saved culture x,y" .-> provcents
    repack -. "pack.cells.g (new)" .-> reattach
    save -. "saved zone grid cells" .-> zones

    note["Key idea: entities are REMAPPED, not regenerated.<br/>Economy is rebuilt from scratch because cell ids changed.<br/>Rivers restored-or-regenerated on erosionAllowed."]
    style note fill:#f8d7da,stroke:#dc3545
```

---

## Cross-path comparison

| Concern | 1 Full | 2 Erase | 3 Keep | 4 Risk |
|---------|--------|---------|--------|--------|
| `setSeed` / `generateGrid` | ✅ | ❌ | ❌ | ❌ |
| `markupGrid` (grid reclassified) | ✅ | ✅ | ❌ | ✅ |
| `reGraph` (pack rebuilt) | ✅ | ✅ | ❌ | ✅ |
| Rivers | generate | generate/param | keep | generate *or* restore |
| Biomes | `generate` (new catalogue) | `define` (reuse catalogue) | keep | recompute per-cell |
| Cultures/Burgs/States/… | generate | generate | **keep** | **remap preserved** |
| Economy | generate | generate | keep | rebuild (cells changed) |
| Coastline can change | ✅ | ✅ | ❌ | ✅ |
