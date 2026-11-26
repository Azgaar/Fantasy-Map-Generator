# PRD — Battle Simulator in Real Units

## Problem Statement

The battle simulator works in abstract units, so a user cannot tell how big a battle is, how fast troops move or how long it lasts:

- **Size.** A field unit means anything from 0.25 to 10 m: it is set from the battalion size, and a siege zooms in further. The field is always 1000 × 600 of these units, so its real size changes from battle to battle and is never stated.
- **Speed.** Unit speed is "field units a tick" (7 on foot, 20 mounted). That has no meaning outside the simulator. The units editor's tooltip has to explain it as a share of a plan "1000 wide".
- **Time.** A tick and a round have no duration. The screen shows "Round 12", which says nothing about how long the troops have been fighting.
- **Ranges.** Ranges are in field units too, so a bow shoots about 110 m in a small battle and 540 m in a big one.
- **No charge.** Troops close at their marching pace. The impetus of a charge comes only from that pace, not from a run-in before contact.

Users want to picture a battle: how wide the field is, how fast infantry and cavalry move, how long the approach and the fighting take.

## Solution

One length is fixed: **1 field unit = 1 metre**. Every other quantity is derived from it and from **one tick = 8 seconds** (a round of 6 ticks = 48 s).

- **Field.** The field has a stated size in metres, set by the size of the battalions (a 300-man battalion gives about 1.4 × 0.8 km), and the screen shows it in the user's distance units.
- **Speed.** Units have real speeds, stored in km/h and shown in the user's distance unit per hour. Defaults are realistic: foot 1.2 m/s, cavalry 3.5 m/s, artillery 0.5 m/s.
- **Ranges.** Ranges are real metres: about 160 m for a bow, 380 m for an engine.
- **Charge.** A battalion running in at a foe it is about to strike moves at 3× its speed. Its impetus comes from that real closing speed.
- **Time.** The screen shows a battle clock, and the log shows the time of each event.
- **Playback.** The playback speed buttons say how much faster than real time the battle plays.

The 8-second tick and the default 300-man battalion are chosen so that, at the default size, troops move as many metres per tick as they do today. The battle plays, and balances, as it does now. Battles much smaller or larger than the default now differ in real ways: a bowshot is a fixed length, so it covers more battalion fronts in a small battle than in a big one.

## User Stories

1. As a map author, I want the battle screen to show the field's size, so I know whether the battle is fought on a kilometre or on five.
2. As a map author, I want the field size shown in my map's distance unit (km, mi, leagues, versts…), so it reads like the rest of my map.
3. As a map author, I want the scale bar on the field in my units, with short lengths in my height unit (m or ft), so a 200 m bar does not read "0.12 mi".
4. As a map author, I want a battle clock showing the time elapsed since the start, so I know how long the troops have been fighting.
5. As a map author, I want each battle log entry to carry its time, so I can tell a story like "the cavalry broke at 0:14".
6. As a map author, I want the downloaded battle log to use the same times, so a report matches what I watched.
7. As a map author, I want the playback speed buttons to say how much faster than real time they run (×25, ×50, ×100, ×200), so I know what I am watching.
8. As a map author, I want the battle animation export to keep the field's true proportions, so the GIF or SVG matches the screen.
9. As a map author, I want unit speed in the units editor in km/h, or in my distance unit per hour, so I can enter what I imagine.
10. As a map author, I want to type a speed in my own unit and have it stored correctly, as I already can for journey transports.
11. As a map author, I want unit range in the units editor in metres, or feet with feet as my height unit, so a bow's reach is a number I can judge.
12. As a map author, I want the speed and range tooltips to explain real-world values, not "units a tick of a plan 1000 wide".
13. As a map author, I want default units with realistic speeds: levies, infantry and archers at 1.2 m/s, cavalry at 3.5 m/s, artillery at 0.5 m/s.
14. As a map author, I want armored, magical, naval and aviation units to keep today's speed relative to foot, so their battles play as they do now.
15. As a map author, I want troops carried by ship to move at the speed of ships, as now.
16. As a map author, I want the default ranges to be realistic: about 160 m for archers, 380 m for artillery, 270 m for fleets.
17. As a map author, I want levies to move exactly as fast as infantry, so the only difference is in their fighting.
18. As a map author, I want battalions to run in at 3× speed in the last moments before they strike, as real troops do, so a charge hits harder.
19. As a map author, I want cavalry charging at the gallop (about 38 km/h) to hit as hard as it does today, so charges stay decisive.
20. As a map author, I want a charge to start only within the distance the battalion can cover in one tick at charge speed (about 30 m for foot, 85 m for horse), so troops don't sprint across the whole field.
21. As a map author, I want engines never to charge.
22. As a map author, I want a fast-moving battalion never to pass through an enemy line, a friend, a river or a wall in one tick, so charges end at contact.
23. As a map author, I want a big battle to be fought on a wider field than a small one, with its battalions standing wider, so the scale reads true.
24. As a map author, I want formations, gaps between battalions and the generals' manoeuvres to keep their proportions at any battle size, so a big battle still looks like a battle.
25. As a map author, I want weapon ranges, troop speeds and the ground (rivers, fords, walls, burgs) to keep their real size at any battle size.
26. As a map author, I want a siege to zoom in on its burg, as now, and still state the field's real size.
27. As a map author, I want the map's terrain to be drawn on the field at true scale, as now: rivers as wide as they are, burgs as big as their people make them.
28. As a map author, I want a battalion's front to be one metre a man across five ranks, so a 300-man battalion stands 60 m wide.
29. As a map author, I want the battalion tooltip to show its unit's speed and range in my units.
30. As a map author, I want unit power and upkeep across my map to stay what they are, so the economy and the military screens don't shift because units are now measured differently.
31. As a map author, I want a battle at the default size to end with about the same outcome and losses as today, so the balance work done so far is kept.
32. As a map author, I want orders given by hand, lulls and pursuits to last a stated time (an order stands 8 minutes, 10 minutes without losses ends a battle), so the rules read in time.
33. As a map author, I want the maximum length of a battle stated in time (80 minutes).
34. As a map author, I want the generals still to plan and the screen still to play as fast as today, so real units cost nothing in speed.
35. As a map author with a custom distance unit, I want the field size and speeds still shown, in metres and km/h, when my unit has no known length.
36. As a map author, I want the wiki and the help assistant to describe the real units, so their answers match the screen.
37. As a translator, I want the new labels ("{{size}} field", the clock, "{{unit}}/h") as plain keys, so they translate in one pass once the feature is done.
38. As a developer, I want a single module that turns battalion size and siege into the field's metres and converts speeds and time, so every other part of the battle reads lengths in plain metres.
39. As a developer, I want every distance constant in the battle code to say whether it is physical, relative to the battalion front or relative to the field, so nobody has to guess what to scale.
40. As a developer, I want the field's size and node grid on the field itself, not a module-wide constant, so a field of any size works.

## Implementation Decisions

### Base constants and the default size

- **1 field unit = 1 metre.** The per-field `metres` scale is removed; every coordinate, size and distance on the field is in metres.
- **One tick = 8 seconds.** A round stays 6 ticks, 48 s. The tick length is a named constant, used only to convert speeds to metres per tick and ticks to time.
- **The default size is a 300-man battalion.** All of today's field-unit numbers are converted at that size: 1 old unit = 300 ÷ 220 ≈ 1.36 m, then rounded to readable values. At the default size the battle plays as it does now.
- **The battalion front.** A battalion stands 1 m a man across 5 ranks, so a full battalion's front is its men ÷ 5 metres: 60 m for 300 men, 40 m for 200, 200 m for 1000.

### Battle scale module (new)

- **What it does.** It gives the size of a battle's field from the battalion size and, for a siege, from the burg's radius.
- **Interface:**
  - *in:* battalion men, battle type, burg radius when it is a siege;
  - *out:* field width and height in metres, the battalion front, and the node cell size.
- **Field width.** It is about 22.7 battalion fronts (today's 1000 ÷ 44), so 1364 m for 300-man battalions. A siege narrows it so the burg's radius is at least 12% of the width, as today. The width is clamped to 250 m – 10 km, today's range. The height is 0.6 × the width.
- **The grid.** It stays 100 × 60 nodes, so a node is 1% of the field's width: 9–45 m, 13.6 m at the default size. Pathfinding costs the same at every size.
- **Conversions:**
  - km/h ↔ metres per tick;
  - tick → elapsed time;
  - the battalion front, for any battalion-relative length.

### The field carries its size

- **Size moves onto the field.** The field gets its own width, height and node cell. It replaces the module-wide fixed size and the `metres` scale.
- **Code that takes the field.** Node lookup, node centres, elevation, slope, wall and quay scans, noise, the clip to view, and every pathfinding call. Pathfinding is already sized by its arguments.
- **Building from the map.** The field is still built from the map at true scale. The map's metres per pixel is now the field's units per pixel.
- **Heights.** Relief becomes plain metres, with no conversion where height is read.
- **Point hashing.** The battalion-level point key multiplies by a fixed 2000. It is sized from the field instead, which can be up to 10 km.

### Three kinds of length

Every distance constant in the battle model, the generals, the battalions, the formations, movement, the field builder and the renderer becomes exactly one of these. Each is named or commented as such.

1. **Physical (fixed metres at any size).** Anything about weapons, bodies or the ground:
   - weapon ranges, the long-shot threshold, point blank, the contact gap;
   - shooters stepping back from foes and their leash beyond range;
   - default bowshots and the siege-ring distances;
   - ambush distances from the road, the sortie's reach;
   - river, ford and bridge widths, rampart thickness, burg radius, site shift;
   - the charge run-in.
2. **Relative to the battalion front.** Anything about how battalions stand or reach one another:
   - block width and depth (depth half the front, width clamped to 0.41–1.32 fronts by the battalion's men);
   - the gaps in and between lines, the bows and refused wings of formations;
   - clearance, the "arrived" tolerance;
   - how far a battalion leaves its place for a foe;
   - guard, ward and morale radii (friends and foes near, safe from pursuit, shaken by a rout);
   - crowding penalties;
   - the generals' probe offsets;
   - gate and breach widths, which must let a battalion through.
3. **Relative to the field.** Anything about the field's room:
   - the edge margin;
   - the ellipse the generals reach to;
   - the base depths and ground candidates;
   - the visual sizes in the renderer: road strokes, patterns, label margins, the "leap" a move is shown at once over.

**Mixed comparisons.** Some code compares a distance to a pace: "within one pace of its place", "the gap closed by 5 since last round", "moved over 10 since last round", "the formation advances a pace a round". These use the block's own metres per tick.

**What stays as it is.** Rates per tick or per round stay numerically the same, because the tick is chosen to keep today's motion per tick. That covers:
- losses, morale gains and losses, impetus decay, breach progress, turn rates;
- counts of rounds and ticks.

### Unit speed and range

- **Stored units.** A unit's speed is stored in km/h and its range in metres. Nothing about these traits is released, so they are redefined without a migration.
- **Defaults by type:**

| Type | Speed | Range |
|---|---|---|
| levies, melee | 1.2 m/s (4.3 km/h) | — |
| ranged | 1.2 m/s (4.3 km/h) | 160 m |
| mounted | 3.5 m/s (12.6 km/h) | — |
| machinery | 0.5 m/s (1.8 km/h) | 380 m |
| naval | 0.85 m/s (3.1 km/h) | 270 m |
| armored | 1.5 m/s (5.4 km/h) | — |
| aviation | 4.1 m/s (14.8 km/h) | 160 m |
| magical | 1.0 m/s (3.6 km/h) | 200 m |

  Troops carried by ship move at the naval speed. The default units take their type's values.
- **What sets pace.** The engine's pace is the unit's speed converted to metres per tick, times terrain, slope and haste, as now.
- **Riders.** A rider is still a unit at twice the foot speed or more.
- **Unit power keeps today's values.** The speed term uses the foot speed in km/h; the range term uses the range in metres divided by about 680, today's 500 converted. Power and upkeep stay the same for every type whose speed keeps today's ratio to foot. Artillery moves a little faster relative to foot than now, which raises its power by about 5%.

### Charge and impetus

- **Charge speed.** A battalion moving to strike a foe in melee gets haste 3 once the foe is within what it covers in one tick at that speed: about 29 m for foot, 84 m for horse. Engines never charge. Fleeing keeps its 1.3 haste.
- **Reuse.** This uses the intent's haste, which is already passed down to the step but always 1 today.
- **Impetus.** It becomes 1 + closing speed in m/s ÷ 6.2, capped at 5. A foot charge at 3.6 m/s gives 1.58 and a horse charge at 10.5 m/s gives 2.69, today's values. The decay per tick at grips is unchanged.

### Movement along the whole step

- **Why.** A cavalry charge covers 84 m in a tick, more than a block's depth (30 m) and many times the contact gap. Today a step only checks its end point for other blocks and for water.
- **The step checks its whole way:**
  - it stops at the first block it would touch, at the contact gap, against blocks already moved this tick;
  - it refuses water and shunned ground anywhere along the way, not only at the end, using the existing sampled line check;
  - walls already use the line from start to end.
- **What stays.** Moves stay one block after another, alternating order each tick, so the result is consistent. Pace is still read where the block starts. A foot step is under one node and a rider's about two, as today, so terrain under the way only matters for charges, which end at contact.

### Time on the screen

- **Battle clock.** It replaces "Round N" and shows the elapsed time (m:ss, h:mm:ss past an hour). The round goes into its tooltip.
- **Log times.** Log entries and the downloaded log show the time instead of the round. The log version is bumped.
- **Playback.** A tick plays in 160 ms at ×1, so ×1 is 50× real time. The buttons and the animation dialog's speed list read ×25, ×50, ×100, ×200.
- **Animation export.** The export's progress reads in time, e.g. "0:12 of 0:20".

### Lengths and speeds in the user's units

- **Speeds** are shown and entered with the existing km/h ↔ user-unit speed helpers, the way the transport editor does: a "{{unit}}/h" header note, values converted on display and parsed on input.
- **A new short-length formatter** in the units model: metres become the user's height unit (m or ft) below one distance unit, and the distance unit above it. Custom units fall back to metres. It is used by:
  - the field-size label;
  - the scale bar;
  - range in the units editor;
  - the battalion tooltip.
- **The scene's viewBox** is the field's size in metres, so the screen, the animation and the export follow the field. Its aspect stays 5:3.

### Docs

- **battles.md:** the Ground section is rewritten. Real units are now the design: lengths are physical, relative to the battalion front or relative to the field. This replaces "speeds and ranges stay in field units on purpose". Every number in units or rounds is restated in metres and time.
- **The wiki pages** for the battle simulator and military forces get the same treatment, and so does the knowledge base for the help assistant.
- Translations are one pass at the end, once the labels settle.

## Testing Decisions

- **Good tests check behaviour you can see:**
  - the field size for a battle;
  - where a battalion ends up;
  - who wins;
  - what the screen shows.

  They don't check which constant was used. Battles are deterministic, so tests compare outcomes and positions, not internals.
- **The battle scale module gets its own unit tests:**
  - field width and height for 200-, 300- and 1000-man battalions;
  - the battalion front;
  - the siege zoom for a small and a large burg;
  - the 250 m – 10 km clamp;
  - node cell size;
  - km/h ↔ metres per tick;
  - tick → clock text.

  Prior art: the plain-function tests in the units model tests and the pathfinding tests.
- **The existing battle tests are updated, not rewritten.** Distances in field units become metres at the default size: the empty test field moves from 2 m a unit to plain metres. The impetus test is restated for the 3× charge and real speeds, and the point-blank and range-from-above tests lose their metre conversions. Expected behaviours stay the same.
- **The options migration test** expects the new speed and range values and the same unit power.
- **Balance check against a HEAD worktree:**
  - Same armies, even dice, mixed armies at equal power.
  - Default size first: outcome, losses and ticks to the end within a few percent of today.
  - Then 200- and 1000-man battalions, to see the intended differences.
  - Every battle type: field, ambush, landing, siege, naval and air.
- **Performance:** planning and tick times are measured against the budgets in battles.md (planning 1 s, a round 100 ms).

## Out of Scope

- **Making battles last longer.** At the default size a battle takes about 15–25 minutes of battle time: an approach of a few minutes and 6–12 minutes of fighting. Real battles of the era often lasted an hour or more. Lengthening them means slowing the rates of losses and morale, which is a balance change of its own.
- **Realistic speeds for ships and fliers.** They keep today's ratios to foot; galleys at 4 knots and fliers at 30 km/h would need landings and air fights rebalanced.
- **Splitting a tick into smaller movement steps.** The tick is chosen so steps stay short, and the whole-step check handles charges.
- **A charge speed per unit.** It is a single 3× factor.
- **Changing what a round is**, or how often generals decide.
- **Translating the new labels** before the feature settles.

## Further Notes

- **Nothing to migrate.** Unit speed and range, the battle model and the battle log exist only on the animated-battles branch, so there is no saved data to convert.
- **Equivalence at the default size.** The geometry at the default size is today's geometry restated in metres. What changes behaviour is that physical lengths — speeds, ranges, the ground — no longer scale with the battle. A bowshot (160 m) is about 2.7 battalion fronts in a default battle, 4 in a small one and 0.8 in the largest. That is the realism asked for, and it is why the balance check covers several sizes.
- **Converted constants.** Most converted values come out as round numbers after rounding: the contact gap of 9 units becomes 12 m, the block depth of 22 units becomes 30 m, the shooters' step back of 40 units becomes 55 m.
