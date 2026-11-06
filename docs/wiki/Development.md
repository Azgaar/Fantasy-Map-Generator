Every cell where people live has a technological **development** from 1 to 100: how advanced its people are. Land nobody lives on, and water, have none (0). Development comes from the map's cultures: dwarves forge steel while giants still hunt with stone. It stays with each people, shaped by the land, and it decides what each region can produce and how rich it gets.

Development is part of the world's lore, not a clock: it does not grow over time.

# The scale

The scale runs from hunter-gatherers to a post-human civilization: a custom historical scale that ends in the Kardashev scale's reach for the stars. Up to the Late Middle Ages every era takes three points, so the medieval world of most maps sits low on the scale, and the rest is left for modern and futuristic worlds.

| Level | Era                   | What it brings                                                                                       |
| ----- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | Paleolithic           | Hunter-gatherers, stone tools, fire, simple shelters, bone weapons                                   |
| 3     | Mesolithic            | Bows, fishing nets, microlith tools, dugout canoes, early pottery                                    |
| 6     | Neolithic             | Agriculture, herding, permanent villages, polished stone tools, basic irrigation                     |
| 9     | Copper Age            | Copper tools, simple bronze, the wheel, pottery kilns, basic textiles                                |
| 12    | Bronze Age            | Bronze weapons and armor, plough agriculture, sailing ships, writing, cities                         |
| 15    | Late Bronze Age       | Advanced bronze casting, organized armies, composite bows, chariots, long-distance trade             |
| 18    | Iron Age              | Iron tools and weapons, steelworking, coinage, masonry, better farm implements                       |
| 21    | Classical Age         | Professional armies, paved roads, concrete, watermills, large warships, paper and books              |
| 24    | Late Antiquity        | Advanced ironworking, siege engines, glassmaking, water-powered mills, large bureaucracies           |
| 27    | Early Middle Ages     | Heavy plough, horse collar, windmills, widespread iron tools                                         |
| 30    | High Middle Ages      | Castles, crossbows, chainmail, mechanical clocks, cogs, gunpowder                                    |
| 33    | Commercial Revolution | Universities, banking, spinning wheels, improved furnaces, early firearms                            |
| 36    | Late Middle Ages      | Plate armor, blast furnaces, bombards and established artillery                                      |
| 40    | Renaissance           | The printing press, hand cannons and arquebuses, carracks and caravels, humanist learning            |
| 45    | Age of Discovery      | Ocean navigation, matchlock firearms, mature artillery, mass printing                                |
| 50    | Scientific Revolution | Muskets, star forts, telescopes, precision instruments, mechanical pumps, the scientific method      |
| 60    | Enlightenment         | Flintlock firearms, canals, advanced metallurgy, early industrial organization                       |
| 70    | Industrial Revolution | Steam engines, factories, railways, mechanized textiles, modern steel                                |
| 80    | Machine Age           | Electricity, chemical industry, combustion engines, aviation, mass production                        |
| 90    | Space Age             | Computers, nuclear power, satellites, spaceflight, biotechnology, automation                         |
| 100   | Post-human            | Artificial superintelligence, post-biological civilization, stellar engineering, interstellar travel |

# Where it comes from

## Cultures

Each culture has its own level, the development of its lands. The [culture set](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Culture-sets) you pick decides your world's era.

Most maps get a medieval world with a few leaders that field artillery and print books and a few peoples left behind. The Antique set gives a classical world without artillery and with hardly any gunpowder.

A culture's [type](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Culture-types) moves its level a little: naval peoples are 3 points ahead, river peoples 2 and lake peoples 1; highlanders are 2 behind, nomads 3 and hunters 4. Unclaimed wildlands stand at 3 as foragers.

## Across the land

Every cell starts at its people's level, and development stays with them: an advanced neighbor softens the border a little, but orcs next to elves stay orcs. Knowledge does not spread across the map.

- **The land** matters: temperate deciduous forests are a little ahead, while harsh lands hold peoples back: savanna and tropical seasonal forest a point, wetland two, taiga and tropical rainforest three, hot desert four, cold desert and tundra five and glaciers eight. Custom biomes add nothing until you set them in the Biomes editor. Rivers and coasts add a point.
- **Broad waves**: borders between peoples and lands are softened into short slopes, and broad waves raise or lower whole regions by up to three eras, so a people's lands differ in large patches rather than cell by cell.

Land nobody lives on has no development.

# What it does

## What a region can produce

Goods need development to be gathered or made. A region below a good's level produces none of it, so it sells its raw goods and buys what it cannot make:

| Level | Goods                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 6     | Grain, cattle, salt, hemp, wine, dates, pearls, gemstones, tobacco, cloth, cheese, beer                                                    |
| 9     | Gold, copper, silver, olives, wool, silk, coal, oil, ceramics, ropes, boots, jewelry                                                       |
| 12    | Tin, horses, camels, marble, dyes, incense, slaves, mahogany, saltpeter, bronze, arms, sails, garments, ink, preserved food, vinegar, soap |
| 15    | Spices, tools, boats, harnesses, perfume                                                                                                   |
| 18    | Iron, coins, barrels                                                                                                                       |
| 21    | Tea, paper, books, candles                                                                                                                 |
| 24    | Glass, sugar                                                                                                                               |
| 30    | Gunpowder, liquor                                                                                                                          |
| 36    | Artillery                                                                                                                                  |

Other goods need no development: anyone can fell wood, hunt, fish or gather honey and furs. Each good's level is the era it was first traded in, somewhere in the world. A good's level is part of the map's goods data.

## How much a region produces

Past the High Middle Ages (30), development also makes people more productive: every field, mine and workshop yields more of what it can make, a third more at 40, half again at 45, twice as much at 60. Below 30 nothing changes. The leaders' extra goods make prices lower for everyone.

## What states call themselves

Peoples before the Bronze Age (development under 12 at the capital) know no kingdoms or republics. Their states are titled as tribes: a Tribe, a Chiefdom or a Paramount Chiefdom, a Horde for nomads, a Tribal Council, a Clans Union or a Shamanate. From the Bronze Age on, states take the usual titles, empires included, as Akkad and Egypt did.

## Who trades first

The [economy](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Economy) plays out one day in which burgs take turns choosing their trades. The more developed and the larger a burg, the earlier it picks: the leaders take the best trades, and backward lands are left the rest. So rich and poor regions follow development: about one burg in five meets less than half its needs where development is 30 or more, one in twenty at 40 or more, and over half where it is under 30.

# Seeing and changing it

Development is set when the map is generated, and saved with it. Open **Tools → Development** (<kbd>Shift</kbd> + <kbd>X</kbd>) for the Development Editor:

- **The map** shows development while the overview is open: every peopled cell in its era's color, from the dark stone ages through the greens of antiquity and the yellows of the Middle Ages to the reds of the modern eras. Hover a cell for its level and era. The eye button hides or shows it, and the choice is kept the next time the overview opens. Closing the overview hides it; there is no separate layer.
- **The table** lists the eras on the map, with their levels, cells, area, people and burgs; the percent button shows each era's share of the totals instead. Hover a row to highlight its land; hover the map to find a cell's row. The bottom line shows the people's average development and the land's lowest and highest.
- **The brush** paints development by era: pick an era, drag over the land, and apply. Only cells where people live are painted. A painted cell takes the level its era begins at; a cell already in that era keeps its own. **No development**, first in the list, clears the cells to 0, as if nothing were known of their people. Undo steps back, cancel discards the strokes.
- **Regenerate** makes development again from the cultures and land, discarding painted changes. Do it after editing cultures, their levels or types, or biomes, which do not change development by themselves.
- **Legend** adds the eras to the map's legend, and **Export** saves the table as a CSV file.
- **Rename** opens the Eras editor, listing every era, on the map or not. The names are yours to change: type your own, and they show across the Generator, are saved with the map and carry over to new maps. Levels and colors stay. The restore button brings the default names back.

Development also shows across the editors: the **States**, **Provinces** and **Cultures** editors and the **Burgs Overview** have a Development column, hidden by default and turned on from the column menu. It shows the people's average, with its era in the tip, and a burg's own level in the Burgs Overview. In the **Cultures** editor the column sets the culture's own level, 1 to 100, with its heartland and the people's average in the tip; in the **Biomes** editor it sets what a biome adds or takes away, in points. Change them, then press Regenerate in the Development Editor to apply. The **Burg Editor** and **Burg Economy** show the burg's development and era. The **Goods Editor** lists each good's development, and **Edit good** sets it. A generated burg stands at 5 or more, a town being past the foragers' era; the brush can still set it lower.

Painted development applies to production the next time the economy is regenerated. It stays with the land through resampling, submaps and heightmap edits; regenerating population gives newly settled land the level around it. For a more or less developed world as a whole, pick another culture set and regenerate the map.

# Questions

**Why does no one on my map make gunpowder?**
Gunpowder needs development 30 and artillery 36, which only the leading cultures of a medieval world reach. The Antique set's cultures stand at 12–24: only a few cells reach 30, so a classical world makes a little gunpowder and no artillery.

**How do I make a people more advanced?**
Set its level in the Development column of the Cultures editor, then press Regenerate in the Development Editor. To change a few places only, paint them with the brush.

**Why is my state called a Tribe or a Shamanate?**
Its capital stands before the Bronze Age, under 12, so its people know no kingdoms: monarchies become Tribes, Chiefdoms or Hordes, republics Tribal Councils, unions Clans Unions and theocracies Shamanates. Rename its form in the States editor if you want another.

**Why is my burg so poor?**
A burg in a backward region cannot make advanced goods and picks its trade after the developed ones. Its Economy Overview shows what it makes and what it lacks.

**Can a culture be more advanced than the Age of Discovery?**
The default cultures stand at 45 or less, but the scale goes to 100 so modern and futuristic worlds have room.
