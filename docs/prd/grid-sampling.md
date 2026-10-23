# PRD — Grid Sampling and Advanced Options

## Problem Statement

Every Map is built on the same Grid: a square lattice of points, each shifted randomly inside its square, turned into Voronoi Cells. That gives the organic look most users want, but nothing else. Users who make maps for wargames, board games, hex-crawls or tile-based engines want hexagonal or square Cells, and some want a calmer, more regular look without going fully geometric. Today they have to redraw the Map in another tool.

The idea was tried before in PR #1100 (2024) and shelved. That PR was a draft against the old classic scripts. It listed three blockers: hex Cells looked distorted, much of the generation assumes a grid of `cellsX × cellsY` squares, and the feature was low priority. A review against `v1.155.0` found that:

- **Distortion was limited to the map edge.** The Voronoi step gives perfect hexagons in the interior: 7,700 of 7,700 interior Cells had 6 equal sides. Only Cells along the map edge were irregular, because the boundary pseudo-points are not aligned with the lattice.
- **The rows-and-columns assumption can be kept.** If every sampling stores its points as `cellsY` rows of `cellsX` points, the code that walks rows and columns keeps working. The real work is the Cell lookup by coordinates, which is now copied in four places.

There is also no place for settings that only experienced users should touch. The Options panel is meant for everyone, and adding lattice controls there would clutter it.

## Starting point

What exists on `v1.155.0`:

- **Grid generation.** The Grid module places a jittered square lattice: spacing `√(width × height / points)`, each point shifted by up to ±0.9 × half the spacing on each axis, rounded to 2 decimals. It adds boundary pseudo-points every two spacings, one spacing outside the map, and runs the Voronoi step. The Grid stores `spacing`, `cellsX`, `cellsY`, `points` and `boundary`. A `.map` file stores these and rebuilds Cells and vertices on load.
- **Cell lookup on the Grid.** `Grid.findCell(x, y, graph)` returns the lattice square that contains the point. The heightmap generator calls it eight times per template, so it shapes every seeded Map. It clamps only the far edges: negative coordinates give an invalid index. Three renderers copy the same formula inline: contour surface, coastal waves and hachures. Hachures is a self-contained function with its own test.
- **Rows-and-columns consumers.**
  - Precipitation passes wind along rows and steps `±cellsX` between them.
  - Temperature takes a row's latitude from its first point.
  - Heightmap invert mirrors by row and column.
  - Heightmap image import and export use one pixel per Grid point.
  - The 3D mesh and the erosion and satellite textures use one vertex or texel per Grid point.
- **The Pack step.** It drops deep-ocean points and every fourth second-ring water point, then adds a midpoint between neighbouring coastal points of the same type when they are at least one spacing apart. On any regular lattice that test always passes, so it would cut the coastal land Cells in two.
- **Configuration.** `options.generation.graph` holds the request (`width`, `height`, `density`). `options.map.graph` holds what the Map was built with (`width`, `height`, `points`) and is copied from the request at generation. Both are strict schema objects. The heightmap selection preview reuses the current Grid when width, height and points match. Resample rebuilds the Grid from `options.map`.
- **Dialogs.** The performance settings dialog (opened by a cog in the Options panel) is the pattern for a small settings dialog driven by `options`. Editors are lazy-loaded through the controller registry and add their own dialog markup.

## Solution

Two independent Grid settings, both set in a new **Advanced options** dialog:

- **Sampling**: the lattice the Grid points sit on.

  | Sampling | UI label | Cells at jitter 0 |
  |---|---|---|
  | `square` (default) | Square grid | squares |
  | `hexPointy` | Hex grid (pointy) | hexagons with a vertex on top |
  | `hexFlat` | Hex grid (flat) | hexagons with an edge on top |
  | `diamond` | Square 45 degrees grid | squares turned 45° |
  | `triangle` | Triangle grid (horizontal) | equilateral triangles, alternating up and down |

  The labels reuse the grid overlay's strings rather than adding near-copies.

- **Jitter**: how far each point may move off its lattice position, from 0 (perfectly regular) to 0.9 (today's look). The default is 0.9.

The defaults (square, 0.9) are today's Grid, point for point, so existing seeds and existing maps don't change. "Natural" is not a separate mode: it is square sampling at full jitter. Lower jitter gives a calmer organic look, and jittered hexes give an organic map with more even Cells.

Every sampling gives about as many Cells as the Points setting asks for: whole rows and columns round the count, as on today's Grid, so it is off by less than a row and a column (within 1.5% at 10,000 points and above). The settings apply to the next generated Map, like the Points slider. A saved Map keeps the sampling and jitter it was made with.

The **Advanced options** dialog opens from the Advanced button in the Options panel's Configure row (Climate, Lore, Advanced, Reset), not from the Points slider, since it holds more than Grid settings. Its Map settings section holds a Lattice preset, Sampling and Jitter next to other generation settings users tend to misread; its Interface settings section holds the rarely changed preferences.

All Grid lookups by coordinates go through two functions on the Grid module: one for the heightmap generator, which keeps seeds stable, and one exact lookup for everything else.

## User Stories

1. As a wargame map maker, I want hexagonal Cells, so that the Map works as a hex board.
2. As a hex-crawl game master, I want pointy-top or flat-top hexes, so that the Map matches the orientation of my game's hex sheets.
3. As a tile-engine developer, I want square Cells, so that I can export a heightmap that fits a square tile grid one Cell per tile.
4. As a map maker, I want diamond Cells, so that the Map fits an isometric game style.
5. As a curious user, I want triangle Cells, so that I can see what a Map built on triangles looks like.
6. As a map maker, I want to lower the jitter, so that Cells look calmer and more even without becoming geometric.
7. As a map maker, I want to raise the jitter on a hex sampling, so that I get an organic Map whose Cells are more even than the classic look.
8. As an existing user, I want the default Map to look exactly as it does today, so that nothing changes unless I choose to.
9. As a user with a favourite seed, I want the same seed with default settings to produce the same Map as before, so that my shared seeds still work.
10. As a map maker, I want about the same number of Cells on every sampling, so that the Points setting means the same thing everywhere.
11. As a map maker, I want my chosen sampling and jitter kept for every new Map until I change them, so that I don't set them again each time.
12. As a map maker, I want the sampling and jitter saved in the `.map` file, so that the Map reopens as it was made.
13. As a user loading a map made before this feature, I want it to open exactly as before, so that old files keep working.
14. As a user, I want sampling and jitter outside the main Options panel, so that the panel stays simple.
15. As an experienced user, I want an Advanced options dialog, so that I know where settings for experienced users are.
16. As a user, I want to see that these settings apply to the next Map, so that I don't expect the current Map to change.
17. As a user, I want a way back to the default sampling and jitter, so that I can get back to the classic look.
18. As a user, I want a short tooltip on each Advanced option, so that I understand it before generating.
35. As a user picking hexes, I want presets that set sampling and jitter together, so that I don't have to know a board needs jitter 0.
36. As a user, I want settings I tend to misread (map size, provinces ratio, size variety, growth rate) and rarely changed preferences (autosave interval, on load, speaker voice, emblem shape) moved out of the main panel, so that it shows what I change often.
37. As a user, I want to generate a new Map from the Advanced options dialog, so that I don't have to find the button elsewhere.
38. As a user, I want the dialog buttons at the bottom of the Options panel in one tidy row with short names, so that I can tell them apart at a glance.
39. As a user, I want Reset to ask before wiping my options and reloading the page, so that I don't lose work by a misclick.
19. As a user of a non-English interface, I want the Advanced options translated, so that I can use them in my language.
20. As a map maker on a regular grid, I want land Cells along the coast to keep their lattice shape, so that the coastline follows the grid.
21. As a map maker on a regular grid, I want Cells at the map edge to keep their lattice shape, so that the border looks clean.
22. As a map maker, I want the tooltip, cell info and heightmap brushes to find the Cell under the cursor exactly on every sampling, so that I edit the Cell I point at.
23. As a classic-map user, I want the cursor lookup to be exact on the jittered Grid too, so that brushes no longer sometimes hit the neighbouring Cell.
24. As a map maker, I want contours, hachures and coastal waves to line up with the Cells on every sampling, so that the heightmap styles look right.
25. As a map maker, I want wind, precipitation and temperature to work on every sampling, so that climate and biomes are as believable as today.
26. As a map maker, I want heightmap templates to raise land on every sampling, so that template choice works the same way.
27. As a map maker, I want to import a heightmap image on any sampling, so that I can keep using my own heightmaps.
28. As a map maker, I want to export the heightmap image on any sampling, so that I can use it in other tools.
29. As a map maker, I want the heightmap selection previews to use my sampling, so that the preview matches the result.
30. As a map maker, I want the 3D view and its erosion and satellite looks to work on every sampling, so that I can still view the Map in 3D.
31. As a map maker, I want resampling (changing map size or cropping) to keep my sampling and jitter, so that the Map keeps its look.
32. As a map maker, I want rivers, lakes, states and routes generated on every sampling, so that the Map is a complete world.
33. As a user, I want the Assistant to know a Map's sampling, so that it can explain why Cells look the way they do.
34. As a user reading the wiki, I want a page explaining the Advanced options and each sampling, so that I can choose one.

## Implementation Decisions

### Lattice module (new, self-contained, no globals)

- A singleton, `Lattice`, imported where needed and never put on `window`. Callers use only its public methods: `placePoints`, `findSlot` and `getSteps`; the row shifts and boundary builders are private.
- One module turns `sampling`, map width and height, the Points-derived spacing `s = √(width × height / points)`, `jitter` and a random function into the Grid points, `cellsX`, `cellsY` and the boundary pseudo-points. It also provides the slot lookup: coordinates to the index of the lattice slot that contains them.
- **Every sampling is stored as rows.** Points are laid out row by row: `cellsY` rows of `cellsX` points each, every row the same length. On offset lattices, even rows move left and odd rows right by half the offset, so the lattice stays centred in the map. This keeps every rows-and-columns consumer valid without changes.
- **Lattice geometry.** Each Cell covers `s²`, so the Cell count matches Points. These values come from a prototype run on a 1920×1080 map with 10,000 points:

  | Sampling | x step | Row height | Odd-row x offset | Notes | Cells (of 10,000) |
  |---|---|---|---|---|---|
  | square | `s` | `s` | 0 | | 9,975 |
  | hexPointy | `s·√(2/√3)` ≈ 1.075s | x step × √3/2 | half x step | | 10,044 |
  | hexFlat | `2c` | `v/2` | `c` | `v = s·√(2/√3)`, `c = v·√3/2` | 10,080 |
  | diamond | `s·√2` | `s/√2` | half x step | | 9,964 |
  | triangle | `L/2` | `L·√3/2` | 0 | side `L = s·√(4/√3)`; each point moves ±⅙ row height by (row + column) parity | 9,975 |

  At jitter 0, interior Cells came out with exactly the intended sides: 4, 6, 6, 4 and 3.
- **Jitter.** Each point moves by up to `jitter` × half the distance between neighbouring points. On the square lattice it moves by that much on each axis, today's rule: square neighbours sit along the axes, so two points never meet. The other lattices have neighbours at an angle, where a per-axis shift brought neighbours within 0.003 spacings of each other; there a point moves within a circle of that radius instead, so neighbours stay at least 0.1 × the neighbour distance apart. Every point takes two random rolls at any jitter, so the random stream after the Grid is the same for every jitter. Jitter is limited to 0–0.9: at 1, neighbouring points can coincide, and the Voronoi step drops duplicate points, which would leave Cells missing.
- **Square at 0.9 reproduces today exactly.** The square sampling keeps today's point loop, rounding, edge clamp, `cellsX`/`cellsY` formula and boundary. A seed with default settings gives the same Grid bit for bit. All samplings round points to 2 decimals, the stored format.
- **Boundary.**
  - The classic Grid (square at jitter 0.9) keeps today's pseudo-points, which keeps the default Grid unchanged.
  - Every other Grid gets two rings of lattice slots around the map. Slots that fall inside the map are left out, so every point of the map still belongs to a real Cell. Edge Cells keep the lattice shape wherever the map edge lines up with the lattice; where it doesn't, as on the right edge of every other hex row, the edge Cell is slightly wider. With the same boundary at every jitter, edge Cells change gradually as jitter changes.

### Grid module

- `Grid.generate` takes the seed and the graph settings (size, points, sampling and jitter) as one object, `options.map.graph` by default. The pipeline, resample and heightmap selection pass them from `options.map.graph` or `options.generation.graph`, as they do with the size today.
- **The Grid carries `sampling` at runtime only**, next to `spacing`, `cellsX` and `cellsY`. Lookups also run on graphs that are not the current Map, such as heightmap selection previews built from the next Map's request, so the lattice must come from the graph itself. The value is set when the Grid is built: by `Grid.generate` from its argument, and by `Grid.rebuildGraph` on load from `options.map.graph.sampling`, which load applies before rebuilding the Grid. It is not written into the saved Grid data, so the `.map` file holds a single copy. Jitter is not on the Grid: no lookup needs it.
- **Two lookups, split by what they need.** A lookup that needs only the lattice lives in the Lattice module; one that needs the Voronoi graph lives on the Grid module. There are no pass-through wrappers.
  - `Lattice.findSlot(x, y, graph)` returns the lattice slot containing the point, clamped to the map on all sides. On square sampling it equals today's `findCell` except at negative coordinates, where today returns an invalid index. The heightmap generator switches to it, so template output and seeds are unchanged.
  - `Grid.findCell(x, y, graph)` starts at the slot and moves to whichever neighbouring Cell is closer to the point, until none is. The result is the exact Voronoi Cell. In the prototype it matched a brute-force nearest-point search on 3,000 random probes for every sampling at jitter 0 and 0.5, in at most 2 moves. Along the map edge the boundary pseudo-points cut the walk, so from a border Cell it checks three rings of neighbours instead of one; with that it matched brute force on 600,000 edge-heavy probes across every sampling, four jitters and three map sizes. The slot alone was right in 57–100% of probes, depending on the sampling. Every other caller uses it: tooltip, cell info, ice editor, heightmap editor tools, unit helpers and renderers. On the classic Grid this fixes brushes that sometimes hit the neighbouring Cell. It is 5–9× faster than a d3 quadtree search on the same points and needs no index to build or cache, so the Grid gets no quadtree. The Pack keeps its quadtree because its points follow no lattice.
- `findAll(x, y, radius, graph)` starts from `findCell` and counts its rings in neighbour distances, which equal the spacing on the square lattice.
- **Raster.** `Grid.getRaster()` gives the Grid as square pixels over the map, each holding the Cell under its centre, and `Grid.rasterize` turns per-Cell values into those pixels. On the square lattice the raster is the lattice slots themselves, so square maps draw exactly as before.
- **Save and load.** The Grid's stored data does not change. The JSON export adds `sampling` next to `cellsX` and `cellsY`.

### Configuration

- `options.map.graph` gains `sampling` and `jitter`: what the Map on screen was built with. Everything that reads them after generation reads this copy: resample, the Pack step, the Grid rebuild on load and the Assistant. It is what the `.map` file stores.
- `options.generation.graph` gains `sampling` and `jitter`: what the next Map should use. Advanced options edits only this copy, and generation copies it into `options.map.graph` next to `points`, as the Points slider's `density` becomes `points`. The request needs its own copy for three reasons:
  - **The Map on screen.** Editing `options.map.graph` from the dialog would make it describe a lattice the current Map doesn't have. A resample before the next generation would then rebuild the Grid on the wrong lattice.
  - **Loading replaces `options.map` wholesale.** Opening an old classic map would reset the user's chosen sampling, and the next new Map would silently be square again.
  - **New maps rebuild `options.map` from defaults** and copy only `points`, width and height from the request.
- The request values don't take part in randomization or pins: they stay as set until changed, which is what experienced users expect from advanced settings.
- Defaults are `square` and `0.9` in both sections.

### Migration

- **Old `.map` files.** The legacy settings migration fills `graph.sampling ??= "square"` and `graph.jitter ??= 0.9` for maps older than the release version, as v1.154.0 did for `relief`. Without it, schema validation would still repair the missing keys from defaults, but with a "values replaced" warning on every old map.
- **The pre-v1.152 settings conversion** builds a `graph` object literal. It gains the same two values, so the oldest maps pass validation without repair too.
- **Browser storage.** Restoring options validates against the schema and fills the missing request keys from defaults once, then persists the result. No migration is needed.
- **The Grid.** Nothing to migrate: its `sampling` comes from the settings on load.
- The heightmap selection preview reuses the current Grid only when sampling and jitter also match. A new Map built on a preview Grid takes the preview's sampling and jitter, even if the request changed while the dialog was open.

### Pack step

- Deep-ocean dropping and the every-fourth second-ring water thinning stay for every sampling. They only reshape water Cells, because land Cells border only kept points.
- Coastal densification adds a point between two coastal neighbours further apart than the neighbour distance × (1 + 0.9 − jitter). On the classic Grid that is today's spacing threshold. At jitter 0 no pair is that far apart, so the Pack's land Cells keep the lattice shape, and the number of added points grows gradually with jitter.

### Renderers

- The contour surface and coastal waves use `Grid.findCell` instead of their inline square formulas.
- The hachure function takes a Cell-lookup function as input instead of `cellsX`/`cellsY`. It keeps its rule that a point off the map has no Cell. It still takes `spacing` for stroke sizes.
- Consumers that keep the rows-and-columns view, and the approximation they accept on offset or anisotropic samplings:
  - **Precipitation:** wind passes step along rows and columns, and each step's humidity loss, gain over water and evaporation are scaled by the step's length in spacings. That is 1 on the square lattice, while on hexFlat an east–west step covers 1.86 spacings and a north–south one 0.54, so without the scale winds would carry rain about twice as far in one direction.
  - **Temperature and the strait width:** unchanged.
  - **Heightmap invert:** on offset rows the mirror is off by up to half a slot.
  - **Heightmap image import:** one pixel per slot, which samples the image within a fraction of a Cell of each point.
  - **On-screen heightmap previews** (the heightmap editor's preview and the style editor's scheme preview) draw the raster, so they keep the map's proportions on every sampling.
  - **3D mesh, erosion and satellite textures:** one vertex or texel per raster pixel, so every sampling gets the same even resolution across and down the map.

### Square, diamond and triangle topology

On square, diamond and triangle samplings at jitter 0, four or six points share a circle. The triangulation then picks a diagonal at each corner. The result:

- Some Voronoi edges have zero length.
- Cells gain extra neighbours across corners.
- Shapes still render exactly.

This is accepted, because every Voronoi vertex still touches exactly three Cells, which feature and coastline tracing depend on. The visible effect is that rivers, lakes and expansion can occasionally cross a corner diagonally.

### Advanced options dialog

- A component next to Performance Settings (`app/chrome/advanced-options.ts`). The Options tab mounts its markup into `#dialogs` once and binds its controls through the same option bindings as its own, so values, locks, persistence and randomization work unchanged; the dialog only shows and hides them. It opens from the Advanced button in the Options panel's Configure row.
- **Map settings** section (apply to new maps): Map size, then:
  - **Lattice** select, a preset that sets Sampling and Jitter together, because a user picking hexes rarely knows a board also needs jitter 0: Default (square, 0.9), which also takes the user back to the classic look, Organic hexes (hexPointy, 0.5), Hex board pointy and flat, Square board and Isometric board (diamond), all at jitter 0. It is derived from the two values, not stored, and reads Custom when they match no preset.
  - **Sampling** select with the five labels above.
  - **Jitter** slider from 0 to 0.9, step 0.05, with a number readout.
  - Provinces ratio, Size variety and Growth rate, moved from the Options panel with their locks.
- **Interface settings** section: Autosave interval, On load, Speaker voice and Emblem shape, moved from the Options panel.
- Reads and writes go through `options.generation.graph` and the other option fields with `Options.set`, as in the Options panel.
- A compact three-column table (icon, label, control) with every control the same width. Explanations stay in the tooltips; the dialog shows none inline.
- A **New Map** button at the bottom calls the same prompt as the Options panel's New Map button.
- All strings go through `t()`. The locale files are re-extracted.

### Options panel Configure row

- The buttons below the Options tables become a **Configure** subsection, one row of short labels: **Climate** (the World Configurator, formerly Configure World), **Lore** (formerly Set Lore), **Advanced** and **Reset** (formerly Reset Options). The row wraps instead of clipping a long translation.
- **Reset** asks for confirmation and says the page reloads. The omnibar's Reset Options command asks the same.

### Docs and supporting changes

- **Glossary:** add **Sampling**, **Jitter** and **Lattice slot**.
- **Data model:** update the Grid section, which today says points are "based on jittered square grid".
- **Wiki:** add an Advanced options page and link it from Home and the Knowledge Base. Update the User Interface page, the Quick Start Tutorial and the Knowledge Base for the Configure row and the moved settings.
- **Assistant:** regenerate its data-field context so it lists `grid.sampling`.
- **Release:** version bump and update notes per the release process.

## Testing Decisions

- **Good tests check behaviour you can observe from outside the module:** points in, Cells out. They don't assert internal steps or intermediate values.
- **Only the Lattice module gets new unit tests.** It is self-contained and needs no globals. Tests feed it a seeded random function and run the existing Voronoi step on its points, as the prototype did. Cases:
  - **Cell count:** off by less than a row and a column for every sampling, at several map sizes and Points values, and within 1.5% from 10,000 points.
  - **Cell shapes:** at jitter 0, interior Cells have the intended number of distinct sides (4, 6, 6, 4, 3).
  - **Interior shapes and the boundary:** at jitter 0, Cells at least two slots from the edge have the intended sides, measured with a tolerance of 0.05 × spacing, since rounding points to 0.01 splits corners by a hair. No boundary point lies inside the map.
  - **Default Grid unchanged:** square at jitter 0.9 gives exactly today's points, `cellsX`, `cellsY` and boundary for a fixed seed. This is the seed-reproducibility guard.
  - **Same stream at any jitter:** the random function is called the same number of times at any jitter.
  - **Rows:** every row has `cellsX` points and there are `cellsY` rows.
  - **Slot lookup:** on square sampling it returns today's formula, clamped on all sides.
- **Prior art:** the hachure test builds a small hand-made grid and checks the drawn output. The pack generator and resample tests run generators on seeded inputs.
- **No new tests for the other modules** (Grid lookups, options, dialog, renderers). The Lattice tests, the existing pack and resample tests, and the existing end-to-end runs cover them. Check them by hand in the running app on every sampling at jitter 0 and 0.9:
  - Generation, tooltip and brushes.
  - Contours, hachures and coastal waves.
  - Heightmap image import and export.
  - 3D erosion and satellite looks.
  - Save and reload.
  - Opening an old `.map` file.

## Out of Scope

- Poisson-disc (blue-noise) sampling and Lloyd relaxation. Points would leave their slots, which breaks the rows-and-columns layout and the fixed-cost slot lookup.
- True 4-neighbour topology for square and diamond Cells.
- Changing the existing pseudo-point boundary for jittered Grids.
- Randomizing sampling or jitter when generating a new Map, and pins for them.
- Converting an existing Map to another sampling without regenerating it. Resample keeps the Map's own sampling.
- A live preview of the lattice inside the dialog.

## Further Notes

- **Performance (measured).** `findCell` takes about 0.33 µs per call on a 100,000-point Grid (Node, random points), against 0.03 µs for `Lattice.findSlot`. Drawing hachures and coastal waves on a 10,000-point Map made about 19,000 calls: 36 ms of a 1,053 ms draw.
- **Reference:** PR #1100 (draft, 2024) holds the original hex point placement. Its hex lookup picked the nearest candidate by `|dx| + |dy|` instead of true distance, and should not be ported.
