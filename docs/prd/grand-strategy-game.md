# Grand Strategy Game Feasibility and Roadmap

## Status

This is an exploratory product and architecture note. It is not an active implementation plan or a commitment to
turn Fantasy Map Generator (FMG) into a game.

The goal is to preserve the analysis needed if the project later decides to build an original, procedurally generated
grand-strategy game inspired by games such as Europa Universalis IV. Any future product should use original names,
content, art, user interface, and rules rather than copying protected assets or presentation.

## Summary

FMG is a strong foundation for an original grand-strategy game, but it is currently a map generator and editor rather
than a persistent game simulation. It already provides much of the difficult world-building and map tooling:

- procedural geography and topology;
- states, provinces, cultures, religions, settlements, routes, and population;
- goods, production, markets, trade, taxes, and treasuries;
- generated diplomacy, campaigns, military regiments, and a manually launched battle simulator;
- map editing, serialization, legacy-map migration, and multiple visualization layers.

These systems could represent roughly 25–35% of the technical foundation of a small playable grand-strategy game.
They represent much less of a feature-complete game once persistent simulation, AI, player interaction, content,
balancing, accessibility, and quality assurance are included.

PixiJS is useful for a game-oriented viewport, but migrating the renderer does not create the game simulation. It
improves the way world state is displayed and interacted with; it does not accelerate or replace climate generation,
state expansion, production, diplomacy, warfare, or AI.

## Scope levels and rough effort

These ranges assume experienced developers working full time, a browser-based single-player game, procedural rather
than historical worlds, reuse of FMG systems, and a deliberately constrained first release. They are planning ranges,
not delivery commitments.

| Target | Included outcome | Rough effort |
| --- | --- | --- |
| Interactive political-map prototype | Province/state map modes, pan/zoom, hover, selection, highlights, basic panels | 3–6 months for one experienced developer |
| Playable conquest vertical slice | Clock, one player nation, army orders, simple war and economy, ownership transfer, basic AI, save/load | 12–24 months solo |
| Solid original “grand-strategy lite” game | Several interacting systems, usable AI, content, balancing, polished UX | 3–5 developers for 2–4 years |
| Broad modern EU4-like feature parity | Deep diplomacy, economy, warfare, internal politics, extensive content and polish | Well over 100 person-years; not a practical initial scope |

Multiplayer, historical scenarios, modding, deterministic lockstep, and a large scripted-event library would add
substantial cost.

## Existing systems that can be reused

### World generation and geography

The current `grid` and `pack` topology, cell adjacency, elevation, climate, hydrology, biomes, and land/water features
are valuable inputs for procedural strategy worlds. Existing generators already produce terrain and political context
that a game would otherwise need to import from authored data.

The packed Voronoi cells should remain rendering and geographic primitives. They should not each become full gameplay
objects with their own economy, diplomacy, and history.

### Political and demographic data

FMG already models:

- states and state-to-cell assignments;
- administrative provinces;
- capitals and burgs;
- cultures and religions;
- population and settlement statistics;
- state neighbors, forms, colors, and generated diplomatic relationships.

This is an excellent map definition, but most values are generated snapshots rather than state that evolves through a
game clock.

### Routes and spatial queries

Cell adjacency, roads, sea routes, ports, rivers, and existing pathfinding can support:

- army and fleet movement;
- travel time and movement cost;
- trade connections;
- supply reach;
- AI route planning;
- map-mode overlays.

Game movement will still require explicit rules for access, hostile territory, naval transport, interception,
attrition, and changing route costs.

### Economy

The existing goods, markets, production, pricing, trade deals, taxes, and treasury code provides useful formulas and
data structures. It already links geography, population, state ownership, burgs, routes, supply, demand, and prices.

The current economy is deliberately a frozen single-pass simulation:

- production has no recurring tick or carried inventory;
- burg output describes the most recent generated cycle;
- state treasury is reset and recalculated;
- there is no upkeep, spending, borrowing, inflation, or compounding;
- economic actors do not make long-term strategic decisions.

A game economy should reuse concepts and selected algorithms, not simply call the existing generation pass every
month.

### Diplomacy, campaigns, and military

FMG provides state relationships, generated campaign histories, military compositions, regiment editing, movement
tools, and a battle simulator. These are useful prototypes and content-generation inputs.

They are not yet a persistent war system:

- diplomacy is generated rather than driven by player and AI actions over time;
- campaigns are historical records rather than live wars with participants and objectives;
- regiment movement is primarily an editing interaction;
- battles are manually initiated and iterated;
- there is no occupation, war score, peace negotiation, reinforcement, recruitment, supply, or strategic AI.

### Persistence and editing

Existing `.map` serialization, migrations, editors, and procedural regeneration are major advantages. The editor can
eventually become a scenario and modding tool if game state remains separate from renderer resources and is fully
serializable.

Old `.map` compatibility must not be broken merely to add game state. A game save may initially be a separately
versioned format that embeds or references an FMG map definition.

## PixiJS migration implications

PixiJS 8 is already installed and an opt-in prototype exists. The prototype currently supports retained cell
geometry and selected state, biome, relief, and border rendering. The detailed production roadmap is documented in
[pixi-renderer-migration.md](../architecture/pixi-renderer-migration.md).

Important current constraints include:

- only a small subset of persistent layers is Pixi-owned;
- renderer-independent picking is not implemented in the Pixi renderer;
- labels, editing targets, masks, filters, and some layer-order combinations remain outside the prototype;
- camera input still crosses legacy D3/SVG compatibility boundaries;
- saving and export temporarily materialize SVG fallback layers.

### Do not wait for total renderer conversion

A game vertical slice does not require completion of every Pixi migration milestone. A hybrid viewport is the most
practical first step:

| Surface | Initial responsibility |
| --- | --- |
| Pixi | Land and water, political/province fills, borders, routes, selection highlights, armies and fleets |
| HTML/React | Top bar, date controls, outliner, dialogs, province/nation panels, tooltips, notifications |
| Small SVG/HTML overlay | Labels and transient selection or editing handles where this remains more accessible |

The persistent full SVG map should not be rendered invisibly behind Pixi. Each live layer must have one owner, as
required by the renderer migration plan.

### Minimum Pixi work for a game prototype

1. Implement screen-to-world conversion and domain-based picking.
2. Render province/state assignments with incremental attribute updates.
3. Render borders and ownership/control changes without rebuilding topology.
4. Add selection, hover, movement paths, and order previews.
5. Render and cull units as sprites with stable domain IDs.
6. Keep camera-only updates independent of scene rebuilding.
7. Verify save/load, resize, context recovery, and deterministic resource cleanup.

This subset is more valuable to an early game than immediately porting every decorative layer and editor.

## Recommended game architecture

The generated map and the live simulation should be separate conceptual states while remaining serializable together.

```text
generation settings
        |
        v
generated map definition
topology, cells, province geometry, initial nations, cultures, routes
        |
        v
initial game-state builder
        |
        v
commands -> deterministic simulation -> domain events
                                       |
                         +-------------+-------------+
                         |                           |
                         v                           v
                  updated game state         renderer invalidations
                                                     |
                                                     v
                                            Pixi + HTML/SVG overlays
```

### Map definition

The map definition contains slow-changing geographic data:

- topology and cell geometry;
- height, biome, climate, rivers, coastlines, and features;
- province shapes and adjacency;
- settlement and route locations;
- initial cultures, religions, states, and names;
- map style and authored scenario metadata.

### Game state

The live game state contains values that change through play:

```ts
interface GameState {
  clock: GameClock;
  playerCountryId: number;
  countries: CountryGameState[];
  provinces: ProvinceGameState[];
  armies: ArmyGameState[];
  wars: WarGameState[];
  diplomacy: DiplomacyGameState;
  economy: EconomyGameState;
  eventQueue: GameEvent[];
  randomState: SerializableRandomState;
}
```

These names are illustrative. Concrete types should be introduced only with their first vertical-slice use case.

### Province as the gameplay unit

Use the administrative `Province` as the primary strategic area. Voronoi cells remain the geometry used to draw and
pick that province.

A gameplay province may eventually contain:

- legal owner and current controller;
- capital burg and important settlements;
- development, population, and manpower;
- culture and religion;
- terrain and climate summaries;
- buildings and local modifiers;
- unrest, devastation, prosperity, and occupation progress;
- cores, claims, supply capacity, and trade affiliation.

Ownership changes should update province game state first. A projection can then update the relevant cell assignment
arrays and publish renderer invalidations. Simulation code should not paint cells or manipulate Pixi objects.

### Commands, ticks, and events

Controllers should submit explicit commands such as:

- `MoveArmy`
- `RecruitUnit`
- `DeclareWar`
- `OfferPeace`
- `SetTaxPolicy`
- `ConstructBuilding`

The simulation validates commands, mutates game state, and emits domain events. Renderers and UI consume the resulting
state/events but do not contain business rules.

Use a deterministic fixed-step simulation. A practical first model is daily movement/combat with monthly economy and
AI planning. Pause and speed controls change how quickly fixed steps are processed, not the rules of a step.

All randomness that affects gameplay must come from an explicit, serializable random-number state. Do not replace
global `Math.random` during the live simulation.

### Performance

Avoid running complex game logic for every Voronoi cell on every tick. Most recurring systems should operate on
countries, provinces, markets, armies, and wars. Cell-level work should be reserved for topology queries, picking,
path preparation, and occasional projections.

If monthly simulation or AI creates visible main-thread stalls, move pure simulation batches into a Web Worker behind
a serializable message contract. Do not introduce that complexity until profiling demonstrates the need.

## Missing game systems

### Essential for the first playable version

- deterministic calendar, pause, and speed controls;
- player-country selection;
- province inspection and selection;
- ownership and controller distinction;
- army recruitment, orders, movement, combat, and retreat;
- war declaration, participants, occupation, victory, and peace;
- recurring income, expenses, treasury, and manpower;
- basic country AI;
- game save/load and schema versioning;
- clear feedback for invalid commands and important events.

### Important after the core loop works

- alliances, access, truces, claims, and diplomatic reputation;
- supply, attrition, reinforcement, forts, and siege depth;
- buildings, technology, policies, and country modifiers;
- internal stability, unrest, rebels, estates, and legitimacy-like systems;
- richer trade, loans, inflation, maintenance, and strategic production;
- exploration, colonization, subjects, and naval transport;
- events, decisions, missions, and procedural narrative;
- stronger strategic AI and difficulty levels;
- tutorials, accessibility, telemetry, balancing tools, and mod support.

### Explicitly defer from the first release

- multiplayer and deterministic network synchronization;
- feature parity with a mature commercial grand-strategy game;
- a large historical Earth scenario and researched historical event library;
- migration of every FMG editor to Pixi;
- replacing accessible HTML application UI with canvas controls;
- exact compatibility with another game's data, rules, art, or interface.

## Suggested vertical slice

Build the smallest loop that proves the project can be enjoyable as a game:

- one procedurally generated world containing roughly 50–200 strategic provinces;
- one selectable player country and several AI countries;
- political map mode with hover, click, selection, and tooltips;
- pause plus two or three simulation speeds;
- monthly tax income, army upkeep, treasury, and manpower;
- recruitment and simple army composition;
- click-to-move orders with travel time;
- one war objective, occupation, field battle, and peace action;
- simple AI that budgets, recruits, selects a target, moves armies, and accepts peace;
- save, load, and deterministic continuation;
- an end-state screen or explicit victory condition.

Do not add technology trees, estates, trade nodes, colonization, scripted events, or advanced naval warfare until this
loop is playable and measurable.

## Incremental roadmap

### Phase G0 — Product constraints and fixtures

- Define the intended game fantasy and what is deliberately different from EU4.
- Fix the first province count, country count, session length, and victory condition.
- Choose deterministic world fixtures for simulation and renderer tests.
- Record baseline generation, load, map interaction, and memory measurements.

Exit gate: the vertical-slice scope fits on one page and has objective acceptance criteria.

### Phase G1 — Read-only game viewport

- Add province-based picking and a political map mode.
- Add selection, hover, province/country panels, and camera navigation.
- Make ownership color updates granular in Pixi.
- Keep labels and transient interaction overlays hybrid where useful.

Exit gate: a user can inspect every strategic province without depending on SVG event targets.

### Phase G2 — Deterministic simulation shell

- Introduce the serializable `GameState` boundary.
- Add fixed-step clock, pause/speed, command validation, and event emission.
- Add deterministic random state and save/load continuation tests.
- Keep generated `pack` data usable without game state.

Exit gate: the same commands and seed reproduce the same state checksum after a fixed number of ticks.

### Phase G3 — Movement and warfare

- Add armies, recruitment, movement orders, travel cost, and path display.
- Adapt battle calculations into automatic combat steps.
- Add retreat, occupation, a minimal siege, war state, and peace.
- Publish granular unit, province, border, and UI invalidations.

Exit gate: the player can start and finish a war that changes province ownership.

### Phase G4 — Recurring economy and constraints

- Convert selected generated economy concepts into monthly flows.
- Add country income, expenses, army upkeep, manpower, and insolvency behavior.
- Define which market values persist and how prices evolve between months.
- Add economic summaries and explainable tooltips.

Exit gate: economic choices constrain warfare and remain stable over long automated runs.

### Phase G5 — Basic AI and complete loop

- Add country goals, budgeting, recruitment, target selection, army control, and peace evaluation.
- Add a victory condition and end-state presentation.
- Run long deterministic simulations to find deadlocks, runaway economies, and performance failures.

Exit gate: AI countries can complete the same core loop without privileged state mutations.

### Phase G6 — Expansion and polish

- Add deeper diplomacy, internal politics, technology, buildings, events, and trade only in measured vertical slices.
- Improve content, balance, onboarding, accessibility, visual feedback, and scenario tools.
- Decide whether a separately packaged read-only/game viewer is justified.

Exit gate: each added system creates meaningful decisions and remains understandable to players and AI.

## Major risks

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Treating Pixi migration as the game | A faster map with no playable loop | Build simulation and renderer work as parallel vertical slices |
| Running simulation per cell | Tick cost grows with 100k-cell maps | Simulate countries/provinces/armies; use cells as geometry |
| Mutating `pack` from many UI paths | Nondeterminism and difficult saves | Route gameplay through explicit commands and owning modules |
| Reusing generated snapshots as recurring systems | Economy and diplomacy reset or behave discontinuously | Design persistent state transitions and migrate formulas selectively |
| Renderer objects entering world state | Broken serialization and backend coupling | Keep Pixi resources in disposable renderer caches |
| Completing broad feature lists before the core loop | Years of work without proof of fun | Gate expansion on a playable conquest vertical slice |
| AI becoming an afterthought | Rules work only for a human and require cheats | Use the same command API for player and AI |
| Scope comparison with a mature commercial game | Unbounded content and balancing demands | Define an original, intentionally smaller product identity |
| Breaking FMG editor compatibility | Existing users and `.map` files regress | Keep game saves versioned and preserve map migrations |

## Testing strategy

The game layer needs stronger determinism and long-run testing than a map editor:

- unit tests for commands, state transitions, economy, combat, diplomacy, and AI scoring;
- checksum tests for deterministic fixed-step simulations;
- save/load continuation tests at different points in wars and economic cycles;
- headless simulations covering hundreds or thousands of game months;
- invariant checks, such as one legal province owner and non-negative unit counts;
- renderer tests for picking, ownership updates, selection, camera alignment, and unit culling;
- performance budgets for tick duration, AI planning, pathfinding, scene invalidation, and memory;
- end-to-end coverage of the complete declare-war-to-peace loop.

## Initial decision checklist

Before implementation starts, decide:

1. Is the product primarily a procedural conquest game, political sandbox, economic simulator, or world-history
   generator?
2. Is FMG still one application with a game mode, or does it export maps to a separate game entry point?
3. What is the strategic province count and expected campaign duration?
4. Which three systems create the core player decisions?
5. Is the first release strictly single-player?
6. Which existing FMG editors remain available during play, before play, or only in a scenario editor?
7. What save compatibility is promised between FMG maps and game campaigns?
8. What is the explicit non-goal list for the first playable release?

## Related documentation

- [Project architecture](../architecture/architecture.md)
- [Current data model](../architecture/data_model.md)
- [Future data-model direction](../architecture/future_data_model.md)
- [Legacy code and compatibility policy](../architecture/legacy-code.md)
- [PixiJS renderer migration plan](../architecture/pixi-renderer-migration.md)
- [PixiJS prototype](../architecture/pixi-renderer-prototype.md)
- [Generation pipeline](../domain/generation_pipeline.md)
- [Production schema](../domain/production_schema.md)
- [Trade and markets schema](../domain/trade_schema.md)
- [State taxes and treasury](../domain/taxes.md)
