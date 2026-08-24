**Battle Simulator** allows you to simulate battles between two or more regiments. It works based on units power parameter that can be set in the [Military units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces#military-units-editor).

To start a battle select a regiment, click on the _Attack foreign regiment_ button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one.

## Battle process

![](https://cdn.discordapp.com/attachments/587406457725779968/722571310290567209/Battle_Simulator.png)

Battle simulation is iterative. It means that it is processed step by step, with each step being controlled automatically, but there is also an ability of a manual change. To progress to the next iteration click on ▶️ button. To apply the current result and end the battle click on ✅, to abandon and cancel the results - click on ❎ button. To add a regiment click on 🙍‍♂️➕ button, select any regiment the list and click on a button to set the side. There is no restriction for state - you can add regiment of the same state both to attackers and defenders side. You can also define battle name using 🅰️ button.

Once a battle is initiated, the system automatically selects a _Battle type_. The battle type defines the _battle phases_, which control the battle process. There are 6 battle types, each with its own logic. Both the battle type and the current phase can be changed manually at any time. The type is chosen from the two initial regiments, in this order:

1. **Naval** — both regiments are naval
2. **Air** — every unit on both sides is of the aviation type
3. **Landing** — the attacker is naval and carries non-naval units, and the defender is not naval
4. **Siege** — the defender is not naval and stands in a burg with walls or a citadel
5. **Ambush** — 10% chance when the defender is in a forest or wetland biome
6. **Field** — everything else

For each iteration the _strength_ of both sides is calculated as the sum of `unit count × unit power × phase modifier` over all units, scaled down by a population adjuster. See the tables below for the phase modifiers.

One more parameter auto-defined on battle start is _morale_. Initial morale is based on the difference in strength — the weaker army gets lower morale, but never below 50. _Supply line length_ then subtracts up to 15 points: the further a regiment is from its base, the bigger the penalty. Please note that supply line length affects only the initial morale, it has no effect on army strength. Morale drops as casualties accumulate, and low morale is what pushes a side into retreat, withdrawal or surrender.

To add a random factor to battles a 6-sided die is rolled for each side. Click a die to re-roll both. The die works as a multiplier for army strength (`die / 10 + 0.4`), so ⚅ (die 6) means full power and ⚀ (die 1) means half power.

For each iteration combined strength of both armies is considered to calculate _casualties_. Casualties are displayed as red line with negative numbers, _survivors_ -as green line with positive value. While there is a significant random factor affecting casualties, the generic pattern is defined by strength ratio and battle phase. It means that displayed _power_ actually shows which army excels at the current iteration and what would be ratio of casualties.

If one of the armies has no survivors left, you cannot proceed with iterations. Now you can either apply battle results or cancel them. Please note that you can apply results at any iteration, you don't need to wait while one army is completely destroyed. If results are applied, regiments' note (legend) is getting updated with a short info about the battle and also a battlefield _marker_ is getting added.

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
