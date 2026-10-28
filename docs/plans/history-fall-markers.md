# Plan — Fall Markers: the Ruins of Fallen Polities

Updated: 2026-10-28. Status: **slices 1 and 1b shipped** (the shared pass, the ruins slider, the
mode fix, the archaeologist unified); slice 2 and 3 open. Companions: the epochs engine in
[history-epochs.md](history-epochs.md), whose slice 4 lists "markers of a past epoch" as a
follow-up; the Archaeologist's echoes in [history-generation.md](history-generation.md).

## The idea

In the epochs mode a polity's collapse is real: the engine grew it, picked it to fall, and
emptied its land. But the map forgets — a fallen empire's capital is just a burg.

Worse, the map *loses* markers: `Markers.generateTypes()` skips the standard `ruins` and
`battlefields` whenever `echoes && realms > 0`, mode-blind, and the epochs path places nothing
in their stead. A default epochs world (`echoes: true`, `realms: 2`) ships with no ruins at all.
The Lore editor even greys out Echoes as "inert" in this mode — while the marker generator still
obeys it.

This plan makes the fall visible, and causal:

- **The capital always falls.** Every fallen polity's capital burg gets a marker — usually
  ruins, sometimes a necropolis.
- **The provinces fall with it.** A random number of the polity's other burgs, scaled by its
  size, are marked as ruins, necropolises or disturbed burials.

## What exists today

| Piece | State |
|---|---|
| `Chronicle.echoes()` | archaeologist only: a ruin per realm capital, a battlefield per `battle` event, notes |
| `Chronicle.generateEpochs()` | writes the chronicle; places no markers |
| `Markers.place(x, y, type, {name, note})` | public placement API; a configured type inherits its icon styling |
| snapshots | per-epoch `cells.state` holding lineage ids — enough to recover a fallen polity's territory |
| Lore editor | `Echoes` disabled in the epochs mode |
| `regenerateHistory` | re-runs the chronicle; no marker redraw, no dedup (the archaeologist duplicates today) |

## The pass

One shared placement on `Chronicle` — `placeFallRemains(subject, territory)` — used by **both**
modes. The subject is the small face a fallen realm turns to the map: its proper name, its
capital burg, a fallback cell, its fall year. The territory is the cell list it died holding.
The epochs take theirs from the saved snapshot; the archaeologist takes the invented realm's
footprint (the cells of its successor states). It is gated on the same
`options.map.lore.history.echoes`, and runs after the pipeline's `markers` step (history is the
last step), so it lands on the finished marker set.

### Whose burgs

**The epochs.** A fallen polity (`polity.fallen` set) appears in the cast of the epoch it fell
in — the collapse happens after that epoch's cast was recorded — and never after. So:

1. The last epoch whose `polities` include the lineage is the epoch of the fall.
2. That epoch's snapshot, filtered to the lineage id, is the territory at the moment of death.
3. The burgs of the territory are `pack.cells.burg[cell]` for those cells, minus removed and
   unpopulated burgs, minus the capital (which is placed first, always).

**The archaeologist.** The invented realm's footprint is `realm.successors` — the states it was
partitioned into — so its territory is the cells of those states, exactly what `buildRealm` used
to pick the realm's seat. The seat rules line up with what the archaeologist already did: the
realm capital (the grandest non-capital burg of the footprint) is the seat; if the realm left no
burg at all, its `center` cell carries the story.

Fallback, both modes: the capital burg → the greatest surviving territory burg → the territory's
first cell.

### How many

The capital is fixed; the extras scale with the territory the realm died holding — its length in
both modes, which is what the epochs' `polity.cells` records — under a **Ruins slider** in Set
Lore: five steps from min to numerous, stored as `lore.history.ruins` (default 3, both modes):

| Slider | Step | Extra-cap formula |
|---|---|---|
| 1 Min | capitals alone | none |
| 2 | few | `1 + floor(sqrt(cells) / 16)` |
| 3 (default) | recommended | `1 + floor(sqrt(cells) / 8)` |
| 4 | many | `1 + floor(sqrt(cells) / 4)` |
| 5 Numerous | ruins everywhere | `1 + floor(sqrt(cells) / 2)` |

At the default step (`sqrt(cells) / 8`), drawn as `rand(0, cap)`, capped by the burgs available:

| Final territory | Extra markers |
|---|---|
| ~40 cells (a march) | 0–1 |
| ~150 cells (a kingdom) | 0–2 |
| ~600 cells (an empire) | 0–4 |
| ~2500 cells (a hegemony) | 0–7 |

Candidates are sorted by population, descending, and drawn from the top 60% — a dead empire
leaves ruins under its great cities, not its hamlets. Burgs that already host a marker are
skipped for extras (portals, fairs and jousts sit on burg cells); the capital is placed even on
an occupied cell, because its marker is the polity's story.

### Which types

Placed through `Markers.place`, so the pin and icon come from the markers config for free.

| Site | Roll | Type |
|---|---|---|
| Capital | 75% | `ruins` — "Ruins of *Old Empire*" |
| Capital | 25% | `necropolises` — "*Old Empire* Necropolis" |
| Province burg | 55% | `ruins` — "Ruins of *Burg*" |
| Province burg | 30% | `necropolises` — "*Burg* Crypt" (from `NECROPOLIS_TYPES`) |
| Province burg | 15% | `disturbed-burials` — only when the Fantasy culture set is on, mirroring the config's fantasy-gated multiplier |

Names use the polity's proper `name` (epoch lineages keep the form word in `form`, unlike realm
names, so no `properRealm` stripping). Notes carry the causality — a few short templates in
`data/history-events.ts` (`FALLEN_CAPITAL_TEMPLATES`, `FALLEN_BURG_TEMPLATES`) taking the polity
name, the burg name and the fall year: *"The seat of the Old Empire, which fell in 732."*,
*"Sacked in the wars that undid the Old Empire, 732."*

### The gap fix

`markers-generator.generateTypes()` learns the mode: the chronicle places its own ruins whenever
`echoes` is on in the epochs mode, not only when `realms > 0`. Standard `battlefields` stay
generated in the epochs mode until battle markers arrive (slice 3), so only the archaeologist
suppresses them.

## Lifecycle

- **Regenerate History** (`map-commands.ts`) gains `Layers.draw("markers")` — the placed markers
  must appear.
- **Dedup**: chronicle-placed markers get an optional `chronicle: true` field (markers serialize
  wholesale, so the flag rides the save format; no format change). `generate()` in either mode
  first removes every `chronicle` marker, then places the new set. This also fixes the
  archaeologist's existing duplicate-on-regenerate behavior.
- **Regenerate Markers** wipes the fall markers (they are not locked), exactly as it wipes the
  archaeologist's echoes today; regenerating history brings them back. Re-placing them from the
  saved chronicle inside `Markers.regenerate()` is a follow-up if the loss feels wrong.
- **The Lore editor** un-greys `Echoes` in the epochs mode (it now means "leave the falls on the
  map"); `loreHistoryRealms` and `loreHistoryRenames` stay disabled. The Ruins slider is enabled
  in both modes — the invented realms leave size-scaled remains too.

## Save format

No change. The markers, epochs, polities and snapshots are already stored; the `chronicle` flag
is one more optional field on markers, which are saved as-is. Old maps load unchanged: no
epochs means no pass.

## Build order

| # | Slice | Size | Acceptance |
|---|---|---|---|
| 1 ✅ | The pass: `placeFallRemains` — capital marker, size-scaled extras, the Ruins slider, templates, the markers-generator mode fix, the Lore editor un-grey | medium | Every fallen polity's capital carries a marker; the slider runs from capitals alone to numerous; `echoes` off leaves none; the archaeologist path is byte-identical |
| 1b ✅ | The archaeologist joins: the invented realms run the same pass over their footprint, the slider governs both modes | small | An archaeologist realm leaves a seat marker plus scaled extras; the old single-ruin behavior is gone by design (saved maps keep their stored markers) |
| 2 | The lifecycle: `chronicle` marker flag, dedup on generate, `Layers.draw("markers")` in `regenerateHistory` | small | Regenerating history twice leaves one set of markers, in both modes |
| 3 | Follow-ups: battlefields from epoch `battle` events (their `loc` cells), burg notes ("once the pride of…"), the historical view hiding fall markers younger than the viewed epoch | small | Optional, in that order |

## Testing

- Epochs tests (the mocked engine artifact in `history-generator.test.ts`): the fallen polity's
  capital always marked; the marker count within the formula's bounds for its `cells`; extras
  drawn only from the snapshot's burgs; `echoes: false` places nothing; names and notes reference
  the polity and the fall year.
- `markers-generator` tests: standard `ruins` skipped when `echoes` in the epochs mode;
  `battlefields` per the Open Question 2 decision.
- Regression: the archaeologist suite unchanged, including its own echoes tests.
- Determinism: same seed, same fall markers (they draw from the generation's seeded stream).

## Risks

- **Marker spam on ruin-heavy histories.** The formula's cap plus the occupied-cell skip bound
  it; the density is one knob if it needs tuning.
- **Burgs are deep time.** A "ruin" sits on a living burg — as the archaeologist's capital ruins
  already do; the note tells the story.
- **Snapshots may be repaired away** (truncated tail). The pass no-ops when there are no epochs;
  the chronicle stays, the map simply keeps its standard markers.

## Open Questions

1. ~~The formula's shape~~ resolved: `sqrt(cells) / 8` at the default step, under the Ruins
   slider's five steps (see *How many*).
2. ~~Battlefields now or in slice 3?~~ resolved: slice 3.
3. **Should a fall depopulate or rename its burgs?** Out of scope here — burgs are deep time —
   but "New *X*" renames and population scars are a natural later plan.
