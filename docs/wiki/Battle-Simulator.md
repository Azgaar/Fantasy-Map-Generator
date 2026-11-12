**Battle Simulator** plays battles between two or more regiments on an animated battle plan. It works based on the attack, defense, speed, range and morale of the units, set in the [Military units editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces#military-units-editor).

To start a battle select a regiment, click on the _Attack foreign regiment_ button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one.

## Battle screen

The battle opens as a battle plan: a map of the ground around the battle point with both armies drawn up on it. The rivers, roads, coast, burgs and slopes are those of the map around the battle cell; woods, marshes and hills follow its biome and heights, with details added to make a battlefield of it. The details are a fixed pattern of the place: the same spot of the map always gives the same ground. A burg with walls is drawn with battlements, with a tower on each side of every gate. A wider river is dotted with stones where it can be waded, a brook can be waded anywhere and has no marks, and a road crossing a river has a bridge.

Above the plan both sides are named, the attackers on the left and the defenders on the right: the emblems of their states, morale as a bar beside the title, the current phase, the troops left and lost. Attackers are always red and defenders blue, whatever the colors of their states. Between them are the battle name and the balance of power: a ribbon with the power of the troops each side still has on the field, each side taking as much of the ribbon as it has of the total. The power is counted as in the Military overview: units number multiplied by unit power and by upkeep. The die of each side stands at its end of the ribbon.

Under the plan are the button to start, pause and continue the battle, the step, restart and speed buttons and the round, with the result beside it once the battle is over; then the battle type, the reset button, the battle log and the buttons to apply or cancel the battle. Below the controls are the regiments of each side; click a regiment to see its units. Point at a regiment to make its battalions stand out on the plan; point at a battalion to mark its regiment in the list.

Every regiment is split into _battalions_ of its units. A battalion has the same size for both sides, 0.3, 0.5 or 1 population point (300 to 1000 men by default): the bigger the battle, the bigger the battalion, so that all the troops make no more than forty of them until the battalion is at its largest. A battle of up to 12 thousand men has battalions of 300, one of 12 to 20 thousand has battalions of 500. A small battle that would field fewer than ten battalions of 300 gets battalions of 200. A regiment with 5000 infantry fields ten times as many blocks as one with 500. A unit too small for a battalion still gets a block, a narrower one. Battalions never stand on each other: they close up side by side and go around those in their way, so only as many fight as the front has room for and the rest wait behind. Only troops on the run pass through the others. Units with a crew, such as cavalry or artillery, count by their men. The icon on a block is its unit; the dark line along the front of the block is as long as the share of its troops alive. When allies fight on one side, every battalion flies a small flag of the color of its state. Hover over a block to see its troops and morale. A red star marks a melee. Ranged units loose volleys of arrows, machinery and ships lob shells that burst in a bigger star where they land, and dotted arcs are the shooting of the other units.

## Setting up

Everything in the setup is optional, the battle can be started right away.

- **Deployment**. Each side is drawn up by its general, by the tactic he has chosen, see [Generals](#generals). Attackers form up where they came from, defenders hold the battle point on the best ground nearby. Drag any battalion to place it yourself, or double-click it to turn it by 15 degrees: the general keeps a battalion in the place it was put in. Every move and turn is written to the battle log. The reset button sets the troops up anew.
- **Regiments**. Add more regiments with the _Add_ button above the regiments of a side. There is no restriction for state: a state can have regiments on both sides.
- **Battle type**. Click the type under the plan and pick another one, see below. The type can be changed only before the battle starts.
- **Actions**. The button with the phase and a cog, beside the title of a side, opens what can be done to the side by hand: order another phase, add power or take it away, add morale or take it away. Power is in the units of the ribbon. Each change is made once, at any time, and is written to the battle log.
- **Name**. Type the battle name or generate one.
- **Reset** draws the troops up anew and drops the moves made by hand, before the battle starts.

## Battle process

Press _Start battle_. The battle goes by itself in short steps, six steps make a _round_. It can be paused at any moment to drag troops, add regiments, order another phase or add power or morale, and then continued. The step button advances it by a single step, and the buttons below it set the speed. _Play again_ returns the battle to its start and plays the same battle once more, with every change made on the way.

Once a battle is initiated, the system automatically selects a _Battle type_. The battle type defines the _battle phases_ a general can order his side into. There are 6 battle types, each with its own logic. The type is chosen from the two initial regiments, in this order:

1. **Naval** — both regiments are naval
2. **Air** — every unit on both sides is of the aviation type
3. **Landing** — the attacker is naval and carries non-naval units, and the defender is not naval
4. **Siege** — the defender is not naval and stands in a burg with walls or a citadel
5. **Ambush** — the defender is in a forest or wetland biome and has less than three quarters of the attacker's power
6. **Field** — everything else

Field battles and ambushes are played on the ground of the map. Naval and air battles are played on open water and sky; sieges and landings use the ground. In a siege the defenders start within the besieged burg.

## Generals

Each side is led by a general. Before the battle he weighs both armies and the ground, picks a _tactic_ and draws his troops up by it; the tactics of both sides are the first lines of the battle log. Every round he looks at the field again, sets the phase of his side and gives every battalion an order. Nothing in a battle is left to chance: the same armies on the same ground always fight the same battle.

**Planning**. In a field, a naval and an air battle the generals think the battle through before it begins: each plays every tactic open to him in his mind, to its end or for sixty rounds, against the foe as the odds make him expect it, and takes the one that leaves him holding the field with the lighter losses. Neither knows what the other has settled on. An attackers' general whose army is the weaker of the two also weighs not attacking at all, and stands if that ends better for him. On ground with water or walls only the attackers' general thinks it through, and only if he is the weaker: his likeliest tactic against not attacking. The other battle types have a choice of their own to think through. In an ambush the ambushers' general weighs lying on both sides of the road against lying on one; the general of the column has no plan, it is caught. In a landing defenders who are ready weigh meeting it at the shore against waiting inland. In a siege besiegers with at least two thirds of the odds the walls ask for weigh storming at once against keeping to the rule; with more than 28 battalions on the field a storm is not thought through: there is no time for it.

The first deployment on screen is the one the odds alone suggest; while the generals think, for up to a second, the start and step buttons are disabled, and then the troops take their final places. Adding a regiment or power, or changing the battle type before the start makes them think again.

| Tactic | The troops are drawn up | Likeliest |
|--------|-------------------------|--------|
| Frontal assault | in lines, shooters behind the first one, riders on both wings, a reserve behind | by the stronger side |
| Oblique attack | with one wing massed, the best troops, the second line, the reserve and all the riders on it, the other wing held back | at even odds or weaker, against the weaker wing of the foe |
| Envelopment | with a thinner centre held back and riders massed on both wings | with clearly more riders |
| Wedge | in a deep column with trailing wings | against a longer, thinner line |
| Harassing fire | with shooters as the first line and the rest behind them | with more to shoot with and less to fight with |
| Defensive line | on the best ground in reach: the high ground, with the ends of the line covered and with something for the foe to cross | by defenders at fair odds |
| Refused flanks | with the ends of the line bent back | by defenders outnumbered or with fewer riders |
| Defence of a crossing | round the far end of the ford or bridge the attackers have to come by | by defenders behind a river |
| Column of march | in a column on the road, riders ahead, engines last | by the attackers of an ambush: they are caught |
| Ambuscade on both sides, Ambuscade on one side | along the road on both sides of it, or all on one, the better covered by trees and high ground | by the ambushers |
| Siege lines, Garrison on the walls | out of bowshot with the engines in front; shooters towards the besiegers, the rest by the gates and in the middle | in a siege of a walled burg |
| Landing in waves | line troops first, shooters and riders behind them | by the attackers of a landing |

Riders kept in reserve stand behind the ends of the line, and never among trees or in a marsh: there they close in to the line till the ground is open. In a naval or an air battle all troops are of one kind and form lines.

**Who attacks**. Attackers come on unless they have less than three quarters of the defenders' power: then they take a defensive tactic and wait. Defenders with a quarter more power than the attackers, and no river to hold, come out to meet them. A side that waits goes over to the attack when the foe is spent (one and a half times the foe's power once the lines have met), when it is shot at with less than half of the foe's fire to answer with, or when the foe has not come for six rounds and is no stronger; but it does not march on a waiting foe who has twice its fire, and a general who chose to wait keeps waiting. It is written to the battle log. A side that holds a river crossing stays behind it until the foe runs. When neither side comes, the battle dies down as a standoff.

**Orders**. A battalion of the line keeps its place in the formation, which the general moves forward at the pace of its slowest troops, and fights what comes within a charge of its place. Shooters keep their place behind the line and step back from those who come for them. Riders on a wing set out round the end of the foe's line when the lines are a charge apart, so that they fall on him as the lines meet, unless the foe's riders on that wing are much the stronger: then they guard the wing. The weak wing of an oblique attack holds back and fights only what comes at it. The reserve waits behind and is sent, the nearest battalion first: into the place of a battalion of the first line that broke, against foes that come round a flank or through the line, at a foe that wavers in a fight, and all of it once the lines have fought for eight rounds.

**A battalion's own mind**. Whatever its order, a battalion at grips fights on and turns on whoever has it by the flank. A battalion with morale below 30 is _shaken_: it defends itself but does not attack. Riders do not charge formed line troops head on while they have a flank, a shooter or an engine to go for.

**The day is lost** when a side has less than a third of the foe's power left in order; less than two thirds with a quarter of its troops gone; no more than the foe with half of them gone; or when its morale is below 25. The general then orders the retreat and the side leaves the field: it does not come back. Defenders of a river crossing hold out at half these odds. So a side more than three times weaker than its foe refuses the battle altogether.

A phase ordered by hand stands for ten rounds, then the general decides again. Ordered to close with the foe (melee, boarding, dogfight), a side attacks even if its general meant to wait.

**Strength**. A battalion strikes and shoots with `troops × unit attack × phase modifier × upkeep` and stands with the same of its unit's _defense_, see the tables below for the phase modifiers. In a field, a naval and an air battle the modifier is by what the battalion itself is doing: the first row of the table while it stands apart and shoots or is shot at, the second when it is at grips, the row of the pursuit when it strikes troops on the run. In an ambush, a landing and a siege it is by the phase of its side. Troops on the run always have the modifiers of a retreat, and engines caught hand to hand those of a melee, whatever the phase. The more a battalion is hit with for what it stands with, the more it loses. Position changes both:

- high ground: up to +20% against troops standing lower, up to −20% against those standing higher
- troops standing in a river fight at half their strength, in a lake or the sea at a quarter, in a marsh at three quarters, in attack and in defence alike
- water does not trouble naval and aviation units, and the attackers of a landing are shipped to the shore
- mounted units lose 40% in woods
- cover takes its share of the losses however heavy the fire: troops in woods or in a burg lose 40% fewer men to shots, troops within walls two thirds fewer to anything from outside
- troops in a burg defend 25% better
- a hit in the flank is 30% stronger, in the rear 60%, and both shake the morale of the troops hit

**Movement**. Every unit moves at its own _speed_: by default mounted units are about three times as fast as troops on foot, ships are slower than foot and machinery is the slowest. The line keeps together on the approach, so the speed shows in the charge, in the pursuit and in the flight. On the open sea everybody goes as fast as the ships. Troops move slower through woods and marshes and faster along roads. A ford is waded at less than half the pace, and deep water all but stops a battalion: caught in it, it is an easy prey. Troops in order do not march into a lake, the sea or a river out of its fords; those on the run do. A side that waits for its foe holds its bank at a ford and at a bridge and leaves the crossing to the other side, until it goes over to the attack.

**Rivers**. A river is crossed by a bridge or at a ford. A bridge stands wherever a road crosses a river, and anybody may cross it. Fords depend on the river: a brook can be waded anywhere, a wider river only at a ford here and there, and the widest have no fords at all. Where water would keep the sides apart altogether, a crossing is opened where it is narrowest for them: a ford on a river, shallows across a lake or a bay, slow going and poor footing as in a marsh.

**Walls**. The wall of a burg stops everybody, in march and in melee alike: nobody fights through it. Its gates stand where the roads come in, and they are open to all, except in the burg a siege is for: there only the defenders pass. The besiegers get in two ways. In the _storming_ and _looting_ phases they go over the walls and through the forced gates, at a quarter of their pace and at half their strength while they climb. Every battalion makes for the middle of the burg by its own quickest way: over the stretch of wall in front of it, or by a breach or a forced gate when one is about as near, so the garrison cannot hold the walls everywhere. And engines in range of the burg work a breach into the wall nearest to them while they bombard or cover a storm, three breaches at most: a breach is open to everybody, at half the pace over the rubble. A battalion of engines in range does 4% of a breach a round, all of them together 20% at most: five battalions breach a wall in five rounds, one in twenty five. Shooting goes over the walls, but troops within them lose a third of the men they would in the open, to shots and to blows from outside alike, and they shoot out a quarter stronger. Friends packed within the walls of one burg keep no lines and do not stand in each other's way.

**Odds**. Besiegers do not storm a burg they are too weak for. Walls are stormed when the besiegers have four times the power of the besieged, and every breach lowers that: two and a half times with one breach, 1.8 with two, 1.4 with three. A burg without walls is stormed at a quarter more power than its defenders have. Below these odds the besiegers bombard if they have engines and hold the blockade if they do not. A storm that has lost a third of the odds it was begun at is called off, unless the stormers are on the walls, within them or at grips with the garrison; the besiegers then go back to their lines. Engines alone storm nothing: with no troops left to climb the walls the besiegers bombard. The besieged make a sortie at the besiegers' engines when the party is half as strong again as their guards, the engines themselves counted at a quarter: the riders and every other battalion of the line go out by the gates, and come home after eight rounds, when the engines are done for or when the party is shaken. A garrison half as strong again as the besiegers comes out with its whole line to drive them off, and the besiegers raise the siege. The besieged give the burg up when their morale falls below 15, or when half of them are lost with the besiegers on the walls and the stronger. The power counted is that of the troops, as in the ribbon above the plan. A phase set by hand is not held back: you can order a storm at any odds. Shots over the walls do not keep a siege going by themselves: with no storm, sortie or breach for a while the battle dies down like any other. Engines in range of the walls do keep it going, as long as there is a breach left for them to make.

**Targets**. Of the foes its order lets it go for, a battalion picks the one worth most and keeps to it. A foe is worth more the nearer it is, when it is already held in a fight and can be taken in the flank or rear, when it is shaken, when it hits harder than it stands (artillery before infantry), and when the general points at it; for riders shooters and engines are worth more and formed line troops met head on less. Those who fight hand to hand spread along the foe's line rather than crowd on one battalion.

**Ways**. On dry ground troops go straight at the foe. Where water or a wall lies between, they take the quickest way there is: through a gate that is open to them, round a lake or a bay, over a bridge or through a ford, whichever is sooner. The foe is chosen by that way too, so the nearest one across the water is not the nearest any more. Nobody is drawn up in the water, steps aside into it or is pushed into it; troops queue at a bridge, and the fight is often for its end. Troops on the run make for the nearest edge of the field behind their side, round the water.

**Fortune** is a 6-sided die each side has. It is never rolled: both stand at ⚂ until you turn them. The die works as a multiplier for strength (`0.75 + (die − 3.5) × 0.15`), from ×0.375 for ⚀ (die 1) to ×1.125 for ⚅ (die 6), so a side with ⚅ strikes three times as hard as with ⚀, and two equal dice change nothing. Point at the die to see the multiplier. Click the die to turn it to the next face, as many times as it takes to set the value you want: the new die is written to the battle log. The generals do not reckon with fortune.

**Casualties**. Battalions lose men only when somebody strikes or shoots at them. The losses of a battalion depend on the strength of all the troops attacking it against its own, so two battalions on one, or archers supporting a melee, tell quickly: a round costs it `rate ÷ 2 × hits ÷ (hits + its own strength)` of the troops it began with, the rate being that of the fiercer of the two phase modifiers at work, the striker's and its own: 10% for shooting, 20% for a melee, 30% for a pursuit. Losses are counted in fractions and rounded to the nearest man, or ship.

**Morale**. Initial morale is based on the difference in strength — the weaker army gets lower morale, but never below 50 — and on the stability of the state. _Supply line length_ then subtracts up to 15 points: the further a regiment is from its base, the bigger the penalty. In the battle every battalion has its own morale. It drops with casualties and with hits in the flank and rear. Every round a battalion also counts the friends and the foes in order around it: outnumbered it loses up to 6 points, with the upper hand it gains as much, and left alone, with no foe near and no losses, it recovers 4 points. A drop is divided by the _morale_ of the unit, so levies break before infantry and a steady unit fights on when others run. A battalion whose morale falls to 15 _breaks and runs_, and can be cut down on the way. A flight unsettles the friends nearby and heartens their foes. Broken troops run only as far as it takes to get away from the foe: once no foe in order is near they halt, and when their morale is back at 35 they _rally_, as long as their side fights on: those who fight hand to hand join the reserve, shooters and engines go on shooting from where they stand. A battalion rallies once: broken again, it leaves the field.

The battle ends when one side has no troops in order: the other one _holds the field_. It also ends when the fighting dies down. You can apply the results at any moment with the apply button, you don't need to wait for the end; the cancel button rolls the battle back. If results are applied, casualties are taken from the regiments, the regiments' notes (legend) are updated with a short info about the battle and a battlefield _marker_ is added.

## Battle log

Everything that happens is written to the battle log, open it with the list button. The log can be downloaded as a file and loaded later:

- with the same regiments on the map the battle is set up as it was and replays exactly, with every change made on the way at its moment
- with other regiments only the settings are taken: the battle type and what was done to the sides by hand

## Battle types
#### 🗡️ Field battle

Field battle is a standard type of combat. It starts with 🎯 _skirmish_ phase: the sides close to shooting distance, and ranged and machinery units prevail. A general who is better at shooting than at close quarters keeps the skirmish up, for 4 to 12 rounds by his share of the fire, or for as long as it lasts if his army is made for shooting; one who is worse at it closes at once. Then ⚔️ _melee_ battle begins - melee and armored units excel at this phase. A side that waits takes it when the foe is upon it. Once a general sees the day lost, his side is entering a 🏳️ _retreat_ phase, where strength of all units is drastically decreased. Another side starts to 🐎 _pursue_ the enemy, getting a good advantage for mounted units; it does so too when the foe has a quarter of its battalions left in order.

|             | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|-------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 🎯 Skirmish |  0.2  |   2.4  |   0.1   |     3     |   1   |   0.2   |    1.8   |   1.8   |
| ⚔️ Melee    |   2   |   1.2  |   1.5   |    0.5    |  0.2  |    2    |    0.8   |   0.8   |
| 🏳️ Retreat  |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue   |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🌊 Naval battle

Naval battle type is auto-selected when both attacker and defender regiments are naval. It starts with a 💣 _shelling_ phase, where naval and machinery units deal almost all the damage. A fleet that would do better at close quarters than at shelling, one that carries melee troops, goes for ⚔️ _boarding_. Melee units excel in this phase, while other types are not that effective. A side that sees the day lost enters a 🏳️ _withdrawal_ phase. The enemy starts a ⛵ _chase_, but contrary to a field battle the damage at this phase is low.

|               | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|---------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 💣 Shelling   |   0   |   0.2  |    0    |     2     |   2   |    0    |    0.1   |   0.5   |
| ⚔️ Boarding   |   1   |   0.5  |   0.5   |     0     |  0.5  |   0.4   |     0    |   0.2   |
| 🏳️ Withdrawal |   0   |  0.02  |    0    |    0.5    |  0.1  |    0    |    0.1   |   0.3   |
| ⛵ Chase      |   0   |  0.15  |    0    |     1     |   1   |    0    |   0.15   |   0.5   |


#### 🏰 Siege

If the defending regiment is not naval and is located in a burg with walls or a citadel, the system automatically selects siege as the battle type. Siege is the most complex type with a number of optional phases and different variants for attackers and defenders.

For attackers siege always starts with a ⏳ _blockade_ phase. This is an inactive phase, where attackers prepare or hold a blockade. No damage dealt until attackers are ready to start a 💣 _bombardment_ or ⚔️ _storm_ the town. Machinery units excel at bombardment phase, while storming is risky and does not provide good results if attackers are not dominating in numbers.

Defenders with machinery units bombard from the very first iteration; without them they 🔒 _shelter_ in an inactive phase. When the besiegers' engines are poorly guarded, defenders send a 🚪 _sortie_ at them. Sortie can be pretty successful, so attackers are not safe during the siege.

When attackers initiate storming, besieged army is switching to a 🛡️ _defense_ phase. As siege can be pretty long and defenders are usually ready for a storming and hence they get good modifiers during the defense. If a storm is not successful and defenders do not 🏳️ _surrender_, attackers get back to a bombardment or blockade phase. Defenders surrender when their morale falls below 15 or nobody is left in order; attackers then start ☠️ _looting_ without significant resistance.

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

Ambush is auto-selected if the defender is clearly the weaker, with less than three quarters of the attackers' power, and stands where the ground hides him: in a Tropical seasonal forest, Temperate deciduous forest, Tropical rainforest, Temperate rainforest, Taiga or Wetland biome. It starts with a ⚡ _surprise attack_ of the defenders that causes attackers' 💫 _shock_. Defenders get a huge advantage with the surprise factor, but if attackers army is still stronger, the shock will end quickly: it lasts 2 to 8 rounds of fighting, four divided by the attackers' odds. While it lasts the attackers' general gives no orders: the battalions of the column fend for themselves. Once shock is over, sides enter a standard ⚔️ _melee_ phase, which usually ends with a 🏳️ _retreat_ of the side that sees the day lost. Other side start a 🐎 _pursue_ where mounted units excel.

|               | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|---------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| ⚡ Surprise   |   2   |   2.4  |    1    |     1     |   1   |    1    |    0.8   |   1.2   |
| 💫 Shock      |  0.5  |   0.5  |   0.5   |    0.4    |  0.3  |   0.1   |    0.4   |   0.5   |
| ⚔️ Melee      |   2   |   1.2  |   1.5   |    0.5    |  0.2  |    2    |    0.8   |   0.8   |
| 🏳️ Retreat    |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue     |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |

#### 🔱 Landing

Landing is happening when attackers regiment is naval and has land units, while defending regiment is a land one. The battle starts with a ⚓ _landing_ phase, which is quite risky for attackers. Defenders are either 💫 _shocked_ and get penalties, or ready for a 🛡️ _defense_ and can withstand or even force attackers to ⛵ _flee_. Defenders are ready when their morale before the battle is no lower than the attackers': their general then chooses between standing a bowshot from the water, where the attackers come out of it, and waiting inland. If attackers are fleeing, defenders 🐎 _pursue_ those still ashore and then are ⌛ _waiting_ at inactive phase.

After three rounds of fighting for the shore sides are entering a standard ⚔️ _melee_ phase. If landing is successful, morale of defenders is dropping and they have to 🏳️ _retreat_. In this case attackers immediately start to 🐎 _pursue_ the enemy.

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

Air battle type is auto-selected in very rare cases, when every unit of both the attacking and the defending regiment has the _aviation_ type. As all units are supposed to have the same type, type-depending modifiers does not play significant role and can be ignored. Air battle starts with a 🎯 _maneuvering_ phase, where damage is not significant. Then an active 🐕 _dogfight_ begins, by the rules of a field battle. If a side sees the day lost, it is entering a 🏳️ _retreat_ phase. The enemy starts a 🐎 _pursue_.

|                | Melee | Ranged | Mounted | Machinery | Naval | Armored | Aviation | Magical |
|----------------|-------|--------|---------|-----------|-------|---------|----------|---------|
| 🎯 Maneuvering |   0   |   0.1  |   0.1   |    0.2    |   0   |    0    |     1    |   0.2   |
| 🐕 Dogfight    |   0   |   0.1  |    0    |    0.1    |   0   |    0    |     2    |   0.1   |
| 🏳️ Retreat     |  0.1  |  0.01  |   0.5   |    0.01   |  0.2  |   0.1   |    0.8   |   0.05  |
| 🐎 Pursue      |   1   |    1   |    4    |    0.05   |   1   |    1    |    1.5   |   0.6   |
