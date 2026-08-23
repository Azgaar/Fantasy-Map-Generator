Each culture gets a type assigned on generation. The type define how culture will grow and what territories it will get, but also serves world-building needs and affects multiple systems.  

## Culture generation

When a culture is generated, its type is determined by the geographical features it spawned in. A culture is guaranteed to be assigned the first culture type that meets the criteria in the listed order, except the Naval culture type which has a random probability check in addition to its normal requirement. 

### Nomadic
Nomadic cultures are generated in deserts or grassland with height less than 70 points.

### Highland
Highland cultures are generated in cells where height is over 50 points. 

### Lake
Lake cultures are generated in cells around lakes that are over 5 cells in size.

### Naval
Naval cultures have a chance of being generated in coastal cells. The chance is slightly higher if the cell is next to an ocean (as opposed to a lake), and significantly higher if the cell is an island.

### River
River cultures are generated in cells with a river of over 100 flux points.

### Hunting
Hunting cultures are generated in cells that are more than two cells away from a coast and the biome is either Savannah, Rain forest, Taiga, Tundra, or Wetland.

### Generic
 A culture is set to be generic when its spawn location is ineligible for any other culture types, or in the case of the Naval culture type, failed a random probability check. 

## Culture spread
Culture spread is a competitive system, where each culture tries to get more cells considering the cost of it. Culture type is crucial in defining cell "cost" and the way culture will spread.

### Culture expansionism

Every culture has a randomly generated expansionism value. The random value is then multiplied according to the culture type:
* Generic: 1
* Lake: 0.8
* Naval: 1.5
* River: 0.9
* Nomadic: 1.5
* Hunting: 0.7
* Highland: 1.2

The more expansionism values is, the less cell cost is for the culture. So Nomadic cultures generally tends to occupy vast territories, while Hunting and Lake cultures are usually pretty limited in area.

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

The cost is reduced to 10 if it's the culture's native biome type. The cost is multiplied by 5 for Hunting cultures in all non-native biome types. The cost is multiplied by 10 for Nomadic cultures in the five forest biome types. Otherwise, the cost is multiplied by 2. Additionally, if the cell has a different biome type than the one the culture is spreading from, 20 is added to the final cost.

### Water crossing cost
Lake cultures crossing a lake has a flat cost of 10. Naval cultures crossing water costs 2 times the size of the cell in pixels. Nomadic cultures crossing water costs 50 times the size of the cell in pixels. All other cultures crossing water (and Lake cultures crossing a sea) costs 6 times the size of the cell in pixels.

### River crossing cost
For non-River cultures, river cells costs 20-100 more to cross, depending on the flux of the river. For River cultures, river cells don't cost extra, but non-river cells cost 100 more.

### Distance to coast cost
Coastal cells cost 60 more for Nomadic cultures, and 20 for other non-Naval non-River cultures. Cells next to coastal cells costs 30 more for Naval and Nomadic cultures. Cells further inland costs 100 more for Naval and River cultures. The costs are added together then divided by expansionism of the culture. When the total cost exceeds the budget, expansion stops.