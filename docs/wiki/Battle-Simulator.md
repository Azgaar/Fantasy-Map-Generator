**Battle Simulator** plays battles between two or more regiments on an animated battle plan. It works based on units power parameter that can be set in the [Military units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces#military-units-editor).

To start a battle select a regiment, click on the _Attack foreign regiment_ button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one.

## Battle screen

The battle opens as a battle plan: a map of the ground around the battle point with both armies drawn up on it. The rivers, roads, coast, burgs and slopes are those of the map around the battle cell; woods, marshes and hills follow its biome and heights, with details added to make a battlefield of it. A burg with walls is drawn with battlements.

Above the plan both sides are named, the attackers on the left and the defenders on the right: the emblems of their states, morale as a bar beside the title, the current phase, the troops left and lost. Attackers are always red and defenders blue, whatever the colors of their states. Between them are the battle name and the balance of power: a ribbon with the power of the troops each side still has on the field, each side taking as much of the ribbon as it has of the total. The power is counted as in the Military overview: units number multiplied by unit power and by upkeep. The die of each side stands at its end of the ribbon.

Under the plan are the button to start, pause and continue the battle, the step, restart and speed buttons and the round, with the result beside it once the battle is over; then the battle type, the reroll button, the battle log and the buttons to apply or cancel the battle. Below the controls are the regiments of each side; click a regiment to see its units. Point at a regiment to make its battalions stand out on the plan; point at a battalion to mark its regiment in the list.

Every regiment is split into _battalions_ of its units. A battalion has the same size for both sides, a round number that makes about thirty battalions of all the troops, so a regiment with 5000 infantry fields ten times as many blocks as one with 500. A unit too small for a battalion still gets a block, a narrower one. Battalions never stand on each other: they close up side by side and go around those in their way, so only as many fight as the front has room for and the rest wait behind. Units with a crew, such as cavalry or artillery, count by their men. The icon on a block is its unit; the dark line along the front of the block is as long as the share of its troops alive. When allies fight on one side, every battalion flies a small flag of the color of its state. Hover over a block to see its troops and morale. Dotted arcs are shooting and a red star marks a melee.

## Setting up

Everything in the setup is optional, the battle can be started right away.

- **Deployment**. Attackers form up where they came from, defenders hold the battle point on the best ground nearby: melee in the middle with the strongest in the centre, ranged units beside them, mounted on the wings and machinery behind, in more than one line when the front is too narrow. Drag any battalion to place it yourself, or hold it still to turn it and let go when it faces the way you want. Every move and turn is written to the battle log. The reroll button sets the troops up anew.
- **Regiments**. Add more regiments with the _Add_ button above the regiments of a side. There is no restriction for state: a state can have regiments on both sides.
- **Battle type**. Click the type under the plan and pick another one, see below. The type can be changed only before the battle starts.
- **Actions**. The button with the phase and a cog, beside the title of a side, opens what can be done to the side by hand: order another phase, add power or take it away, add morale or take it away. Power is in the units of the ribbon. Each change is made once, at any time, and is written to the battle log.
- **Name**. Type the battle name or generate one.
- **Reroll** gives other ground details and other fortune and resets the deployment, before the battle starts.

## Battle process

Press _Start battle_. The battle goes by itself in short steps, six steps make a _round_. It can be paused at any moment to drag troops, add regiments, order another phase or add power or morale, and then continued. The step button advances it by a single step, and the buttons below it set the speed. _Play again_ returns the battle to its start and plays the same battle once more, with every change made on the way.

Once a battle is initiated, the system automatically selects a _Battle type_. The battle type defines the _battle phases_, which control what troops do. There are 6 battle types, each with its own logic. The type is chosen from the two initial regiments, in this order:

1. **Naval** — both regiments are naval
2. **Air** — every unit on both sides is of the aviation type
3. **Landing** — the attacker is naval and carries non-naval units, and the defender is not naval
4. **Siege** — the defender is not naval and stands in a burg with walls or a citadel
5. **Ambush** — 10% chance when the defender is in a forest or wetland biome
6. **Field** — everything else

Field battles and ambushes are played on the ground of the map. Naval and air battles are played on open water and sky; sieges and landings use the ground, but walls, ships and the shore do not affect the troops yet.

**Strength**. The strength of a battalion is `troops × unit power × phase modifier × upkeep`, see the tables below for the phase modifiers. Position changes it:

- high ground: up to +20% against troops standing lower, up to −20% against those standing higher
- crossing a river halves the strength, a marsh takes a quarter of it; a road bridges the river
- mounted units lose 40% in woods; shooting at troops in woods or in a burg loses 40%
- troops in a burg defend 25% better
- a hit in the flank is 30% stronger, in the rear 60%, and both shake the morale of the troops hit

Troops also move slower through woods, marshes and rivers and faster along roads.

To add a random factor a 6-sided die is rolled for each side every round. The die works as a multiplier for strength (`die / 10 + 0.4`), so ⚅ (die 6) means full power and ⚀ (die 1) means half power. Point at the die to see the multiplier. Click the die to roll it again: the new die stands for the round to come, and the roll is written to the battle log.

**Casualties**. Battalions lose men only when somebody strikes or shoots at them. The losses of a battalion depend on the phase and on the strength of all the troops attacking it against its own, so two battalions on one, or archers supporting a melee, tell quickly.

**Morale**. Initial morale is based on the difference in strength — the weaker army gets lower morale, but never below 50 — and on the stability of the state. _Supply line length_ then subtracts up to 15 points: the further a regiment is from its base, the bigger the penalty. In the battle every battalion has its own morale. It drops with casualties and with hits in the flank and rear, and recovers slowly when the battalion is left alone. Troops with morale below 25 may _break and run_: they leave the field and can be cut down on the way. A flight unsettles the friends nearby and heartens their foes. When the morale of a whole side drops, it retreats, and a side that turned to run does not come back.

The battle ends when one side has no troops in order: the other one _holds the field_. It also ends when the fighting dies down. You can apply the results at any moment with the apply button, you don't need to wait for the end; the cancel button rolls the battle back. If results are applied, casualties are taken from the regiments, the regiments' notes (legend) are updated with a short info about the battle and a battlefield _marker_ is added.

## Battle log

Everything that happens is written to the battle log, open it with the list button. The log can be downloaded as a file and loaded later:

- with the same regiments on the map the battle is set up as it was and replays exactly, with every change made on the way at its moment
- with other regiments only the settings are taken: the battle type and what was done to the sides by hand

## Battle types
#### 🗡️ Field battle

Field battle is a standard type of combat. It starts with 🎯 _skirmish_ phase, where ranged and machinery units prevail. Skirmish usually lasts for a few iterations depending on how many ranged units are in both armies. Then ⚔️ _melee_ battle begins - melee and armored units excel at this phase. Once morale of one army drops, it is entering a 🏳️ _retreat_ phase, where strength of all units is drastically decreased. Another side immediately starts to 🐎 _pursue_ the enemy, getting a good advantage for mounted units.

|             | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|-------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 🎯 Skirmish |  0.2  |   2.4  |   0.1   |     3     |   1   |   0.2   |    1.8   |   1.8   |
| ⚔️ Melee    |   2   |   1.2  |   1.5   |    0.5    |  0.2  |    2    |    0.8   |   0.8   |
| 🏳️ Retreat  |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue   |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🌊 Naval battle

Naval battle type is auto-selected when both attacker and defender regiments are naval. It starts with a 💣 _shelling_ phase, where naval and machinery units deal almost all the damage. In a few iterations ⚔️ _boarding_ can start. Melee units excel in this phase, while other types are not that effective. If boarding is not started and the morale of one side drops, it enters a 🏳️ _withdrawal_ phase. The enemy starts a ⛵ _chase_, but contrary to a field battle the damage at this phase is low.

|               | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|---------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 💣 Shelling   |   0   |   0.2  |    0    |     2     |   2   |    0    |    0.1   |   0.5   |
| ⚔️ Boarding   |   1   |   0.5  |   0.5   |     0     |  0.5  |   0.4   |     0    |   0.2   |
| 🏳️ Withdrawal |   0   |  0.02  |    0    |    0.5    |  0.1  |    0    |    0.1   |   0.3   |
| ⛵ Chase      |   0   |  0.15  |    0    |     1     |   1   |    0    |   0.15   |   0.5   |


#### 🏰 Siege

If the defending regiment is not naval and is located in a burg with walls or a citadel, the system automatically selects siege as the battle type. Siege is the most complex type with a number of optional phases and different variants for attackers and defenders.

For attackers siege always starts with a ⏳ _blockade_ phase. This is an inactive phase, where attackers prepare or hold a blockade. No damage dealt until attackers are ready to start a 💣 _bombardment_ or ⚔️ _storm_ the town. Machinery units excel at bombardment phase, while storming is risky and does not provide good results if attackers are not dominating in numbers.

Defenders can start a bombardment from the very first iteration. From time to time, or if they don't have machinery units, defender have to 🔒 _shelter_ in an inactive phase. Once in a few iterations defenders can send a 🚪 _sortie_ to attackers army. Sortie can be pretty successful, so attackers are not safe during the siege.

When attackers initiate storming, besieged army is switching to a 🛡️ _defense_ phase. As siege can be pretty long and defenders are usually ready for a storming and hence they get good modifiers during the defense. Storming is a short phase, so if it is not successful and defenders are not 🏳️ _surrender_, attackers have to get back to a bombardment or blockade phase. If defenders cannot combat anymore and capitulate, attackers start ☠️ _looting_ without significant resistance.

If siege is not successful, which is a pretty common case, attacker may decide to 🏳️ _retreat_. Defenders start 🐎 _pursue_ the enemy, getting a huge advantage for mounted units.

|                | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|----------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| ⏳ Blockade     |  0.25 |  0.25  |   0.2   |    0.5    |  0.2  |   0.1   |   0.25   |   0.25  |
| 🔒 Sheltering   |  0.3  |   0.5  |   0.2   |    0.5    |  0.2  |   0.1   |   0.25   |   0.25  |
| 🚪 Sortie       |   2   |   0.5  |   1.2   |    0.2    |  0.1  |   0.5   |     1    |    1    |
| 💣 Bombardment  |  0.2  |   0.5  |   0.2   |     3     |   1   |   0.5   |     1    |    1    |
| ⚔️ Storming     |   1   |   0.6  |   0.5   |     1     |  0.1  |   0.1   |    0.5   |   0.5   |
| 🛡️ Defense      |   2   |    3   |    1    |     1     |  0.1  |    1    |    0.5   |    1    |
| 🏳️ Surrendering |  0.1  |   0.1  |   0.05  |    0.01   |  0.01 |   0.02  |   0.01   |   0.03  |
| ☠️ Looting      |  1.6  |   1.6  |   0.5   |    0.2    |  0.02 |   0.2   |    0.1   |   0.3   |
| 🏳️ Retreat      |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue       |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🌳 Ambush

Ambush is auto-selected with a 10% chance if the defender stands in a Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga or Wetland biome. It starts with a ⚡ _surprise attack_ of the defenders that causes attackers' 💫 _shock_. Defenders get a huge advantage with the surprise factor, but if attackers army is still stronger, the shock will end quickly. Once shock is over, sides enter a standard ⚔️ _melee_ phase, which usually ends with a 🏳️ _retreat_ of the side with dropped morale. Other side start a 🐎 _pursue_ where mounted units excel.

|               | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|---------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| ⚡ Surprise   |   2   |   2.4  |    1    |     1     |   1   |    1    |    0.8   |   1.2   |
| 💫 Shock      |  0.5  |   0.5  |   0.5   |    0.4    |  0.3  |   0.1   |    0.4   |   0.5   |
| ⚔️ Melee      |   2   |   1.2  |   1.5   |    0.5    |  0.2  |    2    |    0.8   |   0.8   |
| 🏳️ Retreat    |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue     |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🔱 Landing

Landing is happening when attackers regiment is naval and has land units, while defending regiment is a land one. The battle starts with a ⚓ _landing_ phase, which is quite risky for attackers. Defenders are either 💫 _shocked_ and get penalties, or ready for a 🛡️ _defense_ and can withstand or even force attackers to ⛵ _flee_. Shock / defense selection is pure random with 50% chance. If attackers are fleeing, defenders can 🐎 _pursue_ the enemy, but usually they need some time to prepare and hence are ⌛ _waiting_ at inactive phase.

After first few iterations sides are entering a standard ⚔️ _melee_ phase. If landing is successful, morale of defenders is dropping and they have to 🏳️ _retreat_. In this case attackers immediately start to 🐎 _pursue_ the enemy.

|           | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|-----------|-------|--------|---------|-----------|-------|---------|----------|---------|
| ⚓ Landing |  0.8  |   0.6  |   0.6   |    0.5    |  0.5  |   0.5   |    0.5   |   0.6   |
| 💫 Shock   |  0.5  |   0.5  |   0.5   |    0.4    |  0.3  |   0.1   |    0.4   |   0.5   |
| 🛡️ Defense |   2   |    3   |    1    |     1     |  0.1  |    1    |    0.5   |    1    |
| ⚔️ Melee   |   2   |   1.2  |   1.5   |    0.5    |  0.2  |    2    |    0.8   |   0.8   |
| 🏳️ Retreat |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue  |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |
| ⛵ Flee    |  0.1  |  0.01  |   0.5   |    0.01   |  0.5  |   0.1   |    0.2   |   0.05  |
| ⌛ Waiting |  0.05 |   0.5  |   0.05  |    0.5    |   2   |   0.05  |    0.5   |   0.5   |

#### 💨 Air battle

Air battle type is auto-selected in very rare cases, when every unit of both the attacking and the defending regiment has the _aviation_ type. As all units are supposed to have the same type, type-depending modifiers does not play significant role and can be ignored. Air battle starts with a 🎯 _maneuvering_ phase, where damage is not significant. In a few iterations an active 🐕 _dogfight_ begins. If morale of one side is getting low, it is entering a 🏳️ _retreat_ phase. The enemy starts a 🐎 _pursue_.

|                | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|----------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 🎯 Maneuvering |   0   |   0.1  |   0.1   |    0.2    |   0   |    0    |     1    |   0.2   |
| 🐕 Dogfight    |   0   |   0.1  |    0    |    0.1    |   0   |    0    |     2    |   0.1   |
| 🏳️ Retreat     |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue      |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |
