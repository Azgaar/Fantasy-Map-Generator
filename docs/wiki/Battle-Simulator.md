**Battle Simulator** plays battles between two or more regiments on an animated battle plan. It works based on the attack, defense, speed, range and morale of the units, set in the [Military units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces#military-units-editor).

To start a battle select a regiment, click on the _Attack foreign regiment_ button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one.

## Battle screen

The battle opens as a battle plan: a map of the ground around the battle point with both armies drawn up on it. The rivers, roads, coast, burgs and slopes are those of the map around the battle cell; woods, marshes and hills follow its biome and heights, with details added to make a battlefield of it. A burg with walls is drawn with battlements, with a tower on each side of every gate. A wider river is dotted with stones where it can be waded, a brook can be waded anywhere and has no marks, and a road crossing a river has a bridge.

Above the plan both sides are named, the attackers on the left and the defenders on the right: the emblems of their states, morale as a bar beside the title, the current phase, the troops left and lost. Attackers are always red and defenders blue, whatever the colors of their states. Between them are the battle name and the balance of power: a ribbon with the power of the troops each side still has on the field, each side taking as much of the ribbon as it has of the total. The power is counted as in the Military overview: units number multiplied by unit power and by upkeep. The die of each side stands at its end of the ribbon.

Under the plan are the button to start, pause and continue the battle, the step, restart and speed buttons and the round, with the result beside it once the battle is over; then the battle type, the reroll button, the battle log and the buttons to apply or cancel the battle. Below the controls are the regiments of each side; click a regiment to see its units. Point at a regiment to make its battalions stand out on the plan; point at a battalion to mark its regiment in the list.

Every regiment is split into _battalions_ of its units. A battalion has the same size for both sides, 0.3, 0.5 or 1 population point (300 to 1000 men by default): the bigger the battle, the bigger the battalion, so that all the troops make no more than forty of them until the battalion is at its largest. A battle of up to 12 thousand men has battalions of 300, one of 12 to 20 thousand has battalions of 500. A small battle that would field fewer than ten battalions of 300 gets battalions of 200. A regiment with 5000 infantry fields ten times as many blocks as one with 500. A unit too small for a battalion still gets a block, a narrower one. Battalions never stand on each other: they close up side by side and go around those in their way, so only as many fight as the front has room for and the rest wait behind. Only troops on the run pass through the others. Units with a crew, such as cavalry or artillery, count by their men. The icon on a block is its unit; the dark line along the front of the block is as long as the share of its troops alive. When allies fight on one side, every battalion flies a small flag of the color of its state. Hover over a block to see its troops and morale. A red star marks a melee. Ranged units loose volleys of arrows, machinery and ships lob shells that burst in a bigger star where they land, and dotted arcs are the shooting of the other units.

## Setting up

Everything in the setup is optional, the battle can be started right away.

- **Deployment**. Attackers form up where they came from, defenders hold the battle point on the best ground nearby: melee in the middle with the strongest in the centre, shooters beside them, fast units that fight hand to hand on the wings and those that shoot furthest, such as artillery, behind, in more than one line when the front is too narrow. Drag any battalion to place it yourself, or hold it still to turn it and let go when it faces the way you want. Every move and turn is written to the battle log. The reroll button sets the troops up anew.
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

Field battles and ambushes are played on the ground of the map. Naval and air battles are played on open water and sky; sieges and landings use the ground. In a siege the defenders start within the besieged burg.

**Strength**. A battalion strikes and shoots with `troops × unit attack × phase modifier × upkeep` and stands with the same of its unit's _defense_, see the tables below for the phase modifiers. The more it is hit with for what it stands with, the more it loses. Position changes both:

- high ground: up to +20% against troops standing lower, up to −20% against those standing higher
- troops standing in a river fight at half their strength, in a lake or the sea at a quarter, in a marsh at three quarters, in attack and in defence alike
- water does not trouble naval and aviation units, and the attackers of a landing are shipped to the shore
- mounted units lose 40% in woods
- cover takes its share of the losses however heavy the fire: troops in woods or in a burg lose 40% fewer men to shots, troops within walls two thirds fewer to anything from outside
- troops in a burg defend 25% better
- a hit in the flank is 30% stronger, in the rear 60%, and both shake the morale of the troops hit

**Movement**. Every unit moves at its own _speed_: by default mounted units are about three times as fast as troops on foot, ships are slower than foot and machinery is the slowest. The line keeps together on the approach, so the speed shows in the charge, in the pursuit and in the flight. On the open sea everybody goes as fast as the ships. Troops move slower through woods and marshes and faster along roads. A ford is waded at less than half the pace, and deep water all but stops a battalion: caught in it, it is an easy prey. Troops in order do not march into a lake, the sea or a river out of its fords; those on the run do. Defenders hold their bank at a ford and at a bridge and leave the crossing to the attackers, until they pursue.

**Rivers**. A river is crossed by a bridge or at a ford. A bridge stands wherever a road crosses a river, and anybody may cross it. Fords depend on the river: a brook can be waded anywhere, a wider river only at a ford here and there, and the widest have no fords at all. Where water would keep the sides apart altogether, a crossing is opened where it is narrowest for them: a ford on a river, shallows across a lake or a bay, slow going and poor footing as in a marsh.

**Walls**. The wall of a burg stops everybody, in march and in melee alike: nobody fights through it. Its gates stand where the roads come in, and they are open to all, except in the burg a siege is for: there only the defenders pass. The besiegers get in two ways. In the _storming_ and _looting_ phases they go over the walls and through the forced gates, at a quarter of their pace and at half their strength while they climb; a storm of walls lasts twelve rounds at least, time enough to cross the field, and goes on while the stormers are on the walls or within them. And engines in range of the burg may knock a breach into the wall nearest to them at the start of a round, while they bombard or cover a storm, three breaches at most: a breach is open to everybody, at half the pace over the rubble. The chance of a breach is 4% a round for every battalion of engines in range, 20% at most. Shooting goes over the walls, but troops within them lose a third of the men they would in the open, to shots and to blows from outside alike, and they shoot out a quarter stronger. Friends packed within the walls of one burg keep no lines and do not stand in each other's way.

**Odds**. Besiegers do not storm a burg they are too weak for. Walls are stormed when the besiegers have four times the power of the besieged, and every breach lowers that: two and a half times with one breach, 1.8 with two, 1.4 with three. A burg without walls is stormed at a quarter more power than its defenders have. Below these odds the besiegers bombard if they have engines and hold the blockade if they do not. The power counted is that of the troops, as in the ribbon above the plan. A phase set by hand is not held back: you can order a storm at any odds. Shots over the walls do not keep a siege going by themselves: with no storm, sortie or breach for a while the battle dies down like any other. Engines in range of the walls do keep it going, as long as there is a breach left for them to make.

**Targets**. A battalion goes for the nearest foe and keeps to it. Those who fight hand to hand spread along the foe's line, and fast ones hunt shooters. Of the foes at hand, within its range for a shooter and within a short charge for the rest, the one that hits harder than it stands is struck first: artillery before infantry.

**Ways**. On dry ground troops go straight at the foe. Where water or a wall lies between, they take the quickest way there is: through a gate that is open to them, round a lake or a bay, over a bridge or through a ford, whichever is sooner. The foe is chosen by that way too, so the nearest one across the water is not the nearest any more. Nobody is drawn up in the water, steps aside into it or is pushed into it; troops queue at a bridge, and the fight is often for its end. Troops on the run make for the nearest edge of the field behind their side, round the water.

To add a random factor a 6-sided die is rolled for each side once in ten rounds. The die works as a multiplier for strength (`0.75 + (die − 3.5) × 0.15`), from ×0.375 for ⚀ (die 1) to ×1.125 for ⚅ (die 6), so a side with ⚅ strikes three times as hard as with ⚀. Point at the die to see the multiplier. Click the die to roll it again: the new die stands to the end of the battle, and the roll is written to the battle log.

**Casualties**. Battalions lose men only when somebody strikes or shoots at them. The losses of a battalion depend on the phase and on the strength of all the troops attacking it against its own, so two battalions on one, or archers supporting a melee, tell quickly.

**Morale**. Initial morale is based on the difference in strength — the weaker army gets lower morale, but never below 50 — and on the stability of the state. _Supply line length_ then subtracts up to 15 points: the further a regiment is from its base, the bigger the penalty. In the battle every battalion has its own morale. It drops with casualties and with hits in the flank and rear, and recovers slowly when the battalion is left alone. The drop is divided by the _morale_ of the unit, so levies break before infantry and a steady unit fights on when others run. Troops with morale below 25 may _break and run_: they leave the field and can be cut down on the way. A flight unsettles the friends nearby and heartens their foes. When the morale of a whole side drops, it retreats, and a side that turned to run does not come back.

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
