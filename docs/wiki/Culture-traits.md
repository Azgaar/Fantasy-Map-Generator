## Culture traits: alignments, values and figure characters

Every culture can carry an **alignment** and one or two **core values**, and every ruler or general in the chronicle carries an alignment with a mix of **virtues and vices**. Nothing on the map is drawn differently: traits are world-building data, read in the Cultures editor and the Legends browser.

The layer is a _generation request_ — it is decided when the world is generated and stays with the map after that.

### Alignments

A culture's ethos is one of five: `good`, `lawful`, `neutral`, `chaotic`, `evil` — in that order, which is also how the editor column sorts.

| Alignment | Virtues | Vices |
| --- | --- | --- |
| good | 3 | 0 |
| lawful | 2 | 1 |
| neutral | 1 | 1 |
| chaotic | 1 | 2 |
| evil | 0 | 3 |

A **prevailing alignment** is the set of odds an entity rolls against, dictated by its parent's alignment. A culture generated from scratch rolls on the neutral column, which is half neutral and only one in twelve good or evil. A culture you found by hand in the editor rolls on its parent culture's column, so it diverges from its neighbours rather than from the world in general — a border town is mostly like the country it split from. A historical figure rolls on the column of the culture it serves, which is what makes a good rebel in an evil realm rare rather than a coin flip.

### Core values

Each value is a single word — `truth`, `justice`, `power`, `satisfaction` — drawn twice from the column of the culture's own alignment. Two different results make a pair (`truth · justice`). The same result twice means the value is held **above all others**; the editor shows it as `truth above all`.

Some faces of the table point at a neighbouring alignment's column instead: a lawful culture occasionally prizes something good or neutral, an evil one something chaotic. Those faces are resolved on the other column's own top ten.

### Virtues and vices

The word lists are 50 each, one list per side. A figure draws as many as its alignment says, never the same word twice, and never both halves of a contradiction — no honest liar, no merciful one who is also merciless. Neutral characters carry one of each, so they are the only ones with two traits rather than three.

### Where to see them

* **Cultures editor** (_Tools_ → _Cultures_) — an _Alignment_ column with a colored badge and a _Values_ column, both sortable. A culture that predates the layer, or was generated with the layer off, shows an em dash. The **re-roll traits** button at the bottom of the editor re-rolls the alignment and values of every unlocked culture at once; locked cultures keep theirs, and the people of the chronicle keep theirs too — their character was rolled when they were born, and only regenerating history rolls it again.
* **Legends browser** (_Tools_ → _Legends_) — the _Figures_ tab shows the ethos beside each ruler and general, virtues plain and vices in red. Hovering a culture chip there tells you what that people is like: "A lawful people prizing truth and justice".

### Settings

_Options_ → _Map settings_ → **Culture traits**: _Alignment and values_, or _None_. The change applies to the next generated world; nothing is stripped from the map you are looking at. With the layer off, cultures and figures are generated without traits, and the editor's re-roll button explains that the layer is off instead of adding them.

### Determinism

Traits are rolled from the map seed on a stream of their own, keyed by culture id or figure order. The same seed gives the same traits, and — just as important — the traits never shift a name, a border or a date: generating a world with the layer on and off produces exactly the same map, only with or without the character data.

An old map that predates the layer keeps loading unchanged: its cultures show an em dash until you re-roll them or generate anew, and its figures simply have no traits. Traits survive saving and loading like any other map data.

### Where the rules come from

The mechanic — a 1d12 matrix rolled through the parent alignment, and a virtue/vice count per alignment — is adapted from the settlement rules of _Freebooters on the Frontier 2e_, which model a culture as the top social unit whose authorities share its alignment. The word lists themselves are the generator's own.