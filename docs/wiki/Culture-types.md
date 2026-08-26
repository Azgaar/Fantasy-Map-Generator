Each culture gets a type assigned on generation. The type defines how the culture will grow and what territories it will get, but also serves world-building needs and affects multiple systems.

## Culture generation

When a culture is generated, its type is determined by the geographical features it spawned in. A culture is assigned the first culture type that meets the criteria in the listed order, except that Naval also requires a random probability check.

### Nomadic
Nomadic cultures are generated in Hot desert, Cold desert or Grassland biomes with height below 70 points.

### Highland
Highland cultures are generated in cells where height is over 50 points.

### Lake
Lake cultures are generated in cells around lakes that are over 5 cells in size.

### Naval
Naval cultures can be generated in coastal cells. The generator checks a 10% chance for a non-lake coast, a 60% chance for a one-cell harbor, and a 40% chance for an island subtype. These checks are evaluated in this order, after Nomadic, Highland, and Lake.

### River
River cultures are generated in cells with a river of over 100 flux points.

### Hunting
Hunting cultures are generated in cells further than two cells from the coast whose biome is Savanna, Tropical rainforest, Temperate rainforest, Taiga, Tundra or Wetland.

### Generic
A culture is set to Generic when its spawn location is ineligible for any other culture type, or when it was eligible for Naval but failed the random probability check.

## Culture spread
Culture spread is a competitive system, where each culture tries to get more cells considering the cost of it. Culture type is crucial in defining cell "cost" and the way culture will spread.

### Culture expansionism

Every culture gets an expansionism value of `(random × sizeVariety / 2 + 1) × base`, where `sizeVariety` is the _Cultures size variety_ option and `base` depends on the culture type:
* Generic: 1
* Lake: 0.8
* Naval: 1.5
* River: 0.9
* Nomadic: 1.5
* Hunting: 0.7
* Highland: 1.2

The higher the expansionism value, the lower the effective cell cost for the culture. So Nomadic cultures generally tend to occupy vast territories, while Hunting and Lake cultures are usually pretty limited in area.

### Biome cost

The base biome costs are as follows:
* Hot desert: 200
* Cold desert: 150
* Savanna: 60
* Grassland: 50
* Tropical seasonal forest: 70
* Temperate deciduous forest: 70
* Tropical rainforest: 80
* Temperate rainforest: 90
* Taiga: 200
* Tundra: 1000
* Glacier: 5000
* Wetland: 150

The cost is a flat 10 if the biome matches the biome of the culture center (its native biome). Otherwise the base cost is multiplied by 5 for Hunting cultures, by 10 for Nomadic cultures in the forest biomes (Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest and Taiga), and by 2 in all other cases. Additionally, if the target cell has a different biome than the cell the culture is spreading from, 20 is added.

### Height cost
This cost covers both water crossing and elevation. It is checked in order:
* Lake culture crossing a lake: flat 10
* Naval culture crossing water: 2 × cell area
* Nomadic culture crossing water: 50 × cell area
* Any other culture crossing water (including a Lake culture crossing a sea): 6 × cell area
* Highland culture on land below height 44: 3000
* Highland culture on land below height 62: 200
* Highland culture at height 62 and above: 0
* Any other culture at height 67 and above (mountains): 200
* Any other culture at height 44 and above (hills): 30
* Any other culture below height 44: 0

### River cost
For non-River cultures, a river cell costs 20 to 100 more, depending on the river flux (`flux / 10`, clamped to that range). For River cultures a river cell costs nothing extra, but a cell without a river costs 100 more.

### Distance to coast cost
The cost depends on how far a cell is from the coastline:
* Coastal cells: free for Naval and Lake cultures, 60 for Nomadic cultures, 20 for everyone else
* Cells one step inland: 30 for Naval and Nomadic cultures, free for everyone else
* Cells further inland: 100 for Naval and Lake cultures, free for everyone else

### Total cost
All the costs above are added together and divided by the culture expansionism to get the cost of entering the cell. Costs accumulate along the expansion path, and a culture stops spreading once the accumulated cost exceeds the budget of `cells count × 0.6 × growth rate`, where the growth rate is the _Growth rate_ option — lowering it leaves more land culture-less. Only populated cells get a culture assigned, so unpopulated cells stay culture-less regardless of the cost.
