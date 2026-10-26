# Plan — Epochs: Layered Political Regeneration

Updated: 2026-10-26. Status: **slices 1–3 shipped**; slices 4–5 future work. Companions: the shipped retroactive
history in [history-generation.md](history-generation.md) (the Archaeologist), and the era concept
that epochs would ground. The mod-merge plan's "Epochs" bullet in
[history-generation.md](history-generation.md#future-phases-out-of-scope-for-now) is this document.

## The idea

The world has two kinds of time.

**Deep time** is generated once and barely changes: the land, the rivers, the cultures and where
they spread, the towns and their sizes, the faiths. A thousand years of history does not move
a coastline or a burg's population much — it moves *who* lives there.

**The political layer** is the fast part: the states, their borders, their diplomacy, their
provinces. A thousand years of history is a sequence of collapses, expansions, wars and
partitions. This is the layer that has a story worth telling.

The Archaeologist (shipped) does the opposite of simulating this: it generates the political layer
**once**, at the present, and then *dates backwards* — it infers a plausible past from the borders
that exist. It is cheap, and it is convincing, but it is a reconstruction: the empire in the
chronicle never actually held the land its successor states now hold.

**Epochs** regenerate the political layer K times and keep only the last one on the map. The
earlier epochs are real: they were generated, they collapsed, and what they left behind is what
the present map is. That makes two things possible that the Archaeologist cannot do:

- **The events become causally true.** "The empire collapsed, and its provinces became X, Y and Z"
  is no longer a plausible story invented after the fact — it is what happened, because the growth
  algorithm really did flood the gap from the neighbours' capitals.
- **The past becomes scrubbable.** A per-epoch snapshot of the borders is a time slider: drag the
  year, and the nations rise and fall under the pointer.

The visible map does not change. The user sees the same world, with a deeper past and a slider.

## What exists today

| Piece | State |
|---|---|
| The Archaeologist | shipped (slices 1–5): one political state, dated backwards |
| Eras | one per fallen realm (`The Launceston Era`), plus the configured present age |
| Events | founded, wars, subjugations, migrations, schisms, collapses, golden ages, battles, coronations, successions |
| Realms | 1–3 invented empires whose partition explains the present borders |
| Figures | dynasties for the major states, a general per war; reigns dated backwards |
| Legends browser | timeline grouped by era, realms tab, figures tab, filters, zoom links |
| Epochs | the engine (`Epochs.generate`, slice 1), the `.map` slots (slice 2) and `lore.history.mode` with the epochs as the eras (slice 3) are shipped; the slider is not — nothing scrubs them yet |

Two gaps this plan closes: the eras are derived from invented realms rather than from anything
causal, and the events of a state's own past are inferred rather than remembered.

## The engine

### The seam

The political layer is already a single call: `States.regenerate()` in
`src/generators/states-generator.ts` recreates the states, expands them, normalizes them, finds
neighbours, collects statistics, assigns colours, generates the campaigns and the diplomacy,
defines the state forms, regenerates the provinces and the military. Everything the epochs need is
behind that call.

Two things make it usable as an epoch seam:

- **The growth is seeded, not random.** `expandStates()` is a multi-source Dijkstra from the
  capitals, with a cost per cell from culture, population, biome, height, rivers and the state's
  type, bounded by `growthRate = cells / 2 × options.generation.states.growthRate`. Feed it a
  different seed and the same burgs, and the borders move — which is exactly the "provinces became
  X, Y, Z" story, happening for real.
- **The per-epoch parameters already exist.** `options.generation.states.limit` (how many states),
  `sizeVariety` (how far they expand) and `growthRate` (how greedy they are) can be varied per
  epoch: an age of many small states, an age of two empires.

### Per-epoch parameters

Each epoch gets a small profile, drawn from the epoch's own seed:

| Parameter | Range | What it changes |
|---|---|---|
| `stateCount` | 4 – the configured limit | how many polities exist |
| `expansionism` | 1 – `sizeVariety + 1` | how fast each claims land |
| `growthRate` | 0.5 – 1.5 × the configured rate | how far the expansion reaches |
| `collapse` | how many polities fall at the epoch's end | the size of the next epoch's inheritances |

### The collapse

Between epochs, some polities fall. A collapse is a deliberate, local operation on the previous
epoch's state:

1. Pick a polity to fall — biased toward the ones that were weakest (small, isolated, or fighting
   a war they lost).
2. Its capital is lost: the burg is sacked, its capital flag cleared, the polity's name retired
   to the chronicle.
3. Its territory is left empty. The *next* epoch's growth then floods that gap from the
   neighbours' capitals — which is where "its provinces became X, Y, Z" comes from, causally.
4. A `collapse` event is written, and the successors are recorded as `successorOf` that lineage.

Succession is therefore not invented: it is the growth algorithm's answer to a hole. A polity that
grows into a dead empire's land is recorded as its successor.

### What is rebuilt, and what is kept

| Rebuilt per epoch | Kept (deep time) |
|---|---|
| `pack.states` (identity, capitals, expansionism, form, colour) | the grid, heightmap, features, rivers, biomes |
| `pack.cells.state` (the borders) | the cultures and where they spread |
| `pack.provinces`, `pack.cells.province` | the burgs, their positions and populations |
| `burgs[i].state`, `burgs[i].capital` | the religions and their spread |
| `states[i].diplomacy`, `campaigns`, `military` | routes, markets, markers, zones, goods |

Burgs are the one subtlety: their *state* and *capital* flags are political, so they change per
epoch, but their identity, name and population do not. A town that was a capital in one epoch and
is a ruin in the next keeps its name in the chronicle.

### The event log

With epochs, the political events are written **as they happen**, not inferred:

| Event | Emitted when |
|---|---|
| `founding` | a polity first appears in an epoch |
| `war` | two polities are at war in an epoch |
| `independence` | a polity's first appearance, with a `successorOf` lineage |
| `collapse` | a polity falls at an epoch's end |
| `battle` | the war that decided a collapse, at a frontier cell |
| `goldenAge` | a polity that survived the epoch and grew |
| `migration`, `schism` | unchanged — these are deep time, still dated backwards |
| `coronation`, `succession` | the figure events (shipped); deep time until slice 5 re-scopes their reigns |

State ids are **not stable across epochs**: the third epoch's state 3 is not the first epoch's
state 3. Every reference needs an epoch, so `HistRef` gains one (see below).

### The snapshots

Each epoch ends with a snapshot of the borders: `cellsState: Uint16Array`, one entry per cell,
holding the polity id (0 = unclaimed). That is all the time slider needs to draw a past.

The snapshot is the *cheap* artefact: a `Uint16Array` of 10 000 entries is 20 KB, so twenty of
them are 400 KB. The expensive artefact is the event log and the polity records, which are
prose and small.

## Data model

`pack.history` gains two collections. The data stays in the existing record 53, so **no save
format change is needed for the JSON part**.

```ts
interface HistoryEpoch {
  i: number;
  from: number;   // the year the epoch begins
  to: number;     // the year it ends
  era: string;    // the era's name
  /** the political cast of this epoch */
  polities: EpochPolity[];
  /** the index into history.snapshots */
  snapshot: number;
}

interface EpochPolity {
  /** the lineage id, stable across epochs: the third form of the same state keeps it */
  id: number;
  name: string;
  form: string;
  capital: number;   // burg id
  cells: number;
  color: string;
  founded: number;   // the year this lineage appeared
  fallen?: number;   // the year it collapsed
  successorOf?: number; // the lineage it grew out of
  parent?: number;   // the lineage it split from
}

interface History {
  events: HistoryEvent[];
  realms: Realm[];
  eras: Era[];
  figures?: HistoricalFigure[];
  epochs?: HistoryEpoch[];        // the political layers of the past
  polities?: EpochPolity[];       // the lineages, one list for the whole history
}
```

`HistRef` gains the epoch a reference is scoped to:

```ts
interface HistRef {
  kind: "state" | "realm" | "burg" | "culture" | "religion" | "figure" | "polity";
  id: number;
  epoch?: number;   // the epoch this id belongs to; absent for deep-time entities
}
```

A polity in the chronicle is `{kind: "polity", id: lineageId}` — a lineage is stable, so a
reference to "the empire" means the same thing in every epoch. A *state* reference stays
epoch-scoped.

## Save format

- Record **53** keeps `pack.history` as JSON, with the new `epochs` and `polities` inside it.
- The snapshots are **not** JSON — a `Uint16Array` stringifies as an object of numbered keys,
  which is both ugly and big. They go into their own records, **54 and up**, comma-joined, exactly
  as `pack.cells.state` is stored today (record 25). One record per epoch:
  `data[54 + epochIndex] = "0,3,3,12,…"`.
- An old file has no records past 53: the loader gives an empty snapshot list, and the world
  simply has no past to scrub.
- A file with epochs but fewer snapshot records than epochs is repaired by dropping the epochs
  (the chronicle stays; the slider is disabled) — the same "never lose the world over a broken
  extra" rule the mod slot used.
- Size: 20 epochs × 10 000 cells ≈ 60–100 KB of text. Acceptable next to a multi-megabyte
  `.map` file, and it is the price of the time slider.

## The time slider

The slider is a new **historical view**: the map shows a past epoch instead of the present.

**How the map draws a past.** The states layer renders from `pack.cells.state` and `pack.states`.
Rather than a parallel renderer, the view **swaps** those two for the epoch's snapshot and polity
records, redraws the states and label layers, and swaps them back when the slider leaves the
past. A swap is far less code than a second renderer, and it keeps the borders, the labels and
the legend consistent for free.

**Rules while in a past:**
- The map is read-only: the states, provinces and burg editors refuse to open (the same guard
  `customization` uses), because editing a past would corrupt the present.
- The Conquest layers and the chronicle's own markers are hidden or kept as they are — the
  campaign belongs to the present.
- The legend shows the epoch's polities, not the present states.
- Any generation, load or regeneration leaves the view and returns to the present.

**Where it lives.** A slider under the Legends browser's timeline is the natural home: the
timeline already groups events by era, and the eras are the epochs. Dragging the slider moves the
map and the timeline together — the years line up, which is the whole point.

**Interaction with the chronicle.** The present events stay as they are; the slider adds the
epochs' events to the timeline, marked with the epoch they belong to. The browser's filters gain an
"epoch" dimension, and an event in a past epoch is clickable to jump the map to that epoch.

## Eras and epochs

Today an era is a span with a name, derived from an invented realm. With epochs, **the eras are
the epochs**: each epoch is an era, named from what happened in it.

- An epoch that ends in a collapse is an age of ruin ("The Age of Broken Crowns").
- An epoch of many small states is an age of division; an epoch of two empires an age of
  dominion.
- The configured `lore.calendar.era` remains the present age, as it is today.

That replaces the invented-realm eras with real ones, and it gives the timeline a spine: the
eras are the political ages of the world, and the events inside them are the epoch's own history.

The era *character* (ruinous, peaceful, migratory) is a natural follow-up: it would let the
content react to the age — an old faith that only flourishes in a pious age, a polity word that
belongs to an empire's age. That is a separate plan, and it needs the epochs first.

## Interaction with the rest of the fork

- **Figures** (shipped, the history plan's slice 5): dynasties and generals are dated backwards
  from the present and tied to a state id that is not stable across epochs. With epochs a reign
  must be scoped to the epoch and the lineage, and a ruler whose polity falls mid-reign needs an
  end date at the collapse — build order slice 5.
- **Astral Cartographer**: the mapping is applied by hand to the present map, so it is unaffected.
  If the epochs ever grow era-flavored naming, the Astral names would follow the era.
- **OpenConquest**: a campaign is compiled from the present world, so it is unaffected. The
  Conquest layers must be hidden in the historical view (above).
- **The Archaeologist's ghost realms**: in epoch mode they are no longer needed — a real collapsed
  empire is better than an invented one. The realm machinery can stay for the "imperial" scale
  (an empire that spans an entire epoch) or be retired.

## Two modes

`lore.history.mode` chooses between them (shipped): an enum field on the strict `lore.history`
schema, defaulting to `archaeologist`. Old files carry no mode at all — the schema default and the
loader's repair both land them on `archaeologist`, and `Chronicle.generate()` itself treats
anything but `"epochs"` as the archaeologist, so a missing field can never reach the epochs path.
The Lore editor exposes it as a `History mode` select, and greys out the fallen-realms controls
(they only shape the invented past) while the epochs mode holds.

| Mode | What the political past is | Cost |
|---|---|---|
| `archaeologist` (shipped) | inferred backwards from the present borders | free |
| `epochs` (shipped) | really generated, K times | K × the political layer |

The default stays `archaeologist` until the epochs are proven: a world with no epochs must look
exactly as it does now. In `epochs` mode the political events come from the epoch engine and the
cultural and religious events stay retroactive — those are deep time, and there is only one of
them. The dynasties stay state-scoped retroactive figures until slice 5 re-scopes their reigns.

## Performance

The political layer is a fraction of a full generation, but K times is K times that fraction, and
the cost is not yet measured. Before committing to a default K:

1. **Measure** the political layer alone: time `States.regenerate()` on the benchmark map
   (10k cells) and record it as a pipeline step. The benchmark harness
   ([architecture/benchmark.md](../architecture/benchmark.md)) already reports per-step numbers, so
   the epoch steps would show up there.
2. **Budget**: if one epoch costs 250 ms, six epochs cost 1.5 s — tolerable once per generation,
   but not on every edit. The epochs are therefore generated **once**, with the world, and cached
   in the map file; the slider never regenerates anything.
3. **The lazy option**, if the measurement is bad: generate only the final epoch eagerly and the
   earlier ones on demand, the first time the user reaches back. The first scrub then costs one
   epoch, and the rest stream in.
4. The slider's own cost is a `Uint16Array` copy plus one states redraw — the same cost as any
   border change, which the map does constantly.

## Testing

**Invariants**
- Epochs are contiguous: `epochs[i].to === epochs[i+1].from`, the first starts at or before the
  earliest event, the last ends at the current year.
- A snapshot's length equals the cell count; every entry is 0 or a polity id of that epoch.
- Every polity in an epoch has a capital burg that exists and is not another polity's capital.
- Lineages: a `successorOf`/`parent` points at an earlier lineage; a fallen lineage has no
  successor in the same epoch.
- Every event's epoch-scoped refs resolve in that epoch.

**Tests**
- The engine unit-tested against a small fixture map: two epochs produce different borders, the
  second epoch's growth fills the first epoch's collapse, and the events match what happened.
- Determinism: the same seed gives the same epochs; a different seed gives different ones.
- Round-trip: a map with epochs saves and loads with the epochs, the polities and the snapshots
  intact, and the slider still scrubs.
- The saved-file budget: the size of a `.map` with 6 epochs is within the agreed margin.
- Regression: a world with `mode: "archaeologist"` is byte-identical to today (the epochs code
  must not touch the archaeological path at all).

## Build order

| # | Slice | Size | Acceptance |
|---|---|---|---|
| 1 ✅ | The engine: regenerate the political layer per epoch, with a collapse between | large | Two epochs produce different borders; the events describe what happened |
| 2 ✅ | The data model and the save format: epochs, polities, snapshot records | medium | A map with epochs round-trips; an old map loads unchanged |
| 3 ✅ | The mode switch: `lore.history.mode`, the epochs as the eras | medium | `archaeologist` is untouched; `epochs` replaces the invented eras with real ones |
| 4 | The historical view and the slider | large | Dragging the year shows the past borders, the past legend, and the past events |
| 5 | The figures (shipped) in epoch scope: reigns per epoch, a reign ending at its polity's collapse | medium | Dynasties span epochs; a ruler's reign is epoch-scoped |

Slice 1 ships as `src/generators/epochs-generator.ts` (`Epochs.generate`): it returns the epochs,
lineages, events and snapshots without touching the live pack. The per-epoch cast is expanded with
the existing `States.expandStates()` cost model; a collapse empties the weakest polity's land and
the next epoch's foundings flood it, recording the heirs as `successorOf`.

Slice 2 ships as `src/services/io/epochs-format.ts`: `History` gains `epochs`, `polities` and the
runtime-only `snapshots`; `serializeHistory` keeps record 53 as the chronicle JSON (runtime
snapshots stripped, the epochs kept only when every one carries a full-length snapshot) and writes
one comma-joined snapshot record per epoch from 54 on, exactly as `cells.state` is stored in
record 25. `parseHistory` rebuilds `history.snapshots` on load and repairs a truncated or garbled
snapshot tail by dropping the epochs — the chronicle and the polities stay, the slider is
disabled, and an old map with no records past 53 is untouched. The JSON export carries the
snapshots as plain arrays (`historyForJson`), and nothing generates epochs yet: wiring the mode is
slice 3, the slider is slice 4.

Slice 3 ships the mode: `lore.history.mode` joins the strict `lore.history` schema
(`src/components/options-schema.ts`) with the `archaeologist` default, and `Lore.setHistory`
validates and stores it. `Chronicle.generate()` branches on it: the archaeologist path is the
same code as before, and a new `generateEpochs()` runs the engine, merges its political events
under the retroactive cultural and religious ones, installs `epochs`, `polities` and `snapshots`
on `pack.history`, retires the invented realms (no ghosts, no echoes, no realm events) and
derives the eras from the epochs — each epoch's own `era` name, contiguous, with the configured
`lore.calendar.era` as the present age. The dynasties keep their state-scoped reigns until the
figures are re-scoped in slice 5. The Legends browser resolves `polity` actors and filters them.
The pre-created state foundings, wars and vassalages are *not* recorded in this mode: the polities
own that story.

## Risks

- **The cost is unknown.** Mitigated by measuring first, and by the lazy option.
- **The swap-based historical view touches the live `pack`.** A crash mid-swap would leave the map
  in a past. The swap is wrapped so it always restores, and the view is entered and left through
  one function.
- **The political layer is not the whole world.** Cultures and religions do not change per epoch,
  so a polity whose people vanish between epochs needs a story — a migration, or a culture that
  dies out. The events cover it, but the *map* would show a culture's cells with no state.
- **The events must not contradict the borders.** The epoch engine writes the events as it goes,
  so they cannot; but the retroactive cultural events are dated independently and might land
  inside a collapse. The date ranges need a reconciliation pass.
- **Format growth.** Each epoch adds a record; a file with many epochs has many records. The
  loader must tolerate a truncated file.

## Open Questions

1. **How many epochs by default?** Six is the brainstorm's midpoint; the measurement decides.
   Is a fixed count right, or should it scale with the map's history span?
2. **Should the epochs replace the Archaeologist entirely?** The plan keeps both behind a mode
   switch. The alternative is to retire the archaeological path once the epochs are good — one
   mechanism, one truth.
3. **Where does the slider live?** Under the Legends browser (as planned) or as a permanent map
   control (a small strip at the map's edge, always available)?
4. **Should a past epoch be editable?** The plan says no. An author might want to "fix" a past —
   but that is a fork of the past, and the cost is a new concept.
