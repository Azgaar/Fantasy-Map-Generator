Advanced options hold settings for experienced users. Open the **Options** tab and click **Advanced** in the **Configure** row at the bottom.

Hover a setting to see what it does in the tooltip. The dialog has two sections.

## Map settings

These apply to the **next generated map**: the map on screen keeps what it was made with. The **New Map** button at the bottom of the dialog generates one right away.

- **Map size**: the coordinate extent of the next map, in pixels. It is fixed for the life of the map. The arrow on the left resets it to the browser window size. It is not the Viewport size in Options, which is only how much of the map you see. For full-globe maps use aspect ratio 2:1.
- **Lattice**, **Sampling** and **Jitter**: the grid the map cells are built on, described below.
- **Provinces ratio**: the share of eligible burgs in each state that become province centers. Higher values create more provinces.
- **Size variety**: how much states and cultures can differ in size. Lower values make them more uniform.
- **Growth rate**: how far states and cultures expand into neutral lands. Lower values leave more land neutral.

The lock icons work as in Options: a locked value is kept for every new map instead of being randomized.

### Lattice

Every map is built on a grid of points, and each point becomes a cell. **Lattice** is a preset that sets Sampling and Jitter together. Regular boards need jitter 0, which is easy to miss, so start from a preset:

| Lattice | Sampling | Jitter |
| --- | --- | --- |
| Default | Square grid | 0.9 |
| Organic hexes | Hex grid (pointy) | 0.5 |
| Hex board (pointy) | Hex grid (pointy) | 0 |
| Hex board (flat) | Hex grid (flat) | 0 |
| Square board | Square grid | 0 |
| Isometric board | Square 45 degrees grid | 0 |

It reads **Custom** when Sampling and Jitter match none of them. Pick **Default** to get back to the classic map.

**Sampling** is the lattice the points sit on:

| Sampling | Cells at jitter 0 | Use it for |
| --- | --- | --- |
| Square grid (default) | squares | the classic natural look at full jitter, tile engines |
| Hex grid (pointy) | hexagons with a vertex on top | wargames and hex-crawls with pointy-top sheets |
| Hex grid (flat) | hexagons with an edge on top | wargames and hex-crawls with flat-top sheets |
| Square 45 degrees grid | squares turned 45° (diamonds) | isometric game styles |
| Triangle grid (horizontal) | triangles, alternating up and down | experiments |

**Jitter** is how far each point may move off its lattice position, from 0 (perfectly regular cells) to 0.9 (the default). Lower values give a calmer look; a jittered hex grid gives an organic map with more even cells than the classic one.

Every sampling gives about as many cells as the Points setting asks for. Cells along the map edge keep the lattice shape where the edge lines up with it and are slightly wider where it doesn't.

On square, 45° and triangle grids at jitter 0, cells touching only at a corner still count as neighbours, so rivers, lakes and borders can occasionally cross a corner diagonally.

### How the grid settings are kept

- Sampling and Jitter are remembered in the browser until you change them. They are not randomized and cannot be pinned.
- A saved `.map` file keeps the sampling and jitter it was made with. Maps made before this setting existed open as Square grid at 0.9.
- The Transform and Submap tools keep the map's own sampling and jitter.
- The heightmap selection previews use the requested sampling.

To number the cells of a board, turn on the Cells layer and check **Indexes** in its style. Numbers are centered in the cells; the style sets their color, font, size and a halo stroke for contrast, and Shift x / Shift y move them, in font-size units, e.g. to the top of each hex.

To get a heightmap image that fits a square tile grid one cell per tile, generate with the Square board preset and export the heightmap image.

## Interface settings

These apply immediately and are kept in the browser:

- **Autosave interval**: how often, in minutes, the map is saved to browser storage. 0 turns autosave off.
- **On load**: generate a new map or open the last saved one when the page opens.
- **Speaker voice**: the voice used by the speaker buttons next to names. The speaker icon plays a test phrase.
- **Emblem shape**: the default coat of arms shield shape. Single emblems can still be changed in the Emblem Editor.

## Debugging

Diagnostics for checking how the generator works, kept in the browser. They may show more in dialogs or the browser console and record extra data while you work, but they never change what is saved in the `.map` file, so turning them on is always safe.

- **Economy**: the Economy Overview of a burg lists every step of its production run instead of a summary: what it weighed before making each good, every market it could have bought each good from with the price at its door, and the goods that could cover each of its needs. It records from the next production run (Tools → Regenerate → Production), which runs about three times slower while it is on.
- **Temperature**: logs sea temperatures by latitude to the browser console when the climate is generated.
- **Cloud storage**: logs cloud storage responses to the browser console.
