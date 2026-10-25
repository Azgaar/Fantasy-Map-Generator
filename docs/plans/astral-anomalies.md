# Plan — Astral Anomalies: the markers read as anomalies

Updated: 2026-10-26. Inputs: [docs/astral/README.md](../astral/README.md),
[astral-system-dialog.md](astral-system-dialog.md) (the precedent for derived astral readings),
[astral-ui-overhaul.md](astral-ui-overhaul.md) (the Anomalies layer button).

## Goal

The markers layer is the Anomalies layer in Astral, but its 36 marker types are fantasy and
world-terrain readings: volcanoes, inns, hill-monsters, jousts. The anomalies need their own
vocabulary and icons, in two steps:

1. **The reading** — in Astral view every marker draws its anomaly icon and reads as an anomaly in
   the tooltip. Presentation only: no state changes, gone when the view is left.
2. **The conversion** — an explicit Tools action that converts markers in state: astral legends,
   astral icons. Persisted in the `.map`, one-way, deterministic.

## Non-negotiables

- **No new state.** Types stay the fantasy config keys (`volcanoes`, `inns`…); the reading table is
  the translation. Nothing new to save or load.
- **Standard view untouched.** Outside Astral nothing swaps. After an explicit conversion the
  astral icon and legend are in state, so both views show them — that is the point of converting.
- **Deterministic.** Legends are picked by a hash of the marker, like the polity words: the same
  marker converts to the same legend on any run.
- **Authored content survives.** A marker's custom icon and hand-written name are never overridden
  by the reading; a converted legend keeps the original text.
- **Interstellar register.** Every reading is either a phenomenon **found in space** (derelicts,
  rifts, void life, wrecks) or of a **scale that matters to multi-system polities** (strategic ice
  claims, lane megastructures, shrine worlds, archive stations). No planetary micro-feature — a
  volcano, a statue or a cave is not an anomaly on a sector chart, and is re-read as something an
  empire would mark, claim, garrison or fear.

## The reading table

New module `src/data/astral-markers.ts`. One entry per config type:

```ts
export interface MarkerReading {
  /** the astral name of the anomaly kind */
  reading: string;
  /** the emoji drawn in the pin while Astral is on */
  icon: string;
}
export const MARKER_READINGS: Record<string, MarkerReading> = { ... };
```

| type | reading | icon | why it belongs on a sector chart |
|---|---|---|---|
| volcanoes | nova remnants | 💥 | a star's death, still hot; a navigation hazard and a salvage prize |
| hot-springs | plasma plumes | ♨️ | void jets that blind sensors and seed lanes with ion storms |
| water-sources | ice claims | 🧊 | comet ice, the fleet's fuel; claimed and fought over |
| mines | mines | ⛏️ | belt and asteroid mining rights, an empire's industrial base |
| bridges | lane spans | 🌉 | megastructures crossing a current, tolled by whoever holds them |
| inns | way stations | 🛎️ | lane-junction stations where every fleet stops and pays |
| lighthouses | beacon relays | 🚨 | the chain that makes a lane survivable; cutting it strands a sector |
| waterfalls | plasma falls | ⚡ | a current of plasma dropping out of a rift, a landmark and a killer |
| battlefields | wreck fields | ⚔️ | the debris of a fleet battle, still contested for salvage |
| dungeons | derelicts | 🛰️ | dead stations and hulks, boardable, worth a fleet's detour |
| lake-monsters | drift leviathans | 🐋 | void fauna that take ships; lanes reroute around them |
| sea-monsters | void krakens | 🦑 | the deep-void hunter every captain fears |
| hill-monsters | swarm fronts | 🐜 | locust-like swarms that strip a system and move on |
| sacred-mountains | shrine worlds | 🛕 | a world of pilgrimage, its treaties binding several empires |
| sacred-forests | garden worlds | 🌳 | protected biospheres; harming one is a casus belli |
| sacred-pineries | preserve worlds | 🌲 | treaty-pinned wilderness, the sector's gene bank |
| sacred-palm-groves | oasis worlds | 🌴 | terraformed oases, the only green for a dozen systems |
| brigands | lane raiders | 💰 | raiders working the currents, bleeding a sector's trade |
| pirates | void pirates | 🏴‍☠️ | fleets that hold a lane for ransom |
| statues | precursor idols | 🗿 | alien colossi; whoever reads them claims the past |
| ruins | ruins | 🏺 | dead precursor worlds, a whole fallen civilisation |
| libraries | data archives | 📚 | a repository that outlasts empires; its keepers hold power |
| circuses | spectacle stations | 🎪 | arenas that draw crowds from every system |
| jousts | tournaments | 🤺 | fleet tournaments between houses, diplomacy by other means |
| fairs | trade fairs | 🎠 | multi-system summits where prices and treaties are set |
| canoes | courier shuttles | 🛶 | small craft plying a current; the sector's post and gossip |
| migration | void migrations | 🐗 | herds crossing the dark, a season empires plan fleets around |
| dances | festivals | 💃🏽 | sector-wide festivals, where politics happens off the record |
| mirage | sensor mirages | 💦 | false readings that pull fleets off a lane |
| caves | hollows | 🦇 | cavernous asteroid interiors, the smuggler's true port |
| portals | wormholes | 🌀 | a stable way through; whoever holds both ends holds the lane |
| rifts | rifts | 🎆 | tears in space, hazardous and invaluable to study |
| disturbed-burials | grave fields | 💀 | tomb-ship orbits; disturbing them is taboo and profitable |
| necropolises | necropolises | 🪦 | tomb worlds and ship graveyards, holy to some, haunted to all |
| encounters | encounters | 🛸 | first contacts and distress calls in the deep |
| party | party | 🚩 | the expedition itself — where your own fleet currently is |

A handful keep their word (mines, ruins, rifts, necropolises, encounters, party); the rest rename.
Icons mostly survive — the emoji are neutral — and several swap (💥 🧊 🛰️ 🐋 🛸).

## Phase 1 — The reading ✅

- **`src/renderers/draw-markers.ts`** — while `isAstralView()`, the icon resolves through the
  reading table; pin shape, size, fill, stroke and shift come from the marker record as today. The
  swap applies only when the stored icon is the type's **default** icon: a user-picked custom icon
  wins in both views. Layer id stays `markers`, so the tooltip, click, reveal, highlight, hidden
  markers and viewport culling keep working with no new seams.
- **`src/components/map-tooltip.ts`** — the markers tip becomes mode-aware:
  `${name}. ${Reading}. Click to edit…` in Astral, the stock line otherwise.
- **`src/controllers/markers-editor.ts`** — the type field keeps the raw type string (it is the
  state key and the per-type styling key); in Astral its `data-tip` appends the reading, so the
  field is honest about what the kind is called on this chart.
- A pure helper beside the table, `readingOf(marker)`, returns the reading or `undefined` for
  unknown types — user-typed types simply read as themselves.

Shipped: `MARKER_READINGS` (36 types) and `readingOf` in `src/data/astral-markers.ts`, the
`astralIcon` guard in `draw-markers.ts`, the mode-aware tooltip and editor tip, the completeness
unit test and the `draw-markers` swap test, and `tests/e2e/astral-markers.spec.ts` — the icon
swaps in Astral, the tooltip names the anomaly, leaving restores the chart, and the record never
changes.

## Phase 2 — The conversion ✅

New controller `src/controllers/astral-markers.ts`, wired as _Options → Tools → **Astral
Anomalies**_ and an omnibar command, following the Astral Names action: a confirmation dialog, an
apply, a summary tip (`Converted 42 anomalies`).

For each marker:

- **Legend** — rebuilt as astral prose from new word lists beside the table (per-family templates:
  nova and wreck remnants, station tolls and fares, derelict statuses, void life, precursor relics,
  shrine and garden worlds, archive and fair charters, rifts and mirages, burials), seeded by the
  marker so it is stable. The original note is preserved below an `<hr>` divider.
- **Icon** — set to the reading's icon, in state.
- **Name** — left alone. Authored names are proper nouns and survive the shift; only markers with
  no name take the reading as their name.
- **Skipped** — markers whose note already carries the divider (idempotent: applying twice changes
  nothing the second time), and hidden markers stay hidden.

Shipped: the 14 anomaly families with their seeded two-line legends, `AstralMarkers.apply`, the
Tools button and the omnibar command, the unit tests (family completeness, legend determinism and
variety) and the e2e conversion test. Notes are written directly, like the generator's own notes:
dungeon and encounter legends carry iframes the notes editor subset rejects, and the original must
survive whole.

The action is one-way by design: the astral icon lives in the marker record, so Standard view shows
it too. The original text sits under the divider, so nothing authored is lost.

Generation is untouched: a regenerating world produces fantasy legends again and the action is
simply applied again.

## Files

### New

```
src/data/astral-markers.ts        the reading table and the astral legend word lists
src/controllers/astral-markers.ts the conversion action
```

### Modified

```
src/renderers/draw-markers.ts       astral icon resolution, default-icon guard
src/components/map-tooltip.ts       the mode-aware markers tip
src/controllers/markers-editor.ts   the type field's astral data-tip
src/components/options/tabs/tools-tab.ts   the Tools button
src/components/map-commands.ts      the omnibar command
src/controllers/index.ts            AstralMarkers registry entry
tests/e2e/astral-markers.spec.ts    the reading and the conversion
docs/astral/README.md               the anomalies section and roadmap entry
MERGING.md                          the touch-point section
```

## Testing

- **Unit (pure):** every config type has a reading; every reading's icon resolves through
  `Icons.reference`; `readingOf` on unknown types; divider detection and the seeded legend pick are
  deterministic and idempotent.
- **DOM:** `draw-markers` swaps icons in Astral and not in Standard; a custom icon survives the
  reading; pin appearance is untouched.
- **E2E:** `astral-markers.spec.ts` — enter Astral, a volcano pin draws 🌋 and its tooltip reads
  the anomaly line; run the conversion; the note carries the astral legend above the divider and
  the original below; re-running converts nothing; a standard map renders unchanged.
- **Standard guard:** the existing marker specs pass unchanged.

## Risks and open questions

- **Prose volume.** 36 legend builders is the bulk of the work. Families share templates, and the
  word lists are the same register as the astral name bases — the content is authored once, in one
  file, deterministically picked.
- **One-way conversion.** Surfaced in the confirmation dialog; the divider keeps the original text.
- **Default-icon comparison.** The stored icon is a glyph reference (`glyph-1f30b`); the guard
  compares resolved glyphs against the config default, so a user's swapped emoji is safe.
- **Emoji availability.** The readings reuse the system emoji font, like every marker today — no
  new assets, but exotic emojis render differently per platform. The chosen ones are common.

## Out of scope

- An Anomalies overview dialog.
- Astral marker types as new config or state; free-typed markers read as themselves.
- The conquest compiler's marker weights.
- Changing generation, the Markers Editor's editing model, or the notes editor.
