**Battle Simulator**, added to the Generator in [version 1.4](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog),  allows to simulate battles between two or more regiments. It works based on units power parameter that can be set in the [Military units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces#military-units-editor).

To start a battle select a regiment, click on the _Attack foreign regiment_ button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one.

## Battle process

![](https://cdn.discordapp.com/attachments/587406457725779968/722571310290567209/Battle_Simulator.png)

Battle simulation is iterative. It means that it is processed step by step, with each step being controlled automatically, but there is also an ability of a manual change. To progress to the next iteration click on ▶️ button. To apply the current result and end the battle click on ✅, to abandon and cancel the results - click on ❎ button. To add a regiment click on 🙍‍♂️➕ button, select any regiment the list and click on a button to set the side. There is no restriction for state - you can add regiment of the same state both to attackers and defenders side. You can also define battle name using 🅰️ button.

Once battle is initiated, system automatically selects a _Battle type_. Battle type defines _battle phases_, which control the battle process. There are 6 battle types supported, each having its own specific and logic. Both battle type and specific phase can be changed manually at any time. For each iteration _strength_ of both sides are getting calculated. Strength depends on available units quantity and their power, modified by phase adjuster. See the next section for the details.

One more parameter that is auto-define on battle start is _morale_. Initial morale is based on difference in strength - weaker army gets low morale. _Supply line length_ also affects initial morale: the bigger distance to regiments base is, the bigger penalty to morale is applied. Please note that supply line length affects only initial morale, it has no effect for armies strength. 

To add a random factor into battles, a 6-sided die is getting rolled. Click on a die to re-roll. Dice work as a multiplier for army strength, ⚅ (die 6) means full power, while  ⚀ (die 1) - half-power.

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

Naval battle type is auto-selected when both attacker and defender regiments are naval. It starts with 💣 _shelling_ phase, where only ranged units deal damage. In a few iterations ⚔️ _boarding_ can start. Melee units excel in this phase, while other types are not that effective. If boarding is not started and morale of one side is getting low, it is entering a 🏳️ _withdrawal_ phase. The enemy starts ⛵ _chase_, but contrary to field battle the damage at this phase is low. 

|               | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|---------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 💣 Shelling   |   0   |   0.2  |    0    |     2     |   2   |    0    |    0.1   |   0.5   |
| ⚔️ Boarding   |   1   |   0.5  |   0.5   |     0     |  0.5  |   0.4   |     0    |   0.2   |
| 🏳️ Withdrawal |   0   |  0.15  |    0    |     1     |   1   |    0    |   0.15   |   0.5   |
| ⛵ Chase      |   0   |  0.02  |    0    |    0.5    |  0.1  |    0    |    0.1   |   0.3   |


#### 🏰 Siege

If attacked regiment is located in a walled town, the system automatically selects siege as a battle type. Siege is the most complex type with a number of optional phases and different variants for attackers and defenders. 

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
| 🏳️ Surrendering |  0.1  |   0.1  |   0.05  |    0.01   |  0.01 |   0.02  |    0.1   |   0.3   |
| ☠️ Looting      |  1.6  |   1.6  |   0.5   |    0.2    |  0.02 |   0.2   |    0.1   |   0.3   |
| 🏳️ Retreat      |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue       |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🌳 Ambush

Ambush is getting auto-selected with a 20% chance if defenders are in forest or marshes biomes. It starts with a ⚡ _surprise attack_ of the defenders that causes attackers' 💫 _shock_. Defenders get a huge advantage with the surprise factor, but if attackers army is still stronger, the shock will end quickly. Once shock is over, sides enter a standard ⚔️ _melee_ phase, which usually ends with a 🏳️ _retreat_ of the side with dropped morale. Other side start a 🐎 _pursue_ where mounted units excel.

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

Air battle type is auto-selected in very rare cases, when all units participating in battle have type _aviation_. As all units are supposed to have the same type, type-depending modifiers does not play significant role and can be ignored. Air battle starts with a 🎯 _maneuvering_ phase, where damage is not significant. In a few iterations an active 🐕 _dogfight_ begins. If morale of one side is getting low, it is entering a 🏳️ _retreat_ phase. The enemy starts a 🐎 _pursue_.

|                | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|----------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 🎯 Maneuvering |   0   |   0.1  |   0.1   |    0.2    |   0   |    0    |     1    |   0.2   |
| 🐕 Dogfight    |   0   |   0.1  |    0    |    0.1    |   0   |    0    |     2    |   0.1   |
| 🏳️ Retreat     |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue      |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |