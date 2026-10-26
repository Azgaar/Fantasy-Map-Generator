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
   - [Regional Assets & Building Infrastructure](#regional-assets--building-infrastructure)
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
Settlement fortifications consist of walls and citadels. To capture an entire region, an invading army must occupy its major settlement (capital) and choose between immediate **Assault** or **Laying Siege**. Each turn of siege weakens defenders by 15% (down to a 40% floor).

#### Minor Settlements as Tactical Strongpoints
Minor settlements (up to 3 per region) are tactical objectives that armies can hold and contest:
- **Holding a Minor Settlement**: A friendly army stationed at a minor settlement holds it, receiving the settlement's defensive walls (`settlement.walls`) and local militia reinforcements when attacked.
- **Assaulting Undefended Minor Settlements**: If no field army is present, an invading army can assault the minor settlement directly, facing its innate local militia garrison (`minorGarrisonUnits`) and defensive fortifications.
- **Strategic Impact of Occupation**: Victorious attackers occupy the minor settlement, looting gold and inflicting a public order penalty on the province based on the chosen capture policy (`occupy`, `sack`, `loot`, `raze`). While occupied, the minor settlement's development capacity (+1 W / +1 S) and rough-terrain Cunning are denied to the region owner. Region ownership remains tied to the capital until the capital itself falls.
- **Liberation**: When a friendly army re-enters an occupied minor settlement and clears any hostile presence, the settlement is automatically liberated and restores its capacity generation.

Upon triumph at a major settlement, the conqueror selects a **Capture Policy**:
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

### Regional Assets & Building Infrastructure

Regional assets represent permanent civil, martial, economic, and clandestine structures built in controlled settlements and provinces. They anchor the realm's capacity generation ($M/W/S/C$), strengthen fortifications against siege assaults, expand tax revenue, and maintain public order.

#### Core Structural Rules
- **One Structure Per Chain (Upgrade Consumption)**: A region can only maintain one asset from any given chain. Higher-tier structures *consume and replace* their lower-tier predecessors rather than stacking with them (e.g., constructing *Stone Walls* replaces the standing *Palisade*, ensuring fortification tiers and capacity yields do not stack multiplicatively).
- **Settlement Eligibility (`settlementKinds`)**: Basic tier 1 outposts (*Palisade*, *Shrine*, *Informants*) can be erected in both minor settlements and major provincial capitals. Advanced infrastructure and civic centers require a major settlement (`major` burg or capital).
- **Capacity Upkeep Counterweights**: To prevent unchecked building spam, advanced assets load ongoing capacity upkeep ($M/W/S/C$) in a different pool than what they generate (e.g., *Stone Walls* produce $+4\text{ M}$ but load $1\text{ W}$ upkeep; *Great Temples* produce $+8\text{ S}$ but load $2\text{ W}$ upkeep). Construction is barred if the realm lacks sufficient free capacity to shoulder the upkeep.
- **Single Construction Queue**: Each region can have at most one building actively under construction at a time. While in progress, an asset generates no benefits and loads no upkeep.

#### Default Regional Assets (Cost / Benefit)

The standard ruleset (`commonBase` / [`default.json`](../../src/conquest/content/docs/rosters/default.json)) ships with **38 assets** covering the full domain management roster from *In Light Snow, Three Thousand Realms* alongside OpenConquest's maritime and espionage infrastructure:

##### 1. Tiered Structural Assets (6 Chains)

| Asset (ID) | Chain & Tier | Allowed Settlements | Checks (M / W / S) | Upkeep | Capacity & Special Mechanical Effect | Prerequisites |
|---|---|---|---|---|---|---|
| **Palisade** (`walls1`) | Defense · T1 | Major, Minor | 14 / 12 / 12 | — | +1 Wall Tier, +2 M Capacity | None |
| **Stone Walls** (`walls2`) | Defense · T2 | Major | 16 / 13 / 12 | 1 W | +1 Wall Tier, +4 M Capacity | Palisade (`walls1`) |
| **Layered Walls** (`walls3`) | Defense · T3 | Major | 20 / 14 / 12 | 2 W | +1 Wall Tier, +1 Order/turn, +8 M Capacity | Stone Walls (`walls2`) |
| **Barracks** (`barracks1`) | Military · T1 | Major | 14 / 12 / 12 | — | +2 M Capacity. Waives upkeep of **1 stationed unit** (`freeGarrisonUnits: 1`). | None |
| **Training Grounds** (`barracks2`) | Military · T2 | Major | 16 / 13 / 12 | 1 W | +4 M Capacity. Waives upkeep of **2 stationed units** (`freeGarrisonUnits: 2`). | Barracks (`barracks1`) |
| **War Academy** (`barracks3`) | Military · T3 | Major | 20 / 13 / 13 | 1 W, 1 S | +8 M Capacity. Waives upkeep of **4 stationed units** (`freeGarrisonUnits: 4`). | Training Grounds (`barracks2`) |
| **Market** (`market1`) | Economy · T1 | Major | 12 / 14 / 12 | — | +5% Tax Income, +2 W Capacity | None |
| **Trade Center** (`market2`) | Economy · T2 | Major | 13 / 16 / 12 | 1 M | +8% Tax Income, +4 W Capacity | Market (`market1`) |
| **Mercantile Guilds** (`market3`) | Economy · T3 | Major | 13 / 20 / 13 | 1 M, 1 S | +12% Tax Income, +8 W Capacity | Trade Center (`market2`) |
| **Shrine** (`temple1`) | Order · T1 | Major, Minor | 12 / 12 / 14 | — | +2 Public Order/turn, +2 S Capacity | None |
| **Temple** (`temple2`) | Order · T2 | Major | 12 / 13 / 16 | 1 W | +3 Public Order/turn, +4 S Capacity | Shrine (`temple1`) |
| **Great Temple** (`temple3`) | Order · T3 | Major | 12 / 14 / 20 | 2 W | +4 Public Order/turn, +8 S Capacity | Temple (`temple2`) |
| **School** (`school1`) | School · T1 | Major | 12 / 14 / 12 | — | +2 W Capacity | None |
| **Academy** (`school2`) | School · T2 | Major | 12 / 16 / 13 | 1 S | +4 W Capacity | School (`school1`) |
| **Great Academy** (`school3`) | School · T3 | Major | 12 / 20 / 14 | 2 S | +8 W Capacity | Academy (`school2`) |
| **Militia Muster** (`militia1`) | Militia · T1 | Major, Minor | 13 / 12 / 12 | — | +1 M Capacity. Spawns **2 Militia** (`levy_spear`) automatically on defense. | None |
| **Organized Militia** (`militia2`) | Militia · T2 | Major | 14 / 13 / 12 | 1 W | +2 M Capacity. Spawns **4 Militia** (`levy_spear`) on defense. | Militia Muster (`militia1`) |
| **Veteran Guard** (`militia3`) | Militia · T3 | Major | 16 / 14 / 12 | 2 W | +4 M Capacity. Spawns **4 Heavy Infantry** (`sword`) on defense. | Organized Militia (`militia2`) |

##### 2. Maritime & Intrigue Assets

| Asset (ID) | Chain & Tier | Allowed Settlements | Checks (M / W / S) | Upkeep | Capacity & Special Mechanical Effect | Prerequisites |
|---|---|---|---|---|---|---|
| **Harbor Works** (`port1`) | Maritime · T1 | Major | 12 / 13 / 12 | — | +6% Tax Income, +1 W Capacity | None |
| **Informants** (`informants1`) | Shadows · T1 | Major, Minor | 12 / 13 / 12 | 1 W | +1 C Capacity | None |
| **Spy Network** (`informants2`) | Shadows · T2 | Major | 12 / 14 / 12 | 2 W | +2 C Capacity | Informants (`informants1`) |
| **Hidden Court** (`informants3`) | Shadows · T3 | Major | 12 / 15 / 12 | 3 W | +3 C Capacity | Spy Network (`informants2`) |

##### 3. Domain Cultural Customs (Domain-Wide)

Customs represent deeply ingrained traditions of a realm. They are unique across the entire faction domain and apply their effects to all held provinces:

| Custom (ID) | Checks (M / W / S) | Upkeep | Benefits & Mechanical Effects | Incompatible With |
|---|---|---|---|---|
| **Brutal Tyranny** (`custom_brutal_tyranny`) | 16 / 12 / 12 | — | +4 M Capacity. Halves Atrocity point gains (rounded down); triples Atrocity rebel pool on uprisings. | None |
| **Burning Creed** (`custom_burning_creed`) | 12 / 12 / 16 | — | +4 S Capacity. Unlocks elven auxiliary units (`elfBase` allies). | None |
| **Democratic Traditions** (`custom_democratic`) | 12 / 14 / 14 | — | +2 W, +2 S Capacity. Grants +3 to one check/save per turn; natural 1 skips next turn action. | None |
| **Devil Worshipers** (`custom_devil_worshipers`) | 16 / 16 / 12 | — | +4 M, +4 W Capacity. Atrocity decreases by 1/turn; ungarrisoned regions generate 0 M/W/S! | None |
| **Dwarf Friend** (`custom_dwarf_friend`) | 12 / 16 / 12 | — | +4 W Capacity. Unlocks dwarven auxiliary units (`dwarfBase` allies). | Slavery |
| **Halfling Affinity** (`custom_halfling_affinity`) | 12 / 14 / 14 | — | +2 W, +2 S Capacity. Unlocks halfling auxiliary units (`halflingBase` allies). | None |
| **Mercantile** (`custom_mercantile`) | 12 / 16 / 12 | — | +4 W Capacity. Doubles Wealth capacity generated by all Markets, Trade Centers, and Guilds. | None |
| **Religious Fervor** (`custom_religious_fervor`) | 12 / 12 / 16 | — | +4 S Capacity. Doubles Social capacity generated by all Shrines, Temples, and Great Temples. | None |
| **Slavery** (`custom_slavery`) | 12 / 16 / 14 | 2 S | +4 W Capacity. Waives the upkeep of the costliest building in every held region. | Dwarf Friend |
| **Spartan Culture** (`custom_spartan_culture`) | 16 / 12 / 12 | — | +4 M Capacity. Doubles Military capacity generated by Barracks, Training Grounds, and War Academies. | None |
| **Well-Educated** (`custom_well_educated`) | 12 / 14 / 14 | — | +2 W, +2 S Capacity. Doubles Wealth capacity generated by all Schools, Academies, and Great Academies. | None |

##### 4. Unchained & Resource Assets

| Asset (ID) | Category | Checks (M / W / S) | Upkeep | Capacity & Special Mechanical Effect | Notes |
|---|---|---|---|---|---|
| **Community Aid** (`community_aid`) | Unchained | 12 / 14 / 13 | 2 W* | Converts location Wealth into Social: 2 W upkeep → +1 S generated (capped at location W output). | Standalone |
| **Hell Shrine** (`hell_shrine`) | Unchained | 14 / 16 / 14 | — | +2 M, +4 W, +2 S Capacity. Ignores 5 Atrocity points; natural 1 on check/save adds +2 Atrocity. | Standalone |
| **Military Spending** (`military_spending`) | Unchained | 13 / 14 / 12 | 2 W* | Converts location Wealth into Military: 2 W upkeep → +1 M generated (capped at location W output). | Standalone |
| **Necromantic Cult** (`necromantic_cult`) | Unchained | 12 / 12 / 14 | 2 S | Unlocks Undead units (`necromancer`, `undead_swarm`, `dead_legion`); recruiting undead adds +2 Atrocity. | Standalone |
| **Processing Camp** (`processing_camp`) | Resource | 12 / 14 / 12 | 1 W* | Resource location only. Generates +2 W; converts 1 W upkeep → +1 M generated. | Specialty/POI req. |
| **Resource Extractor** (`resource_extractor`) | Resource | 12 / 14 / 12 | — | Resource location only. Generates +2 W Capacity. | Specialty/POI req. |
| **Scapegoat** (`scapegoat`) | Unchained | 5 + Atrocity | — | Dummy asset established to be sacrificed via `PunishAtrocity` (-1d4+2 Atrocity, 4-turn cooldown). | Single-use |
| **Siege Supplies** (`siege_supplies`) | Unchained | 14 / 12 / 12 | 2 M | Stores 20 HD of supplies (buffers siege attrition by 10 HD/turn). **May be built twice** (`maxInstances: 2`). | Buffer |
| **United Efforts** (`united_efforts`) | Unchained | 13 / 14 / 13 | 2 W* | Converts location Wealth into Military & Social: 2 W upkeep → +1 M, +1 S generated. | Standalone |

---

#### The Process of Creating Building Assets

OpenConquest implements the authentic **3-Check Value Roll System ("Establish an Asset")** from the *AER Domain Management Rules*:

##### 1. The 3-Check Value Roll System
Rather than relying on flat turn countdowns, establishing an asset requires overcoming three distinct Domain value checks — one each for **Military**, **Wealth**, and **Social**:

1. **Check Difficulty Class (DC)**:
   For each value pool $p \in \{M, W, S\}$, the base difficulty reflects the magnitude of the asset's impact:
   $$\text{magnitude}_p = \max\!\left(\text{benefit}_p,\, \text{upkeep}_p\right)$$
   $$\text{DC}_p = \max\!\left(2,\, 12 + \text{magnitude}_p - \text{pityBonus}\right)$$
   *(For Scapegoat assets, the base difficulty is $5 + \text{Domain Atrocity} - \text{pityBonus}$. Minimum DC is 2; a natural 1 always misses.)*
2. **Value Modifiers**:
   Each roll is $1d20 + \text{modifier}$, where the modifier derives from the region's raw generation pool according to the standard value ladder ($0\text{--}5: +0$, $6\text{--}10: +1$, $11\text{--}15: +2$, $16\text{--}20: +3$, $+1$ per $+5$). Upkeep costs do not subtract from a Domain's scores.
3. **Continuous Effort & Pity Mechanic**:
   Each failed check for a project decreases all difficulties for that asset by 1 point (`pityBonus += 1`), ensuring continuous construction efforts eventually prevail.
4. **Treasure Reserves**:
   - Commanders can pre-spend stored Treasure points to boost value checks ($+1$ to the roll per Treasure spent, up to 5 points).
   - If a roll misses by $\le 2$ points, reserve Treasure automatically rescues the attempt at a cost of 2 Treasure per $+1$ needed (up to 4 Treasure spent).
   - Factions accumulate portable Treasure using the `AccumulateTreasure` domain action (Wealth check vs $8 + \text{current Treasure}$ for $1d4$ points).
5. **The Lure of Atrocity**:
   - Rulers facing critical deadlines can force an asset check to succeed via the `useAtrocity` directive, crucifying dissidents or seizing forbidden resources to add $\text{DC} - \text{total}$ Atrocity points.
   - Any Atrocity points inflict a severe domain-wide upkeep penalty ($2 + \lfloor \text{effectiveAtrocity} / 4 \rfloor$ added to Military, Wealth, and Social load).
   - Atrocity can be alleviated by creating a *Scapegoat* asset and issuing the `PunishAtrocity` command to publicly purge the blame (removes $1d4 + 2$ Atrocity points, restricted to once per year / 4 turns).
6. **Voluntary Disbanding & Deficits**:
   - Assets can be dismantled via the `DisbandBuilding` command.
   - Deeply held cultural customs resist disbanding unless the domain is in active capacity deficit for a pool loaded by the custom, or through forced suppression (`suppressCustom: true`), which inflames public outrage and inflicts a $-15$ public order penalty across the realm.

##### 2. Authoring & Modding Building Assets
Developers and modders can define custom building chains in JSON rulesets or live through the in-game editor:

1. **Data-Driven Definition (`BuildingDef`)**:
   Buildings are declared in roster content documents (`src/conquest/content/docs/rosters/<roster>.json`) or custom mod packs:

   ```json
   {
     "id": "dwarf_forge1",
     "name": "Runic Smithy",
     "chain": "forge",
     "tier": 1,
     "settlementKinds": ["major"],
     "cost": 1200,
     "turns": 2,
     "effects": {
       "capacity": { "m": 3, "w": 1 },
       "upkeep": { "w": 1 },
       "orderPerTurn": 1,
       "unlock": ["ironbreakers"]
     }
   }
   ```

2. **Schema Field Reference**:
   - `id` *(string, required)*: Unique identifier for the building.
   - `name` *(string, required)*: Display title shown in campaign panels and tooltips.
   - `chain` *(string, required)*: Identifier of the structural chain (e.g. `"defense"`, `"military"`, `"forge"`). Enforces single-structure-per-chain and upgrade consumption.
   - `tier` *(number, required)*: Numerical rank in the chain ($1, 2, 3\dots$).
   - `kind` *(string, optional)*: Asset category (`"building"`, `"chain"`, `"unchained"`, or `"custom"`). Customs apply domain-wide (limit 3 per domain).
   - `settlementKinds` *(array)*: Array containing `"major"`, `"minor"`, or both. Determines which settlement categories can house the building.
   - `cost` *(number)*: Base gold cost for construction.
   - `turns` *(number, optional)*: Turns required to construct (defaults to 1).
   - `requires` *(string, optional)*: ID of the prerequisite building in the same chain.
   - `group` *(string, optional)*: Roster ID binding. If omitted, the building is common to all factions.
   - `freeGarrisonUnits` *(number, optional)*: Number of military units based in the region whose capacity upkeep is waived (e.g., Barracks waives 1, Training Grounds waives 2, War Academy waives 4).
   - `siegeSupplies` *(number, optional)*: Hit-dice equivalent of stored supplies protecting besieged defenders from attrition (e.g., Siege Supplies provides 20 HD).
   - `atrocityIgnore` *(number, optional)*: Points of domain Atrocity ignored when calculating capacity penalties (e.g., Hell Shrine ignores 5).
   - `maxInstances` *(number, optional)*: Maximum copies allowed per region (e.g., Siege Supplies allows up to 2).
   - `incompatibleWith` *(string[], optional)*: Mutually exclusive customs (e.g., Slavery and Dwarf Friend).
   - `effects` *(object)*:
     - `capacity`: Object specifying capacity generated per turn (`{"m": 2, "w": 1, "s": 0, "c": 0}`).
     - `upkeep`: Object specifying capacity loaded per turn (`{"w": 1}`). Provides the economic counterweight that prevents building spam.
     - `walls`: Number of fortification tiers added to region defenses during assaults.
     - `incomePct`: Decimal percentage multiplier to regional tax revenues (e.g., `0.08` for $+8\%$).
     - `orderPerTurn`: Shift in public order per turn (positive for pacification, negative for oppressive industries).
     - `unlock`: Array of unit IDs that become recruitable in the region once the building stands.

3. **In-App Live Creation via Config Editor**:
   - Open the **⚔ OpenConquest** top menu and select **Faction Forces / Config Editor**.
   - Navigate to the **Buildings** tab.
   - Select a culture roster from the sidebar (or common defaults).
   - Click **Add Building** to declare a new asset ID, or edit existing fields (chain, tier, settlement eligibility, turns, capacity yields, upkeep loads, wall modifiers, and unit unlocks).
   - Changes are verified against the engine's schema validator in real time and replayed directly through the command log without restarting the game or corrupting campaign state.

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
