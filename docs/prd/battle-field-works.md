# PRD — Field Works in the Battle Simulator

## Problem Statement

A battle is fought on the ground the map gives and nothing else. A side that waits for the foe can pick its ground, but it cannot improve it: there is no ditch, no stakes, no wagon fort, though they decided many real battles.

- **Stakes** stopped the charges at Nicopolis (1396) and Agincourt (1415). Archers carried their own and planted them in minutes.
- **Ditches and banks** held the line at Courtrai (1302), Poltava (1709), Fontenoy (1745) and Borodino (1812), and closed the lines of every siege. Troops with tools threw one up in a quarter of an hour.
- **Wagon forts** let the Hussites (1419–34), the Russians at Molodi (1572) and the Boers at Blood River (1838) beat armies of horse many times their size.

Users want a side to be able to dig in, and the battle to be honest about it. Works cost time, and a foe who sees them going up can strike first. Works also beat a frontal charge but not a march round their ends.

## Solution

A side can build **works**: lines on the ground in front of its first line that hinder its foes and shelter it. There are three kinds:

| Kind | Built against | Takes | Hinders foes | Shelters the holders |
| --- | --- | --- | --- | --- |
| **Stakes** | a foe strong in riders | 2 minutes | riders cannot reach the holders over them | blows over them weaker; a charge over them has no impetus |
| **Ditch** | any other foe | 15 minutes | — | shots and blows over it weaker; a charge over it has no impetus |
| **Wagons** | a foe strong in riders, by a side in a wagon ring | 4 minutes | no foe crosses them | shots and blows over them weaker; a charge over them has no impetus |

Works are built **in the battle**, at any phase, by either side:

- **By the general**, by a fixed rule: when the side holds, and the foe will not be on it before some work is done.
- **By hand**, with a new order, **Fortify**.

Each battalion of the first line builds the stretch in front of its place, and stops when a foe comes near. A stretch counts only once it is finished.

The free head start is the same works built in advance: a side **dug in** starts the battle with them finished. A side is dug in by default only where the battle type implies days of preparation: besiegers who ring a burg in (their siege lines), and defenders who are ready for a landing at the shore. Anywhere else the user can dig a side in by hand before the start.

Nothing is rolled. The works, the times and the rules are the same in every replay and every rehearsal.

## User Stories

1. As a map author, I want defenders who wait for the foe to plant stakes or dig a ditch while the attackers come up, so a defensive battle looks like one.
2. As a map author, I want works to take a stated time, so a foe that comes on at once catches them half done.
3. As a map author, I want a half-built work to give nothing, so digging is a gamble against the foe's speed.
4. As a map author, I want a battalion to stop building when a foe comes near and fight, then to take up its work again once the foe is gone.
5. As a map author, I want either side to be able to build works at any phase: a defender waiting, an attacker holding back, besiegers in blockade.
6. As a map author, I want a **Fortify** order in the side's actions, so I can tell a side to dig in when its general would not.
7. As a map author, I want the banner and the log to show "fortify" while a side builds, whether I told it to or its general chose to.
8. As a map author, I want a **Dug in** setting per side before the start, so I can stage a battle on ground prepared the night before.
9. As a map author, I want besiegers who ring a burg in to stand behind works from the start, so a sortie has to fight its way over siege lines.
10. As a map author, I want defenders ready for a landing to have works on the shore before them, so a landing meets a prepared beach.
11. As a map author, I want a line facing cavalry to plant stakes, so a charge breaks on them as at Agincourt.
12. As a map author, I want riders never to reach a line over its stakes: they stand before them under its arrows, or go round.
13. As a map author, I want a charge over any work to strike with no impetus, so works break charges.
14. As a map author, I want troops behind a work to take fewer losses from shots and blows that come over it.
15. As a map author, I want works to shelter only from the front: a foe that goes round the end of a ditch meets none of it.
16. As a map author, I want a side's own works never to hinder it.
17. As a map author, I want troops behind their works to stay behind them and let the foe come, rather than charge out and lose them.
18. As a map author, I want shooters behind stakes to keep shooting at riders held off by the stakes, rather than step back from them.
19. As a map author, I want a side badly outridden on open ground to form a wagon ring round the whole army, as the Hussites did.
20. As a map author, I want foot to fight the holders of a wagon ring over the wagons, and engines to break the wagons stretch by stretch, so a wagon fort is strong but not invulnerable.
21. As a map author, I want an attacker that sees the foe dig a ditch or circle its wagons to come on at once when it is no weaker, rather than wait for the works to stand.
22. As a map author, I want a side behind works not to leave them to attack until the foe is spent or runs, as behind a crossing.
23. As a map author, I want a battle in which neither side will attack the other's works to end in a lull, as most entrenched stand-offs did.
24. As a map author, I want the battle not to end in a lull while a side is still building within sight of the foe.
25. As a map author, I want works drawn on the plan in the style of old battle plans: a ditch with hachures, stakes as slanted strokes, wagons as small blocks end to end.
26. As a map author, I want a work under construction drawn growing along its line, so I can see how far it is.
27. As a map author, I want the log to say when a side's works stand and when the foe breaks through them.
28. As a map author, I want the generals to rehearse with works, so a weaker attacker sees that an assault on a dug-in foe does not pay.
29. As a map author, I want the animation export to show the works, as the screen does.
30. As a map author, I want the wiki and the help assistant to describe works, so their answers match the screen.
31. As a translator, I want the new labels (Fortify, Dug in, the log lines) as plain keys, translated in one pass once the feature is done.
32. As a developer, I want works to be one kind of line on the field with three kinds, not three systems, so the rules live in one place.
33. As a developer, I want planning and round times to stay within the budgets in battles.md, and a field with no works to cost what it costs now.

## Implementation Decisions

This PRD assumes [real units](battle-real-units.md): lengths are in metres, a tick is 8 s, a round 48 s, and blocks fight at a gap of 12 m (`CONTACT`).

### The work

Works live on the field, beside walls, in `battlefield.ts`:

```ts
export type WorkKind = "stakes" | "ditch" | "wagons";

export interface FieldWork {
  a: Point;
  b: Point;
  kind: WorkKind;
  side: Side; // who holds it
  builder: number | null; // the battalion building it; null for wagons and for works laid in advance
  done: number; // 0 to 1; it counts once it is 1
  harm: number; // 0 to 1: engines knocking down a stretch of wagons; at 1 it is down, kept for the drawing
}

// Battlefield
works: FieldWork[];
```

- **Its line.** A stretch runs across the front of its battalion's place, as long as the block's width plus the line's gap (`GAP`), so neighbours' stretches join. It stands 6 m ahead of the front: well inside the 12 m at which blocks fight, so at grips it always lies between the two. It runs from `a` to `b` with its front on the left, for the drawing. Ends are left open: a line of works has flanks.
- **Only the first line builds.** Places of rank 0 get stretches, whoever stands there: line foot or shooters in the first line. Shooters behind the line get none, or their stakes would stand in the line's back. Riders, engines, ships and fliers never build.
- **The wagon ring** is a closed polygon of stretches round a laager's formation, a stretch for each battalion standing on it.
- **One test decides when a work counts.** It is finished and not down, it is held by the side of the block it shelters (the target of a blow or a shot, the foe of a block that would cross it), and the straight line from one block's middle to the other's crosses it (`getWorksBetween`, beside `getWallsBetween`). The test needs no facing: a foe that came round the end has no work between it and its target. A side's own works never hinder it.
- **No grid marks.** All the effects of works use this exact test, as contact across walls already does. The grid's 9–45 m nodes are too coarse for a 6 m strip: a foe at grips stands with its middle outside any strip one could mark.
- **Finished works take effect at the start of the next round**, all at once. Then, if any of them bars a kind of troops (stakes, wagons), the field's ways are forgotten (`forgetWays`), at most once a round, so that the troops go round them. Whether a field needs ways at all (`rough`) is decided when its ways are first made, so forgetting them is also how a field that had none gets them; the cache needs no new key.

### What a work does

One factor per kind, applied the same way to all blows and shots that come over a work at its holders:

| | stakes | ditch | wagons |
| --- | --- | --- | --- |
| blows over it | × 0.75 | × 0.6 | × 0.5 |
| shots over it | × 1 | × 0.6 | × 0.5 |
| impetus of a charge over it | none | none | none |
| crossing it | riders never; foot freely | everybody freely | nobody, until a stretch is knocked down |
| contact over it | not for riders | yes | yes |

- **One factor, not footing and cover multiplied together.** Walls are × 1/3. A ditch with a bank-and-footing penalty and a separate cover factor would multiply out to the strength of stone walls. Footing at the foot of a work is folded into the blow factor.
- **Cover.** `fight` multiplies `power` by the factor where it applies `WALLS` and `COVER`, with the same "between" test.
- **Impetus.** Where `act` sets a charge's impetus on contact, a work between the striker and its target sets it to 1.
- **Barring crossing** goes through the wall machinery: `isBarred` asks walls and works. It stops steps, the closed steps of the ways (`getClosed`), and the push-through check in `act`. The ways are `rough` for a kind of troops only when something bars that kind: water, walls, wagons for all, stakes for riders. A ditch never makes a field rough, so a field with ditches plans as fast as an open one.
- **Barring contact** is stakes against riders only: `inContact`, which already refuses contact across a wall neither block can cross, refuses it across stakes when one of the two is a rider. Riders stand before the stakes, under shot, and their ways take them round the ends. Wagons stop crossing, not fighting: foot fight the holders over the wagons, as they did at every wagon fort, and only engines open a way in.

### The holders keep their works

Two existing behaviours would empty a work as soon as the foe came:

- **Line troops leave their place** for a foe within a charge (`COUNTER` fronts in `decide`). A battalion behind its own finished stretch, on a side that does not advance, does not go for a foe its stretch lies between: it waits for it to come into contact. A foe that came round the end, or that a neighbour fights in the flank, it goes for as now.
- **Shooters step back** from foot and riders within 55 m (`EVADE`). They do not step back from a foe that a work bars from reaching them: riders before stakes, anyone outside a wagon ring.

### Building

- **Rates.** Times are for a full battalion. A smaller one builds in proportion to its troops: `done += troops / battalion / ticks` a tick. A wagon ring is the side's train: it builds as one, however large the army, every tick while the side fortifies, whatever its battalions do.

  | Kind | Ticks | Time |
  | --- | --- | --- |
  | stakes | 15 | 2 minutes |
  | wagons | 30 | 4 minutes |
  | ditch | 112 | 15 minutes |

- **Which kind.** The best kind that will be done in time. A ditch when the foe's riders are under a third of its power and a ditch will be done before the foe arrives; else stakes, when they will be. A battalion keeps the kind it began. A laager builds wagons.
- **The side's decision (`plan.fortify`).** The general makes it once a round, in `direct`, since he sees the whole field. A side begins to fortify when all of these hold:
  - **It holds.** It neither advances, chases nor runs. In a siege `advancing` is set by the phase, and the besiegers always advance, so for them it is the phase: they hold in blockade.
  - **It may build.** The battle is a field battle, the besiegers of a siege, or the defenders of a landing. Ambushers hide rather than dig, the besieged have walls, and naval and air battles have no ground.
  - **The foe will not arrive before some kind is done.** Its arrival is the gap between the lines over how fast it closed last round (`plan.gap` before and now). A foe that is not closing arrives never; one that is closing arrives at the gap divided by that rate. In the first round there is no last round (`plan.gap` starts at infinity): a foe that advances is reckoned to close at the pace of its first line.

  Once begun, it goes on until the side's works are done or it advances. Builders the foe comes near are stopped by the battalion's rule, not by the general's, so the order does not flicker from round to round. A laager fortifies from the first tick, whatever the foe: its wagons are its tactic. `getOrder` shows `fortify` while it is set.
- **The battalion's decision.** It is made every tick in `decide`, as a new `build` intent and action. A battalion of a fortifying side builds its stretch when it stands at its place, is not at grips, and no foe in order is within a round's march of it (the foe's pace × 6 ticks, plus a charge). Otherwise it decides as now. Progress is kept: it takes up the work again once the foe has gone.
- **The frame stands still while a side fortifies or holds works** (`plan.fixed`), so places and their stretches stay together. Only advancing frees it. A frame that moves on leaves its works behind, as real armies did.
- **The order by hand.** `Fortify` is a new `Command`, listed for the sides that may build: field (both), siege besiegers, landing defenders. It takes the side's holding phase (`COMMANDS`). In a landing it keeps the phase (`keepsPhase`). `obey` leaves `advancing` false for it, as for `hold` and `defend`, and sets `plan.fortify`. Like any order it stands for `ORDER_ROUNDS`; then the general's rule decides whether to go on.
- **The log** has two new events: `fortified` when the last stretch the side began stands (side, kind), and `gap` when engines knock a stretch of wagons down (side). The order change is already logged as an `order` entry.

### Dug in

- **The setting.** A new intervention, `{ kind: "dig"; side; on }`, set before the start in the side's actions. It is replayed like the others. Like a change of power, it makes the generals think again (`rethink`).
- **What it builds.** At the end of `drawUp`, after the hand moves are applied, a dug-in side has its works laid at its places with `done: 1`: the works its rule would build given unlimited time. `prepare` clears `field.works` first, so a redeployment or a rehearsal lays them anew.
- **Defaults.** A side is dug in by default when:
  - it is the besiegers, ringing a burg in (`ringIn`): the ring's places count as a first line, so the works run along the ring, facing the walls;
  - it is the defenders of a landing who chose to stand at the shore: the works run along it.

  The kind is the rule's, as everywhere: a ditch, or stakes against a foe strong in riders. The user's setting overrides the default either way.

### The generals

- **Holding works.** A side with finished works at its first line counts as holding them. It does not go over to the attack because the foe does not come (`waited` in `direct`); it still does when the foe is spent (`spent`, the Hussite sally after a failed assault). It also still does when it is shot at with nothing to answer (`outshot`): works shelter a side, but it does not stand forever under fire it cannot return.
- **A foe digging in.** A side that waits, attacker or defender, and holds no works of its own goes over to the attack at once when the foe begins a ditch or a wagon ring and its odds are 1 or better. It does not wait out `plan.idle`. Stakes do not provoke it: they go up in two minutes in almost every defence, and reacting to them would change every defensive battle.
- **No lull while building.** While a side builds with a foe in order within sight (the field's width), `lastLoss` is kept current, as engines at the walls keep it. Once the works stand and nobody comes, the lull ends the battle as usual.
- **Engines** knock down wagons. Each round, the engines of a side in range of a stretch of the foe's wagons add 0.04 each (up to 0.2) to its `harm`, the nearest stretch first. At 1 the stretch is down: it stays in `works` for the drawing and counts no more. It is a function of its own beside `batter`, which stays the walls'. Ditches and stakes are not knocked down.
- **Tactic scores.** Against a side dug in, Oblique and Envelopment score more when the works have ends, and Harass when they are a ring. A field with wagons, or stakes and riders, is rough, so, as now, defenders there do not rehearse and attackers rehearse only their best tactic; the score has to point them right.
- **Rehearsal.** A rehearsal is the real engine on a copy of the field, so it digs, fortifies and batters as the battle would. Nothing special is needed.

### The laager

- **A new tactic, `laager`.** A ring formation: line troops and shooters on the ring facing out, engines among them, riders and the reserve inside. The wagons are the work along it.
- **Chosen when** the side defends, the foe's riders outweigh its own two to one and make two fifths or more of the foe's power, and the ground offers nothing for the ends of a line. For that, `findGround` returns the score of the ground it picks.
- **Wagons.** Every land army has a train, so any land army can form a laager.
- **The formation is fixed** (`plan.fixed`). Its battalions go out by sallies only (the reserve, `spent`) and come back over their own wagons.
- **Defenders rehearse it** against Stand and Crescent on an open field, as they rehearse the tactics now: 30 ticks of building against a cavalry foe's approach is a race the rehearsal settles.

### The screen

- **Drawing**, see [Rendering](#rendering).
- **The side's actions** get `Fortify` in the orders list (from `COMMANDS`). Before the start they also get a **Dug in** checkbox.
- **The tooltip** says "building" while a battalion builds. The marker legend lists the new order.

### Rendering

Works are drawn the way fortifications appear on old battle plans: flat, one colour per kind, no textures, in the plan's own ink.

| Kind | Symbol | Colour |
| --- | --- | --- |
| ditch | a line, with short hachures on its front side | earth, `#8a6d4b` |
| stakes | a row of short strokes leaning out to the front | wood, `#6b4f32` |
| wagons | small filled oblongs end to end along the line | wall ink, `#55524b` |

- **The layer.** A new `<g class="battleWorks">` sits over the ground and under `battleFire` and the blocks, so troops stand on their works. Works grow and fall during the battle, so it joins the moving layers of the animation export (`MOVING` in `battle-animation.ts`), which are redrawn every frame. The ground layers are drawn once.
- **Sizes are in plan points** (`getPoint`, a thousandth of the field's width), like roads and walls, not in metres. A 3 m ditch would be invisible on a 5 km field. The sizes:
  - line strokes 1.6 pt;
  - hachures 3 pt long every 5 pt;
  - stakes 4 pt long every 3 pt, slanted 45°;
  - wagons 5 × 2.4 pt with 0.8 pt between them.
- **Which side is the front.** A stretch runs from `a` to `b` with its front on the left, as the formation lays it. The renderer needs nothing more to put hachures and stakes on the foe's side, and the model gets no `facing` field.
- **Few elements.** All stretches of a kind and state go into one `<path>`: hachures, stake strokes and wagon oblongs are built as path segments. That is at most seven paths, however many battalions build: three kinds, finished or not, and the wreckage of wagons.
- **Building.** A stretch under construction is drawn from `a` along its length to `done`, at half opacity. Finished ones are drawn whole, at full opacity. So the line visibly grows along the front.
- **Knocked down.** A stretch of wagons that is down is drawn as three oblongs askew in the gap, as a breach leaves rubble.
- **When it is redrawn.** `updateBlocks` redraws the works once a round, when their signature changed: the count of stretches down and the sum of `done` rounded to tenths, kept in `svg.dataset.works`. This works as `dataset.breaches` does for walls.
- **Battalions** look the same while they build. Their tooltip says "building", and the growing line shows the work.

### Diagnostics

The Battles diagnostics (`draw-battle-debug.ts`) show works as the simulation has them. The overlay is for developers, so its text is not translated.

- **Works are drawn with the doings, not the ground.** The ground overlay is cached by its key (breaches, the held burg) and works change every tick, so they go to the doings layer, which is redrawn on every update.
- **Each stretch is drawn by what it does:**
  - red: bars everybody (wagons);
  - orange: bars riders (stakes);
  - blue: shelters only (ditch);
  - grey, dashed: down.

  An unfinished stretch is drawn thin, with its `done` as a percentage at its middle. A short tick marks its front side, to check the front-on-the-left rule. The legend gets the four entries.
- **Who builds.** A battalion's label already shows its mission and its action, so `build` appears there with nothing more to do. A thin line joins a builder to the middle of its stretch.
- **The "between" test.** A blow or a shot that a work weakens has its target line drawn in that work's colour instead of grey. So the test can be checked at a glance: head on through the ditch, round its end with no change.
- **The side's line** adds `fortify` while it is set, `holds works` once it does, the general's estimate of the foe's arrival in rounds (`arrives ∞` for a foe not closing), and the works as finished/all.
- **The state line** shows `works` with the counts standing, building and down, beside `breaches`.
- **Pointing at the ground** names a work under the pointer within 6 m: kind, side, done, harm.

### Modules touched

| Module | Change |
| --- | --- |
| `battlefield.ts` | `FieldWork`, `works`, `getWorksBetween` |
| `movement.ts` | barring by works in `isBarred` and `inContact`, `rough` by the kind of troops |
| `battle.ts` | building progress, works taking effect each round, impetus and cover, knocking down wagons, the `dig` intervention, the log events, no lull while building |
| `battalion.ts` | the `build` intent; holding behind works; shooters not stepping back from barred foes |
| `general.ts` | `plan.fortify` and its rule, the fixed frame, holding works, the attacker's reaction, dug-in works in `drawUp`, the ground score, the laager |
| `formations.ts` | the `laager` entry and the ring builder |
| `battle-rules.ts` | the `fortify` command in `COMMANDS`, `getCommand` and `keepsPhase` |
| `draw-battle-scene.ts`, `battle-animation.ts` | drawing works |
| `draw-battle-debug.ts` | works, builders, the between test and the side's fortifying in the diagnostics |
| `battle-screen.ts` | the order, the Dug in setting, the log lines, the tooltip |
| `docs/domain/battles.md`, `docs/wiki/Battle-Simulator.md` | a Works section, the new order |

### Delivery stages

Each stage ships on its own and is balanced before the next one starts:

1. **The model and stakes.** `FieldWork`, the test, building, `Fortify`, the general's rule, the fixed frame, holding behind works, drawing. Stakes exercise barring (riders only), the blow factor and impetus.
2. **Ditch.** Cover from shots, the attacker's reaction, no lull while building.
3. **Dug in and siege lines.** The setting and its defaults.
4. **Laager.** The tactic, the ring formation, wagons, engines knocking them down.

## Testing Decisions

- **Good tests check what one can see:**
  - where works stand;
  - when they are finished;
  - who gets through;
  - who wins and with what losses.

  They do not check which constant was used. Battles are deterministic, so tests compare outcomes and positions.
- **New tests in `battle.test.ts`:**
  - a line told to fortify with no foe near finishes its stakes in 15 ticks, and the stretches join along it;
  - a foe that is not closing lets a side finish a ditch; one that closes too fast for a ditch gets stakes;
  - besiegers in blockade fortify; a laager builds its wagons with cavalry bearing down;
  - a side behind its ditch, shot at with nothing to answer, comes out; one that is not shot at stays;
  - line troops behind their ditch go for a foe that came round its end;
  - a battalion stops building when a foe comes within a round's march, fights, and takes the work up again when the foe is gone;
  - a half-built work gives nothing: the same charge strikes as on open ground;
  - riders never come to contact with a line over its stakes, and its shooters keep shooting at them;
  - a charge over a ditch strikes with no impetus; the same charge round its end does;
  - line troops behind their ditch wait for the foe instead of charging out;
  - shots over a ditch kill fewer, and the same shots from a flank do not;
  - a side's own works never slow it;
  - foot fight a wagon ring over the wagons; engines in range knock a stretch down, and troops then get in by the gap;
  - a dug-in side starts with its works finished, in front of battalions moved by hand too; resetting the deployment lays them anew;
  - an attacker no weaker comes on when the foe starts a ditch, but not when it plants stakes;
  - a weaker attacker facing a dug-in foe rehearses not attacking, both stand, and the battle ends in a lull;
  - the same battle with works replays the same, interventions included.

  Prior art: the ford tests ("stands round the far end of a ford", "has a weaker attacker think better of forcing a ford").
- **Pathfinding.** A unit test that stakes shut the steps across them for riders only, and that their ends stay open.
- **Balance against a HEAD worktree.** Compare several army sizes, all eight directions, on a plain and on a hill, mixed armies at equal power, even dice:
  - **with works switched off**, outcomes match HEAD. The switch is a test-only flag of the battle model, not a user setting. With works on, defenders plant stakes in most battles, so HEAD equality cannot be the gate;
  - **with works on**, an equal attacker loses an assault on a ditch by losses but is not destroyed, cavalry against a line behind stakes loses, and no battle turns into both sides digging until the lull.
- **Performance.** Measure planning and round times against the budgets in battles.md: a plain with ditches (should equal an open plain), stakes against riders, and a laager.

## Out of Scope

- **Placing or drawing works by hand.** The user orders works; the generals lay them.
- **Palisades.** A barrier no foot can fight over would make siege lines impossible to sortie through and a cut-off garrison certain to starve. Siege lines are a ditch, or stakes against a garrison strong in riders.
- **Pulling works down by hand to hand.** Only engines knock down wagons; ditches and stakes stay.
- **Works of the besieged outside their walls.** Walls are their works.
- **Second lines of works**, or the reserve digging for the first line.
- **Tactics that put shooters in front because of stakes.** Stakes go before whatever stands in the first line.
- **Wagons counted from units or tied to cultures.** Every land army has a train.
- **Holders blocked by their own wagons.** They pass their own works anywhere: their gaps and lanes are not modelled.
- **Fire.**
- **Works in ambushes, naval and air battles.**
- **Translating the new labels** before the feature settles.

## Further Notes

- **Nothing to migrate.** Battles are not saved with the map; works exist only in a battle.
- **Why build in battle.** At the default size a battle takes 15–25 minutes, so the build times sort the kinds by themselves:
  - stakes go up in almost any defence;
  - wagons go up if the foe is still marching up;
  - a ditch goes up only if the foe holds back.

  Because an attacker no weaker comes on at a ditch, in-battle ditches will mostly be dug against weaker attackers, and the strong ditch is the dug-in one. That is the history: entrenched positions were prepared, not improvised.
- **Why "dug in" stays narrow.** Free works for every defender would help them even against attacks they never saw coming. They would also shift the outcome of most field battles, where defenders stand at fair odds. Dug in is therefore a default only where the battle type implies days of preparation, and otherwise the user's choice.
- **The risk to watch** is patience. If attackers wait too long, battles turn into both sides digging. The reaction to a ditch or a ring is the guard against it, and the balance check looks for battles where both sides build.
