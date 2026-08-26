# 🚧 Under construction

Goods **spread models** are applied to check whether goods can or cannot be placed in a cell. Fantasy Map Generator allows to create custom spread models, but it requires some understanding on how models work. Goods are generated before states and cultures, so models are built on top of geographical data. Once model is changed, you need to regenerate all goods.

# Technical info
Technically spread models are expressions evaluated for each cell to return `true` or `false`. If `true` is returned, the good can be placed in the cell. The expressions are valid JS functions, you can use logical operators (`!` for not, `||` for OR, `&&` for and, etc.) and other features.

The options are limited to a number of build-in functions. These functions make models syntax easier to read and write:
* `random(number)`: percentage of true, e.g. `50` will return true in 50% of cases
* `nth(number)`: true for each only n-th cell: 1st, 2nd, 3rd and so on. For example `nth(2)` skips 1/2 (50%) of cells and `nth(5)` skips 4/5 (80%) of cells.
* `habitable()`: true if biome habitability is greater than 0
* `habitability()`: check against biome habitability. Always true for habitability `>=100`, false for `0`, skips 50% of cells if habitability is `50` and so on
* `elevation()`: check against cell's height - the higher cell is, the greater chance is. If you need a good to be more frequent in lower elevation areas, than just negate the function: `!elevation()`
* `biome(biomeId, biomeId, ...)`: check against list of biome ids, see below to get biome id reference
* `minHeight(number)`: true if cell height >= number. Number is in range `[0-100]`, where `0` is deep ocean and `20` is minimal land elevation
* `maxHeight(number)`: true if cell height <= number
* `minTemp(number)`: true if cell temperature (in Celsius) >= number
* `maxTemp(number)`: true if cell temperature <= number
* `shore(ringId, ringId, ...)`: check against distance to the closest shoreline. `1` is land cells next to water (coastline), `2` - next land ring, `-1` - water cells next to land (shallow water), `-2, -3, ...` - deeper water cells
* `type(string, string, ...)`: check against cell type. Types of all water cells connected to map border is `ocean`, lake types are `freshwater`, `salt`, `sinkhole`, `frozen`, `lava` and `dry`. Land types are defined not so clear, so I don't recommend to use them. In any case land types are `continent`, `island`, `isle` and `lake_island`
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

These are the default biomes. To get actual ids run `biomesData.name.map((n,i) => i+". "+n)` in FMG console (F12).

# Examples

Let's say we want a a good to be generated in hot and highly elevated areas. If altitude is medium, let it also be allowed, but pretty rarely. The model will be something like `minTemp(15) && (minHeight(70) || minHeight(40) && nth(5))`.

Another usual case is when we want a good frequency vary based on biomes. In this case you need to join multiple `biome()` functions like `biome(1) && (biome(2) && nth(2)) && (biome(3) && nth(3))`.

Check the build-in models below to get the gist.

### Built-in models
* Deciduous_forests: `biome(6, 7, 8)`
* Any_forest: `biome(5, 6, 7, 8, 9)`
* Temperate_and_boreal_forests: `biome(6, 8, 9)`
* Hills: `minHeight(40) || (minHeight(30) && nth(10))`
* Mountains: `minHeight(60) || (minHeight(40) && nth(10))`
* Mountains_and_wetlands: `minHeight(60) || (biome(12) && nth(8))`
* Headwaters: `river() && minHeight(40)`
* Biome_habitability: `habitability()`
* Marine_and_rivers: `type("ocean", "freshwater", "salt") || (river() && shore(1, 2))`
* Pastures_and_temperate_forest: `(biome(3, 4) && !elevation()) || (biome(6) && random(70)) || (biome(5) && nth(5))`
* Tropical_forests: `biome(5, 7)`
* Arid_land_and_salt_lakes: `type("salt", "dry") || (biome(1, 2) && random(70)) || (biome(12) && nth(10))`
* Hot_desert: `biome(1)`
* Deserts: `biome(1, 2)`
* Grassland_and_cold_desert: `biome(3) || (biome(2) && nth(4))`
* Hot_biomes: `biome(1, 3, 5, 7)`
* Hot_desert_and_tropical_forest: `biome(1, 7)`
* Tropical_rainforest: `biome(7)`
* Tropical_waters: `shore(-1) && minTemp(18)`
* Hilly_tropical_rainforest: `minHeight(40) && biome(7)`
* Subtropical_waters: `shore(-1) && minTemp(14)`
* Habitable_biome_or_marine: `shore(-1) || habitable()`
* Foresty_seashore: `shore(1) && biome(6, 7, 8, 9)`
* Boreal_forests: `biome(9) || (biome(10) && nth(2)) || (biome(6, 8) && nth(5)) || (biome(12) && nth(10))`
* Less_habitable_seashore: `shore(1) && habitable() && !habitability()`
* Less_habitable_biomes: `habitable() && !habitability()`
* Arctic_waters: `biome(0) && maxTemp(7)`