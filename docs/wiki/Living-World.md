## Living World
The _Living World_ is a seasonal simulation layered on top of a finished map. Instead of reading the world as a static snapshot, you can let its rulers age, its states spend their capacity, its armies march, its borders move, and its chronicle grow — one season at a time.

Open it from _Options_ → _Tools_ → _Living World_, or type "living world" in the omnibar. The simulation is optional: old maps initialize it lazily the first time you open the HUD or step a season.

### The HUD
The HUD is a compact bar at the bottom of the map. It can be dragged anywhere on screen.

* **Pause** stops the clock.
* **Step +1 Season** advances one season and redraws the political map.
* **Step +1 Year** advances four seasons.
* **Play 1× / Play 4×** runs the simulation automatically at a leisurely or brisk pace.
* The **date badge** shows the current season and year. Clicking it opens the _Legends browser_ and its time slider.
* The **news ticker** lists the latest dispatches — wars, battles, conquests, musters, constructions, successions and revolts. Click any headline to zoom the map to where it happened.

Each tick writes to the map itself: state borders, burg ownership, regiments, battle markers and chronicle events all change as the simulation runs.

### The inspector
While the HUD is open, click a state or a burg on the map to open its diorama card.

A **state** card shows:

* **Ruler & traits** — name, age, culture, alignment and virtues or vices.
* **Capacity** — the live `M` / `W` / `S` / `C` pools, each with its current generation and load.
* **Agenda** — the state's current project and its `progress / required` clock.
* **Stability** — the unravel and war-exhaustion meters.
* **Claims & grudges** — outstanding casus belli, remembered wrongs, restive burgs, and active provincial troubles.
* Quick buttons open the full _States Editor_ or _Regiments Overview_.

A **burg** card shows its owner, tier and population, its unrest, its current construction, its standing assets, and its province's public order, stability, development, and active **Trouble** (with required save bane and specialist role). Quick buttons open the _Burg Editor_ or the owning state's regiments.

### What the simulation does
The Living World uses the Conquest capacity rules and the map's existing history and military data. It does not generate a separate game world.

* **Seasons and years** — one tick is one season; four seasons make a year. Rulers age and the world's chronicle advances at each spring boundary.
* **Capacity** — every state draws `M` (military), `W` (wealth), `S` (stability) and `C` (culture/magic) from its territory, buildings and regiments. Assets and standing armies add load. A pool whose load exceeds its generation constrains what the state can do and feeds its unravel clock.
* **Provincial Troubles** — each season (or upon restless conquest), local obstacles can crop up from a province's burgs, ruins, or resources (37 fantasy archetypes). Trouble adds $\lceil \text{level} / 2 \rceil$ to the state's `M`, `W`, and `S` upkeep load, drains order by $\text{level} \times 2$, establishes a floor on burg unrest, freezes garrison stability, and suppresses resource trade goods. If unchecked, Trouble escalates every 2 seasons. States address Trouble via the `resolve_trouble` agenda, sending units to roll against one of six domain saving throws (`disorder`, `uprising`, `poverty`, `ignorance`, `despair`, `corruption`). Matching specialists (Guardsmen, Merchants, Sages, Prophets, Magistrates) roll at normal DC ($16 + \text{level}$), while mismatching units suffer double or triple level penalties. Failed attempts inflict unit Disruption, while success reduces Trouble severity.
* **Agendas** — a state chooses one project at a time: `muster`, `develop`, `build`, `colonize`, `conquer`, `reclaim`, `pacify`, or `resolve_trouble`. Ruler traits and culture values weight that choice, so a martial ruler is more likely to look for a war while a pious one prefers to pacify a restive burg.
* **Development** — provinces spend stability and wealth to raise their development, growing their settlements and adding capacity.
* **Assets** — burgs construct buildings through the three-check value roll. Completed assets change burg flags such as walls, plazas, temples and citadels.
* **Muster** — states recruit roster units and specialists into field regiments, subject to capacity, goods and building requirements.
* **Diplomacy and war** — states declare war, assault border burgs and annex them. Free Burgs are integrated peacefully when they share the state's culture or religion; otherwise they fight with their own garrison and become restive after conquest.
* **Unrest** — occupied burgs carry unrest, which drains province order and contributes to the owner's unravel clock. Garrisoning a burg or building a temple helps it decay; a `pacify` agenda speeds it up and may assimilate the burg's culture or faith.
* **Rulers** — every state has a ruler with a seeded lifespan. On death a successor is crowned. A weak court or an unsuitable heir can turn a funeral into a succession crisis.
* **Grudges and claims** — wars, sacks, slain rulers, repulsed assaults and breakaways are remembered as weighted grudges. Lost burgs become claims. Both influence whom a state attacks next.
* **Rebellion** — when a state's unravel meter fills, its most restive non-capital burg breaks away. It may rejoin its former owner, defect to a kindred neighbour, restore its independence, or found a new secessionist state.
* **Epochs** — every `snapshotIntervalYears` (ten years by default) the simulation captures the political map. These snapshots appear in the _Legends browser_ as the time slider's past epochs.

The simulation is deterministic: the same starting map and seed, stepped the same number of seasons, produce the same borders, battles, units and chronicle events. Its state lives in `pack.history.living`, so a saved `.map` file keeps rulers, agendas, unrest, grudges and snapshots when it is loaded again.

### God mode
The inspector's _God Mode_ section lets you intervene without waiting for the simulation to reach a result.

* **Spark Rebellion** — sets a state's most restive burg (or the selected burg) on the path to secession and fills the state's unravel clock.
* **Smite Ruler** — kills the current ruler and immediately plays out the succession.
* **Force War** — declares war on a neighbouring rival.
* **Pacify Unrest** — clears a burg's unrest at once, eases its owner's unravel and begins assimilation.
* **Complete Asset** — finishes the burg's current construction, or starts and finishes the best available asset.
* **Spawn Trouble** — seeds a procedural trouble crisis in the selected province.
* **Quell Trouble** — immediately quashes an active provincial trouble.
* **Resolve Trouble** — triggers a domain saving throw attempt by the province's owning state.

Every intervention is written to the same chronicle and news ticker as a normal seasonal step.

### Where to read more
The design, data model and invariants are described in [`docs/plans/living-world.md`](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/living-world.md). The simulation code lives in `src/generators/living-generator.ts`; the HUD and inspector live in `src/controllers/living-hud.ts`.
