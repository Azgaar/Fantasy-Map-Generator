# PRD — Battle Camera and Options

## Problem Statement

The battle screen always shows the whole field, draws everything it can, and remembers nothing the user sets on it.

- **The view never moves.** The field is drawn whole and the view is fixed. In an ambush along a road, a small fight on open ground or a siege, the troops take a part of the field and the rest is empty ground. Battalions are small, their icons and flags hard to read, and the fighting is a cluster in the middle. There is no way to zoom in on a flank or follow a pursuit.
- **The drawing can't be adjusted.** Contours, woods, labels, fire lines, the north arrow and the scale bar are always drawn. A user who wants a clean picture, or the states' own colours on the troops, has no way to get it.
- **Nothing is remembered.** The playback speed resets to ×1 every time the screen opens, and so do the animation export's format, quality and speed. The log panel closes every time.
- **The battle's key numbers are fixed in code:** how many battalions a battle is split into, how long it may last, how long a lull or an order lasts, how far ahead the generals think. Users can't tune them, and testing a change to them means editing code.
- **The only export is an animation.** There is no way to get a battle as a series of still pictures with its story, for a report or a page of a campaign book.

## Solution

**A battle camera.** By default the view follows the troops: it frames every battalion still on the field with a margin, keeps the field's proportions, and glides when the troops spread or close up. The user can zoom with the wheel or a pinch, pan by dragging empty ground, and go back to following with one button or switch to seeing the whole field.

**An overlay that stays on screen.** The battle's title and clock, the scale bar and the north arrow sit in a corner of the view. They keep their place and size while the view moves, and each can be turned off for a clear view. The scale bar measures the view in sight.

**Configure Battle.** One cog button on the battle screen's footer opens a compact Configure Battle dialog, in the style of the trade animation editor. It replaces the footer's export button and has five groups:
- *View:* camera and battle plan overlay.
- *Rendering:* terrain, troops, effects and overlay, each part turned on or off. It also chooses between red and blue sides and the states' own colours.
- *Playback:* step size and which events pause the battle.
- *Simulation:* the battle's key numbers.
- *Export:* the animation, now also a battle report with keyframes and movement arrows.

**Quick controls stay where they are.** The speed buttons and the log toggle stay in the footer for one-click use, and their state is now kept.

**Options are kept per browser, like any other UI option.** The simulation numbers are copied into each battle when it is set up and stored in its log. So a battle replays the same on any machine, whatever that machine's options say.

The camera and options work on today's field as well as on the real-units field of the battle-real-units PRD; with real units, the scale bar and clock read in real units.

## User Stories

### Camera

1. As a map author, I want the battle view to frame the troops, so a small battle fills the screen instead of a corner of it.
2. As a map author, I want the view to follow the troops as they march, spread and close up, so I never lose sight of the fighting.
3. As a map author, I want the view to move smoothly, without jumps, so it is pleasant to watch.
4. As a map author, I want the view to ignore battalions that have left the field, so a rout does not pull the view to the edge.
5. As a map author, I want the view never to zoom in further than a few battalion fronts, so a battle down to two battalions still shows the ground around them.
6. As a map author, I want the view never to show beyond the field, so I never see empty space past its edge.
7. As a map author, I want the view to keep the field's proportions (5:3), so the screen layout never changes.
8. As a map author, I want to zoom with the mouse wheel or a pinch where I point, so I can look at a flank closely.
9. As a map author, I want to pan by dragging empty ground, so I can look round the field.
10. As a map author, I want dragging a battalion before the start to still move that battalion, not the view.
11. As a map author, I want zooming or panning by hand to stop the camera following, so it does not take the view back while I look.
12. As a map author, I want a button that makes the camera follow the troops again, so I can return after looking round.
13. As a map author, I want to switch the camera to the whole field, so I see all the ground at once, as today.
14. As a map author, I want double-clicking the field to go back to the camera's mode, as a shortcut.
15. As a map author, I want the deployment before the start framed too, so I see how the troops are drawn up.
16. As a map author, I want the camera mode I chose kept the next time I open a battle.

### Overlay

17. As a map author, I want the battle's name and the battle clock shown in a corner of the field, next to the scale bar and north arrow, so a screenshot says what and when it is.
18. As a map author, I want the scale bar to measure the view in sight, so it stays true when I zoom.
19. As a map author, I want the title, clock, scale bar and north arrow to stay put on screen while the view moves, as on the map.
20. As a map author, I want to turn the title and clock, the scale bar and the north arrow off one by one, so I can have a clear view.
21. As a map author, I want the overlay drawn into exports exactly as I see it on screen, so a shared GIF or report explains itself.

### Rendering

22. As a map author, I want elevation contours drawn by default, so hills and valleys read at a glance.
23. As a map author, I want to turn contours off, for a flat, clean picture.
24. As a map author, I want to turn woods and marsh patterns off, to see the troops against plain ground.
25. As a map author, I want to turn place labels (burgs, rivers) off.
26. As a map author, I want to colour the sides by their leading states' colours instead of red and blue, so the battle matches my map.
27. As a map author, I want red and blue used anyway when the two states' colours are too alike to tell apart.
28. As a map author, I want to turn unit icons, flags and health lines off one by one, for a cleaner or a more detailed look.
29. As a map author, I want destroyed battalions to stay as faint outlines where they fell, if I choose, so the end of a battle shows where it was hardest.
30. As a map author, I want to turn fire lines, missiles and clash marks off, so a big battle plays smoothly on a slow machine or reads more calmly.
31. As a map author, I want battalions drawn at their real size at any zoom, so their width and depth compare with the ground.
32. As a map author, I want flags, icons, health lines and labels to keep a readable size on screen at any zoom.
33. As a map author, I want movement arrows that show where each battalion went since the last key moment, while the battle is paused and in keyframes, so a still picture shows the manoeuvre.
34. As a map author, I want every rendering choice to apply at once while the battle plays.

### Playback

35. As a map author, I want the speed buttons to stay in the footer, so I can change the pace in one click while the battle plays.
36. As a map author, I want the playback speed I chose kept the next time.
37. As a map author, I want to choose whether the step button advances one tick or one round, so I can step through a battle at the pace I need.
38. As a map author, I want the battle to pause by itself at the events I pick: the first clash, a battalion routed or surrendering, a breach in the walls, a side breaking. That way I don't miss the turning points.
39. As a map author, I want the log panel to stay open or closed as I last left it.

### Simulation

40. As a map author, I want to set the most and the fewest battalions a battle is split into, so I can trade detail for speed.
41. As a map author, I want to set the longest a battle may last.
42. As a map author, I want to set how long a lull without losses lasts before the battle ends.
43. As a map author, I want to set how long an order given by hand stands.
44. As a map author, I want to set how far ahead the generals think the battle through, so planning is faster on a slow machine or deeper on a fast one.
45. As a map author, I want to set how long the beaten side's rearguard is pursued before the rest get away.
46. As a map author, I want each simulation number to show its default, and a Restore defaults button for the group.
47. As a map author, I want a battle log to replay with the numbers it was fought with, so a shared log gives the same battle to everyone.
48. As a map author, I want a change to the simulation numbers to apply to the next battle I set up, or the current one before it starts, never to a battle under way.
49. As a developer, I want to change these numbers without editing code, so I can test how the battle behaves at other values.

### Export

50. As a map author, I want to save the battle animation from Configure Battle, so there is no separate export button to find.
51. As a map author, I want the animation to use the camera as on screen, or the whole field, as I choose.
52. As a map author, I want the export to replay the same camera on every save of the same battle.
53. As a map author, I want the export to open with the format, quality, speed and camera I used last.
54. As a map author, I want to save the battle as a report: one page with its title, date and place, the sides, a keyframe at each key moment with movement arrows, the log lines between keyframes, and the outcome. That way I can use it in a story without an animation.
55. As a map author, I want the report to work offline as a single file, so I can keep it or share it as it is.
56. As a map author, I want the report to show a reasonable number of keyframes even for a long battle, so it reads as a story, not a flip-book.

### General

57. As a map author, I want a tooltip on every option saying what it does.
58. As a map author, I want a Restore defaults button for each group in Configure Battle.
59. As a map author, I want battle options never saved into the map file, since they describe my screen and my testing, not my world.
60. As a map author, I want the options to survive a browser restart, like my other UI settings.
61. As a translator, I want the dialog's labels and tooltips as plain keys.
62. As a developer, I want the camera as a small module that takes the troops' positions and the field and gives a view box, so it can be tested without a screen.
63. As a developer, I want battle options in the options schema with defaults, so they are checked and kept like the rest of the app options.

## Implementation Decisions

### Battle camera module (new)

- **Pure, with no screen.**
  - *in:* the field's size; the battalions with position, size and whether they are on the field; the current view; the mode; the time since the last frame.
  - *out:* the next view box.
- **Follow mode:**
  - The target is the bounds of every battalion still on the field (fled and destroyed ones are left out), padded by about two battalion fronts.
  - It is widened to the field's 5:3 aspect and kept at least about six battalion fronts wide. It is clamped inside the field: a box larger than the field becomes the field.
  - The view eases toward it over about a second of screen time, whatever the playback speed. A change smaller than a few percent is ignored, so the view does not shimmer with the jostle of a crowd.
- **Whole-field mode:** the view box is the field.
- **Manual mode:** the view box is what the user zoomed and panned to, clamped inside the field and between the minimum width and the whole field.
- **Exports.** The same module drives the animation and the report's keyframes. Fed the same battle, it gives the same views.

### Battle screen

- **The view.** The scene's view box is set from the camera each frame, in the frame loop that already eases the battalions. The terrain is drawn once; only the view box changes, so the camera causes no redrawing.
- **Zoom and pan:**
  - The wheel and pinch zoom at the pointer, and dragging empty ground pans. Either switches the camera to manual.
  - A follow button joins the footer: pressed while following. A double-click returns to the chosen mode.
- **Dragging battalions** before the start keeps working: a drag on a battalion moves it, a drag on empty ground pans. Pointer coordinates go through the current view.
- **The overlay.** The title and clock, the scale bar and the north arrow move to an overlay above the scene that does not move with the view. The scale bar is redrawn from the view's width when the view changes by more than a few percent. The clock is the round, or the time once the real-units PRD lands.
- **Sizes.** Battalion rectangles stay true to size. Outline and health strokes don't scale, and flags, icons and labels are scaled by the inverse of the zoom, within limits.
- **What the footer keeps.** It keeps the speed buttons, the log toggle, the follow button and a single cog button for Configure Battle. The export button is removed.

### Rendering

- **Each part of the drawing is its own switch**, applied by showing or hiding its layer or by a class on the scene, never by rebuilding the field:
  - **Terrain:**
    - elevation contours: on by default, if the look holds up on hilly fields; that is checked on real maps before the default is set;
    - woods and marsh patterns;
    - place labels.
  - **Troops:**
    - side colours: red and blue (default) or the leading states' colours;
    - unit icons;
    - flags;
    - health lines;
    - fallen: fade away (default) or keep a faint outline;
    - movement arrows.
  - **Effects:** fire lines, missiles, clash marks.
  - **Overlay:** title and clock, scale bar, north arrow.
- **Side colours.** "States' colours" takes the colour of each side's leading state: the one with the most troops. When the two are too alike, by the colour distance FMG already uses for contrast checks, both sides fall back to red and blue. Everything coloured by side follows the choice: fills, fire lines, the battle plan overlay and the summary.
- **Movement arrows:**
  - **What they show.** Each battalion's path since the previous key moment: the start, a paused moment, or a keyframe. The path is sampled once a round, smoothed and ended with an arrowhead, and drawn in its side's colour.
  - **What's left out.** Battalions that moved less than their own depth get no arrow.
  - **Where they show.** On screen only while paused, and in every report keyframe.
  - **Recording.** The screen keeps each battalion's position at every round boundary for this. That is a small record next to the replay it already has.

### Playback

- **Step size:** one tick (default) or one round.
- **Pause on events.** Each event has a checkbox:
  - the first clash, when the battle's engagement starts;
  - a battalion routed;
  - a battalion surrendering;
  - a breach;
  - a side broken.

  All are off by default. The player checks the log entries of each tick it plays and pauses after the first entry of a chosen kind. The first clash and a side broken need log entries of their own; the battle model already tracks both moments.

### Simulation numbers

- **What can be set:** the battle's existing constants, with today's values as defaults.

| Number | Default |
|---|---|
| Most battalions on the field | 40 |
| Fewest battalions on the field | 10 |
| Longest battle | 600 ticks |
| Lull that ends a battle | 12 rounds |
| An order given by hand stands | 10 rounds |
| Generals think ahead, open battle | 360 ticks |
| Generals think ahead, siege | 150 ticks |
| Pursuit after a side breaks | 3 rounds |

  Each is shown in rounds or time where that reads better. Each has bounds that keep the battle working, enforced by the schema.
- **How a battle gets them.** They are copied into the battle when it is created, and the model reads them from the battle, not from constants. A battle under way never changes. Before the start, a change re-plans the battle as a change of armies does today.
- **Replays.** The log records the numbers. A loaded log sets up its battle with them and leaves the user's options alone. Logs without them use the defaults.

### Battle options

- **Where they are stored.** A new `battle` group in the per-browser app options, never in the map file, with these sub-groups:
  - *view:* camera mode, speed, log open;
  - *rendering*;
  - *playback:* step, pause events;
  - *simulation*;
  - *export:* format, quality, speed, camera.
- **Schema and saving.** The group has a schema and defaults and is saved through the options model, like the trade-animation and 3D options. A stored value that fails the schema falls back to its default.
- **The battle plan overlay** stays the existing `battle` debug mode; the dialog only switches it.
- **State kept without the dialog.** The footer's speed buttons, the log toggle and the follow button write to the options as they are used.

### The Configure Battle dialog

- **Layout.** A native dialog with a compact grid of labelled controls per group, as in the trade animation editor: View, Rendering, Playback, Simulation, Export. Each control has a tooltip, and each group a Restore defaults button.
- **Changes** apply at once and are saved.
- **Export group:**
  - format: GIF, animated SVG or battle report;
  - quality, speed and camera;
  - the progress bar, and a Save button that becomes Stop while recording.

  The recording code of today's export dialog is reused, and that dialog is removed. While recording, the dialog's other controls are disabled.

### Battle report export (new)

- **What it is.** A single self-contained HTML page. It reuses the battle summary's text (title, date by the map's year and era, place, sides, troops, losses, outcome), followed by the keyframes.
- **When keyframes are taken.** A keyframe is taken at the start, at each event of the kinds chosen under pause-on-events (or the first clash, routs and a side broken if none are chosen), and at the end.
- **Merging and capping.** Events in the same round share a keyframe, and the page is capped at 12. When there are more, the ones with the most losses or routs are kept, and the start and end always.
- **What a keyframe is.** An inline SVG of the field at that moment, framed by the export camera, with the current rendering choices, the overlay and movement arrows since the previous keyframe. Its caption is the clock and the log lines since the previous keyframe.
- **How it is made.** The page is built by replaying the battle from the start, as the animation export does. It is saved with the same file-naming as the battle log download.

### Docs

- **battles.md** gets a Screen section on the camera, the overlay, rendering, pause-on-events and the report. Its constants section notes that the simulation numbers are options copied into each battle.
- **The wiki's Battle Simulator page** describes zoom, pan, follow, Configure Battle and the report; the knowledge base follows.
- **Translations:** one pass at the end.

## Testing Decisions

- **Good tests check what the user gets, not how:**
  - the view frames the troops;
  - a battle set up with other numbers behaves accordingly;
  - a replayed log matches its battle;
  - a report has the expected keyframes.
- **The camera module gets unit tests:**
  - framing with a margin;
  - a box wider than the field becomes the field;
  - the minimum width;
  - fled battalions ignored;
  - aspect kept;
  - easing reaches and holds the target;
  - small changes ignored;
  - manual views clamped;
  - same inputs give the same views.

  Prior art: the plain-function tests of the battle model and pathfinding.
- **Simulation numbers** are tested through the battle:
  - fewer allowed battalions give fewer blocks;
  - a shorter longest battle ends sooner;
  - a log carrying other numbers replays the same as the battle it recorded;
  - a log without them uses the defaults.

  Prior art: the battle tests for battalion splitting and for replaying a log.
- **Keyframe selection** is a pure function of the battle log and gets unit tests: events in one round merged, the cap, start and end kept.
- **Options:** a schema test checks that the defaults pass and that a bad stored value falls back to its default. Prior art: the options schema and storage tests.
- **The screen:** zoom, pan, follow, dragging a battalion, each rendering switch, pause-on-events and both exports are checked in the browser pane on a real battle, with screenshots. There are no DOM tests unless a regression appears.

## Out of Scope

- **A camera that cuts to events** or **tracks a single battalion.**
- **Movement trails during play.** Arrows show only while paused and in keyframes.
- **A minimap or overview inset.**
- **Simulation numbers per map.** They live in the browser and in each battle's log.
- **Exposing balance rates** (blows, shots, morale): they stay in code; tuning them is balance work.
- **Exporting keyframes as separate image files**, or a report in formats other than HTML.
- **Hill shading** and other new kinds of terrain drawing. The rendering group switches what is drawn today, and is the place new drawing options go.
- **Moving or resizing the battle screen's panels.**

## Further Notes

- **Why the field itself stays put.** Zooming the camera, rather than building a smaller field, keeps the simulation independent of the view. A fixed, larger field was weighed and rejected: its node grid would be too coarse for rivers, fords and walls, or too fine for pathfinding to stay within the planning budget. See the battle-real-units PRD.
- **Fixed sides by default.** The flat, fixed red and blue stay the default, in keeping with FMG's look; the states' colours are a choice.
- **Prior art in FMG:**
  - the trade-animation options and their editor dialog;
  - the 3D view options;
  - the map's zoom extent option and its wheel and pinch zoom;
  - the battle summary;
  - the battle log download and upload.
