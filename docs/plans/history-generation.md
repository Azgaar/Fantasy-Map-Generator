# Plan — History Generation (the Archaeologist)

Updated: 2026-10-20. Decisions taken in brainstorming: **Archaeologist** approach (retroactive
event log + ghost fallen realms), figures deferred to a later phase, primary consumption is an
**in-app Legends browser**. This document is the implementation contract; slices in
[Build Order](#build-order) are each shippable on their own.

## Problem Statement

FMG generates a single snapshot of the world at `options.map.lore.calendar.year`. Cultures expand,
states develop, wars are declared — but everything happens in an eternal, undated present:

- `state.campaigns` holds randomly dated wars disconnected from each other
  (`states-generator.ts:generateCampaign`), and the current war's story is stashed as a
  `string[][]` on the neutrals state (`states[0].diplomacy`) with a standing TODO to move it out.
- `culture.origins` and `religion.origins` are divergence trees with no dates: migrations and
  schisms exist as structure but never as events.
- `ruins` and `battlefields` markers are placed randomly, explaining nothing.
- There is no rise and fall: no state was ever founded, no empire ever collapsed, no border has
  a past.

The goal is Dwarf-Fortress-Legends-style rich history — browsable, entity-linked, dated —
**without** running a simulation. History does not have to *cause* the present; it has to
*explain* it plausibly.

## Solution

A new **History** generator runs as the last step of the generation pipeline and works
retroactively over the finished world:

1. **Timeline scaffold** — date what already exists: state foundings, the wars in
   `state.campaigns`, vassal backstories, culture-tree divergences, religion schisms.
2. **Ghost realms** — invent 1–3 fallen empires whose footprints explain current borders,
   culture enclaves and unexplained grandeur.
3. **Event emission** — one append-only, year-sorted `pack.history.events` log referencing
   entities by `{kind, id}`.
4. **Map echoes** — ruins/battlefield markers placed *from* events, notes on successor states
   and sacked burgs, optional "New X" renames.

A **Legends browser** overview presents the log: timeline grouped by era, realm/entity pages,
filters, click-to-zoom.

### Rejected alternatives

| Approach | Why not first |
|---|---|
| Chronicler (pure event log, no map changes) | Subsumed: it is exactly slices 1–2 of this plan |
| Epochs (layered political regeneration + border time slider) | Territory reassignment must keep provinces, routes, markets, military consistent; a month+ of work. The event schema here is designed so epochs can later make the same events causally real |
| Ticker (forward macro-sim of state scalars) | Most work, and the single-shot generators already produce good-looking final states a sim could easily degrade |

## User Stories

1. As a worldbuilder, I want every state to have a founding date and a past, so that the map
   feels inhabited by time.
2. As a worldbuilder, I want fallen empires whose rise and fall explains current borders, ruins
   and enclaves, so that the world has depth beyond the snapshot.
3. As a worldbuilder, I want to browse a timeline of events grouped by era, so that I can read
   the world like a chronicle.
4. As a worldbuilder, I want to open a state, culture, religion or burg and see its history, so
   that every entity has a story.
5. As a worldbuilder, I want to click an event and jump to where it happened, so that the log
   stays tied to the map.
6. As a worldbuilder, I want history to be deterministic from the map seed, so that reloading
   and regenerating behave predictably.
7. As a worldbuilder, I want to lock events I care about and edit their text, so that
   regeneration preserves my canon.
8. As a worldbuilder, I want ruins and battlefield markers placed where history says they
   happened, so that the map and the chronicle agree.
9. As a worldbuilder, I want to configure history depth and the number of fallen realms, so
   that I control how much past a world carries.

## Data Model

New file `src/types/history.ts`. `pack.history` is a new top-level pack key; everything is
additive — **no existing interface changes**.

```ts
interface HistRef {
  kind: "state" | "realm" | "burg" | "culture" | "religion";
  id: number;
}

interface HistoryEvent {
  i: number;
  year: number;
  type: "founding" | "war" | "battle" | "collapse" | "schism" | "migration"
      | "independence" | "goldenAge" | "sack" | "plague";
  actors: HistRef[];
  loc?: number;   // cell id; the Legends browser zooms to it
  text: string;
  lock?: boolean; // user-edited events survive regeneration
}

interface Realm {
  i: number;
  name: string;       // e.g. "Vhælen Empire" — Names + STATE_FORMS patterns
  coa: Emblem;        // from the Emblems generator
  center: number;     // cell of its capital (usually now a ruin)
  capital?: number;   // burg id if attached to an existing burg
  founded: number;
  fallen: number;
  cause: "collapse" | "conquest" | "partition";
  successors: number[];  // current state ids
  remnantCulture?: number; // culture id explained as imperial remnant
}

interface Era {
  name: string;
  from: number;
  to: number;
}

interface History {
  events: HistoryEvent[];
  realms: Realm[];
  eras: Era[];
  figures?: HistoricalFigure[]; // phase 5, see Future Phases
}
```

### Why ghost realms are not `pack.states` entries

The `removed` convention was considered and rejected for generated realms:

- `state.diplomacy` is a string array indexed by state id; ghost ids would force padding every
  live state's array and guarding `generateDiplomacy`'s vassal/war loops.
- Statistics, provinces, military and markets all join against `pack.states`; ghost entries leak
  into all of them.
- Events reference entities generically via `HistRef`; a fallen realm is just
  `{kind: "realm", id}` into `history.realms`. Successorship lives on the realm record, so the
  `State` interface is untouched.

Historical realms are invisible to the states editor by design; the Legends browser is their UI.

## Generator Design

New file `src/generators/history-generator.ts`, exporting a `History` model class in the style
of the other generators (module singleton, seeded RNG from the pipeline context, no DOM).

Pipeline wiring in `src/generators/generation-pipeline.ts`:

```ts
{ id: "journeys", run: () => Journeys.generate() },
{ id: "history", run: () => History.generate() }   // last: sees the finished world
```

The same step is appended to `ErasePipeline`. Determinism comes free: it runs on the map's
seeded RNG like every other generator.

### Pass 1 — Timeline scaffold

- **State foundings**: `founded = gauss(year - k, σ, year - span, year - 5)` with `k`
  correlated to area (older states tend larger) and to culture-tree depth. Young upstarts and
  ancient realms both occur naturally from the distribution.
- **Wars**: convert each `state.campaigns` entry into `war` events; keep the
  `states[0].diplomacy` chronicle migration (see Slice 2) so ongoing wars get events too. Every
  `Enemy` diplomacy pair must end up with at least one war event — a testable invariant.
- **Vassals**: each `Vassal` relation gets either a subjugation event or an independence war
  against the suzerain, which then *explains* the current `Suspicion`/`Ally` stance.
- **Culture tree**: BFS from roots of `culture.origins`; each edge gets a divergence date
  between the parent's and the child's first appearance → `migration` events. Same pass over
  `religion.origins`; `Heresy`/`Cult` religions emit `schism` events.

### Pass 2 — Ghost realms

For each of `options.map.lore.history.realms` realms (default 2):

1. **Footprint**: score candidate sets — the largest state + its neighbors is the default
   candidate; a cluster of 2–3 neighbor states works for maps without a dominant state. Score
   by total area, province count, culture coherence.
2. **Territory & capital**: union of the chosen states' cells. The capital is the highest-score
   burg in the footprint that is *not* currently a capital — history explains its unexplained
   grandeur. `realm.center` = its cell; `realm.capital` = its burg id.
3. **Dates**: `founded` deep in the configured span; `fallen` comfortably before the youngest
   successor's founding; `founded < fallen < now` is a testable invariant.
4. **Explain the present** (table-driven rules, each an event or a note):
   - each successor state: partition/independence from the realm → `note` via the Notes model
   - vassals of a successor: independence war against the realm's last claimant
   - culture enclaves inside the footprint: remnant-population migration; set `remnantCulture`
   - the fall generates a `battle` event at a frontier cell between two successors (a border
     cell between their territories, from `pack.cells.state`)
   - 1–2 existing `campaigns` are retconned as "reforging the old borders"
5. **Eras**: derive `history.eras` from realm spans (e.g. `founded`→`fallen` becomes the
   "Vhælen Era"); unnamed centuries fall back to numbered centuries.

### Pass 3 — Event emission

All events land in one array sorted by year, ids sequential after sort. Event text comes from
template tables in a new `src/data/history-events.ts` (the pattern of the `wars` table in
`generateCampaign`), one weighted template set per event type, names filled from the actor's
culture namebase. Templates stay data so they are extensible and cheap to localize later.

### Pass 4 — Map echoes

- **Markers**: place `ruins` on each realm capital and `battlefields` at battle event locs via
  the public `Markers.add` op (marker name, legend note, icon; types `ruins`/`battlefields`
  already exist in the markers config). When history is enabled, the random `ruins` and
  `battlefields` rolls in `markers-generator` are skipped, so the map has one source of truth.
- **Notes**: `Notes.write` on successor states ("carved from the Vhælen Empire in 812…") and on
  sacked burgs — the existing notes box then surfaces history on hover with zero UI work.
- **Renames** (optional, default off): one successor becomes "New <Realm>" through the same
  rename path the States editor uses, keeping `fullName`/`formName` consistent.

## Legends Browser

New `src/controllers/history-overview.ts`, following the overview conventions and
[migration-guide.md](../architecture/migration-guide.md): named export over module-scoped
state, `open()` → `render()` → `addListeners()`, owns its dialog markup, lazy-loaded through
the Controllers registry, opened from the Tools tab.

- **Timeline tab**: events grouped under `history.eras` headers; row = year, type glyph, text,
  actor chips. Clicking a row with a `loc` zooms to it (existing `zoomTo` pattern).
- **Realms tab**: fallen realms with COA, span, cause, successor links; current states with
  their joined events.
- **Filters**: actor kind, event type, free-text search.
- **Entity links**: actor chips open the corresponding editor/overview or filter the browser to
  that entity. Later: a "History" link inside the state and burg editors opens the browser
  pre-filtered (cheap once the browser exists).

## Configuration

`options.map.lore.history`, mirroring how `calendar` is configured:

```ts
history: { span: 1000; realms: 2; density: 1; echoes: true; renames: false }
```

- zod entry in `src/components/options-schema.ts` beside `calendar` (strict object)
- defaults in `src/components/options-model.ts` beside the lore defaults
- documented in `docs/architecture/configuration.md`
- Lore Editor gets a History section (span, realms, echoes) later in slice 4 — not required for
  slices 1–3, config edits via the Configuration panel suffice

## Serialization & IO

`pack.history` becomes a new record in the `.map` format:

- `src/services/io/save.ts`: append `history` to `mapData` — **record index 53**, after
  `journeys` (52). `JSON.stringify(pack.history ?? emptyHistory)`.
- `src/services/io/load.ts`: `pack.history = data[53] ? parse + validate : emptyHistory()`.
- `src/services/io/auto-update.ts`: no migration needed for old files (absent record → default
  empty history), but `load.ts` must tolerate short arrays as it already does for later records.
- Invariant: saving MUST preserve the exact world state — locked events, realms and eras
  round-trip byte-for-byte; the round-trip test below guards this.
- `src/services/io/export-json.ts`: include `history` in the full JSON export alongside
  `journeys`.

## Testing

Vitest units (`src/generators/history-generator.test.ts` and IO tests):

- events sorted by year; ids sequential; every `actors` ref resolves to a live entity or realm
- `founded < fallen < now` for every realm; successors are live states
- every `Enemy` diplomacy pair has at least one war event; every vassal pair has a subjugation
  or independence event
- culture/religion divergence events respect tree order (parent divergence ≤ child's)
- same seed → identical history (determinism)
- `.map` round-trip preserves `pack.history` exactly, including `lock`ed events
- old-format file (no record 53) loads with empty history
- markers: when history enabled, no random `ruins`/`battlefields`; realm-capital ruin and
  battle markers exist with notes

Runtime budget: all table/string work, O(states × events); target < 10 ms on a default map
(docs/architecture/benchmark.md territory). No Playwright e2e needed for slices 1–3; the
browser UI (slice 4) gets one smoke test at most.

## Glossary & Docs

Update `docs/domain/glossary.md` (it is a living document) with: **History** (the
`pack.history` object), **History Event**, **Realm** (a fallen state, not in `pack.states`),
**Era**, **Legends Browser**. Add a `docs/wiki/Legends.md` user page when slice 4 ships.

## Build Order

Slice notes:

- Slice 2 chronicle migration — the chronicle *content* flows into events at generation: ongoing-war
  records written by `generateDiplomacy` become the war events' text (matched by campaign name). The
  chronicle itself stays on `states[0].diplomacy`: the diplomacy overview uses it as a live,
  user-editable "Relations history" dialog, so relocating it is a UI/IO refactor deferred beyond
  slice 5. `States.getChronicle()` is now defensive about its absence.
- Slice 2 dating — founding age biases with `sqrt(area / largest)` and a uniform jitter; a gaussian
  was avoided because d3's `randomNormal` loops forever when the test suite pins `Math.random`
  constant.
- Slice 3 independence — a realm falls *before* its youngest successor is founded, so no successor
  state ever lived under it. The footprint-vassal event is therefore the *people's* revolt: "D first
  rose in revolt against the Empire", dated inside the realm's span, with the current vassalage left
  to the slice-2 subjugation event to explain.
- Slice 3 suppression — `Markers.generate` skips its random `ruins`/`battlefields` rolls when
  `lore.history.echoes` is on and realms are configured; the chronicle places them where history
  says they happened. Sea battle events keep their `loc` but place no marker.
- Slice 4 chips — state/culture/religion editors act on the *selected* entity, not an id, so actor
  chips zoom to where the actor lives (a state's pole, a culture or religion's center cell); a burg
  chip opens its editor; a realm chip switches to the Realms tab. Realm COAs are carried in the
  realm record but not yet drawn in the browser — inline heraldry is future polish.

Each slice is shippable; nothing user-visible breaks if work stops between slices.

| Slice | Contents | Acceptance |
|---|---|---|
| 1 ✅ | `src/types/history.ts`; `Chronicle` model skeleton (`generate()` produces empty history); pipeline step; save/load record 53; options schema + defaults | New map and old map both save/load identically to before; `pack.history` present in saves |
| 2 ✅ | Pass 1 (scaffold) + pass 3 (emission); migrate `states[0].diplomacy` chronicle into events; culture/religion divergence events | Every state has a founding; every war (past and ongoing) is an event; invariants above pass |
| 3 ✅ | Pass 2 (ghost realms) + pass 4 (echoes: markers, notes, optional renames) | Realms with valid dates; ruin/battlefield markers from events; successor notes visible in the notes box |
| 4 ✅ | Legends browser (timeline + realms tabs, filters, zoom links); Tools tab entry; Lore Editor history section | Browsable, filterable, clickable chronicle |
| 5 | Figures: dynasties (2–5 rulers per major state spanning founding→now), coronations, successions, a general per major war — lazily generated, only where events need them | Entity pages list figures; events reference them |

## Future Phases (out of scope for now)

- **Epochs**: run the political layer K times with collapses between; per-epoch
  `cellsState: Uint16Array` snapshots (~20 × 10k cells) enable a border time slider. The event
  schema above is already what epochs would emit causally; `History.generate` would consume
  epoch logs instead of writing retroactive ones.
- **Chronicle export**: markdown timeline export for worldbuilding outside the tool — falls out
  of the event log.
- **Assistant operations**: register `History.regenerate()`, `History.lockEvent(id)` as
  Operations so the Assistant can propose history edits like any other entity.
- **Event editing UI**: beyond `lock` + note-style text edits.

## Open Questions

Resolved 2026-10-20 (all three confirmed):

1. `battle` events at sea get `loc` on a water cell; no sea markers are placed. **Agreed.**
2. Realm COAs live only in the Legends browser, not on the map. **Agreed.**
3. `lore.calendar.era` names the final era; history eras precede it. **Agreed.**

Naming: the model global is **`Chronicle`** (`window.Chronicle`, data still `pack.history`) —
`History` collides with the DOM's `window.History` constructor and cannot be redeclared.
