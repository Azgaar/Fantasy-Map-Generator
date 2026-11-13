# Battles

How a battle is fought on the battle plan. The user guide is the [Battle Simulator wiki page](../wiki/Battle-Simulator.md).

A battle is a deterministic simulation of **battalions** on a field measured in metres and fought in ticks of eight seconds (see [Ground](#ground) and [Time](#time)). Two levels decide what happens:

1. a **general** for each side, who reads the whole field once a round, picks a **tactic**, draws the troops up and gives every battalion an **order**;
2. the **battalion** itself, which every tick weighs its order against what is around it: who threatens it, whom it can hurt, how shaken it is.

Nothing in a battle is random: neither it nor its setup has a generator of chance. The battle type is picked by rules, and the ground details are a fixed pattern of the place on the map (`mix` in `battlefield.ts`), so the same spot always gives the same field. A side's **die** is a strength multiplier the user sets by hand, never rolled, and the generals do not reckon with it. The same setup always plays the same battle.

## Modules

| Module | Holds |
| --- | --- |
| [battle.ts](../../src/model/political/battle/battle.ts) | The battle: its state, the tick, blows and losses, morale, the end |
| [movement.ts](../../src/model/political/battle/movement.ts) | What ground means to troops, walls, ways round obstacles, steps and collisions |
| [general.ts](../../src/model/political/battle/general.ts) | The side level: appraisal, tactic, deployment, phase and orders each round |
| [formations.ts](../../src/model/political/battle/formations.ts) | Places in a formation, by tactic |
| [battalion.ts](../../src/model/political/battle/battalion.ts) | The battalion level: what one battalion does this tick |
| [battle-rules.ts](../../src/model/political/battle/battle-rules.ts) | Phases, orders, surrender, starting morale, outcome names |
| [battle-scale.ts](../../src/model/political/battle/battle-scale.ts) | The size of the field by the battalions, the tick in seconds, speeds in metres a tick |
| [battlefield.ts](../../src/model/political/battle/battlefield.ts), [pathfinding.ts](../../src/model/political/battle/pathfinding.ts) | The ground as a grid, and the cheapest way over it |

`general.ts`, `formations.ts` and `battalion.ts` only read the battle and write orders and intents; `battle.ts` alone moves troops and takes lives.

## The loop

- **On setup** (`prepare`): both generals appraise, choose a tactic by scores and deploy; the defenders first, the attackers in sight of them. It is instant, so the screen has troops to show.
- **Before the first tick** (`plan`): the generals think the battle through, see [Rehearsal](#rehearsal), and the same battalions take their final places. `tick` does it itself when nobody has, so every battle is planned however it is driven; the screen does it off a timer with the start and step buttons disabled. Budget: 1 s.
- **Every round** (6 ticks, 48 s, `command`): each general appraises anew, sets the side's phase, moves the formation and rewrites the orders. Budget: 100 ms.
- **Every tick** (`act`): each battalion turns its order into an intent (go there, strike or shoot that foe, stand), then all move and blows are settled together.

## The general

### Appraisal

What a general knows is what a general could see: the troops in order on both sides by kind (**line** troops that fight hand to hand, **shooters**, **riders**, **engines**), their power and morale, the losses so far, the ground. From it:

- **odds**: own power in order to the foe's, as the military screens count it;
- **fire**: the same for what shoots; **grip** for what fights hand to hand, shooters counted at half and engines and ships at a tenth (`getGrip`);
- **wings**: the foe's left, centre and right by power, and where its line ends;
- **trend**: losses of the last rounds, own to the foe's.

### Tactic

The tactic is chosen once, before the start, by scoring every tactic the battle type allows against the appraisal; the best score wins, ties go to the first. A tactic is a set of numbers a single formation builder and a single order writer read, not code of its own.

| Tactic | Formation | Chosen when |
| --- | --- | --- |
| Assault | Line troops in lines, shooters behind the first, riders on both wings, a reserve | stronger, nothing better |
| Oblique | One wing massed two deep with all the riders, the other held back in steps | no stronger than the foe, or a foe's wing is weak or open |
| Envelopment | A thin centre held back, riders massed on both wings | clearly more riders |
| Wedge | A deep column in the centre, the wings trailing | the foe's line is longer and thinner, own line troops heavier |
| Harass | Shooters forward in the first line, line troops behind them, riders ready | more fire, less weight |
| Stand | A line on the best ground in reach, shooters behind it, a reserve, riders behind its ends | defending at fair odds |
| Crescent | The ends of the line bent back | defending outnumbered or outridden |
| Crossing | Round the far end of the ford or bridge the attackers come by | defending behind a river |
| Column; Ambuscade, Waylay | The attackers of an ambush on the march; the ambushers on both sides of the road, or all on the better covered one | ambush |
| Siege lines, Garrison | Out of bowshot with the engines in front; shooters towards the foe, line troops by the gates, riders in the middle | siege of a walled burg |
| Ring round the walls | Out of bowshot all round the burg: the strongest battalions by the gates, ships off the quay, the rest spread between | besiegers of a walled burg with three times its power and six battalions or more |
| Waves | Line troops first, shooters and riders behind | the attackers of a landing |

The scores are in `chooseTactic`, the numbers of each tactic in `TACTICS`. The defenders look for their ground first (`findGround`): lines across the attack at three depths and five shifts are scored by height, by what covers their ends (water, wood, a burg, the edge of the field) and by what the attackers must cross to reach them. Defenders ready for a landing stand a bowshot from the water. A formation is shifted as a whole to stay on the field: places are never clamped one by one, or they would end up on each other.

**Who attacks** is `side.advancing`. Attackers do unless their odds are under 0.75 or their general settled on waiting (`side.waits`), and then they take a defender's tactic. Defenders do at odds of 1.25 with no crossing to hold. A side that waits goes over to the attack when the foe is spent (odds of 1.5 with the lines at grips), outshoots it two to one while it bleeds, or has not come for six rounds (about 5 minutes) while being no stronger; not into twice its own fire, not when its general chose to wait, and never from behind a crossing until the foe runs. Only an advancing side enters a ford or a bridge.

### Rehearsal

Scores only rank the tactics. Before an open fight (field, naval, air) each general plays every option the scores allow him (`getOptions`) in a battle of his own (`rehearse`): a copy of the setup with even dice and nobody moved by hand, run to its end or for 360 ticks (48 minutes), the foe using the tactic the scores give him. An attacker weaker than the defenders has one option more: not to attack. He takes the tactic with the best outcome: holding the field first, then the difference in losses; of equal ones, the likelier by score. Both do it against the expected foe, not against what the other settled on: the second to choose would otherwise always win. Where water or walls make ticks dear only an attacker who is the weaker rehearses: his likeliest tactic against waiting.

The other types have one choice each (`getOptions`): ambushers lie on both sides of the road or on one (`waylay`); defenders ready for a landing meet it at the shore or wait inland (`side.waits`); besiegers with two thirds of the odds the walls ask for storm at once (`side.storms`) or keep to the rule; a burg they cut off they starve out instead. A storm is played for 150 ticks (20 minutes) and only with 28 battalions or fewer on the field: more cannot be reckoned within the second.

A rehearsal is the real engine on a copy of the battle with `rehearsal` set and a copy of the field, so a storm in the mind breaches no walls; the regiments are shared. Changes of the armies or the type before the start call `rethink`. Planning times are with the ways, under The battalion.

### Phase

The phase is the state the general puts his side in. The screen does not show it: the user sees and gives [orders](#the-sides-order). It is decided from the appraisal with fixed thresholds and never rolled:

- **stand off** (skirmish, shelling, maneuvering): close to shooting distance and no further. A general with the better fire keeps it up for 4 to 12 rounds (3 to 10 minutes), by his share of the fire; one with the worse fire closes at once when attacking, and when defending holds his ground unless he is the stronger.
- **close** (melee, boarding, dogfight): the formation advances into contact; a defender takes this phase when the foe's line comes within a charge.
- **chase** (pursue, chase): the foe retreats or has a quarter of its battalions left in order.
- **run** (retreat, withdrawal, flee): the day is lost (`isLost`): odds under 1:3, under 2:3 with a quarter of the troops gone, under 1:1 with half of them gone, or morale under 25. Behind a river a side holds out at half these odds. It is final.
- **surrender** (`SURRENDER`, of every type): a side whose day is lost and that cannot get away (`isTrapped`): every battalion it has left in order is at grips. Its battalions in order lay down their arms at once (`capitulate`). It is final. A side that runs leaves behind those it cannot get away: battalions at grips with more foes than friends at hand (`getHand`) surrender as it turns.
- **ambush**: surprise and shock last 2 to 8 rounds (1.5 to 6.5 minutes) of fighting, four divided by the attackers' odds; a shocked general gives no orders, his battalions fend for themselves.
- **landing**: the fight for the shore lasts three rounds (2.5 minutes); the defenders are ready when their morale at the start is no lower than the attackers', else shocked.
- **siege**: the besiegers storm at the odds the walls ask for, bombard with engines, else blockade; they call a storm off when it has lost a third of those odds and nobody is on the walls, and go back to their lines. The besieged shelter or bombard, sortie at engines whose guards the party outweighs, and surrender when their morale is spent.

A ring cuts the burg off (`isCutOff`, `battle.cutOff`, logged when it changes) while every gate has a besieger in order no further from it than the ring stands from the walls, and 70 m more (`watches`), so a sortie must clear a stretch of the ring to open a gate: a ship by a quay, troops by a road gate, either by a river gate. A port is never cut off by besiegers without ships. A garrison cut off goes hungry (`isHungry`): it takes heart from nothing, neither left alone, nor with the upper hand, nor from foes broken, does not rally, and loses a point of morale a round, divided by the unit's morale, down to 20 (`STARVED`), where it gives the burg up. A blockade that keeps it cut off is no lull. Cut off, the garrison has less to lose: its sorties go out at 40 morale, not 50, come home under 30, not 40, and go also for a besieger keeping a gate shut whose guards the party outweighs at all. Clearing a gate is what a good sortie wins: food comes in, and the garrison takes heart and recovers again.

### The side's order

The banner, the log and the marker legend (`battle.course`) show **orders** (`Command`: hold, skirmish, attack, defend, pursue, retreat, surrender), never phases. `getCommand` puts a phase as an order. In the open (`isOpen`) it also takes `side.advancing`: a side that waits holds where it would skirmish and defends where it would attack.

`COMMANDS` lists the orders a side of each battle type can be given by hand and the phase each takes; any side can be told to surrender, and after the first tick nothing undoes it. `obey` stores the order in `plan.order`, sets `advancing` by it (not in a siege, where the phase does) and changes the phase when the current one does not carry the order out already. The order stands for eight minutes, ten rounds (`ORDER_ROUNDS`): meanwhile the general neither changes the phase nor goes over to the attack; then `release` hands the side back to him.

In an ambush and a landing the phases are states of the fight (surprise, shock, landing, prepared defense), so an order to hold, skirmish, attack or defend leaves the phase alone (`keepsPhase`): `choosePhase` lets it take its course, short of running or chasing, and the battalions read the order instead of the phase (`getBearing`). Held off (`keepsOff`), ambushers keep their places instead of hunting, wings guard, the frame halts at shooting distance and the reserve is not thrown in; told to skirmish, shooters of a formation that does not move go as far as it takes. A side stood by an order has not begun: the round of the first blow (`battle.engaged`) is not set by nobody marching while an order stands, or a landing held off the shore would be over before it started.

### Orders

Every battalion has a **place** in the formation, across and along its **frame** (a point and a heading), and a **mission**:

| Mission | Meaning |
| --- | --- |
| line | keep the place; fight what comes to the front |
| support | shooters: keep the place behind the line, shoot, stay out of reach |
| battery | engines: stand and shoot |
| guard | keep the place and go only for riders about, the foe pointed at, or what comes right at it: riders on a wing, the weak wing of an oblique attack |
| reserve | wait behind until sent |
| flank | go to a point, fighting only who bars the way: round the end of the foe's line, over the wall in a storm |
| hunt | go for the foe worth most anywhere: riders come round, a reserve sent, stormers within the walls, ambushers, pursuers |
| withdraw | leave the field |

The general moves the frame, not the battalions (`moveFrame`): forward at the pace of the slowest battalion of the first line along the way its troops would take, turning to face the foe, and not at all while most of the line lags behind its places. So a river is crossed like an inchworm: the frame waits at the ford until the line is over. The shape of the formation is its timing: the massed wing of an oblique attack strikes first because the other wing stands further back, the wings of an envelopment meet the foe before its centre, a wedge leads with the centre.

A battalion going to its place spreads the way over the ticks left in the round (`keep`), so riders march beside the foot instead of dashing to the next place and waiting there. The screen draws each block trailing the battle by under a tick (`updateBlocks`), which evens out the jostle of a crowd.

The **reserve** is sent, nearest battalion first:

1. into the place of a battalion of the first line that broke with foes near: the second line counts as a reserve for this;
2. against foes come round a flank or through the line, riders first;
3. at a foe that wavers at grips (morale under 40), to break it;
4. all of it, once the lines have fought for eight rounds (6.5 minutes): a reserve never used is wasted.

Before all that, and in a formation that does not move too, the shooters and engines are guarded (`guardWards`): a foe in order that goes for one hand to hand within 3.4 battalion fronts has the nearest battalion free to go sent at it, of the reserve, the riders on guard and the line troops not at grips, the engines' foes first. Like any battalion sent, it comes back once its foe is gone.

A battalion sent comes back to its place when its foe is done for.

A battalion moved by hand keeps the place it was put in.

## The battalion

Every tick a battalion looks at the foes in sight and at its friends beside it, and chooses, in this order:

1. **Broken or withdrawn**: it runs for the edge of the field behind its side. A regiment withdrawn by hand once the battle is on (`withdraw`) has its battalions marked `leaving`: they march off whatever the general says, he no longer counts them, and they do not hold the field. Withdrawn before the start, the regiment is dropped with its add, moves and turns, as if it never came.
2. **At grips**: it fights; with nobody to its front it turns on whoever has it by the flank.
3. **Its own skin**: shooters step back from those who come for them within 55 m; a shaken battalion (morale under 30) does not attack.
4. **Its order**, by mission. A line battalion goes for a foe within reach of its place and no further, so the line holds: 2.75 battalion fronts when its side advances and closes, one front when it waits. A foe a neighbour holds is within reach half as far again, to be taken in the flank.
5. **Its target** (`getWorth`): of the foes its mission lets it reach, the nearest by the way there, made nearer by all that makes it a better prey: held by a friend and open to a blow in the flank or rear, shaken, hitting harder than it stands, pointed at by the general; for riders a shooter or an engine, and not formed line troops head on. Friends already going for it make it further, so the line spreads.

The way to a point of the field is kept while the point stays (`getPointKey`), the way to a foe is found anew every round. Stormers all make for the middle of the burg, so their ways are found once from there for each kind of troops (`getSharedHeading`), and besiegers pick their foes as the crow flies: forty stormers each finding their own way on one tick cost 150 ms. Measured on 2026-11-12 over every battle type, three passes: planning up to 331 ms, six ticks up to 64 ms, one tick up to 51 ms.

A battalion about to strike a foe runs in at three times its pace (`CHARGE_HASTE`) once the foe is within what it covers in one tick so: about 29 m on foot, 84 m on horse. Engines never charge, the broken run at 1.3 times their pace. A step checks its whole way, a sample every 11 m, under the contact gap: it ends short of the first battalion it would touch, so a charge ends at contact, and it refuses water and shunned ground anywhere on the way, not only at its end. Pace is read where the step starts.

Battalions do not pass through each other, except friends packed within the walls of one burg, who are not in the way of one stepping in or out either: a garrison once jammed itself in its own gate. One hemmed in by friends goes round them by the side it took first (`block.detour`), which is why riders kept back stand behind the ends of the line.

## Blows and losses

A battalion strikes or shoots with `troops × attack × upkeep × die`, and stands with the same of its defense. There is no table of strengths by unit type and phase: what a unit is good at is in its attack and defense, and the phase only says what the side does. A few states change it outright: troops on the run (`isRunning`) and a side whose phase is its run posture (a retreat, a garrison giving itself up) strike and stand at a tenth (`BROKEN`), a side in shock at half (`SHOCK`). A side whose phase is idle (`isIdle`: blockade, sheltering, waiting) holds its fire.

Men lost a tick are the blows that land on a battalion over what each of its men stands with: `Σ strike × impetus × cover × rate ÷ (defense per man) ÷ 6`, carried in fractions, so they come to the same men every time. The rate is a round's kills per point of attack against defense 1: 0.05 a blow, 0.035 a shot (`BLOW_RATE`, `SHOT_RATE`). Losses grow with the blow, with no ceiling, so numbers and concentration tell and the broken, at a tenth of their defense, are cut down ten times as fast. **Impetus** multiplies the strike: a blow's is set when contact begins, `1 + closing speed in m/s ÷ 6.2` from the striker's own velocity towards its target (`block.vx`, `block.vy`, set by `step`), at most 5 (`MAX_IMPETUS`): 1.58 for foot at the charge, 2.69 for horse at the gallop, 1.19 for foot that walks into a foe, and loses 15% of its excess every tick at grips; a shot's is `1.5 − distance ÷ range`, 0.5 to 1.5.

## Ground

A field unit is a metre. The field is the map at true scale, sized by its battalions (`getFieldSize`): a full battalion stands a metre a man across five ranks, so 60 m for 300 men, 40 m for 200, 200 m for 1000, and the field is 22.7 fronts wide and 0.6 as deep (1364 × 818 m for 300-man battalions), from 250 m to 10 km. A siege narrows it to its burg, whose radius is at least 12% of the width (`getSiegeRadius`), and the battalions keep their real size. The grid is always 100 × 60 nodes, so a node is 1% of the width, 9 to 45 m, and pathfinding costs the same at every size. The field carries its size: `width`, `height`, `cell` and `front`. The screen hands `prepare` an unbuilt field of the map (`createMapField`), and `prepare` builds it (`buildBattlefield`), again whenever the battalion size changes before the start; an empty field (a naval or an air battle, a test) is resized and its walls raised anew.

Every length in the battle is one of three kinds, named or commented as such:

1. **Physical**, fixed metres at any size: ranges, the long-shot threshold (250 m), point blank, the contact gap (12 m), shooters stepping back (55 m) and their leash (80 m), the default bowshot (205 m) and the siege ring (at most 340 m), ambush distances from the road (110 to 230 m), the sortie's reach (400 m), a landing's shore line (150 m), rivers, fords, bridges, rampart thickness, burg radius, the charge run-in.
2. **Relative to the battalion front**: block width (0.41 to 1.32 fronts by its men) and depth (half a front), gaps in and between lines, the bows and refused wings of formations (`TACTICS`), clearance, the "arrived" tolerance, how far a battalion leaves its place for a foe, guard, ward and morale radii, crowding, the generals' probe offsets, gate and breach widths (half and 0.7 of a front, so a battalion gets through).
3. **Relative to the field**: the edge margin (2%), the ellipse the generals reach to, base depths and ground candidates, and on screen the size of marks and lines (`getPoint`: sized as on a field 1000 wide).

A few rules compare a distance with a pace, and read the block's own metres a tick: on the march is who made 1.4 paces in a round, a side closes when the gap shrank by 0.7 of a foot pace, a formation advances a pace a tick a round.

The default 300-man battalion is where the battle was balanced: at that size every length is what it was on the old 1000-wide plan, and the battle plays as it did. Elsewhere physical lengths differ in fronts: a bowshot of 160 m is 4 fronts in a battle of 200-man battalions, 2.7 at the default and 0.8 at 1000 men, so small battles favour who stands and shoots, and large ones take long to close (a 1000-man battle runs 30 to 60 minutes).

The field lies where the battle is named for (`findSite`): on the burg of its cell, else by the river, on the crossing of a road over it if there is one. What the map draws is taken as drawn: roads and rivers on the Catmull-Rom curves the map draws them with, land and water by the coastline shapes, heights, tree cover and wetness interpolated within the triangle of the three cell centres round each node. The map is coarser than the plan, a cell some tens of km across, so what it cannot show is a fixed pattern of the place: hills by the roughness of the cell (a tenth of its rise to its neighbours, 4 to 100 m), copses and bogs by the share of the biomes, and meanders some twelve river widths long.

The field's heights are a shape, `elevation` 0 to 1, times `relief`: the rise from the lowest node to the highest, in metres. `getElevation` interpolates it between the nodes and `getSlope` reads its rise over run along a heading. Pace on a slope follows Tobler's hiking function by the way a battalion goes (`getClimb`), fliers and ships excepted; the ways round water and walls do not weigh slopes. Range grows 1% a metre a shooter stands above its target, up to 30% either way (`getRange`), and nobody shoots a foe nearer than point blank: 2 m for bows, 20 m for engines (`canShoot`).

Walls have gates where roads and rivers (not brooks) come in, and a burg on the sea or a lake one on its quay, the stretch looking out on the most water (`FieldWall.water`: 0 a road, 1 the quay, 2 a river). Ships on a land field keep to the water, on the run too (`isMoored`); drawn up on land they put out to the nearest water.

## Time

A tick is eight seconds (`TICK_SECONDS`) and a round six ticks, 48 s; rates per tick and per round (losses, morale, impetus decay, breaches, turning) and counts of rounds keep the values they were balanced at. Unit speed is stored in km/h and turned into metres a tick (`toMetresPerTick`): foot 4.3 km/h is 9.6 m a tick. A battle ends after twelve rounds without losses (about 10 minutes); eight hours (`MAX_TICKS`) is only a backstop, so a run to the end (a replay, an export) always ends, and an order by hand stands eight minutes. At the default size a battle takes 15 to 25 minutes: an approach of a few minutes, then 6 to 12 of fighting. The screen shows the time since the start (`formatClock`, m:ss), the log carries it for every entry, and a tick plays in 160 ms at ×1, fifty times as fast as the battle.

## Morale

Morale is a battalion's own, 0 to 100, and moves only by what happens to it:

- **losses** and **hits in the flank and rear** shake it, the less the steadier the unit;
- **odds at hand**: each round it counts friends and foes in order within 2.95 battalion fronts: badly outnumbered it loses heart, with the upper hand it takes heart;
- **left alone**, with no foe near and not hit, it recovers;
- a friend that **breaks or is destroyed** nearby shakes it, a foe's heartens it; a foe's also heartens the whole side by 2;
- **hunger**: a garrison cut off takes heart from nothing and loses morale every round, see the siege phases.

Under 30 a battalion is **shaken**: it holds and defends but does not attack. At 15 it **breaks** and runs. Broken troops run only while a foe in order is within 4.5 battalion fronts; then they halt, recover and **rally** at 35, as long as their side still fights: line troops and riders join the reserve, shooters and engines keep their role. Once only (`block.routs`): without that limit a lost fight went on for sixty rounds of breaking and rallying.

Between the two a battalion may **surrender** (`isCornered`): shaken, at grips, under 1 in 4.5 of the strength in order within 2.95 fronts (foes 3.5 to 1), on a side weaker than its foe that has lost more. It is `surrendered`: it stands, still in the way of all (`present` in `act`), but is nobody's target, strikes no blow and is left out of the power and the troops a side has. Its men are **captured**, a category of their own: neither fallen (`casualties`, `getLosses`) nor left (`getTroops`), but `captured` (`getCaptured`); the outcome, the rehearsals and the general count both as lost (`getLost`). Its side holding the field frees them at the end. It shakes friends and heartens foes as a rout does.

## Tuning and checks

Measure balance over several army sizes and all eight directions of attack: a battle is one fixed outcome, so a single size tells nothing. Measure on a hill, behind a ford, between woods and on a shore too: open ground alone hid a defender who waded into the ford he was winning at. The directions matter: a diagonal attack has other room than a straight one. Watch a battle with the Battles diagnostics on (Advanced options): they draw every battalion's mission, its place and its target over the plan, and each side's tactic and stance.
