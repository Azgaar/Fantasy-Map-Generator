# Development

A cell's technological **development**: how advanced its people are, from hunter-gatherers to a post-human civilization. It is set by the cultures and varies over the land, and it decides what the land can produce and how much, who picks a trade first in the economy's day, and whether a state is a kingdom or a tribe. The user guide is the [Development wiki page](../wiki/Development.md).

Development is a world-building lever, not a simulation: it does not grow over time. The culture set decides a map's development: a medieval set gives a medieval world with a few leaders and a few laggards, the Antique set a classical one.

## Elements

| Element                            | Code                                                                                                                    | Persisted state                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| The eras and culture type offsets  | [data/development.ts](../../src/data/development.ts)                                                                    | nothing                                     |
| Culture levels                     | `Cultures.getDefault` ([cultures-generator.ts](../../src/model/society/cultures-generator.ts))                          | `culture.development`                       |
| Biome offsets                      | `Biomes.getDefault` ([biomes-generator.ts](../../src/model/physical/biomes-generator.ts))                               | `biome.development`                         |
| The cell field                     | `Development` ([development-generator.ts](../../src/model/society/development-generator.ts))                            | `pack.cells.development` (`.map` record 55) |
| Goods' tiers                       | `GOODS_DATA` ([data/goods.ts](../../src/data/goods.ts))                                                                 | `good.development`                          |
| Tiers, productivity and turn order | `Production` ([production-generator.ts](../../src/model/economy/production-generator.ts))                               | nothing                                     |
| Overlay, colored by era            | `drawDevelopmentOverlay`, `getEraColor` ([development-overlay.ts](../../src/renderers/overlays/development-overlay.ts)) | nothing: drawn while the editor is open     |
| State titles                       | `States.getTribalForm` ([states-generator.ts](../../src/model/political/states-generator.ts))                           | `state.formName`                            |
| Editor, statistics and brush       | `DevelopmentEditor` ([development-editor.ts](../../src/controllers/society/development-editor.ts))                      | nothing                                     |
| Era names                          | `ErasEditor` ([eras-editor.ts](../../src/controllers/society/eras-editor.ts))                                           |

## The scale

1–100, a custom historical scale that ends where the Kardashev scale begins; 0 is no development, where nobody lives (no people, no data). Up to the Late Middle Ages each era takes three points, so the medieval world sits low and most of the scale is left for modern and futuristic worlds:

| Level | Era               | Level | Era                   |
| ----- | ----------------- | ----- | --------------------- |
| 1     | Paleolithic       | 33    | Commercial Revolution |
| 3     | Mesolithic        | 36    | Late Middle Ages      |
| 6     | Neolithic         | 40    | Renaissance           |
| 9     | Copper Age        | 45    | Age of Discovery      |
| 12    | Bronze Age        | 50    | Scientific Revolution |
| 15    | Late Bronze Age   | 60    | Enlightenment         |
| 18    | Iron Age          | 70    | Industrial Revolution |
| 21    | Classical Age     | 80    | Machine Age           |
| 24    | Late Antiquity    | 90    | Space Age             |
| 27    | Early Middle Ages | 100   | Post-human            |
| 30    | High Middle Ages  |       |                       |

These are the default names, and arbitrary: the eras are a definition set in `options.map.eras`, each from the level it begins at, and the user renames them in the Eras editor. Nothing points at an era by name, and no rule reads one. `Development.getEra(level)` returns a level's era name, and the views show it through `eraName`: a default name translates through `ERA_LABELS` ([id-labels.ts](../../src/data/id-labels.ts)), the user's own stays as typed. What each era brings is in the wiki page. Constants that move a cell by an era use three points.

## Culture levels

Each predefined culture carries its own `development` in `Cultures.getDefault`, its level before its type's offset. Levels are per culture, not per name base: the Antique set's Germanic (16) and the medieval Shwazen (36) share a name base but not an era.

| Set          | Range | Typical | Leaders                                            | Laggards                                  |
| ------------ | ----- | ------- | -------------------------------------------------- | ----------------------------------------- |
| All-world    | 6–42  | 35      | Tallian, Hantzu 42; Luari, Eurabic 40              | Inuk 6, Maui 12, Nawatli 18, Inqan 20     |
| European     | 28–42 | 36      | Tallian 42, Luari 40                               | Soumi 28                                  |
| Oriental     | 12–42 | 35      | Hantzu 42, Eurabic 40                              | Maui 12, Ulus 26                          |
| English      | 36    | 36      | none                                               | none                                      |
| Antique      | 12–24 | 21      | Roman 24, Hellenic 23                              | Estian 12, Scythian 15                    |
| High Fantasy | 8–53  | 32      | Khazadur 53, Dunirr 50, Eldar 46, Quenian 44       | Yotunn 8, Arago 12, Ugluk 15, Uruk 18     |
| Dark Fantasy | 8–53  | 35      | Durinn 53, Eldar 46, Hetallian and Hantzu 42       | Yotunn 8, Rakhnid 12, Uruk and Kobblin 18 |
| Random       | 15–42 | —       | a hash of the culture's name, `getNameDevelopment` |                                           |

- **Random set**: the level comes from a hash of the name, 15–42, so generating it draws nothing from the map's random sequence. Drawing a number would shift every later step of generation.
- **Added cultures**: `Cultures.add` takes the level of the default culture it copies, or of the culture it is modeled on.
- **No level**: a culture without one counts as 33 (`DEFAULT_DEVELOPMENT`), the Commercial Revolution. Wildlands (culture 0) are 3 (`WILDLANDS_DEVELOPMENT`), foragers.
- **Type offset** (`CULTURE_TYPE_DEVELOPMENT`), applied when the field is made, not stored: Naval +3, River +2, Lake +1, Generic 0, Highland −2, Nomadic −3, Hunting −4.

## The field

`Development.generate()` writes `pack.cells.development`, a `Uint8Array` of 1–100 on peopled cells (`isPeopled`: land with rural people or a burg) and 0 elsewhere; the steps below work over all land, so empty land still carries the field between peoples. It runs in `O(n)`.

1. **Culture**. Each land cell starts at its culture's level, with the type offset (`ofCulture`). Wildlands take 3.
2. **Land**. Each biome adds its own offset (`biome.development`, in the biomes data and saved with the map; a custom biome starts at 0, older maps' generated biomes get theirs on load): temperate deciduous forest +2, grassland, temperate rainforest and marine 0, savanna and tropical seasonal forest −1, wetland −2, taiga and tropical rainforest −3, hot desert −4, cold desert and tundra −5, glacier −8. The Biomes editor edits them (`Biomes.setDevelopment`). It does not follow habitability, which sets population. A river and the coast add 1 each.
3. **Smoothing** (`smooth`). Two passes average each land cell with its land neighbors (`SMOOTHING`): the borders between peoples and biomes become short slopes instead of steps.
4. **Noise**. Smooth value noise in two octaves of about three waves across the map, ±9 (`NOISE`, `WAVES`), seeded by a hash of the map seed: the broad rises and dips within a people, its main source of variety (about 3 points of the 3.6 a cell typically differs from its culture's mean).

A generated burg's cell is at least 5 (`MIN_BURG`), a town being past the foragers' era; painting may set it lower. A burg added, moved or regenerated later settles its cell (`Development.settle`): a cell with none takes the best level of the land around, and the cell is raised to 5. A cell a burg leaves, moved, removed or dropped by Regenerate Burgs, goes back to 0 if nobody else lives there (`vacate`). Regenerating population resettles the land (`resettle`): land newly peopled takes the best level around it, at least 1, and land left empty has none; painted levels of land that stays peopled are kept. Resample, submap and heightmap edits carry development over with the peopled cells, painted levels included, and generate it for land the old map had no people on (`MapRestoration.restoreDevelopment`): there its 0 means nobody lived there, not a painted level. Development is otherwise not updated by later edits: regenerate it after changing cultures, their levels or biomes. Maps older than v1.157.0 get it generated on load, and their default goods their tiers; loading does not rerun the economy. On the tuner's maps neighboring cells differ by about 0.9 points on average.

## When it runs

- **Generation**: its own step in the generation and erosion pipelines, right after routes, so state forms and markets can read it ([generation-pipeline.ts](../../src/model/generation-pipeline.ts)). It reads the cultures, burgs, rivers, coast and biomes, and draws no random numbers, so its place does not change the rest of the map.
- **Map restoration** (resample, submap, heightmap edits): `restoreDevelopment` carries each peopled cell's level over, painted levels included, and generates it for land that had no people, before the economy is rebuilt.
- **Load**: read from `.map` record 55. A map older than v1.157.0 gets it in auto-update (`addDevelopment`): cultures without a level get the predefined culture's of the same name (`Cultures.getDefaultDevelopment`), skipping the English and Random sets that name at random, and the field is made. Its default goods get their tiers by name (`Goods.getDefaultDevelopment`).
- **Not on edits**: changing a culture, its level or type or a biome's offset does not remake the field; routes never enter it; the economy reads it as it was made. The Development Editor's Regenerate makes it again. Burgs and population keep it in step on their own (see above).

## Editing

The Development Editor (Tools → Development, Shift + X) shows the land by era (`collectDevelopmentStatistics`: cells, area, people and burgs, and the people's average weighted by rural and urban population) over an overlay of the eras (`drawDevelopmentOverlay`, in the `debug` layer), drawn while it is open and kept under its brush; development has no layer of its own. A percent button shows each era's share of the totals. Its brush is the shared `PaintEditor` with the eras as items, in order (`keepOrder`): a painted peopled cell is set to the level its era begins at (`Development.setCells`, 0–100; empty land stays at 0), or to 0 with the brush's first item, No development, and painting a cell's own era leaves its level as it is. Painted levels stay until development is regenerated; the economy reads them on its next run.

The States, Provinces and Cultures editors and the Burgs Overview each have a Development column of their own, hidden by default. In the Cultures editor it is the culture's own level to edit (`Cultures.setDevelopment`, 1–100), with the people's average in the tip; the Biomes editor's column edits a biome's offset (`Biomes.setDevelopment`, −50 to 50). Both take effect when development is regenerated, and both are in the editors' CSV files. The Assistant can set them, paint cells (`Development.setCells`) and regenerate development. `Development.getAverages(cells.state)` and the like give development weighted by population by entity: rural people by cell, townspeople by burg at the urbanization rate; land with no people or no development does not count, and an entity with no people has none. A culture's tip adds its heartland level (`ofCulture`). A burg shows its cell's level, in the editor, the Burg Editor and Burg Economy. The Goods Editor has a Development column for the tiers, which Edit Good sets (`Goods.setDevelopment`, 0 for none). The views format a level and its translated era with [development-view.ts](../../src/ui/development-view.ts).

## What it does

- **Technology tiers**. `good.development` is the least development a cell needs to produce the good, raw or made. In `getModifiers`, a cell below it gets a multiplier of 0 (a water cell's deposit is worked from the shore and takes the best level of the land around it, `Development.ofCell`): it gathers none of the good, and a burg there neither makes it nor works its deposit. A good without a tier needs none. Tiers follow the era the good was first traded in, anywhere. Foragers below 6 live on game, fish, honey and furs. A backward region sells raw goods and buys what it cannot make.
- **Productivity**. Past the High Middle Ages a cell makes more of every good it can: `getModifiers` multiplies by development ÷ 30 (`PRODUCTIVITY_START`), ×1.5 at 45 and ×2 at 60, for rural output, deposits and a burg's workers alike. Below 30 it is 1, so laggards lose nothing twice: the tiers already hold them back. The extra supply makes goods cheaper everywhere.
- **Turn order**. Burgs take their turns in the economy's day by √population × development, the most first (`getTurnOrder`): the advanced pick the best trades first, and size counts less than development.
- **State titles**. A state whose capital stands below the Bronze Age (12, `TRIBAL_DEVELOPMENT`) is titled as a people without kingdoms (`States.getTribalForm`): a monarchy is a Tribe, a Chiefdom or, for the largest, a Paramount Chiefdom, and a Horde if Nomadic; a republic is a Tribal Council, a union a Clans Union and a theocracy a Shamanate. The title is rolled as before and then replaced, so the random draws of the rest of the map do not shift. On random maps about one state in twenty is tribal, mostly in fantasy sets.

## Gotchas

- **Never draw from `Math.random`**: the noise and the Random set's levels are hashes. A draw in this step would shift markets, military, markers and zones on every new map.
- **Saltpeter's tier is low on purpose**. Each map has only 2–4 saltpeter deposits; at its era's tier, a map whose deposits fell in backward land made no gunpowder at all. The requirement sits on gunpowder.
- **Dwarves and elves start above their era** (dwarves 50–53, elves 44–46). Their land is pulled down by their types (dwarves often get Highland, Hunting or Nomadic) and by small homelands averaged with lower neighbors: on random maps dwarves' people averaged about 9 points below their culture's level, elves about 4. The levels make up for it.
- **Antique maps make no artillery and little gunpowder**: their best cultures stand at 24, 27 for Naval Romans, and only a few cells reach 30, on the noise's crests. That is the set's era, not a bug.
- **Tiers are absolute**: raising every culture by an era makes more goods available everywhere; the KPIs of the [economy](economy.md#kpis) shift with it.

## Measured

On the economy tuner's ten maps:

- **Spread**: medieval maps' median burg stands at 32–41, their best at 44–57; the Antique map's median is 17, its best 25.
- **Gunpowder and artillery**: made on nine maps in ten, all but the Antique one.
- **Wealth**: burgs below half their needs are 87% under 10, 60% under 30, 25% at 30–39 and 5% at 40 or more; product per worker is 1.5 at 10–19 and 8.3 at 40 or more.
- **Goods**: about 93% of the catalogue is made on a map. Tropical goods (incense, spices, sugar, mahogany) often fall in land below their tier and are missing on some maps.
- **Cost**: the economy run is as fast as before.

## Further reading

- [Development wiki page](../wiki/Development.md): the scale's eras and what they bring.
- [Economy](economy.md): the day the tiers, productivity and turn order shape.
- [Culture sets](../wiki/Culture-sets.md) and [Culture types](../wiki/Culture-types.md).
