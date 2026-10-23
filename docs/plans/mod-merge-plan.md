# Plan — Merging the Mods into This Fork

Updated: 2026-10-21. Decision record: the upstream lead's guidance is that mods **maintain the
fork format** — full forks give a mod complete developmental control, AI assistance makes upstream
merging a non-issue, and fork features may feed back into main. The three-patch vendored-client
approach (see [mod-seams-proposal.md](mod-seams-proposal.md)) is therefore **superseded for our own
use**: the patches remain valid as an upstream contribution, but our mods move in-tree.

This fork becomes the one repo: **stock FMG + History (shipped) + Astral Cartographer content +
OpenConquest campaign game.**

## Target architecture

Everything follows FMG's own layering (`docs/architecture/architecture.md`). A mod in-tree is not
a folder bolted beside `src/` — it dissolves into the layers it belongs to, keeping one deviation
documented (below).

| Mod piece | Lands in | Layer |
|---|---|---|
| Astral name bases (12) | `src/data/name-bases.ts` | data |
| Astral culture sets (3) | `CULTURE_SETS` + `CulturesGenerator.getDefault()` branches | generator |
| Polity/sector/system naming | `src/generators/astral-naming.ts` (new, gated on set) | generator |
| Star classes & traits | `src/generators/astral-naming.ts` (derived view) | generator |
| OpenConquest engine, host, store, ui | `src/conquest/**` — one self-contained vertical | documented exception |
| OpenConquest Tools entry | registry + `map-commands.ts` + Tools tab | controller wiring |

**The one exception:** OpenConquest is a game engine compiled from a finished world — it is not
world generation, not a renderer, and not a dialog. It stays a self-contained vertical under
`src/conquest/` (engine / host / store / ui), exposed to the app through one controller and
native Layers/commands. Documented as a deliberate layering exception; its `ui/` parts follow the
controller conventions (own markup, lazy load, cleanup).

**Upstream-merge discipline** — the whole point of this direction. Every merge into this fork
keeps its touch points on existing files short and append-only, so `git merge upstream/master`
stays mechanical:

- new content = new files or appended array entries (`name-bases.ts`, `CULTURE_SETS`)
- new behavior = new modules + registry entries
- edits to stock files limited to: `cultures-generator.getDefault()` branches, `map-commands.ts`
  entries, `controllers/index.ts` entries, `options-schema.ts` ids, Tools tab buttons

Keep a `MERGING.md` at root listing exactly these touch points, so an assisted upstream merge has
a checklist.

## Phase A — Astral content in core (bases + sets) ✅

Delivered in `240ba81e`: 12 Astral name bases appended to `getDefaultNameBases()` (with the
`groups` extension carrying the `polities` pools), the three sets added to `CULTURE_SETS` and
`CulturesGenerator.getDefault()`, the placement hints translated into the stock homeland scoring
callbacks, and the content-rules test suite (`src/data/name-bases.test.ts`).

The user-visible outcome: the Cultures set dropdown offers **AstralTrek, AstralJammer, Grimdark**,
and generating with one produces the star-map peoples out of the box — no panel, no payload push,
and (unlike the mod) **set pinning works**, because `cultureSetId` validates against ids the core
knows.

1. **Bases** (`src/data/name-bases.ts`): append the 12 Astral bases in FMG's own shape
   (`{name, min, max, d, m, b}`), `b` = the flattened `systems` pool (what burgs chain from).
   Extend the core `NameBase` type with optional `groups?: Record<string, string[]>` carrying the
   `polities` pools. Groups are **core data, not user data**: nothing is saved (a stock edit of
   `b` in the Namebase Editor changes only `b`), so the `.map` format needs no change.
2. **Sets** (`cultures-generator.ts`): add `astralTrek / astralJammer / grimdark` to
   `CULTURE_SETS` (max 8, modest probability), and three `getDefault()` branches returning each
   set's eight cultures — two per base, resolving `base` by name to the appended index.
3. **Placement hints → sort functions**: the content says where a homeland goes in words
   (`temperate | harsh | remote | any`); the mod already turned hints into scoring functions. Port
   that translation into the `sort(i)` callbacks using the stock vocabulary already in
   `getDefault()`: `n(i)` cell score, `td(i, goal)` temperature distance, `bd(i, biomes)` biome
   fee, `sf(i)` sea-coast fee — e.g. `temperate → td(i, 12)`, `harsh → td(i, 0) + bd(highland)`,
   `remote → 1 / (n(i) + 1)`, `any → n(i)`.
4. **Schema**: confirm `cultureSetId` derives from `CULTURE_SETS` keys (it is built from them at
   load time) — adding the sets should extend validation and pinning automatically; add a test.
5. **Content tests**: port the mod's naming rules to vitest — no digits in a pool, no name shared
   across bases, pool minimums (50+ systems / 18+ polities), no duplicates, no `|` or `/`, length
   window, doubling letters. These were each a real bug first.

Acceptance: a fresh generation with `cultures.set: "astralTrek"` yields the eight Trek peoples
naming their burgs from the systems pools; the set survives save/load and pinning; the naming
rules test suite passes.

## Phase B — OpenConquest in-tree

OpenConquest stays what it is: **a campaign game compiled from a finished FMG world** — applied
after full generation, never part of it. The port is a transplant, not a rewrite: the mod's
internal architecture (engine / host compiler / store / ui, worker-compilable) is sound.

1. **Transplant** `openconquest/{engine,host,store,content}` → `src/conquest/`. Import rewrites
   only (`@/` alias already matches). The engine keeps compiling in a Worker — Vite supports
   `new Worker(new URL(...), { type: "module" })` natively, replacing the hand-rolled worker
   import.
2. **Seams become native**: the three patches dissolve — layers registered directly on the
   `Layers` registry, commands appended to `MAP_COMMANDS`, no mod slot (campaigns are sessions
   over a world, not map data).
3. **Campaign persistence**: IndexedDB (the app's `ldb` helper) keyed by **map id**, replacing
   the `.map` mod slot. Campaign archives (the `campaigns/*.json` files) stay downloadable and
   importable through the existing content store.
4. **UI**: the ⚔ button and rail become a registered controller (`Controllers.Conquest`) with the
   Tools tab entry; layers (`armies`, `regions`, `settlements`, `move-paths`, `selection`) become
   native layers with their toggles.
5. **Lifecycle**: keep the "follow FMG's world lifecycle" behavior — a new world or rebase
   recompiles the campaign; the ordering rule (layers registered before a map loads, so
   `Layers.restore()` sees them) is preserved by registering at controller-module init.
6. **Tests**: port the mod's `test/` suite (engine rules are already unit-shaped).

Acceptance: generate a world, open Conquest from Tools, start a campaign from the finished map,
fight a turn, save the campaign, reload the browser, resume it. A stock map untouched by
Conquest behaves exactly as FMG.

## Phase C — Cleanup and strategy artifacts ✅

Delivered together with this commit:

1. **Archived** `AFMGTW` and `Astral-Cartographer`: both READMEs carry a banner pointing at this
   fork, both repositories are read-only from here on, and their vendored FMG clients and dev
   harnesses are retired (~47 MB out of the working set; the files remain in their git history).
2. **Retired** the per-mod harnesses: one workflow remains — `npm run dev` (or `bun dev`).
3. **Marked** [mod-seams-proposal.md](mod-seams-proposal.md) superseded-by-decision. The file is
   kept: the seams remain a legitimate upstream contribution if the ecosystem question reopens.
4. **`MERGING.md`** carries the upstream touch-point checklist — now covering all three features
   (history, conquest, Astral), not only Phase A.
5. **Content docs**: wiki pages for the [Legends browser](../wiki/Legends.md) and
   [OpenConquest](../wiki/OpenConquest.md); the three Astral sets are documented in
   [Culture sets](../wiki/Culture-sets.md) and linked from the wiki's home page. The module
   READMEs under `docs/` were corrected where they described the pre-merge integration.

## Phase D — Astral naming in generation (the mapping)

The last step, and an optional one: the content from Phase A stands alone without it.

1. **Polity & sector words** (`src/generators/astral-naming.ts`): after `stateForms`/provinces in
   the pipeline, when the map's set is an Astral one, name states from their culture base's
   `polities` group ("Compact of Gant", not "Gantia") and provinces as sectors ("Gant Sector").
   Skip words that carry their own "of" in front of a state name. Stock sets are untouched — the
   gate is the set id, so a fantasy map is never renamed.
2. **Star classes & traits**: the derived view — population → class (M red dwarf … B blue giant),
   installations → traits (port → shipyard, citadel → bastion, walls → shielding). Surface it as
   burg notes or a Burgs Overview column behind the same set gate; expose `Astral.systems()` as a
   console helper for parity with the mod.
3. **Existing maps**: generation-time naming only touches fresh generations (pipeline position);
   edited maps keep their names. An "apply naming" action can come later if wanted.

Acceptance: an Astral-set world reads as a star map in text — polities, sectors, and systems with
classes; a European-set world is byte-for-byte unaffected.

## Save format & compatibility

| Concern | Decision |
|---|---|
| Astral bases | Core data; `namesData` save line unchanged (only user-diffed names are stored) |
| `polities` groups | Core data; never saved |
| `cultures.set: "astralTrek"` | Travels in `options.map` like any set; schema accepts core ids — fixes the mod's repair-to-stock bug |
| History × Astral | Independent: chronicle events snapshot names at generation; polity renames are generation-time too |
| Conquest campaigns | Browser storage keyed by map id; explicitly **not** in the `.map` — a campaign is a session, not map data. Archive import/export covers portability |
| Stock `.map` compat | Unchanged: no new records, no new options keys |

## Risks

- **Base-index drift**: appended bases shift nothing today, but an upstream insert into
  `nameBases` would shift indices that saved maps reference. Append-only + upstream merge cadence
  keeps the window small; this risk already exists in stock.
- **`getDefault()` growth**: three more set branches in `cultures-generator.ts` — the largest
  edit to a stock file. If it balloons, extract set descriptors to `src/data/` with the sort
  functions, leaving the generator a lookup.
- **Conquest size**: ~60 files, the biggest transplant. Do it as a folder move with import
  rewrites in one slice; do not refactor while porting.
- **Worker + lazy chunks**: conquest engine must stay out of the main bundle (dynamic import +
  Worker entry) or startup cost regresses — the benchmark gate will catch it.
- **Upstream drift in touched files**: `cultures-generator.ts` and `map-commands.ts` are living
  upstream files; keep edits append-only and rebase often.

## Build order

The table's rows are the work items; the sections above are the phases they belong to. Phase A and
B are done, C (cleanup) with them; only the naming step is left.

| # | Slice | Phase | Size | Acceptance |
|---|---|---|---|---|
| A ✅ | Astral content in core (bases, sets, schema, naming tests) | A | small | Trek generation works; set survives save/load + pinning |
| B ✅ | Conquest transplant (engine/host/store → `src/conquest/`, native layers/commands, worker) | B | large | Campaign compiles from a finished world; a turn can be fought |
| C ✅ | Conquest UI (top-bar button, rail, layers, campaign storage) | B | medium | Save/resume campaign across reloads |
| D ✅ | Cleanup (archive repos, retire harnesses, MERGING.md, wiki pages) | C | small | One repo, one dev command |
| E ✅ | Astral naming (polities, sectors, star classes) | D | small–medium | Astral-set worlds read as star maps; stock worlds untouched |

Phase D (cleanup) before E on purpose: the naming step is optional polish, while the cleanup makes
the repo the single home for everything the remaining work builds on.

### Phase D notes

- The mapping is an **action, not a generation step**: a world stays a fantasy world until the
  author applies the naming (_Options_ → _Tools_ → _Astral Names_). The pipeline is untouched by it,
  so no stock file gains a generation step.
- A polity is named by the system that holds it — a state takes its capital's name, with no
  fantasy suffix — and its word comes from the `polities` group of its own culture's base, so a
  mixed map keeps each people's register. The words are hashed from the name, so applying twice
  changes nothing.
- **The star class ladder was corrected during the work**: the biggest settlements sit on the most
  habitable stars (a Sun-like yellow dwarf), and the small ones on the exotic, harsh fringe (blue
  giants, white stars, red dwarfs). The original mod's mapping ran the other way — a capital on a
  blue giant, a hamlet on a red dwarf.
- The Star Systems overview is a read-only controller (`Controllers.AstralSystems`); the console
  helper `Astral.systems()` returns the same data.

### Phase C notes

- The Conquest UI needed no controller registration: the ⚔ button installs itself in the top bar
  (`#sticked`) and the campaign actions register themselves in `MAP_COMMANDS`, so the omnibar and
  the hotkey system find them without any wiring. The plan's "Tools tab entry" line item is
  superseded by the top-bar button, which is the mod's own design and needs no duplicate.
- The module READMEs under `docs/` were written before the merge and described the pre-merge
  integration in two places (a Vite-native module worker, and a `Controllers.Conquest` registry
  entry). Both were corrected: the worker is a Blob importing the engine's own module URL, and the
  feature is reached through the self-installing button.

### Phase B notes

- The transplant kept the mod's host-seam module (`ui/fmg.ts`) intact, so its files ported 1:1;
  the three patch seams became three small in-tree changes (`LayersRegistry.register` with
  `LayerId` widened, `window.LAYER_TOGGLES`, `window.MAP_COMMANDS`).
- Campaign persistence is **IndexedDB keyed by map id** (`conquest-<id>` via the app's `ldb`),
  loaded on `map:generated` and awaited by the compile flow before the session adopts anything;
  the pack-keyed mirror (store/mirror.ts) stays as crash insurance. The `.map` slot design is gone.
- The compile Worker (a Blob importing its own module URL) needed no changes under Vite.
- The ⚔ button self-installs into FMG's top bar (`#sticked`) and the palette commands
  self-register into `MAP_COMMANDS` — no Tools-tab or registry wiring required.
- Tests: 9 of 16 suites ported (204 tests, green under vitest). Skipped: `server-boot`/`tw-layers`
  (build-harness-coupled), `phase-b` bundle assertions (same), `phase-c` (superseded — it tested
  the removed ModSlot seam). The golden-world fixture (8 MB) is committed at
  `src/conquest/test-data/`. Remaining port candidates: `phase-b/d/e` integration suites, rebased
  onto the new persistence.

## Out of scope (for now)

- Astral **visual reskin** (galactic plane, nebulae, system markers) — moved out of this plan into
  [astral-ui-overhaul.md](astral-ui-overhaul.md), a renderers/layers project built on the mapping.
- Style presets for sci-fi charts — the `astral` preset is part of that overhaul.
- Conquest multiplayer or campaign-in-`.map`.
