**Military forces** allow you to view auto-generated regiments and set up custom units. Generation is based on population, land possession and cultural specific, climate, diplomacy and other factors. The process is cell-based, but aggregated to Regiments level for usability purposes.

Generation rules, unit types and regiments themselves are editable and customizable. You can add fantasy, modern or ancient units, change parameters and re-generate military to let the system automatically recreate regiments. Changes specific to state or culture can be done manually on regiments level.

Regiments are displayed as state-colored boxes in a separate layer called _Military_ (<kbd>M</kbd> to toggle). To edit specific Regiment click on its box. To open Military overview screen go to _Tools_ and click on _Military_ (hotkey: <kbd>Shift</kbd> + <kbd>M</kbd>).

## Military overview
![](https://cdn.discordapp.com/attachments/587406457725779968/719203701180596779/military_overview.png)

Military overview shows the army each state has. _Total_ is the sum of all military personnel, taking unit crew into account (see the next section). _Population_ is the state population, and _Rate_ is the percentage of military personnel to it (militarization index), normally about 1–2%. _War Alert_ defines how willing a state is to wage a war and acts as a multiplier to the unit numbers; it is editable here. The icon in the last column shows the list of the state's regiments and allows adding new ones.

The footer sums up states number, total and average forces, average rate and average alert. The bottom toolbar lets you refresh the screen, open the Units Editor (cog icon), show the regiments list, toggle between absolute and percentage values, recalculate the military forces, export the data as a `.csv` file and open this wiki page.

## Military units editor
![](https://cdn.discordapp.com/attachments/587406457725779968/720368676360028252/military_options.png)

Military units used for generation are customizable. To open the units editor click the _cog_ icon in the Military overview screen. Here you can add new units and specify their features. The number of units is not limited, but having many of them makes the overview screens hard to read. The behaviour of a unit is defined by its _type_. Type variants are hard-coded and define the rules applied on generation, described in the next section.

Customizable parameters are:
* **Icon** - unit symbol. Unicode emojis are used for simplicity. While there is a list of pre-selected ones, you can use any Unicode character, or supply an image URL / data URI. Please note that Unicode emojis look different in different systems and browsers. Here is [the full list](https://unicode.org/emoji/charts/full-emoji-list.html)
* **Name** - a unique unit name. Renaming an existing unit replaces it
* **Biomes**, **States**, **Cultures**, **Religions** - optional limitations. By default a unit is generated everywhere (`all`); click a button to restrict the unit to selected biomes, states, cultures or religions (`some`). A cell or burg that fails any active limitation produces no troops of that unit
* **Rural** - percentage of rural population to be conscripted to the unit. It defines how many troops of this unit are generated per cell population point. The number is then adjusted by the rules described in the next section. Set to 0 if you want the unit to be generated in burgs only
* **Urban** - percentage of urban population to be conscripted to the unit. Works the same as _rural_, but for burg population
* **Crew** - average number of people in one unit. Like tank crew is usually 4. This number is used for total people calculation and does not affect unit _power_ at all
* **Power** - damage dealt by unit. Used in battle simulation only
* **Type** - a set of rules to be applied for the unit, see the details in the next section
* **Sep.** - check if the unit is _separate_ and can only be stacked with the same unit. This is why e.g. the naval _fleet_ is not merged into a mixed land regiment by default

Any change has to be confirmed with _Apply_, which triggers a full military regeneration. There is currently no way to change unit definitions without regenerating the forces.

The default unit set is:

| Icon | Name | Rural % | Urban % | Crew | Power | Type | Separate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ⚔️ | infantry | 0.25 | 0.2 | 1 | 1 | melee | no |
| 🏹 | archers | 0.12 | 0.2 | 1 | 1 | ranged | no |
| 🐴 | cavalry | 0.12 | 0.03 | 2 | 2 | mounted | no |
| 💣 | artillery | 0 | 0.03 | 8 | 12 | machinery | no |
| 🌊 | fleet | 0 | 0.015 | 100 | 50 | naval | yes |

The available types are melee, ranged, mounted, machinery, naval, armored, aviation and magical.

## Generation logic
Fantasy Map Generator regiments creation logic is pretty advanced and considers different aspects such as state diplomacy, type, culture and religion, cell biome and elevation, as well as military unit specific.

For each state a _War Alert_ is calculated. It shows how much the state is willing to wage a war and acts as a multiplier to all its military forces — a state with 1000 infantry and a War Alert of 2 ends up with 2000. It is the product of three factors, and the result is clamped to the `0.1 – 5` range:

`War Alert = Expansion rate × Diplomacy rate × Neighbors rate`

* **Expansion rate** — how much of the state expansionism is realized: `(state expansionism / total expansionism) / (state area / total area)`, clamped to `0.25 – 4`. Expansionist states with a relatively small area get a higher rate than big states with moderate expansionism
* **Diplomacy rate** — the state's own peacefulness, based on the most hostile relation it holds: `1` if it has any Enemy, otherwise `0.8` with any Rival, `0.5` with any Suspicion, `0.1` otherwise
* **Neighbors rate** — how the neighbors feel about this state. Start from `0.5` and add the modifier for each neighbor's stance, then clamp to `0.3 – 3`:

`Ally: -0.2, Friendly: -0.1, Neutral: 0, Suspicion: 0.1, Enemy: 1, Unknown: 0, Rival: 0.5, Vassal: 0.5, Suzerain: -0.5`

War Alert can be overridden manually in the Military overview.

War Alert is not the only state-specific modifier. The other one depends on _State Type_ and getting applied based on hard-coded matrix:

|          | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|----------|-------|--------|---------|-----------|-------|---------|----------|---------|
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
* Cell culture is not the state's dominant culture: divider is 1.2 for _Unions_ and 2 for other states
* Cell religion is not the religion of the state center: divider is 2.2 for _Theocracies_ and 1.4 for other states
* Cell is on a different landmass than the state center: divider is 1.2 for _Naval_ states and 1.8 for others

The cell type is determined by biome first, elevation second:
* **Nomadic** — Hot desert, Cold desert, Savanna or Grassland
* **Wetland** — Tropical rainforest, Temperate rainforest, Taiga or Wetland
* **Highland** — any other biome at height 70 or above
* **Generic** — everything else, all modifiers are 1

Cell type modifiers:

|               | Melee | Ranged | Mounted | Machinery | Armored | Magical | Naval | Aviation |
|---------------|-------|--------|---------|-----------|---------|---------|-------|----------|
| Nomadic cell  |  0.2  |   0.5  |    3    |    0.4    |   1.6   |   0.5   |  0.3  |     1    |
| Wetland cell  |  0.8  |   2    |   0.3   |    1.2    |   0.2   |   0.5   |   1   |    0.5   |
| Highland cell |  1.2  |   1.6  |   0.3   |     3     |   0.8   |    2    |   1   |    0.3   |
| Nomadic burg  |  0.3  |   0.8  |    3    |    0.4    |   1.6   |   0.5   |   1   |     1    |
| Wetland burg  |  1    |   1.6  |   0.2   |    1.2    |   0.2   |   0.5   |   1   |    0.5   |
| Highland burg |  1.2  |    2   |   0.3   |     3     |   0.8   |    2    |   1   |    0.3   |

Here is the resulting troops number per 10 000 population points with the default units, a state modifier of 1, a War Alert of 1 and a population rate of 1. Multiply by the actual population rate to get the numbers shown on the map:

|               | Melee | Ranged | Mounted | Machinery | Naval |
|---------------|-------|--------|---------|-----------|-------|
| Generic cell  |   25  |   12   |    12   |     0     |   0   |
| Nomadic cell  |   5   |    6   |    36   |     0     |   0   |
| Wetland cell  |   20  |   24   |    4    |     0     |   0   |
| Highland cell |   30  |   19   |    4    |     0     |   0   |
| Generic burg  |   20  |   20   |    3    |     3     |   2   |
| Nomadic burg  |   6   |   16   |    9    |     1     |   2   |
| Wetland burg  |   20  |   32   |    1    |     4     |   2   |
| Highland burg |   24  |   40   |    1    |     9     |   2   |

Rural cells produce no machinery or naval troops with the default units, since both have a rural percentage of 0. Burg naval troops only appear in port burgs.

Please also note that rural naval units are generated only in cells that have a haven (an adjacent water cell), while burg naval units require the burg to be a port *and* to have a haven. Naval platoons are placed on the haven water cell rather than on the land cell itself.

Troops for each cell and burg form a _platoon_. As the number of platoons is far too high, they are sorted starting from the smallest and merged into _regiments_ based on the distance between platoons and an expected regiment size of `3 × Population rate`. Platoons of a _separate_ unit can only merge with platoons of the same unit. Once a regiment reaches the expected size it stops absorbing others. The system then generates names, emblems and legends for the regiments and places them on the map.

## Regiment Editor
![](https://cdn.discordapp.com/attachments/587406457725779968/720385818694254602/regiment_editor.png)

If you click on a regiment box, a Regiment Editor will pop up at the top left corner. Once editor is displayed, you can drag regiment boxes to move them around. A circle shows regiment's base and can be dragged as well. 

From the Regiment Editor screen you can rename the regiment or restore its original name, hear the name spoken, change the regiment emblem and edit the number of troops of each unit. You can also switch the regiment type between _land_ and _naval_. Naval regiments look almost the same as land ones, the only visual difference is the box size.

The buttons at the bottom let you attack a foreign regiment (see [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) for the details), create a new regiment or fleet, split the regiment into two, attach it to another regiment, regenerate or edit the regiment legend, and remove the regiment.
