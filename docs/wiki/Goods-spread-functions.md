A good **distribution** is an expression that decides whether the good can be placed in a cell. Fantasy Map Generator allows you to write custom distributions, but it requires some understanding of how they work. Goods are generated before states and cultures, so distributions can only rely on geographical data. Once a distribution is changed, the good placement has to be regenerated — the _Goods Editor_ does that for the edited good.

# How placement works

Cells are processed in random order. For every cell the generator walks the (reshuffled) list of goods and takes the first good that passes all of these checks:

1. the good has both a distribution and a non-zero **chance**;
2. the good has not yet reached its cell cap of `ceil(200 × cells count / 5000)` cells;
3. a random roll against the good `chance` (in percent) succeeds;
4. the distribution expression evaluates to `true`.

A cell holds at most one good. Glacier cells are skipped entirely while the Glacier biome habitability is `0`. Because goods are reshuffled as the generator walks the map, no good gets a systematic advantage over the others.

# Technical info
Technically a distribution is an expression evaluated for each cell to return `true` or `false`. If `true` is returned, the good can be placed in the cell. The expression is plain JS, so you can use logical operators (`!` for NOT, `||` for OR, `&&` for AND) and parentheses.

The expression can only call the built-in functions below. They make the syntax easier to read and write:
* `random(number)`: percentage of true, e.g. `50` will return true in 50% of cases
* `nth(number)`: true only for every n-th cell (cells whose id is divisible by the number). For example `nth(2)` skips 1/2 (50%) of cells and `nth(5)` skips 4/5 (80%) of cells. Unlike `random()`, this is deterministic for a given cell
* `minHabitability(number)`: true if biome habitability is at least the supplied value
* `habitability()`: check against biome habitability. Always true for habitability `>=100`, false for `0`, skips 50% of cells if habitability is `50` and so on
* `elevation()`: random check against the cell height — the higher the cell, the greater the chance. To make a good more frequent in low areas, negate it: `!elevation()`. The function takes no arguments; anything passed to it is ignored
* `biome(biomeId, biomeId, ...)`: check against list of biome ids, see below to get biome id reference
* `minHeight(number)`: true if cell height >= number. Number is in range `[0-100]`, where `0` is deep ocean and `20` is minimal land elevation
* `maxHeight(number)`: true if cell height <= number
* `minTemp(number)`: true if cell temperature (in Celsius) >= number
* `maxTemp(number)`: true if cell temperature <= number
* `shore(ringId, ringId, ...)`: check against distance to the closest shoreline. `1` is land cells next to water (coastline), `2` - next land ring, `-1` - water cells next to land (shallow water), `-2, -3, ...` - deeper water cells
* `type(string, string, ...)`: check against the feature subtype (or feature type). Types of all water cells connected to map border is `ocean`, lake types are `freshwater`, `salt`, `sinkhole`, `frozen`, `lava` and `dry`. Land subtypes are `continent`, `island`, `isle` and `lake_island`
* `river()`: true if there is a river in the cell

### Biomes ids

* 0: Marine;
* 1: Hot desert;
* 2: Cold desert;
* 3: Savanna;
* 4: Grassland;
* 5: Tropical seasonal forest;
* 6: Temperate deciduous forest;
* 7: Tropical rainforest;
* 8: Temperate rainforest;
* 9: Taiga;
* 10: Tundra;
* 11: Glacier;
* 12: Wetland.

These are the default biomes. Biomes can be edited in the _Biomes Editor_, so to get the actual ids of your map run `pack.biomes.map(b => b.i + ". " + b.name)` in the browser console (F12).

# Examples

Let's say we want a good to be generated in hot and highly elevated areas. If the altitude is medium, let it also be allowed, but rarely. The expression will be something like `minTemp(15) && (minHeight(70) || (minHeight(40) && nth(5)))`.

Another common case is a good whose frequency varies by biome. Combine `biome()` with `nth()` or `random()`: `biome(1) || (biome(2) && nth(2)) || (biome(3) && nth(3))`.

## Default catalogue

The distributions used by the built-in goods, as a starting point for your own:

| Good | Distribution |
| --- | --- |
| Wood | `biome(5, 6, 7, 8, 9)` |
| Stone | `(minHeight(40) || (minHeight(20) && elevation())) && biome(1, 2, 3, 4)` |
| Marble | `minHeight(60) || (minHeight(30) && elevation())` |
| Iron | `minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10))` |
| Copper | `minHeight(60) || (minHeight(30) && elevation())` |
| Tin | `minHeight(60) || (minHeight(30) && elevation())` |
| Silver | `minHeight(60) || (minHeight(30) && elevation())` |
| Gold | `river() && minHeight(40)` |
| Grain | `minHabitability(20) && habitability()` |
| Cattle | `(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))` |
| Fish | `shore(-1) && (type("ocean", "freshwater", "salt") || (river() && shore(1, 2)))` |
| Game | `biome(5, 6, 7, 8, 9)` |
| Wine | `biome(6) || (biome(4) && random(50) && river())` |
| Olives | `biome(3) && shore(1, 2)` |
| Honey | `biome(6, 8, 9)` |
| Salt | `shore(1) && type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))` |
| Dates | `biome(1)` |
| Horses | `biome(3) || (biome(2) && nth(4))` |
| Elephants | `biome(1, 3, 5, 7)` |
| Camels | `biome(1, 2)` |
| Hemp | `biome(6, 7, 8)` |
| Pearls | `shore(-1) && minTemp(18)` |
| Gemstones | `minHeight(60) || (minHeight(30) && elevation())` |
| Dyes | `shore(-1) || minHabitability(1)` |
| Incense | `biome(1, 7)` |
| Silk | `biome(7)` |
| Spices | `biome(7)` |
| Amber | `shore(1) && biome(6, 7, 8, 9)` |
| Furs | `biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))` |
| Sheep | `(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))` |
| Slaves | `shore(1) && minHabitability(1) && !habitability()` |
| Tar | `biome(1, 2) || (minHeight(50) && random(20))` |
| Coal | `minHeight(40) || (minHeight(20) && elevation())` |
| Oil | `biome(1, 2, 10) || (shore(-1) && minTemp(18) && random(15))` |
| Mahogany | `biome(5, 7) && random(50)` |
| Whales | `shore(-1) && type("ocean") && maxTemp(7)` |
| Sugarcane | `biome(7)` |
| Tea | `minHeight(40) && (biome(5) || (biome(7) || biome(8)))` |
| Tobacco | `random(20) && (biome(3) || (biome(5) || biome(6)))` |
| Clay | `minTemp(8) && (shore(1) || river())` |
| White sand | `minTemp(8) && (shore(1) || river())` |
