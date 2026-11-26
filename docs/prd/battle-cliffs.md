# PRD — Cliffs in the Battle Simulator

## Problem Statement

The battle field's ground is gentle everywhere. Hills are noise scaled by how rough the map cell is: 4 to 100 m of rise in waves of 520 and 230 m. Slopes are a few degrees on most fields, about 20° on the roughest. A steep slope slows troops (`getClimb` keeps a tenth of the pace from 12° uphill) and halves their footing. But the ways round the terrain do not weigh slopes, so troops walk straight up a hill instead of going round it. The ground slows battalions but never shapes where they go. The only things that do are water, walls and works.

Real battles turned on ground no army could cross: the escarpment that covered a flank, the gully everyone had to file through, the cliffed coast where a landing could only come ashore at the beaches. Users want fields like that. The risk is that ground nobody can cross leaves troops unable to reach each other, and the battle stalls.

## Solution

A field on rugged ground can have **cliffs**: lines on the plan that nobody on foot or horse crosses, with the ground a stated height higher on one side.

- **Sea cliffs.** On a rugged coast, stretches of the shore are cliffs and the rest are beaches. A landing comes ashore only at the beaches. Land troops are not affected, since nobody walks into the sea anyway.
- **Escarpments.** On rugged inland ground, the edges of some high ground are cliffs. They run in pieces with ends and gaps. Where the edge of high ground is not a cliff, it is an ordinary steep slope.

Cliffs come only from the map: a field on a gentle cell has none and plays exactly as now. They are fixed by the place, like hills and copses, so a replay and every rehearsal get the same cliffs.

Every piece of land stays reachable. When the field is built, a cliff that would cut off any land is broken by a **gully**, as wide as a gate is taken (two fronts at least). Ways go through gullies on their own, as they go through gates.

What a cliff does:

- **Nobody crosses it** but fliers. Ways go round it or through its gaps and gullies.
- **Nobody fights hand to hand across it.** Troops at the top and the bottom do not come into contact.
- **Shots go over it.** Its height counts, so shooters at the top reach further and those below fall short, by the existing missile rule.
- **It is not a slope.** Troops standing at the top keep their full footing and pace. Only crossing is barred.

## User Stories

1. As a map author, I want a battle on rugged ground to have cliffs, so a mountain fight does not look like one on a plain.
2. As a map author, I want a battle on a gentle cell to have no cliffs and play as it does today.
3. As a map author, I want cliffs fixed by the place, so a battle replays the same and my saved setup still means the same ground.
4. As a map author, I want no troops to cross a cliff, so it shapes where a battle is fought.
5. As a map author, I want fliers to pass cliffs, as they pass walls.
6. As a map author, I want battalions to find their way round a cliff or through its gaps on their own, as they do round water and walls.
7. As a map author, I want every piece of land to be reachable, so no battle stalls because the foes cannot meet.
8. As a map author, I want a cliff that would cut off ground to be broken by a gully wide enough for a battalion, so the way in is narrow but real.
9. As a map author, I want roads to go through cliffs where the map draws them, so a road is never blocked by ground the map does not show.
10. As a map author, I want no cliffs over rivers or in burgs, so the features the map draws stay as drawn.
11. As a map author, I want escarpments in pieces with ends and gaps, so a line can lean on one and a foe can go round it.
12. As a map author, I want the edge of high ground that is not a cliff to be an ordinary steep slope, so the ground has no invisible step.
13. As a map author, I want no hand-to-hand fighting across a cliff, so a line at the top cannot be charged from below.
14. As a map author, I want shooters at the top to reach further and those below to fall short, so holding high ground pays.
15. As a map author, I want troops at the top to keep their full footing and pace, so a line at the edge fights at full strength.
16. As a map author, I want a rugged coast to be cliffed in stretches, with beaches between them, so a landing has to choose where to come ashore.
17. As a map author, I want a beach near the middle of the field always, so a landing always has somewhere to go.
18. As a map author, I want the landing troops to make for the beaches on their own, by the ways over the water.
19. As a map author, I want defenders waiting for a landing to hold a beach, not the top of a cliff the foe will never climb.
20. As a map author, I want a defending general to use a cliff to cover the end of a line, as he uses water, wood and burgs.
21. As a map author, I want a general not to draw up a line across a cliff, with half of it above and half below.
22. As a map author, I want a line at the top of an escarpment to stand at its edge, where the foe below cannot reach it, as the brow rule puts it at the top of a slope.
23. As a map author, I want an attacker facing a foe behind an escarpment to go round by the gully or a gap, and the rehearsal to show whether that pays.
24. As a map author, I want a battalion cornered against a cliff with no way out to surrender, as one cornered against water does.
25. As a map author, I want routed troops to flee by the ways round cliffs, never through them.
26. As a map author, I want cliffs drawn the way old battle plans draw them: a line with short teeth down its face, in the relief's ink.
27. As a map author, I want sea cliffs drawn along the shore as the coast is drawn, with the beaches clear.
28. As a map author, I want the contours and hachures to crowd at a cliff, as on a topographic map, with the cliff symbol over them.
29. As a map author, I want the animation export to show cliffs, as the screen does.
30. As a map author, I want pointing at the ground to tell me a cliff is there and how high it is.
31. As a map author, I want the wiki and the help assistant to describe cliffs, so their answers match the screen.
32. As a developer, I want the Battles diagnostics to draw cliffs as the simulation has them, gullies marked, so I can check the barrier.
33. As a developer, I want cliffs to be one more barrier on the existing wall path, not a new movement system, so steps, ways, flight and surrender all follow from one test.
34. As a developer, I want "is this field rough" decided in one place, so cliffs are not forgotten in one of its copies.
35. As a developer, I want planning and round times on a cliffed field within the budgets in battles.md.
36. As a translator, I want the new labels as plain keys, translated in one pass once the feature is done.

## Implementation Decisions

This PRD assumes [real units](battle-real-units.md) and [field works](battle-field-works.md). It reuses the wall barrier path that works already go through.

### The cliff

Cliffs live on the field beside walls, in `battlefield.ts`:

```ts
/** A stretch of cliff, its top on the left of the way from `a` to `b` */
export interface FieldCliff {
  a: Point;
  b: Point;
  height: number; // metres from its foot to its top
}

// Battlefield
cliffs: FieldCliff[];
cliff: number[]; // per node: metres of cliff the node stands on top of; 0 below or with none
```

- **The top is on the left.** This is the same rule as works' front, so the renderer puts the teeth on the low side without a facing field.
- **`cliff` keeps the step apart from the ground.** `elevation` still holds the whole ground, step included, so the relief, the tops and hollows, and the generals' `terrain.height` see the high ground as high. `getElevation` interpolates the smooth part between the nodes and adds the step of the node a point lies in, so the step stays sharp at the line instead of smeared over a node. `getSlope` and `getGrade` read only the smooth part, with a flag like `onWalls`. That is what gives troops at the top their full footing and pace.
- **`getCliffsBetween(field, from, to)`** returns the stretches the straight way crosses, as `getWallsBetween` does. The node index behind `getWallNodes` is generalised to any list of stretches (a `WeakMap` keyed by the array), and walls and cliffs both use it.
- **Empty on every field without cliffs.** `createEmptyBattlefield` gives `cliffs: []` and a zero `cliff` grid. Tests that build fields by hand need no change.

### The barrier

Everything that moves goes through four places, and each gets one condition:

- **`isBarred`**: a cliff between the two points bars every block but fliers. It covers steps (sampled every 11 m), the closed steps of the ways (`getClosed`), the push-through check, `getNodeAt`, flight (`getFlight`) and `hasWayOut`. Surrender against a cliff follows from `hasWayOut` with no new code.
- **`inContact`**: no contact across a cliff unless one of the two is a flier.
- **The ways**: `rough` is true when the field has cliffs, and `markStretches` takes cliffs with walls and barring works. Rough is also decided in `getOptions`, separately. Both copies become one `isRoughField(field)` beside `getWays`.
- **Shooting** stays as it is. `canShoot` and `getRange` read `getElevation`, so cliff height already counts.

### Sea cliffs

These are built in `buildBattlefield`, after land, water and roads are on the grid:

- **Where.** Only on a field whose roughness (the existing tenth of the cell's rise to its neighbours) is `SEA_CLIFF_ROUGHNESS` or more. The starting value is 10 m.
- **The line.** The coast as the grid has it: the boundary between sea or lake nodes (`water === 1`) and land, traced by marching squares at 0.5. These are the same segments the drawn coast follows before smoothing. Each segment has its top on the land side.
- **Beaches.** A segment is cliff where a beach noise (a new `createNoise` layer, 300 m) is above `BEACH`. It is never cliff within a front of a road, a river mouth, a burg or a pier, nor within 1.5 fronts of the shore point nearest the field's middle, so a beach is always there. Pieces shorter than two fronts are dropped.
- **Height.** `SEA_CLIFF` × roughness, kept between 6 and 40 m. In the first stage the height is drawn and named but does not change `elevation`, since water nodes read as the lowest land (see Further Notes). So a sea cliff changes no missile range yet.
- **Connectivity** cannot break: a sea cliff only stands between water and land. The one guarantee needed is the beach near the middle.

### Escarpments

These are also built in `buildBattlefield`, after the ground's heights and before the elevation is normalised:

- **Where.** Only on a field whose roughness is `ESCARPMENT_ROUGHNESS` or more. The starting value is 15 m, a cell rising 150 m or more to a neighbour: hill and mountain country. They are kept off siege fields in this PRD.
- **The high ground.** A new noise layer at 700 m, larger than the hills, so not every hill gets a top. A land node is on top where the noise is over `TOP`. To start, this is about a third of the land of a rugged field.
- **The step's height along the edge.** H = `ESCARPMENT` × roughness, kept between 6 and 40 m, then scaled by a gap noise (300 m) through a smoothstep. So the step fades out along the edge, and the cliff ends where it falls under `CLIFF_LEAST`, which starts at 3 m.
- **Cliff or slope.** A boundary segment between a top node and a node below is a cliff where H is at least `CLIFF_LEAST` at both. Like sea cliffs, it is never on or next to a river, road or burg node, or in water, and pieces shorter than two fronts are dropped. Where the edge is not a cliff, the step is spread into the smooth ground over two nodes (a blur of the step), so it is a steep slope the pace and footing see. Nodes along a kept cliff keep the step sharp, in `cliff`.
- **Gullies.** Flood the land the way troops on foot can go (deep water closed, as `shuns` keeps them out of it) twice: without cliffs and with them, using `flood` from `pathfinding.ts`. Every part that was one piece without cliffs must stay one piece with them. For a part that the cliffs split off, cut a gully at the lowest stretch of cliff on its edge: H tapers to 0 over the gully's width (`getOpening(field, 2)`, two fronts and two nodes at least) and a node either side, and the cliffs are traced again. Repeat until nothing is cut off, at most once per cliff piece. If that bound is reached, the field drops its escarpments.
- **One function** builds it all: `raiseCliffs(field, ground, roughness, place)` returns the cliffs, the `cliff` grid and the heights to add to the ground. It is pure, so it is tested on hand-made grids.

### The generals

- **The end of a line** (`getEnds` in `findGround`) counts as covered when a cliff lies between the end and the point beyond it. This is in addition to water, wood or a burg.
- **No line across a cliff.** `score` takes 2 off a frame for every pair of neighbouring sample points of the first line that a cliff lies between, as it already does for water under the line.
- **The brow.** `getBrowOffset` already finds the highest place above the slope ahead. With the step in `getElevation`, a line at the top of an escarpment bends to its edge. No change is needed beyond checking it.
- **Landings.** `findShore` returns the shore point on the axis only when no cliff lies within a front of it. Otherwise it takes the nearest beach along the shore within the field. The attackers need nothing: their ways over the water already go to the beaches.
- **Rehearsals.** A cliffed field is rough, so as for water and walls, only a weaker attacker rehearses. The tactic scores have to point the others right: a defender's end covered by a cliff is what makes Oblique and Envelopment worth more against the open one.

### Drawing

- **A cliff** is a line along the stretches, in the relief's ink (`INK`), 1.4 pt. Short teeth 3 pt long every 3 pt hang from it on the low side, tapering, as on old battle plans. All cliffs go into one `<path>` in `battleTerrain`, drawn after the water and before the labels. Sizes are in plan points (`getPoint`), like walls and works.
- **The line is drawn smoothed.** Stretches are joined into polylines and drawn on a Catmull-Rom curve, as roads are. The barrier stays the traced segments. Drawing and barrier differ by under a quarter of a node.
- **Sea cliffs** follow the coast as `outline` draws it (blurred and smoothed), so the teeth sit on the shore line and not a node off it.
- **The relief** is drawn from `elevation` with the step in, so the contours and hachures crowd at a cliff and the symbol sits over them.
- **Static.** Cliffs never change in a battle, so they are drawn once with the ground and go into the export like the rest of the ground.
- **Pointing at the ground** names a cliff within half a node of the pointer, with its height in the map's height unit.

### Diagnostics

- **The ground overlay** draws cliffs red (they bar everybody) with a tick on the top side, and gullies as a dashed outline. Cliffs are static, so the overlay's cache key needs no change.
- **The node readout** adds `cliff N m` for a node on top of one.

### Modules touched

| Module | Change |
| --- | --- |
| `battlefield.ts` | `FieldCliff`, `cliffs`, `cliff`, `getCliffsBetween`, the shared stretch index, `getElevation`/`getSlope`/`getGrade` reading the step, sea cliffs and escarpments (`raiseCliffs`) |
| `movement.ts` | cliffs in `isBarred`, `inContact`, `markStretches` and `isRoughField` |
| `general.ts` | rough from `isRoughField`, cliff cover in `getEnds`, the across-a-cliff penalty, `findShore` to a beach |
| `draw-battle-scene.ts` | the cliff path and the tooltip |
| `draw-battle-debug.ts` | cliffs and gullies, the node readout |
| `docs/domain/battles.md`, `docs/wiki/Battle-Simulator.md`, Knowledge Base | a Cliffs section |

### Fast implementation

Most of the cost of cliffs is already paid. Walls built the barrier path and works generalised it, so a cliff only has to answer "is there one between these two points". The steps below put the quick, low-risk parts first.

1. **Barrier and data (half a day).** `FieldCliff`, `cliffs`, `getCliffsBetween` on the shared index, the condition in `isBarred`, `inContact` and `markStretches`, and `isRoughField`. A test field with a hand-placed cliff then plays: ways round it, no contact over it, surrender against it. Nothing generates cliffs yet, so every existing battle is unchanged. That is the HEAD-equality gate.
2. **Sea cliffs (a day).** Trace the coast, add beaches by noise, keep the middle beach, `findShore` to a beach, draw the symbol. There is no step and no connectivity work. It ships alone: landings on rugged coasts become a choice of beach.
3. **Escarpments (two days).** `raiseCliffs` with the step, the blur where there is no cliff, the gully loop, `getElevation`/`getSlope` reading the step, and the general's two ground changes. This is the part that needs balancing.
4. **Sea-cliff height (optional).** Water at sea level in `getElevation`. See Further Notes.

Each stage is balanced against a HEAD worktree before the next one starts.

## Testing Decisions

- **Good tests check what one can see:**
  - where troops can go;
  - who comes into contact;
  - who surrenders;
  - how far shots reach;
  - that every land node is reachable.

  Not which constant was used. Battles are deterministic, so tests compare positions and outcomes.
- **`raiseCliffs` on hand-made grids** (new `cliffs.test.ts`, like `pathfinding.test.ts` with its drawn rows):
  - a plateau whose edge is all cliff gets a gully, at its lowest stretch, two fronts wide;
  - a cliff never closes land that was open without it, rivers and the sea included;
  - no cliff on a road, a river or a burg;
  - pieces under two fronts are dropped;
  - where H fades under the least height, the cliff ends and the step is a slope.
- **New tests in `battle.test.ts`**, on `createEmptyBattlefield` with cliffs set by hand:
  - a battalion sent past a cliff goes round its end, and through a gully when that is nearer;
  - two foes either side of a cliff never come into contact, but shooters at the top hit those below at a range they could not reach on the flat;
  - a battalion at the top of a cliff fights with full footing, the same as on the flat;
  - fliers cross a cliff and fight across it;
  - a battalion cornered against a cliff and a foe surrenders; one with a gully behind it gets away;
  - a landing on a cliffed coast comes ashore at a beach, and the defenders hold that beach;
  - a defending line with one end on a cliff scores the end covered.

  Prior art: the ford and wall tests ("stands round the far end of a ford", the gate tests).
- **Relief rendering** (`draw-battle-relief.test.ts`): a field with a step draws contours crowding at the cliff and the cliff path with its teeth on the low side.
- **Balance against a HEAD worktree.** Several army sizes, all eight directions, even dice:
  - fields with no cliffs match HEAD exactly;
  - on cliffed fields, no battle ends in a lull with both sides intact more often than on the same field with cliffs off;
  - a defender with a cliff on one flank does better than without, but an equal attacker still wins some battles by the open flank.
- **Performance.** Planning and six ticks on a cliffed mountain field and a cliffed landing, against the budgets in battles.md.

## Out of Scope

- **Climbing cliffs**, ladders or ropes for special troops. A cliff bars everybody on foot or horse.
- **Cliffs by hand**: drawing, moving or removing them in the battle screen.
- **River gorges and cliffed river banks.**
- **Escarpments on siege fields.** A burg on a crag is worth its own PRD: the ring and the storm both have to know about it.
- **Terraces of more than one level**, a top on a top.
- **Rockfall, falling off a cliff, or pushing troops over it.**
- **Cliffs on the world map.** The map has no such data; they are a pattern of the place, as hills are.
- **Translating the new labels** before the feature settles.

## Further Notes

- **Nothing to migrate.** Battles are not saved with the map. Cliffs are rebuilt from the place each time.
- **No drift on gentle fields.** New noise layers do not shift the existing ones: `createNoise` is seeded by its layer. A field under the roughness thresholds builds exactly as now. That is the HEAD-equality gate.
- **Water's height.** Water nodes keep `elevation` 0, the lowest land, not sea level. On a coast where all the land in view stands 40 m up, the drop to the water is read as nothing. Reading water at sea level (minus `base`) would give sea cliffs their height for missiles. But it changes ranges in every landing and bombardment, so it is a separate step with its own balance check.
- **Why no cliffs on gentle ground.** A cliff on a plain is noise, not terrain. Tying them to the cell's roughness keeps them where the map says the ground is broken, and keeps most battles as they are.
- **The risk to watch** is stand-offs. A defender on a plateau behind an escarpment cannot be charged from the front. The attacker has to go round by a gully, which the rough-field rehearsal rule may not explore. The balance check looks for lulls that come from cliffs alone, and the remedy is in the tactic scores, not in more gaps.
