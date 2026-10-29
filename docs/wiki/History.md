## History

Every generated world has a past. The _history_ feature dates the world you are looking at — foundings, wars, collapses, migrations, dynasties — and stores it in the map as the **chronicle**. It can invent the past backwards from the present borders, or generate the political layers for real and let you scrub through them. Either way the world is saved with its history: the same seed gives the same chronicle, and an old map without one still loads unchanged.

The chronicle is read in the [Legends browser](Legends), written into the map by the history generator, and configured in _Options_ → _Map settings_ → _Set Lore_.

### What the chronicle holds

The chronicle lives in `pack.history` and has four parts:

* **Events** — a dated log. Each event has a year, one of twelve kinds (founding, war, battle, collapse, schism, migration, independence, golden age, sack, plague, coronation, succession), the entities involved (`state`, `realm`, `burg`, `culture`, `religion`, `figure`, `polity`) and, where it happened, a map cell. The cell is what lets the Legends browser zoom to the place.
* **Eras** — named spans with a start and end year. The timeline is grouped under them.
* **Fallen realms** — empires that no longer exist: name, heraldry, capital, founding and fall, cause, the successor states that rose from them, and optionally a culture remembered as their remnant. They are kept out of `pack.states`, so politics, statistics and editors never see a ghost.
* **Figures** — rulers and generals, with birth and death years and the roles they held. Every major state remembers a dynasty; every interstate war remembers a general. With [culture traits](Culture-traits) on, figures also carry an alignment and virtues or vices.

Epochs mode adds **polities** (a lineage's stable identity across the ages) and **epochs** (each political layer with its own cast, borders and years), plus a border snapshot per epoch.

## Two ways to make the past

The **History mode** in _Set Lore_ chooses how the political past is made. It is a generation request: change it, then run _Regenerate History_.

### Archaeologist

The default. The world is generated once, at the present, and the generator inspects the finished map and reconstructs a plausible timeline backwards:

* State foundings are dated from the state's size and culture depth, so old large realms and young upstarts both occur.
* The wars in the states' campaign lists, the vassalages, and the splits in the culture and religion trees become events with dates.
* Up to the configured number (0–10, default 2) of **fallen empires** are invented, and their partition is made to explain the current borders and enclaves. They get their own heraldry, capital ruins and successor states.
* Eras come from the spans of those fallen realms, plus the present age.
* The fallen empires leave **echoes** on the map (see below) and may lend their name to a successor.

This is cheap and convincing, but it is a reconstruction: the invented empire never actually held the land its successor states now hold.

### Epochs

Epochs generate the political layer several times — four by default — and keep only the last one as the live map. Between epochs, weak polities collapse: their capital is sacked, their name is retired to the chronicle, and their territory is left empty for the next epoch's expansion to flood from the neighbours. Succession is therefore not invented; it is what the growth algorithm did with the hole.

The consequences:

* Events are causally true. "The empire collapsed and its provinces became X, Y and Z" describes what the engine actually did.
* Eras are the epochs themselves, and polities are real lineages with a founding, a form, a capital and a fall.
* The past is scrubbable: the border snapshot of each epoch drives the historical view and the year slider.
* There are no invented fallen realms, so the _Realms_ tab is empty. Figures are grouped under the polity they served.
* The invented-realm controls — _Fallen realms_ and _Renames_ — are disabled.

The visible present-day map is the same either way; epochs only add depth and a slider.

## Generating and regenerating

History is the last step of world generation, after the map, cultures, states, burgs and journeys exist — it has to see the finished world. It runs on the map's seeded random stream, so it is deterministic.

To rebuild the chronicle after changing a history setting, use either:

* _Options_ → _Tools_ → _Regenerate_ → **History**
* the omnibar command **Regenerate History**

You are asked to confirm. Regeneration clears the old chronicle markers and replaces them, redraws the markers layer, and leaves the rest of the world as it is. The button's tooltip says it plainly: changing the history mode requires it.

## Set Lore controls

_Options_ → _Map settings_ → _Set Lore_ holds the history section. Every control edits the lore immediately but only affects the chronicle when history is regenerated.

| Control | Range / default | What it does |
| --- | --- | --- |
| **History mode** | Archaeologist (default) or Epochs | How the political past is made |
| **History span** | 100+ years, step 100; default 1000 | How far back the chronicle reaches from the current year |
| **Fallen realms** | 0–10; default 2 | How many invented empires to weave into the map. 0 turns them off. Disabled in epochs |
| **Event density** | 0–10, step 0.5; default 1 | Multiplier on how many events are recorded |
| **Echoes** | on by default | Let the fallen polities leave ruins, battlefields and notes on the map |
| **Ruins** | 1–5; default 3 | How much they leave: from the fallen capitals alone up to their greater towns too |
| **Renames** | off by default | Let a successor state inherit the fallen realm's name ("New X"). Disabled in epochs |

The current year, era and era abbreviation at the top of _Set Lore_ date the whole chronicle and its battle reports.

## The Legends browser

Open it from _Options_ → _Tools_ → _Legends_, or with the omnibar command **Open Legends Browser** (aliases include "history", "chronicle", "timeline", "fallen realms"). The browser is a reader, not an editor: nothing about the world changes when you open it. It always opens at the present, even if the map was left scrubbed into the past.

The window has three tabs, shared filters and a footer count:

* **Timeline** — every recorded event in year order, grouped under its era. A row shows the year, a glyph for the event kind, the text and chips for the actors. While a past year is scrubbed, only events up to that year are shown, and the viewed era's header is marked.
* **Realms** — one card per fallen empire: name, the years it stood, how it ended, its successors, its remnant culture, and its own events. In epochs mode it says "No fallen realms haunt this map."
* **Figures** — the people of the chronicle grouped under the state or polity they served, with life years, roles and their spans. Culture traits appear beside each person.

The filters apply to all tabs:

* **Type** — keep only one kind of event.
* **Actors** — keep only events involving one kind of entity (state, realm, culture, religion, burg, figure, polity).
* **Search** — match the event text.

Filters are remembered between sessions.

Clicking a row's target icon zooms to where the event happened. Clicking an actor chip zooms to a state's pole, a culture's or religion's homeland, or opens the burg editor, the realm's _Realms_ card, or the figure's _Figures_ entry. The refresh button re-reads the chronicle, and the download button exports it as a plain `.txt`, one event per line.

### The year slider

When the map has epochs and snapshots, a slider appears under the timeline. It spans from the first epoch's start to the current year, labels itself with the year and era, and has a **Now** button. Dragging it moves the map into the **historical view** for the epoch that contains that year. The slider is hidden on Archaeologist maps and on old maps with no snapshots.

## The historical view

Scrubbing swaps `pack.cells.state` and `pack.states` for the epoch's snapshot and polity records, remapped to compact state ids, then redraws states, borders, labels and markers. Emblems, military and Conquest layers that are on are hidden, and a shown _States_ legend is replaced by the epoch's polities under a "States · era" title. Markers dated after the viewed epoch's start are hidden, so a past does not show its own future.

The view is read-only: a customization guard stops every editor from changing a world that is not the present. Leaving the slider at the present, pressing **Now**, closing the browser, or generating, loading or regenerating the map restores the live `pack` exactly and brings the hidden layers and legend back.

## Map echoes

With **Echoes** on, the chronicle leaves physical traces instead of scattering ruins and battlefields at random:

* **Ruins** at the fallen capitals, and — depending on the _Ruins_ slider — at their greater towns.
* **Battlefields** where the chronicle records a battle.
* **Notes** on sacked burgs and successor states ("carved from the Vhælen Empire in 812…"), which the existing notes box surfaces on hover.
* **Renames** on one successor, if enabled.

When history is on, the markers generator skips its own random ruins and battlefield rolls, so there is one source of truth. Chronicle markers are tagged `chronicle: true`, carry the event's `year`, and are cleared and replaced when history is regenerated.

## Persistence

The chronicle is saved inside the `.map` file as `pack.history` in record 53. Epoch border snapshots are not JSON — they are comma-joined `Uint16Array` records starting at 54, one per epoch, the same way `pack.cells.state` is stored.

Old maps load unchanged: a file with no history records gets an empty chronicle, and the slider stays hidden. A file whose epoch list and snapshot records disagree is repaired by dropping the epochs and keeping the events, rather than losing the world.

## Under the hood

The feature is split the way the rest of FMG is:

* `src/types/history.ts` — the data model (`HistoryEvent`, `Realm`, `Era`, `HistoricalFigure`, `EpochPolity`, `HistoryEpoch`).
* `src/generators/history-generator.ts` — the `Chronicle` generator, the final generation step; `Epochs` lives in `src/generators/epochs-generator.ts`.
* `src/data/history-events.ts` — event narrative templates and era names.
* `src/controllers/history-overview.ts` — the Legends browser; `src/controllers/historical-view.ts` and `historical-time.ts` — the past map and its shared year.
* `src/controllers/lore-editor.ts` — the _Set Lore_ controls; `src/components/options-schema.ts` — their defaults and validation.

The design contracts are in [history-generation.md](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/history-generation.md), [history-epochs.md](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/history-epochs.md) and [history-fall-markers.md](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/history-fall-markers.md).
