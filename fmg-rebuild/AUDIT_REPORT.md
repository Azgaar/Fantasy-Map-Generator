# Comparative Audit Report: fmg-rebuild vs. Original FMG

This report evaluates the current functional completeness of the rebuilt codebase (`fmg-rebuild/`) in comparison with the original Fantasy Map Generator (FMG) source files. It identifies exactly what has been ported, the size ratios, and the algorithmic gaps remaining to reach 100% feature parity.

---

## 1. File-by-File Comparison & Parity Ledger

The following ledger lists key original simulation files in `src/modules/` alongside their corresponding rebuild implementations in `fmg-rebuild/simulation/`.

| Original FMG File | Size (Bytes) | Rebuild Implementation File | Size (Bytes) | Size Ratio | Algorithmic Parity Level | Remaining Gaps / Action Items |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`voronoi.ts`** | 7,982 | `simulation/grid/grid-generator.ts` | 5,440 | 68% | **High** | Delaunator integration is complete. Rebuild features coordinates packing and jittered grids. |
| **`heightmap-generator.ts`** | 19,537 | `simulation/heightmap/heightmap-generator.ts` | 15,048 | 77% | **High** | Standard heightmap template parser (Hill, Strait, Smooth, Mask commands) is successfully ported. |
| **`river-generator.ts`** | 21,177 | `simulation/hydrology/hydrology-generator.ts` | 5,140 | 24% | **Medium** | Rebuild has flow accumulation (flux) and direction routing, but is missing coordinates-based meander route generation. Rivers will render as straight lines. |
| **`biomes.ts`** | 7,255 | `simulation/biomes/biomes-generator.ts` | 4,008 | 55% | **High** | Whittaker climate classification matrix is fully ported. |
| **`names-generator.ts`** | 113,753 | `simulation/civilization/name-generator.ts` | 1,851 | 1.6% | **Low (Skeletal)** | Missing 110KB+ of name syllables and linguistic bases. Currently uses simple randomized string output. |
| **`cultures-generator.ts`** | 35,786 | `simulation/civilization/culture-generator.ts` | 3,246 | 9% | **Low (Skeletal)** | Missing Dijkstra-based terrain weight expansion, culture center calculations, and habitability scoring. |
| **`states-generator.ts`** | 29,753 | `simulation/civilization/state-generator.ts` | 3,038 | 10% | **Low (Skeletal)** | Missing expansion distance cost algorithms (states expanding slower over mountains/biomes) and capital seeding. |
| **`burgs-generator.ts`** | 29,339 | `simulation/civilization/burg-generator.ts` | 3,577 | 12% | **Low (Skeletal)** | Missing placement rating equations (harbors, crossroads, defensive layouts, and capital status). |
| **`goods-generator.ts`** | 30,178 | `simulation/civilization/goods-generator.ts` | 1,334 | 4.4% | **Low (Skeletal)** | Missing detailed goods catalogs, production resource inputs, and specific raw vs manufactured tags. |
| **`production-generator.ts`** | 30,164 | `simulation/civilization/production-generator.ts` | 912 | 3% | **Low (Skeletal)** | Missing equations calculating production volumes, consumption, sales taxes, and treasuries. |
| **`routes-generator.ts`** | 29,597 | `simulation/civilization/route-generator.ts` | 3,292 | 11% | **Low (Skeletal)** | Missing pathfinding routes generation (A* search) mapping land trails, main roads, and sea lanes. |

---

## 2. Technical Gap Breakdown

### 2.1 Name Generation Databases
* **Original Logic:** `names-generator.ts` is the largest module because it embeds over 100 syllable sets and rules for phonetic generation representing dozens of distinct fantasy/historical cultures.
* **Rebuild Gap:** The rebuild `name-generator.ts` is only a stub. It cannot generate culturally-coherent names for burgs, rivers, or states.
* **Action:** Port the static syllable arrays and generator rules into a dedicated config file (e.g. `core/name-bases.ts`) and import it.

### 2.2 River Pathing & Meanders
* **Original Logic:** Rivers flow along cell gravity lines, but FMG interpolates points to create smooth, meandering curves with branching logic.
* **Rebuild Gap:** The current hydrology module only maps flow vectors between Voronoi cell centers.
* **Action:** Implement Bézier/Catmull-Rom coordinate interpolation to convert cell flow vectors into smooth river paths.

### 2.3 Terrain-Weighted Expansion (Dijkstra's Algorithm)
* **Original Logic:** States, cultures, and religions expand outward from seeds. The cost to expand into an adjacent cell depends on biomes, heights, and water bodies (e.g. crossing a mountain range costs significantly more than crossing a flat grassland).
* **Rebuild Gap:** The rebuild relies on simple radial/BFS distance calculations, resulting in perfectly circular kingdoms.
* **Action:** Implement a terrain-weighted Dijkstra shortest path solver on the Voronoi cell graph to shape realistic, natural political borders.

---

## 3. UI & Frontend Monolith Audit

* **Original Interface:** Located inside a single massive [index.html](file:///c:/Users/krazy/Desktop/Fantasy-Map-Generator/src/index.html) (838 KB) and non-migrated UI files in `public/modules/ui`. It mixes SVG layouts, CSS filters, modal scripts, and rendering logic.
* **Rebuild UI:** Located in `/frontend/src/index.html` and `/frontend/src/main.ts`. It correctly uses a clean Canvas viewport and separates styles from calculations.
* **Remaining Parity Task:** To achieve feature parity, the various editors (Burg Editor, State Editor, Heightmap Brush tools) must be rewritten as modular UI widgets rather than raw inline HTML nodes.
