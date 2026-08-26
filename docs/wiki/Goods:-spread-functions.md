Every raw good in Fantasy Map Generator has a **distribution** expression that decides which cells are eligible to receive it. This page documents how distribution expressions work today, the built-in functions you can use in them, and where to edit them in the UI.

Goods are generated before states and cultures, so distributions are built purely on top of geographical data (height, temperature, biome, shoreline, rivers). Whenever a good's distribution changes, that good needs to be regenerated (or the whole Goods layer regenerated) to reflect the new expression.

# Technical info

A distribution is a small JS-like boolean expression evaluated once per cell. If it returns `true`, the cell is *eligible* — the good may still not end up there, because each good also has a `chance` (0–5, how often it's rolled per cell) and a per-map cap on how many cells any one raw good can occupy (roughly `200 × totalCells / 5000`, rounded up). Expressions support the usual JS logical operators: `!` (not), `&&` (and), `||` (or), and parentheses for grouping.

The functions below are the only building blocks available inside a distribution string (see `getMethods()` in `src/generators/goods-generator.ts`):

* `random(number)`: percentage chance of being true, e.g. `random(50)` returns true for about half of cells it's checked on.
* `nth(number)`: true for every Nth cell by cell id. `nth(2)` keeps roughly 1 in 2 cells, `nth(5)` keeps roughly 1 in 5.
* `minHabitability(number)`: true if the cell's biome habitability is at or above `number` (0–100). This is the eligibility gate — use it to rule biomes like glaciers or deep ocean in or out outright.
* `habitability()`: a *weighted* check against biome habitability — always true at habitability 100, always false at 0, and roughly a 50% chance at habitability 50. Use it (instead of, or together with, `minHabitability`) when you want frequency to scale smoothly with how livable a biome is, rather than a hard cutoff.
* `elevation()`: a weighted check against cell height — the higher the cell, the greater the chance of true. Negate it (`!elevation()`) if you want a good to favor lower elevations instead.
* `biome(id, id, ...)`: true if the cell's biome id is in the list. See "Biome ids" below.
* `minHeight(number)`: true if cell height is at or above `number`. Height is on the map's internal 0–100 scale, where `20` is roughly sea level and higher values are progressively more elevated (around `50` for highlands, `70` for mountains).
* `maxHeight(number)`: true if cell height is at or below `number`.
* `minTemp(number)`: true if the cell's average temperature (°C) is at or above `number`.
* `maxTemp(number)`: true if cell's average temperature is at or below `number`.
* `shore(ring, ring, ...)`: true if the cell's distance-to-shore ring matches. `1` = coastal land (land adjacent to water), `2` = next land ring inland, `-1` = shallow water adjacent to land, `-2` = deeper water, and so on.
* `type(string, string, ...)`: true if the cell's water feature type matches. Ocean-connected water is `"ocean"`; lake subtypes are `"freshwater"`, `"salt"`, `"sinkhole"`, `"frozen"`, `"lava"`, and `"dry"`.
* `river()`: true if a river flows through the cell.

There is no longer a standalone `habitable()` function — it was replaced by `minHabitability(n)`. Any old custom expression using `habitable()` will fail; rewrite it as `minHabitability(1)` (or another threshold) or as `habitability()` if you actually wanted the weighted check.

### Biome ids

Biome ids depend on the current biomes configuration and can be renumbered by biome edits, so don't hard-code them from memory. To get the current, authoritative list, run this in the FMG browser console (F12):

```js
pack.biomes.map((b, i) => `${i}: ${b.name}`)
```

For a freshly generated map the defaults are typically Marine, Hot desert, Cold desert, Savanna, Grassland, Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga, Tundra, Glacier, Wetland (ids 0–12) — but treat this as a starting point, not a guarantee.

# Editing distributions in the UI

You don't have to hand-write these expressions. The Goods Editor's **Distribution Editor** (opened per-good) provides a visual builder: pick a function from a dropdown, fill in its parameters (with pickers for biomes, shore rings, and waterbody types), optionally negate a condition, and combine conditions with AND within a group and OR across groups. It shows the generated expression live, a plain-language interpretation of it, and how many cells (and what percentage of the map) currently qualify — so you can sanity-check a model before applying it. The raw expression field is still shown and editable directly if you prefer to type it.

# Examples

Want a good that appears in hot, highly elevated areas, with rarer appearances at medium altitude?

```
minTemp(15) && (minHeight(70) || (minHeight(40) && nth(5)))
```

Want frequency to vary by biome, with each biome thinned out differently?

```
biome(1) || (biome(2) && nth(2)) || (biome(3) && nth(3))
```

## Current built-in goods

There's no longer a separate library of named, reusable "spread models" to pick from — each good in the built-in catalogue (`GOODS_DATA` in `src/generators/goods-generator.ts`) carries its own bespoke `distribution` string directly. A few representative examples from the current catalogue:

| Good | Distribution |
|---|---|
| Wood | `biome(5, 6, 7, 8, 9)` |
| Stone | `(minHeight(40) \|\| (minHeight(20) && elevation())) && biome(1, 2, 3, 4)` |
| Iron | `minHeight(60) \|\| (biome(12) && nth(7)) \|\| (minHeight(20) && nth(10))` |
| Gold | `river() && minHeight(40)` |
| Grain | `minHabitability(20) && habitability()` |
| Fish | `shore(-1) && (type("ocean", "freshwater", "salt") \|\| (river() && shore(1, 2)))` |
| Salt | `shore(1) && type("salt", "dry") \|\| (biome(1, 2) && random(70)) \|\| (biome(12) && nth(10))` |
| Whales | `shore(-1) && type('ocean') && maxTemp(7)` |
| Dyes | `shore(-1) \|\| minHabitability(1)` |

To see every built-in good's actual distribution (and every other field), open the Goods Editor in the app, or read `GOODS_DATA` in `src/generators/goods-generator.ts` directly — it's the single source of truth and can change between versions.

Some goods have no `distribution` at all (an empty `chance: 0`), because they aren't placed on the map by cell eligibility — they're purely **manufactured**, produced from other goods via `recipes` (e.g. Tools, Arms, Cloth, Beer).

# Beyond placement: production and the market

Cell placement (what this page covers) decides where a raw good's *bonus resource* can appear on the map — it's only one part of the current goods system. Separately, each good can also define:

* `biomeOutput` — a baseline amount produced by ordinary rural population in matching biomes, regardless of whether the bonus resource was placed there.
* `recipes` — one or more input combinations that let a good be manufactured from other goods (used by the production/market simulation, not by cell placement).

These feed into burg production, trade, and the market/price system, which are documented separately from spread functions — see `docs/domain/goods_schema.md` in the repository for the full goods/markets/production model.
