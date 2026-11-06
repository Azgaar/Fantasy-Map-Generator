**Military forces** allow you to view auto-generated regiments and set up custom units. Generation is based on population, land possession and cultural specific, climate, diplomacy and other factors. The process is cell-based, but aggregated to Regiments level for usability purposes.

Generation rules, unit types and regiments themselves are editable and customizable. You can add fantasy, modern or ancient units, change parameters and re-generate military to let the system automatically recreate regiments. Changes specific to state or culture can be done manually on regiments level.

Regiments are displayed as state-colored boxes in a separate layer called _Military_ (<kbd>M</kbd> to toggle). To edit specific Regiment click on its box. To open Military overview screen go to _Tools_ and click on _Military_ (hotkey: <kbd>Shift</kbd> + <kbd>M</kbd>).

## Military overview

![](https://cdn.discordapp.com/attachments/587406457725779968/719203701180596779/military_overview.png)

Military overview shows the army each state has. _Total_ is the sum of all military personnel, taking unit crew into account. _Power_ is the military power as the forces fight: the number of each unit multiplied by its power and by the state's _Upkeep_, how well its military spending keeps them, as in the [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator). _Population_ is the state population, and _Rate_ is the percentage of military personnel to it (militarization index), normally about 1–2%. _War Alert_ defines how willing a state is to wage a war and acts as a multiplier to the unit numbers; it is editable here. The icon in the last column shows the list of the state's regiments and allows adding new ones.

The footer sums up states number, total and average forces, average rate and average alert. The bottom toolbar lets you refresh the screen, open the Units Editor (cog icon), show the regiments list, toggle between absolute and percentage values, recalculate the military forces, export the data as a `.csv` file and open this wiki page.

## Military units editor

![](https://cdn.discordapp.com/attachments/587406457725779968/720368676360028252/military_options.png)

Military units used for generation are customizable. To open the units editor click the _cog_ icon in the Military overview screen. Here you can add new units and specify their features. The number of units is not limited, but having many of them makes the overview screens hard to read. The behaviour of a unit is defined by its _type_. Type variants are hard-coded and define the rules applied on generation, described in the next section.

Customizable parameters are:

- **Icon** - unit symbol, chosen in the icon picker: an emoji or short text (the defaults), a built-in icon or a custom icon linked or uploaded to the map. Emoji look different in different systems and browsers. See [Icons](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons)
- **Name** - a unique unit name. Renaming an existing unit replaces it
- **Goods** - goods that equip the unit, such as arms for infantry or horses for cavalry. Click the button to pick them; `none` means the unit needs no goods. A state fields only as many troops of the unit as its goods can equip, the rest serve as levies. See [Goods and levies](#goods-and-levies) below
- **Biomes**, **States**, **Cultures**, **Religions** - optional limitations. By default a unit is generated everywhere (`all`); click a button to restrict the unit to selected biomes, states, cultures or religions (`some`). A cell or burg that fails any active limitation produces no troops of that unit
- **Rural** - the most of the rural population, in percent, that can be raised to the unit. It defines how many troops of this unit are generated per cell population point at most: the number is then adjusted by the rules described in the next section, and a state lacking the unit's goods raises fewer. Set to 0 if you want the unit to be generated in burgs only
- **Urban** - the most of the urban population, in percent, that can be raised to the unit. Works the same as _rural_, but for burg population
- **Crew** - average number of people in one unit. Like tank crew is usually 4. This number is used for total people calculation and does not affect unit _power_ at all
- **Power** - damage dealt by unit. Used in battle simulation only
- **Type** - a set of rules to be applied for the unit, see the details in the next section
- **Sep.** - check if the unit is _separate_ and can only be stacked with the same unit. This is why e.g. the naval _fleet_ is not merged into a mixed land regiment by default

Any change has to be confirmed with _Apply_, which triggers a full military regeneration. There is currently no way to change unit definitions without regenerating the forces.

The default unit set is:

| Icon | Name      | Goods                     | Rural % | Urban % | Crew | Power | Type      | Separate |
| ---- | --------- | ------------------------- | ------- | ------- | ---- | ----- | --------- | -------- |
| 🪓   | levies    | none                      | 0       | 0       | 1    | 0.5   | levies    | no       |
| ⚔️   | infantry  | Arms                      | 0.25    | 0.2     | 1    | 1     | melee     | no       |
| 🏹   | archers   | Arms                      | 0.12    | 0.2     | 1    | 1     | ranged    | no       |
| 🐴   | cavalry   | Horses, Camels, Harnesses | 0.12    | 0.03    | 1    | 2     | mounted   | no       |
| 💣   | artillery | Artillery, Gunpowder      | 0       | 0.03    | 8    | 12    | machinery | no       |
| 🌊   | fleet     | Boats                     | 0       | 0.015   | 100  | 50    | naval     | yes      |

The available types are melee, ranged, mounted, machinery, naval, armored, aviation, magical and levies. Levies are a normal unit, just weak: poorly armed conscripts with half an infantryman's power. By default their rural and urban percentages are 0, so they only take in troops other units could not equip, but they can be raised directly like any other unit.

## Generation logic

Fantasy Map Generator regiments creation logic is pretty advanced and considers different aspects such as state diplomacy, type, culture and religion, cell biome and elevation, as well as military unit specific.

For each state a _War Alert_ is calculated. It shows how much the state is willing to wage a war and acts as a multiplier to all its military forces — a state with 1000 infantry and a War Alert of 2 ends up with 2000. It is the product of three factors, and the result is clamped to the `0.1 – 5` range:

`War Alert = Expansion rate × Diplomacy rate × Neighbors rate`

- **Expansion rate** — how much of the state expansionism is realized: `(state expansionism / total expansionism) / (state area / total area)`, clamped to `0.25 – 4`. Expansionist states with a relatively small area get a higher rate than big states with moderate expansionism
- **Diplomacy rate** — the state's own peacefulness, based on the most hostile relation it holds: `1` if it has any Enemy, otherwise `0.8` with any Rival, `0.5` with any Suspicion, `0.1` otherwise
- **Neighbors rate** — how the neighbors feel about this state. Start from `0.5` and add the modifier for each neighbor's stance, then clamp to `0.3 – 3`:

`Ally: -0.2, Friendly: -0.1, Neutral: 0, Suspicion: 0.1, Enemy: 1, Unknown: 0, Rival: 0.5, Vassal: 0.5, Suzerain: -0.5`

War Alert can be overridden manually in the Military overview.

War Alert is not the only state-specific modifier. The other one depends on _State Type_ and getting applied based on hard-coded matrix:

|          | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
| -------- | ----- | ------ | ------- | --------- | ----- | ------- | -------- | ------- |
| Generic  | 1     | 1      | 1       | 1         | 1     | 1       | 1        | 1       |
| Nomadic  | 0.5   | 0.9    | 2.3     | 0.8       | 0.5   | 1       | 0.5      | 1       |
| Highland | 1.2   | 1.3    | 0.6     | 1.4       | 0.5   | 0.5     | 0.5      | 2       |
| Lake     | 1     | 1      | 0.7     | 1.1       | 1.2   | 1       | 1.2      | 1       |
| Naval    | 0.7   | 0.8    | 0.3     | 1.4       | 1.8   | 1       | 1.2      | 1       |
| Hunting  | 1.2   | 2      | 0.7     | 0.4       | 0.7   | 0.7     | 0.6      | 1       |
| River    | 1.1   | 0.8    | 0.8     | 1.1       | 1.2   | 1.1     | 1.2      | 1       |

The matrix above is keyed by the state _type_, which is inherited from the state's culture type, not by its government form. Two form-based modifiers are applied on top: states whose form name contains _Horde_ get ×2 mounted units, and states with the _Republic_ form get ×1.2 naval units.

The next step is to calculate the troops number for each cell and burg. The calculation is done separately for each unit and considers the possession-specific divider, the unit percentage set in the military options, the state modifier calculated above and a hard-coded cell type matrix. For example mounted units get a ×3 modifier in nomadic cells, while their number is cut in highlands. The formula is:

`Troops = Base / Possession_divider × Unit_percentage × Cell_type_mod × State_mod × War_Alert × Population_rate`

`Base` is `cell population / 100` for rural cells and `burg population × urbanization / 100` for burgs. Capital burgs get an extra ×1.2 for household troops.

The possession-specific divider is applied in 3 cases only:

- Cell culture is not the state's dominant culture: divider is 1.2 for _Unions_ and 2 for other states
- Cell religion is not the religion of the state center: divider is 2.2 for _Theocracies_ and 1.4 for other states
- Cell is on a different landmass than the state center: divider is 1.2 for _Naval_ states and 1.8 for others

The cell type is determined by biome first, elevation second:

- **Nomadic** — Hot desert, Cold desert, Savanna or Grassland
- **Wetland** — Tropical rainforest, Temperate rainforest, Taiga or Wetland
- **Highland** — any other biome at height 70 or above
- **Generic** — everything else, all modifiers are 1

Cell type modifiers:

|               | Melee | Ranged | Mounted | Machinery | Armored | Magical | Naval | Aviation |
| ------------- | ----- | ------ | ------- | --------- | ------- | ------- | ----- | -------- |
| Nomadic cell  | 0.2   | 0.5    | 3       | 0.4       | 1.6     | 0.5     | 0.3   | 1        |
| Wetland cell  | 0.8   | 2      | 0.3     | 1.2       | 0.2     | 0.5     | 1     | 0.5      |
| Highland cell | 1.2   | 1.6    | 0.3     | 3         | 0.8     | 2       | 1     | 0.3      |
| Nomadic burg  | 0.3   | 0.8    | 3       | 0.4       | 1.6     | 0.5     | 1     | 1        |
| Wetland burg  | 1     | 1.6    | 0.2     | 1.2       | 0.2     | 0.5     | 1     | 0.5      |
| Highland burg | 1.2   | 2      | 0.3     | 3         | 0.8     | 2       | 1     | 0.3      |

Here is the resulting troops number per 10 000 population points with the default units, a state modifier of 1, a War Alert of 1 and a population rate of 1. Multiply by the actual population rate to get the numbers shown on the map:

|               | Melee | Ranged | Mounted | Machinery | Naval |
| ------------- | ----- | ------ | ------- | --------- | ----- |
| Generic cell  | 25    | 12     | 12      | 0         | 0     |
| Nomadic cell  | 5     | 6      | 36      | 0         | 0     |
| Wetland cell  | 20    | 24     | 4       | 0         | 0     |
| Highland cell | 30    | 19     | 4       | 0         | 0     |
| Generic burg  | 20    | 20     | 3       | 3         | 2     |
| Nomadic burg  | 6     | 16     | 9       | 1         | 2     |
| Wetland burg  | 20    | 32     | 1       | 4         | 2     |
| Highland burg | 24    | 40     | 1       | 9         | 2     |

Rural cells produce no machinery or naval troops with the default units, since both have a rural percentage of 0. Burg naval troops only appear in port burgs.

Please also note that rural naval units are generated only in cells that have a haven (an adjacent water cell), while burg naval units require the burg to be a port _and_ to have a haven. Naval platoons are placed on the haven water cell rather than on the land cell itself.

### Goods and levies

Once the economy has run, a unit with goods is fielded only as far as the state can equip it. The state's stock of a good is a year of what it consumes of it, its townspeople's and rural people's purchases and what the state buys with its budget, times how much of the military need one unit of the good covers (1 for a good that covers none, such as a custom one):

`Stock = daily consumption × 365 × military coverage`

The state counts what it consumes, not what it makes: imported goods equip its troops, while goods it makes and sells abroad do not. A good several units need is split between them by their troops. A unit's equipped share is its goods' stock against its troops, at most 1:

`Equipped = min(1, Σ goods stock / troops)`

For example, a state consuming 4 horses a day has 4 × 365 × 0.6 = 876 horses' worth of mounts, so 2 000 conscripted cavalry are 44% equipped: 876 serve as cavalry and the other 1 124 as levies.

Conscripts a state cannot equip are not lost: they serve as **levies** in the cell or burg where they were raised, joining its land regiments. Unequipped sailors become levies on land too. Levies have half an infantryman's power, and an army's starting morale follows its power, so a state short of arms, horses, cannons or boats fields an army as large but weaker. With the default units, where nobody is raised to levies directly, a well-supplied state has none. If no unit has the _levies_ type, unequipped conscripts are not raised.

Units that need no goods, such as the default levies, are always fully equipped, and so is every unit before the economy has run or in a map made before this rule.

Troops for each cell and burg form a _platoon_. As the number of platoons is far too high, they are sorted starting from the smallest and merged into _regiments_ based on the distance between platoons and an expected regiment size of `3 × Population rate`. Platoons of a _separate_ unit can only merge with platoons of the same unit. Once a regiment reaches the expected size it stops absorbing others. The system then generates names, emblems and legends for the regiments and places them on the map at their bases.

A state at war marches its land regiments from their bases to the front: its own land cells bordering an enemy, then up to two lines of cells behind them. Its fleets sail to the water cells next to that border, on either side, or up to two cells offshore. Fleets deploy first, as land regiments on the coast would crowd them out. The largest regiments go first, each to the free cell nearest its base on its landmass or water body, foremost line first, so regiment boxes never overlap, an enemy's included. Regiments that find no free cell stay at their bases. The base stays where the regiment was raised.

## Regiment Editor

![](https://cdn.discordapp.com/attachments/587406457725779968/720385818694254602/regiment_editor.png)

If you click on a regiment box, a Regiment Editor will pop up at the top left corner. Once editor is displayed, you can drag regiment boxes to move them around. A circle shows regiment's base and can be dragged as well.

From the Regiment Editor screen you can rename the regiment or restore its original name, hear the name spoken, toggle its visibility on the map (eye icon), change the regiment emblem and edit the number of troops of each unit. Below the units it shows the regiment's _Power_, which is not editable: the number of each unit multiplied by its power and by the state's upkeep, as in the Military overview. The regiments overview has the same _Power_ column. You can also switch the regiment type between _land_ and _naval_. Naval regiments look almost the same as land ones, the only visual difference is the box size. Hidden regiments can also be toggled from the regiments overview table.

The buttons at the bottom let you attack a foreign regiment (see [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) for the details), create a new regiment or fleet, split the regiment into two, attach it to another regiment, regenerate or edit the regiment legend, and remove the regiment.

In the _Style_ tab under _Military forces_, you can also toggle _Show names_ to display regiment names below units on the map.
