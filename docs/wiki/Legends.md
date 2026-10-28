## Legends browser
The _Legends browser_ reads the chronicle of your world: every dated event the generator recorded, and the fallen empires whose rise and fall explains the map you are looking at. Open it from _Options_ → _Tools_ → _Legends_, or by typing "legends" in the omnibar.

Nothing about the world changes when you open it — the browser is a reader, not an editor.

### The timeline
The _Timeline_ tab lists every recorded event in order of year, grouped under the era it belongs to. Each row carries the year, a glyph for the kind of event, the event text, and chips for the entities involved.

* **Filter by kind** — the _Type_ dropdown keeps only the events of one kind (wars, foundings, schisms, and so on).
* **Filter by participants** — the _Actors_ dropdown keeps only the events that involve states, realms, burgs, cultures or religions.
* **Search** — the _Search_ field matches the event text.

The filters are remembered between sessions.

### Jumping to the map
* The target icon on a row zooms the map to the place the event happened.
* A chip on a state zooms to its pole; a chip on a culture or a religion zooms to its homeland; a chip on a burg opens its editor; a chip on a fallen realm switches to the _Realms_ tab; a chip on a ruler or a general opens their page on the _Figures_ tab.

### The realms tab
The _Realms_ tab shows each fallen empire: its name, the years it stood, how it ended, the states that rose from it, and the people left behind as a remnant. Its own events are listed underneath.

### The figures tab
The _Figures_ tab lists the people of the chronicle: every major state remembers a dynasty of rulers spanning its founding to the present, and every interstate war is remembered through a general. Figures are grouped under the state they served, with their life years and the span of each role; the first ruler's coronation and every later succession are events on the timeline.

### Exporting
The download button saves the chronicle as a plain text file, one event per line — handy for keeping the history of a world outside the generator.

### Where the chronicle comes from
The chronicle is generated with the world, not simulated over centuries: the generator inspects the finished map and dates what it finds — the founding of every state, the wars in the states' campaign lists, the vassalages, the splits in the culture and religion trees — then weaves in the configured number of fallen empires whose partition explains the current borders, and remembers dynasties and generals where the story needs people. In the epochs mode the political past is generated for real instead, one layer per age, and the timeline's year slider can show it. See [History](History) for both modes.

The optional [Living World](https://github.com/0xPaladin/Fantasy-Map-Generator/wiki/Living-World) simulation keeps extending the same chronicle as you step seasons, and its periodic border snapshots become the time slider's past epochs.

### Settings
_Options_ → _Map settings_ → _Set Lore_ has a history section: the history mode, how many years back the chronicle reaches, how many fallen empires to weave in, how dense the event log is, whether the fallen empires leave ruins and battlefields on the map, and whether a successor state may inherit the fallen empire's name. Run _Tools_ → _Regenerate_ → _History_ to apply the changes; see [History](History#set-lore-controls).
