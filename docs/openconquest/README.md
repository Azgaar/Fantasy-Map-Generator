# OpenConquest: Atlas Invictus

> **An open-source grand-strategy campaign game unified directly inside the [Fantasy Map Generator (Unified Mod Fork)](../../README.md).**

> [!NOTE]
> **Trademark Notice & Disclaimer:** *Total War* is a registered trademark of SEGA Games Co., Ltd. and/or Creative Assembly. OpenConquest is an independent open-source fan-made project and homage. It is not affiliated with, endorsed by, or sponsored by SEGA or Creative Assembly.

You open the generator and play: the map you were designing or editing *is* the campaign map. Political provinces become strategic regions, burgs become fortified settlements, Azgaar's military regiments become strategic armies, and rival states contest borders, raise levies, and march to war.

```
┌────────────────────────── FMG 2.0 Unified Fork ──────────────────────────┐
│  src/                                                                    │
│  ├── generators/       # procedural world generation pipelines           │
│  ├── controllers/      # UI editors, overviews & app shell               │
│  ├── renderers/        # SVG / DOM map rendering layers                  │
│  ├── services/io/      # backward-compatible .map persistence            │
│  └── conquest/         # ⚔ OPENCONQUEST IN-TREE VERTICAL                 │
│      ├── engine/       # pure, deterministic rules & simulation          │
│      │                 # (map pack + ruleset JSON + seed ⇒ commands)     │
│      ├── host/         # Web Worker compiler (off-thread background job) │
│      ├── store/        # command log, replay, IndexedDB session storage │
│      ├── ui/           # ⚔ menu, campaign rail, native layers & editors  │
│      └── content/      # shipped ruleset JSON (rosters, tech, buildings) │
└──────────────────────────────────────────────────────────────────────────┘
```

| | |
|---|---|
| **Architecture** | **Full Fork Methodology** — OpenConquest is integrated directly in-tree under [`src/conquest/`](../../src/conquest) as a self-contained vertical. No injected external scripts, no standalone dev harness, and no fragile runtime patches. |
| **Upstream Discipline** | Touches stock FMG files only through minimal, append-only seams (view mode controller, battle screen, military generation, capital burg markers, and bootstrap in `main.ts`). Documented in [`MERGING.md`](../../MERGING.md). |
| **Persistence** | Campaigns are sessions *over* a world, stored in browser storage (IndexedDB via `ldb`) keyed by **map ID**. Stock `.map` files remain 100% clean and standard. Campaign sessions can be exported and imported as JSON archives (`campaigns/*.json`). |
| **Runtime** | TypeScript bundled natively with Vite. The simulation engine runs in a Web Worker with automatic fallback to the main thread. |
| **Playability** | Any world generated or loaded in FMG is immediately playable. Live map edits (moving borders, shifting burgs) trigger an automatic tolerant rebase of the campaign. |

---

## Contents

1. [Quickstart & Workflow](#quickstart--workflow)
2. [The Full Fork Architecture](#the-full-fork-architecture)
3. [Upstream Seams & Touch Points](#upstream-seams--touch-points)
4. [From Azgaar Map to Campaign World](#from-azgaar-map-to-campaign-world)
5. [Game Mechanics](#game-mechanics)
   - [Factions and the World](#factions-and-the-world)
   - [Turns and Seasons](#turns-and-seasons)
   - [Armies, Movement, and Stances](#armies-movement-and-stances)
   - [Battles: Tactical & Auto-Resolve Simulation](#battles-tactical--auto-resolve-simulation)
   - [Magic, Monsters & Arcane Warfare](#magic-monsters--arcane-warfare)
   - [Sieges and Capturing Regions](#sieges-and-capturing-regions)
   - [Economy: Power as a Stock (Capacity M/W/S/C)](#economy-power-as-a-stock-capacity-mwsc)
   - [Public Order and Rebellions](#public-order-and-rebellions)
   - [Diplomacy & Treaties](#diplomacy--treaties)
   - [Characters: Lords & Agents](#characters-lords--agents)
   - [Scripted Events & Dilemmas](#scripted-events--dilemmas)
   - [Victory Conditions](#victory-conditions)
   - [Campaign AI](#the-campaign-ai)
6. [Modding & Content Pipeline](#modding--content-pipeline)
7. [Repository Layout](#repository-layout)
8. [Testing & Determinism](#testing--determinism)
9. [Roadmap](#roadmap)
10. [Credits & Legal Notice](#credits--legal-notice)

---

## Quickstart & Workflow

### Prerequisites
- [Bun](https://bun.sh) (recommended) or [Node.js](https://nodejs.org) ≥ 20

### Development Server
Run the unified application directly:

```sh
bun install
bun dev                        # launches Vite dev server for the unified fork
```

Open your browser at the local dev URL (e.g. `http://localhost:5173`).

### Playing a Campaign
1. **Boot or load any world**: Generate a new map using FMG's procedural generator, or load an existing `.map` file from disk via **File ▸ Load**.
2. **Start OpenConquest**: Click the **⚔ OpenConquest** button in the generator's top bar, select **Conquest** mode in the bottom view-mode bar, select **OpenConquest** from the **Tools** tab, or trigger `openconquest` via the omnibar (`F1` / map commands).
3. **Compile & Play**: The world compiles into a strategic game board in a background Web Worker. Choose **Start campaign** from the ⚔ menu — your starting faction is assigned, and the campaign interface appears.
4. **End Turn & Save**: Maneuver your armies, recruit units, construct fortifications, and click **End Turn**. Campaigns are automatically persisted to IndexedDB keyed to the map ID. To share a campaign session, select **Export campaign…** from the ⚔ menu to download a portable JSON archive.

### Live Map Editing & Rebasing
You can edit the world while a campaign is underway:
- Modify state borders, adjust province shapes, or relocate burgs using FMG's native editors.
- OpenConquest detects structural changes through an event-driven signature hash, recompiles the map graph in the background, and **tolerantly rebases** the campaign command log onto the altered world.
- Valid orders are preserved; commands that reference deleted settlements or inaccessible terrain are dropped with a clear notification report.
- Undo in FMG triggers an inverse rebase, restoring earlier orders cleanly.

---

## The Full Fork Architecture

### The Evolution: From Standalone Mod to Full Fork
In earlier designs, OpenConquest operated as an external mod bolted onto a pinned client using an injected script (`total-war.js`), three patch files, a standalone development server harness, and a proprietary slot appended to the `.map` file. 

Under the **Full Fork Methodology** ([`docs/plans/mod-merge-plan.md`](../plans/mod-merge-plan.md)), that approach has been superseded:
- **In-Tree Vertical**: OpenConquest is now a first-class vertical under [`src/conquest/`](../../src/conquest) inside the unified repository.
- **Native Architectural Alignment**: The game engine compiles from a completed FMG world rather than intercepting generation steps. It adheres to FMG 2.0 principles: UI logic is separated from simulation, world state remains clean, and rendering leverages FMG's native layers and burg symbols directly without redundant duplicate layers.
- **Pure Deterministic Simulation**: The engine (`src/conquest/engine/`) is a pure function of `(map pack, ruleset, seed, commands) => state`. It has no dependencies on the DOM, wall clocks, or external servers.
- **Background Web Worker**: World compilation runs off the main thread in a Web Worker using Vite's native module worker support (`new Worker(new URL(...), { type: "module" })`). Large maps with thousands of cells and hundreds of burgs compile seamlessly without freezing UI interactions.
- **Session-Based Storage (Clean `.map` Compatibility)**: Rather than polluting the `.map` file format with custom mod slots, campaigns are treated as **sessions over a world**. They are stored in browser IndexedDB (`ldb`) keyed by map ID. The `.map` format remains 100% backward-compatible with stock FMG. Standalone campaign JSON exports provide portability.

---

## Upstream Seams & Touch Points

To maintain easy upstream synchronisation with [Azgaar's upstream repository](https://github.com/Azgaar/Fantasy-Map-Generator), all modifications to stock FMG files are strictly append-only, as catalogued in [`MERGING.md`](../../MERGING.md):

1. **View Mode & Controller Integration** ([`src/controllers/conquest-mode.ts`](../../src/controllers/conquest-mode.ts), [`src/components/options/view-mode.ts`](../../src/components/options/view-mode.ts)):
   - Registered as a first-class view mode (`Controllers.ConquestMode`) toggleable via the view mode bar alongside Standard, 3D, and Astral views.
2. **Core FMG Cartographic Rendering** ([`src/renderers/draw-burg-icons.ts`](../../src/renderers/draw-burg-icons.ts)):
   - Renders state capitals with circled star markers (`burgs-atlas-star-circled`) and province capitals with smaller star markers (`burgs-atlas-star`), eliminating the need for redundant custom settlements or regions layers.
3. **Military & Battle Pipeline** ([`src/generators/military-generator.ts`](../../src/generators/military-generator.ts), [`src/controllers/battle-screen.ts`](../../src/controllers/battle-screen.ts)):
   - Allocates native `ArmyUnit[]` blocks for FMG regiments directly from each state's bound roster (`state.rosterId`), feeding seamlessly into both the campaign compiler and the turn-by-turn Lanchester battle simulator.
4. **Map Commands & App Entry Point** ([`src/components/map-commands.ts`](../../src/components/map-commands.ts), [`src/main.ts`](../../src/main.ts)):
   - Registers omnibar commands (`openConquest`) and appends `import "@/conquest/entry"` so Conquest controllers and listeners register during app bootstrap.

---

## From Azgaar Map to Campaign World

The map compiler transforms Azgaar's cartographic dataset into a deterministic game graph:

| Azgaar Concept | Conquest Conversion | Purpose |
|---|---|---|
| **States** | **Factions** | Playable and AI-governed realms with diplomacy, starting armies, and culture bindings. |
| **Provinces** | **Regions** | The fundamental strategic territories providing tax capacity, public order, and recruitment. |
| **Burgs** | **Settlements** | Fortified towns and capitals (1 major + up to 2 minors per region) with upgradeable infrastructure tiers. |
| **Cells** | **Movement Graph** | Navigable Voronoi land cells connected via an A* pathfinding graph. |
| **Biomes** | **Movement Costs & Habitability** | Terrain movement costs (grassland 5 … desert 20 … glacier 500) and economic habitability caps. |
| **Roads & Trails** | **Movement Multipliers** | Paved roads (×0.5 cost) and dirt trails (×0.8 cost) accelerate strategic troop movement. |
| **Rivers** | **River Fords** | Natural barriers imposing tactical penalties on attackers crossing water cells. |
| **Military Regiments** | **Starting Armies** | Pre-existing regiments are grouped into strategic campaign formations with unit compositions. |
| **Trade Goods** | **Unit & Asset Gates** | Strategic goods (e.g., horses, iron, timber) gate recruitment of cavalry, heavy infantry, and siege engines. |
| **Religions & Cultures** | **Culture Groups & Roster Binding** | Determines which unit roster, building chains, and tech trees a faction fields. |
| **Markers** | **Points of Interest (POIs)** | Explorable dungeons, ruins, and shrines yielding capacity boosts, booty, or event triggers. |

---

## Game Mechanics

### Factions and the World
Every state defined on the map begins as an active faction with its diplomatic matrix, territory, and starting forces. The player commands one faction via the **⚔ menu** or the right-hand **Campaign Rail**; all other factions are directed by the campaign AI.

### Turns and Seasons
- **Sequential Turn Flow**: The player issues strategic orders (movement, recruiting, building, diplomacy) and clicks **End Turn**.
- **AI Turn Execution**: Non-player factions execute orders in a deterministic order based on faction ID.
- **Economy Tick**: At the end of each round, construction finishes, sieges progress, rebellions check for domain saves, public order adjusts, and capacity ledgers refresh.
- **Four Seasons**: A full year consists of Spring, Summer, Autumn, and Winter. Autumn yields a +15% boost to Wealth generation; Winter slows army movement to 80% of normal speed.

### Armies, Movement, and Stances
Armies navigate the cell graph using A* pathfinding. Before issuing a move order, an army can adopt a strategic **Stance**:

| Stance | Movement Multiplier | Tactical Effect |
|---|---|---|
| `normal` | ×1.0 | Standard march stance. |
| `march` | ×1.5 | Forced march; cannot initiate attacks or assaults on the same turn. |
| `encamp` | ×0.7 | Entrenched position: +10% battle defense bonus and double casualty replenishment. |
| `ambush` | ×0.7 | Concealed force: attacks initiated from ambush receive a +30% combat power bonus. |
| `raid` | ×1.0 | Plunders enemy territory, transferring Wealth into booty and destabilizing local public order. |

### Battles: Tactical & Auto-Resolve Simulation
Combat is resolved through an auditable, deterministic statistical model grounded in [Lanchester Combat Laws](lanchester-model.md). Engagements can be auto-resolved instantaneously or commanded round-by-round in the interactive **Battle Screen** ([`src/controllers/battle-screen.ts`](../../src/controllers/battle-screen.ts)):
1. **Power Calculation**: Each unit contributes `(attack + defense + charge/2 + missile×0.6)`, modulated by current unit strength, veterancy experience, and unit category.
2. **Matchup Matrix**: Tactical interactions scale effectiveness across a complete 6×6 archetype matrix (`melee`, `ranged`, `cavalry`, `artillery`, `monster`, `spellcaster`). For instance, cavalry counters missile (×1.3) and spellcasters (×1.5), monsters crush melee lines (×1.3) but suffer concentrated missile fire (×1.25), and spellcasters blast dense infantry (×1.25).
3. **Attrition Rounds & Stances**: Combat simulates up to 6 rounds where casualties compound based on relative force disparity (Lanchester loss pressure). In the interactive Battle Screen, commanders can assign per-round tactical stances (Shock, Flank, Skirmish, Brace, Retreat) and step through engagements round-by-round.
4. **Rout & Pursuit**: Armies rout when falling below their threshold (base 25%, modified by enemy `terror`); losing forces suffer an additional 30% casualty rate during pursuit.
5. **Contextual Modifiers & Troop Sync**: Wall tiers, river crossings, encamped defender bonuses, arcane siege breaches, and commanding lord skills are evaluated per round. Final battle outcomes synchronize surviving `ArmyUnit[]` blocks directly back to regiments on the map. For a complete mathematical breakdown of Linear vs. Square laws and frontage constraints, see [`lanchester-model.md`](lanchester-model.md).

### Magic, Monsters & Arcane Warfare
OpenConquest models asymmetric fantasy warfare through a deterministic magic and monster system ([`docs/plans/openconquest-magic-system.md`](../plans/openconquest-magic-system.md)):
- **Expanded Archetypes**: Units are classified across six core categories: `melee`, `ranged`, `cavalry`, `artillery`, `monster`, and `spellcaster`.
- **6×6 Tactical Matchup Matrix**:
  - **Spellcasters**: Devastate massed infantry (×1.25) and artillery (×1.2), but are vulnerable when ridden down by cavalry (0.5× defense, cavalry gains ×1.5) or sniped by ranged units (×1.2).
  - **Monsters**: Smash infantry frontlines (×1.3), trample artillery (×1.4), and hunt casters (×1.4), but are large targets vulnerable to concentrated missile fire (ranged ×1.25, artillery ×1.3).
- **Declarative Unit Powers (`powers`)**:
  - `ward`: Multiplicatively mitigates incoming round attrition (`lossFrac × (1 - ownWard)`).
  - `hex`: Amplifies enemy round attrition (`lossFrac × (1 + enemyHex)`).
  - `heal`: Regenerates casualties up to the unit's starting battle headcount each round, prioritizing the most-damaged living units.
  - `terror`: Elevates the enemy's breaking point (`routThreshold + enemyTerror`), causing opponents to rout sooner.
  - `arcaneSiege`: Directly reduces defender fortification wall tiers before siege calculations.
- **Arcane Resistance (`resistArcane`)**: Cultural and unit trait (e.g. Dwarven runic wards) that proportionally dampens incoming enemy spell powers.
- **Configurable Caps**: Global engine caps in `game.json` (`wardCap: 0.3`, `hexCap: 0.3`, `healCap: 40`, `terrorCap: 0.15`, `arcaneSiegeCap: 2`, `resistCap: 0.5`) ensure magical dominance remains balanced against mundane arms.

### Sieges and Capturing Regions
Settlement fortifications consist of walls and citadels. To capture a region, an invading army must occupy its major settlement and choose between immediate **Assault** or **Laying Siege**. Each turn of siege weakens defenders by 15% (down to a 40% floor).

Upon triumph, the conqueror selects a **Capture Policy**:
- **Occupy**: Orderly transition; public order resets to 25.
- **Sack**: Plunders 4× base booty; drops public order to 15.
- **Loot**: Plunders 2× base booty; drops public order to 20.
- **Raze**: Demolishes buildings, halves population, plunders 3× booty, and crushes public order to 5.

### Economy: Power as a Stock (Capacity M/W/S/C)
The economy operates on a **capacity stock model** rather than an inflationary gold cash flow:

| Pool | Concept | Generated By | Loaded By |
|---|---|---|---|
| **M** (Military) | Manpower, garrisons, fortifications | Barracks, walls, martial POIs | Recruited regiments, army units |
| **W** (Wealth) | Production, trade, infrastructure | Population tier, markets, ports, trade POIs | Active construction, tech, treasure withdrawals |
| **S** (Social) | Legitimacy, faith, stability | Population tier, temples, shrines | Lords, agents, cultural upkeep |
| **C** (Cunning) | Intrigue, espionage, scouting | Capitals, rugged border hamlets, spy dens | Active espionage, counter-intelligence |

- **Balance Formula**: `Free Capacity = Generation − Load`.
- **Deficits**: If load exceeds generation, the realm experiences military **attrition** and public order unrest rather than monetary bankruptcy.
- **Mobilisation Standard**: Unit costs derive from `MEN_PER_BLOCK = 1000`. Full-strength regiments load fractional capacity blocks (e.g. 150 men = 0.15 blocks = 0.3 M load).
- **Gold as Diplomatic Purse**: Gold is strictly an exchange currency for diplomatic gifts, peace tributes, and ransoms. Free Wealth can be converted to purse gold using the `WithdrawTreasure` action with escalating costs.

### Public Order and Rebellions
Public order ranges from 0 to 100. Garrisoned armies stabilize provinces, while high taxes, looting, or neglect cause order to decline. If order remains below 25 for two consecutive turns, an uprising occurs, spawning hostile brigands or triggering a **Domain Save** (1d20 + Military modifier vs. DC 12).

### Diplomacy & Treaties
- Stances range from −100 to +100, initialized from the map's native diplomatic matrix.
- Actions include non-aggression pacts, trade agreements, defensive alliances, military access, gold gifts, and cultural **confederation**.
- Defensive alliances trigger automated calls-to-arms when an ally is invaded.

### Characters: Lords & Agents
- **Lords** command armies (costing 1 Social capacity). They gain XP from engagements, unlock skill specializations (Combat, Campaign, Economy), and receive procedural personality traits.
- **Agents** operate independently: *Assassins* strike enemy generals, while *Diplomats* sway relations in neighboring capitals.

### Scripted Events & Dilemmas
Dynamic narrative dilemmas present players with contextual choices affecting gold, public order, and diplomatic stance (e.g., war-weary nobles, mercenary offers, natural blights).

### Victory Conditions
Campaign victory is configured per ruleset:
- **Short Campaign**: Control 35% of all regions on the map.
- **Long Campaign**: Control 50% of regions and occupy 3 rival faction capitals.

### The Campaign AI
The AI operates deterministically via a seeded PRNG:
- **Defensive Interceptions**: Defends home settlements within two movement steps.
- **Target Selection**: Converges on vulnerable enemy outposts based on calculated battle odds.
- **Capacity Management**: Restricts recruitment and building orders strictly within available capacity pools.

---

## Modding & Content Pipeline

OpenConquest is designed around data-driven configuration:

```
src/conquest/content/docs/
├── game.json            # core engine parameters (movement, combat, capacity rules)
├── rosters/             # unit pools, building chains, tech trees & FMG regiment mapping
│   ├── default.json     # Standard fantasy roster (commonBase)
│   ├── dwarf.json       # Karaz Mountain Holds (dwarfBase)
│   ├── elf.json         # Highborne Elven Realms (elfBase)
│   ├── orc.json         # Orc & Goblin War-Tribes (orcBase)
│   ├── empire.json      # Grand Electoral Empire (empireBase)
│   ├── chivalric.json   # Kingdom of the Sacred Grail (chivalricBase)
│   ├── wood_elf.json    # Sylvan Deepwood Realms (woodElfBase)
│   ├── tomb_kings.json  # Undying Sun-Dynasties (tombKingsBase)
│   ├── vampire.json     # Vampiric Blood-Counts (vampireBase)
│   ├── chaos.json       # Hordes of the Ruinous Wastes (chaosBase)
│   ├── dark_elf.json    # Dread-Corsair Principalities (darkElfBase)
│   ├── skaven.json      # Blighted Under-Empire (skavenBase)
│   ├── lizardmen.json   # Saurian Temple-Cities (lizardmenBase)
│   ├── infernal_dwarf.json # Infernal Forge-Citadels (infernalDwarfBase)
│   ├── steppe.json      # Steppe nomad cavalry roster (steppeBase)
│   ├── east_asia.json   # East Asian imperial roster (eastAsiaBase)
│   ├── mughal.json      # Mughal gunpowder & war elephant roster (mughalBase)
│   ├── ottoman.json     # Ottoman Janissary & Sipahi roster (ottomanBase)
│   ├── renaissance.json # European Renaissance pike-and-shot roster (renaissanceBase)
│   ├── ogre.json        # Maw-Tribe Ogre Kingdoms (ogreBase)
│   ├── demon.json       # Legions of the Infernal Abyss (demonBase)
│   ├── beastfolk.json   # Primal Beastfolk War-Herds (beastfolkBase)
│   ├── halfling.json    # Shire-Moot & Tinker Guilds (halflingBase)
│   ├── fey.json         # Seelie & Twilight Fey Courts (feyBase)
│   ├── dragonborn.json  # Draconic Flame-Citadels (dragonbornBase)
│   ├── celestial.json   # Radiant Celestial Host (celestialBase)
│   ├── merfolk.json     # Pelagic Reef-Thalassocracies (merfolkBase)
│   ├── elemental.json   # Primordial Elemental Nexus (elementalBase)
│   ├── construct.json   # Clockwork & Golem Foundries (constructBase)
│   ├── eldritch.json    # Void-Spawned Aberrant Synods (eldritchBase)
│   ├── tribal.json      # Primal Wildland Confederacies (tribalBase)
│   └── arachnid.json    # Brood-Hive of the Chitin-Spiders (arachnidBase)
├── victory/             # short, long, and faction-specific victory conditions
└── events/              # scripted narrative events and dilemmas
```

Buildings and research technologies are packaged directly within each roster document to ensure tight thematic cohesion and distinct racial/cultural playstyles.

### In-App Editors
You can modify game balance live during an active campaign via the ⚔ menu:
- **Config Editor**: Edit culture groups, unit roster stats, buildings, and technology trees across the whole campaign.
- **State Editor**: Adjust individual faction attributes, grants, bans, and traits.
- **Live Validation & Replay**: Edits are validated by the engine's schema validator and immediately re-replayed through the command log. If an edit produces an invalid state, it is rejected safely without corrupting the campaign session.

---

## Repository Layout

```
src/conquest/
├── entry.ts             # app bootstrap & controller registration
├── engine/              # pure simulation engine (worker-compilable, zero DOM)
│   ├── common/          # content pack interfaces & serialization schemas
│   ├── compile/         # FMG snapshot extraction & worker protocol
│   ├── compiler/        # map pack compiler: graph construction, capacity footing
│   └── game/            # turns, movement, battles, sieges, economy, AI
├── host/                # Web Worker compilation seam & snapshot serialization
├── store/               # campaign sessions, command log replay, IndexedDB storage
├── ui/                  # user interface and presentation components
│   ├── button.ts        # top bar ⚔ button & menu controller
│   ├── layers/          # FMG integration seam, style presets & zoom triggers
│   ├── panels/          # campaign rail, faction overview, settlement inspector
│   └── content/         # tabbed live config & state dialog editors
├── content/             # shipped ruleset JSON documents & ContentPack store
└── test/                # unit tests for simulation, capacity, and compiler
```

---

## Testing & Determinism

OpenConquest simulation is verified through pure unit tests:

```sh
# Run unit tests across the repository, including Conquest engine tests
bun test --preload ./src/test-setup.ts
# or using npm / vitest
npm run test
```

Test suites cover:
- **Deterministic Replay**: Verifies that identical command streams on identical map packs produce matching state hashes.
- **Capacity Invariants**: Validates that units load capacity accurately and that resource deficits trigger appropriate attrition.
- **Compiler Parity**: Confirms that world snapshots compiled off-thread in the Web Worker match expected graph topologies.
- **Rebase Integrity**: Tests tolerant rebasing when map terrain or political borders are altered mid-campaign.

---

## Roadmap

| Phase | Milestone | Status |
|---|---|---|
| **Phase 0–F** | Standalone mod architecture (layers, Web Worker engine, live JSON editing, capacity pivot) | ✅ Completed |
| **Phase B (In-Tree)** | In-tree transplant into [`src/conquest/`](../../src/conquest), native view mode integration, and Web Worker build | ✅ Completed |
| **Phase C (In-Tree)** | Unified Tools menu entry, map command registration, and IndexedDB session storage | ✅ Completed |
| **Military Integration** | Native `ArmyUnit[]` rosters for regiments, state roster binding, and turn-by-turn Lanchester battle sim | ✅ Completed |
| **Magic & Arcane Warfare** | 6×6 Lanchester matchup matrix, spellcasters, monsters, declarative powers, and arcane siege | ✅ Completed |
| **Expanded Content** | Renaissance Europe, East Asia, Mughal, and Ottoman historical rosters | ✅ Completed |
| **Old World Fantasy Rosters** | Asymmetric Warhammer-inspired Old World faction rosters ([`openconquest-old-world-rosters.md`](../plans/openconquest-old-world-rosters.md)) | ✅ Completed |
| **RPG Fantasy Force Alignment** | Complete 44-culture RPG set alignment with 31 bespoke rosters ([`openconquest-rpg-rosters.md`](../plans/openconquest-rpg-rosters.md)) | ✅ Completed |
| **Next Horizons** | Tactical battle map visualization, fog-of-war exploration, and custom scenario scripting | 📋 Planned |

---

## Credits & Legal Notice

- **Azgaar's Fantasy Map Generator**: Created by [Azgaar](https://github.com/Azgaar) under the MIT License.
- **OpenConquest Design**: Developed as an open-source grand strategy simulation module for FMG.
- **SEGA / Creative Assembly Disclaimer**: *Total War* is a registered trademark of SEGA Games Co., Ltd. and/or Creative Assembly. OpenConquest is an independent homage and is not affiliated with or endorsed by SEGA or Creative Assembly.
