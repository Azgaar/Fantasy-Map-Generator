Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Markers, zones and extras

### How do rulers (distance measurement) work?
Open the Measurers Editor: Tools → Measurers (or <kbd>Shift+=</kbd>). It offers a linear ruler, opisometer, route opisometer and planimeter — each tooltip explains its type. To delete a ruler, click its label. Distance and unit scales are set in Tools → Units, see [Scale and distance](Scale-and-distance).

### Can a marker link to a generated dungeon map?
Yes. Create a [marker](Markers), edit its note, click the Source code button and insert (replacing YOUR_SEED):
```html
<p><a href="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED" target="_blank">Click here to go to the dungeon</a></p>
<p><iframe src="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED"></iframe></p>
```

### Is there time, a calendar, or history simulation?
No — the map is a static moment. The era and year in Options only stamp dates onto notes (battles, regiments). Over-time simulation is a long-term plan. There is also no travel-time calculator; use rulers and the distance scale.

### Are there rulers/leaders or dynasties for states?
Not supported. Use notes and labels to record them manually.

### Can the hex grid number its hexes, or be used for counting?
No — the grid overlay is purely visual.

### Can fog of war edges be blurred?
No, fog edges cannot be made blurry.

### Can I focus on just one state and hide the rest?
There's no per-state workspace. Pin the state in the States editor to fog the others visually, or make a Submap of its region.

### Can I make city maps or galaxy maps with FMG?
FMG targets country-to-continent scale — no city blocks or buildings. For cities, burgs link to external city generators. Galaxy maps aren't a goal, but creative styling can fake the look; examples on Discord.
