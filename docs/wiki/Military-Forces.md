**Military forces**, added to the Generator in [version 1.3](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog), allows to view auto-generated regiments and setup custom units. Generation is based on population, land possession and cultural specific, climate, diplomacy and other factors. The process is cell-based, but aggregated to Regiments level for usability purposes.

Generation rules, unit types and regiments themselves are editable and customizable. You can add fantasy, modern or ancient units, change parameters and re-generate military to let the system automatically recreate regiments. Changes specific to state or culture can be done manually on regiments level.

Regiments are displayed as state-colored boxes in a separate layer called _Military_ (<kbd>M</kbd> to toggle). To edit specific Regiment click on its box. To open Military overview screen go to _Tools_ and click on _Military_ (hotkey: <kbd>Shift</kbd> + <kbd>M</kbd>).

## Military overview
![](https://cdn.discordapp.com/attachments/587406457725779968/719203701180596779/military_overview.png)

Military overview shows the army that states have. _Total_ value shows sum of all military units, considering unit crew (see the next section for the details). _Rate_ shows a percentage of military personnel to state population (militarization index), by default is about 1-2%. _War Alert_ defines how much state is willing to wage a war and works as a multiplier to the units number. The calculation method is described in details in the Generation logic section below. The button on the right shows a list of all state's regiments and alow to add new regiments.

The bottom menu allows you to open Units Editor (see below), show units numbers as a percentage, download data for reference and trigger military forces recalculation. 

## Military units editor
![](https://cdn.discordapp.com/attachments/587406457725779968/720368676360028252/military_options.png)

Military units that are used for generation are customizable. To open units editor click on the _Cog_ icon in the Military overview screen. Here you can add new units and specify their features. The maximum number of units is not defined, but having a lot will make overview screens too complex to observe. The idea of unit is defined by its _type_. Type variants are hard-coded and define specific rules to be applied on generation, you can see all of these rules described in the next section.

Customizable parameters are:
* **Icon** - unit symbol. We are using Unicode emojis for simplicity. While there is a list of pre-selected ones, you can use any Unicode character. Please note that Unicode emojis look different in different systems and browsers. Here is [the full list](https://unicode.org/emoji/charts/full-emoji-list.html)
* **Name** - a unique unit name. Can be pretty much any
* **Rural** - percentage of rural population to be conscripted to the unit. It defines how many troops of this unit will be generated for a cell population point. Then this number is getting adjusted based on specific rules described in the next section. Set to 0 if you want unit to be generated in burgs only
* **Urban** - percentage of urban population to be conscripted to the unit. Works the same as _rural_, but for burg population
* **Crew** - average number of people in one unit. Like tank crew is usually 4. This number is used for total people calculation and does not affect unit _power_ at all
* **Power** - damage dealt by unit. Used in battle simulation only
* **Type** - a set of rules to be applied for the unit, see the details in the next section
* **Sep.** - check if unit is _separate_ and not forming a regiment with platoons of other types. It means that e.g. naval units are not getting mixed with non-naval units in one regiment by default.

For any change you have to click on _Apply_ and it will trigger generation. It's done to avoid possible issues and as for now there is no way to change units without regeneration.

## Generation logic
Fantasy Map Generator regiments creation logic is pretty advanced and considers different aspects such as state diplomacy, type, culture and religion, cell biome and elevation, as well as military unit specific.

For each state _War Alert_ is getting calculated. It shows how much state is willing to wage a war. War Alert acts as a modifier to all military forces of the state. For example if state has 1000 infantry generated and War Alert is 2, total infantry number will be 2000. War Alert rate is a combination of _Expansion Fulfillment_ (State Expansionism / State Area) and _Diplomatic alert_ (rate of diplomatic relations). It means that expansionist states with relatively small area get higher War Alert rate than big states with moderate expansionism. Diplomatic alert is a sum of relations rates, where bad relations increase the value, while good decrease it. Diplomatic alert is calculated separately for neighboring and all states, so relations with neighbors have more impact on War Alert. Diplomatic relations modifiers are:

`Ally: -0.2, Friendly: -0.1, Neutral: 0, Suspicion: 0.1, Enemy: 1, Unknown: 0, Rival: 0.5, Vassal: 0.5, Suzerain: -0.5`

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

Some state forms have an additional modifier. _Hordes_ get x2 mounted units, while _Republics_ get x1.2 naval units.

The next step is to calculate troops number for each cell and burg. Calculation is done separately for each unit and  considers possession-specific divider, unit percentage set in military options, state modifier calculated above and hard-coded unit type matrix. For example mounted units have x3 modifier in cells with nomadic biomes, while their number is reduced in highlands. The formula is:

`Troops = Population_points / 100 * Possession_divider * Unit_percentage * State_mod * Unit_mod * Population_rate`

Possession-specific divider is applied in 3 cases only:
* Cell culture is not state's dominant culture: divider is 1.2 for _Unions_ and 2 for other states
* Cell religion is not state's dominant religion: divider is 2.2 for _Theocracies_ and 1.4 for other states 
* Cell is on a different island than state's center: divider is 1.2 for _Naval_ states and 1.8 for others.

Unit-specific modifiers are applied for cells with _Nomadic_ and _Wetland_ biomes, and also for _Highland_ cells (_height_ > 70):

|               | Melee | Ranged | Mounted | Machinery | Armored | Magical | Naval | Aviation |
|---------------|-------|--------|---------|-----------|---------|---------|-------|----------|
| Nomadic cell  |  0.2  |   0.5  |    3    |    0.4    |   1.6   |   0.5   |  0.3  |     1    |
| Wetland cell  |  0.8  |   2    |   0.3   |    1.2    |   0.2   |   0.5   |  1.2  |    0.5   |
| Highland cell |  1.2  |   1.6  |   0.3   |     3     |   0.8   |    2    |  0.3  |    0.3   |
| Nomadic burg  |  0.3  |   0.8  |    3    |    0.4    |   1.6   |   0.5   |  0.3  |     1    |
| Wetland burg  |  1    |   1.6  |   0.2   |    1.2    |   0.2   |   0.5   |  1.2  |    0.5   |
| Highland burg |  1.2  |    2   |   0.3   |     3     |   0.8   |    2    |  0.3  |    0.3   |

Here are generic troops number for 10000 population if state modifier is 1 and standard units options and population rate are applied:

|               | Melee | Ranged | Mounted | Machinery | Naval |
|---------------|-------|--------|---------|-----------|-------|
| Generic cell  |   25  |   12   |    12   |     0     |   0   |
| Nomadic cell  |   5   |    6   |    36   |     0     |   0   |
| Wetland cell  |   20  |   24   |    4    |     0     |   0   |
| Highland cell |   30  |   19   |    4    |     0     |   0   |
| Generic burg  |   20  |   20   |    3    |     3     |   1   |
| Nomadic burg  |   6   |   16   |    9    |     1     |   0   |
| Wetland burg  |   20  |   32   |    1    |     4     |   1   |
| Highland burg |   24  |   40   |    1    |     9     |   0   |

Please also note that _Naval_ units can be generated only in port burgs. 

Troops for each cell and burg form a _platoon_. As number of platoons is too high, they are getting sorted by troops number and aggregated to _regiments_ based on distance between platoons and expected size. Regiment expected size is calculated by a simple formula of `3 * Population_rate`. If the current regiment is big enough, new one is getting created. Then system generates names and a few details for regiments and place them on a map.

## Regiment Editor
![](https://cdn.discordapp.com/attachments/587406457725779968/720385818694254602/regiment_editor.png)

If you click on a regiment box, a Regiment Editor will pop up at the top left corner. Once editor is displayed, you can drag regiment boxes to move them around. A circle shows regiment's base and can be dragged as well. 

From the Regiment Editor screen you can rename the regiment or restore its original name, change regiment emblem and composition. You can also define regiment's type: _land_ or _naval_. Naval regiments look almost the same as land, the only visual difference is box size.

Buttons at the bottom allows to attack foreign regiment (see [Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) for the details), add a new regiment, split the regiment into 2 ones, attach the regiment to another one, regenerate or edit regiment's note (legend) and also remove the regiment.