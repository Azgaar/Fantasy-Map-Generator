## Astral Cartographer
Astral Cartographer is the fork's science-fiction reading of a fantasy map: the peoples of the world are star-faring civilizations, their states are polities, their provinces are sectors, and their towns are star systems.

Two parts of it are in the generator: the **content** (three culture sets and twelve name bases), and the **mapping** (what the polities are called, what the systems are).

### The culture sets
Three sets join the stock ones in the _Options_ tab under _Map settings_ → _Cultures set_:

| Set | Register |
|---|---|
| **AstralTrek** | clean, optimistic classic science fiction: people who still live on a world, and the machine intelligences that do not |
| **AstralJammer** | the high-fantasy register told in the vocabulary of the deep places: the kindred, the deep folk, the ferals, the choirs |
| **Grimdark** | the dark-fantasy register, industrial and cold: darklings, foundrymen, and the machine calculators that took the world apart |

Each set holds eight peoples, two per name base, and each base names its settlements from a pool of star and system names — Vega, Sirius, Rigel, Proxima Centauri and the rest. See [Culture sets](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Culture-sets) for the full lists.

### Applying the naming
The content is applied when the world is generated; the **mapping** is applied on demand, so a world stays a fantasy world until you ask for it.

Open _Options_ → _Tools_ → **Astral Names** (or type "apply astral naming" in the omnibar). It will:

- give each Astral polity its own word — a Trek state becomes a "United Federation", a Grimdark one a "Compact", picked from that culture's own vocabulary;
- name each polity after the system that holds it — "Gant", not "Gantia";
- call the provinces sectors — "Gant Sector", "Yaxford Reach", "Aulacurus Belt".

A state whose people are a stock culture keeps its kingdom and county: on a mixed map each people speaks in its own register. The words are stable — a polity keeps its word between regenerations, and applying the naming twice changes nothing the second time.

### The Star Systems overview
_Options_ → _Tools_ → **Star Systems** lists every settlement on the map as a star system: its class, its population, and the installations that make it what it is. Click a row to zoom to it.

A system's class follows its population, and the ladder runs from the comfortable to the exotic as the population falls:

| People | Class | Star |
|---|---|---|
| over 1 000 000 | G | yellow dwarf — the Sun-like homeworld, the most habitable there is |
| under 1 000 000 | F | white-yellow star — bright and comfortable |
| under 250 000 | K | orange dwarf — hardy, long-lived |
| under 50 000 | A | white star — hot and brilliant |
| under 10 000 | B | blue giant — spectacular, and short-lived |
| under 2 000 | M | red dwarf — flare-lit, tidal-locked, nobody's idea of a home |

The big worlds sit on the comfortable stars; the small ones on the exotic, harsh fringe. The rare, spectacular types belong to the smaller worlds, because they are spectacular, not comfortable.

The installations become the system's own: a port is a **shipyard**, a citadel a **bastion**, a plaza a **civic core**, a shanty a **drift**, a temple a **shrine**, walls are **shielding**.

In the browser console, `Astral.systems()` returns the same list as data.
