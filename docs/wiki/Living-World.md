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
* **Claims & grudges** — outstanding casus belli, remembered wrongs, restive burgs, active provincial troubles, and entrenched provincial lairs.
* Quick buttons open the full _States Editor_ or _Regiments Overview_.

A **burg** card shows its owner, tier and population, its unrest, its current construction, its standing assets, and its province's public order, stability, development, active **Trouble** (with required save bane and specialist role), and active **Lair** (with threat level, raid threshold, defenders, and fortification status). Quick buttons open the _Burg Editor_ or the owning state's regiments.

### What the simulation does
The Living World uses domain capacity rules and the map's existing history and military data. It does not generate a separate game world.

* **Seasons and years** — one tick is one season; four seasons make a year. Rulers age and the world's chronicle advances at each spring boundary.
* **Capacity** — every state draws `M` (military), `W` (wealth), `S` (stability) and `C` (culture/magic) from its territory, buildings and regiments. Assets, standing armies, active Troubles, and entrenched Lairs add load. A pool whose load exceeds its generation constrains what the state can do and feeds its unravel clock.
* **Provincial Troubles** — each season (or upon restless conquest), local obstacles can crop up from a province's burgs, ruins, or resources (37 fantasy archetypes). Trouble adds $\lceil \text{level} / 2 \rceil$ strictly to the state's `M`, `W`, and `S` upkeep load, drains order by $\text{level} \times 2$, establishes a floor on burg unrest, freezes garrison stability, and suppresses resource trade goods. If unchecked, Trouble escalates every 2 seasons. States address Trouble via the `resolve_trouble` agenda, sending units to roll against one of six domain saving throws (`disorder`, `uprising`, `poverty`, `ignorance`, `despair`, `corruption`). Matching specialists (Guardsmen, Merchants, Sages, Prophets, Magistrates) roll at normal DC ($16 + \text{level}$), while mismatching units suffer double or triple level penalties. Failed attempts inflict unit Disruption, while success reduces Trouble severity.
* **Provincial Lairs & Seasonal Raids** — troubles left lingering unchecked (for $\ge 3$ seasons or reaching level $\ge 5$) fester and metastasize into permanent, fortified Lairs (or spawn directly from ancient wilderness perils across 20 generic fantasy archetypes). Lairs place a dungeon marker on the map, maintain an entrenched garrison of defender units, and apply $\lceil \text{level} / 2 \rceil$ load strictly to `M`, `W`, and `S` while draining public order and freezing stability accrual. Each season, active lairs roll $1\text{d}6$ against their raid threshold ($4+$, $5+$, or $6+$) to launch marauding raids against nearby vulnerable settlements. Raiders bypass heavily garrisoned citadels to assault targets, clashing with local garrisons in simulated battles; on victory, raiders tear down burg buildings or pillage development points. Lairs block civic resolution (`resolve_trouble`) and demand direct martial intervention:
  - **Military Expeditions (`clear_lair` / `assaultLair`)**: A state's field army marches to storm the lair in an encamped/fortified battle against its defender roster. Victory smites the lair, recovers public order ($+15$), restores stability ($+2$), and relieves war exhaustion ($-2$); defeat repulses the army with casualties, unit disruption, and heightened war exhaustion.
  - **Adventurer Decapitation Delves (`hire_adventurers` / `sendAdventurersToLair`)**: An adventuring company is recruited ($+1\text{ W}$ load contract) to infiltrate the lair. Delves roll $1\text{d}20 + \text{modifier}(\max(W, C)) + \text{traits}$ against $\text{DC} = 14 + \text{level}$. Full success slays the master and clears the lair; near misses cull 25–50% of the defenders and reduce lair level; critical failures carry mortal risks for named adventurers and trigger retaliatory raids.
* **Emergent Sovereign Realms (Trouble Promotion & Lair Ascension)** — both political/factional Troubles (19 of 37 archetypes) and organized/sentient Lairs (15 of 20 archetypes) can give birth to new sovereign states:
  - **Direct Trouble $\rightarrow$ State Promotion (`promoteTroubleToState`)**: When a state-promotable trouble escalates in a province with collapsed order ($\le 25$) or inside a state in deep turmoil (`unravel` or `warExhaustion` $\ge 60$), or when a `resolve_trouble` crackdown critically backfires in a low-order province, the faction stages an immediate coup or revolution instead of retreating into a lair.
  - **Lair $\rightarrow$ State Ascension (`ascendLairToState`)**: Successful seasonal raids increase a lair's threat level (up to $10$) and reinforce its defenders (up to $8$ blocks). A state-capable lair ascends into a sovereign realm either by capturing a vulnerable non-capital settlement during a raid (Path A) or by proclaiming sovereignty from its entrenched wilderness stronghold at level $\ge 8$ after $\ge 8$ active seasons (Path B).
  - **Viable Foundation & Initial Aggression**: Emergent realms seize a provincial burg (or found a new capital on their origin cell), scaffold foundational capital infrastructure (`walls2`, `barracks1`, `market1`, `temple1`), reset province order to $75$ and stability to $3$ with $150$ gold treasury, raise a 1st field regiment balanced within `M`/`W`/`S` capacity generation, mint an aggressive ruler figure (`expansionism = 0.8`), and enter immediate war with mutual claims and grudges against their former sovereign.
* **Agendas** — a state chooses one project at a time: `muster`, `develop`, `build`, `colonize`, `conquer`, `reclaim`, `pacify`, `resolve_trouble`, `clear_lair`, or `hire_adventurers`. Ruler traits and culture values weight that choice, so a martial ruler is more likely to hunt lairs or declare war, while a cautious or wealthy ruler may contract adventurers or develop their realm.
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
* **Promote to State** — immediately promotes an eligible political or factional trouble into an emergent sovereign state.
* **Spawn Lair** — creates an entrenched lair stronghold with defenders and a map marker in the province.
* **Assault Lair** — orders the state's field army to launch an immediate assault on the lair.
* **Send Adventurers** — dispatches an adventuring party to delve into the lair.
* **Ascend Lair** — immediately ascends a state-capable lair into an emergent sovereign state.
* **Smite Lair** — strikes down the lair and its defenders by divine intervention.

Every intervention is written to the same chronicle and news ticker as a normal seasonal step.

### The Grand Guild
_Open the Living World HUD in **Guild Mode** (the default) to play as an independent Adventurers' Guild. **Sandbox God Mode** keeps every free intervention above for worldbuilders._

* **Wallet and renown** — heroes earn gold, renown and experience from missions; chapterhouses pay passive dues; renown promotes the Guild through five tiers (larger roster, more vault slots, better checks).
* **Heroes** — recruit seekers from the tavern each spring, then let the idle doctrine dispatch them (`Hunt Troubles`, `Hunt Lairs`, `Excavate Ruins`, `Guard Favored State`, or `Manual`). Missions roll `1d20 + skill + domain modifier + traits + guild bonus + relic bonus` against the target's DC; fumbles force a DC 12 survival save that ends in a vice or a heroic death. Veterans of age 55+ can **Retire & Mentor** a protege.
* **Relics & archaeology** — heroes excavate ruins, battlefields, dungeons, necropolises, statues and libraries. Chronicle sites always yield a named `HistoricalRelic` minted from the nearest fallen realm, dead hero or site (e.g. _Crown of the Vhaelen Emperors_). Relics can be **equipped** on a hero (one each), **enshrined** in the vault (up to one per tier, granting +10% contract gold/renown/xp per point) or **leased** to a state (+generation, -1 unravel and +10 gold tribute per season). If a leased state's capital falls, its relics are buried in a fresh ruin and must be excavated again.
* **Petitions** — every ~5 seasons a ruler, burg or frightened priesthood asks the Guild to pick a side in an active crisis. Click the ⚖️ popup (or its chip in the guild bar) to open a two-choice dilemma card trading gold and renown against real outcomes: coups birth states, crackdowns quell troubles, tithes purge — or enrich — lairs.

### The Wheel of Ages
The **eschaton clock** (⏳ in the guild bar) measures how close the age is to its finale. It rises each season for every level 8+ lair, when an evil sovereign conquers a burg, and when a major state collapses; purging lairs winds it back by 5.

Once the clock reaches **100** — or the Guild reaches **tier 5** — the **Turn the Wheel of Ages** button illuminates. Turning it plays out the epoch bake:

1. **Bake the epoch** — the current borders are cloned into `pack.history.snapshots` and recorded as a `HistoryEpoch`, so the Legends browser' year slider can scrub back through every age you played.
2. **Fallen empires** — every state whose unravel clock passed 50 is retired into `pack.history.realms`, its lands go wild, and a `chronicle` ruins marker seeded with a realm-named relic appears at its capital.
3. **A new era** — the calendar leaps forward 150 years into a freshly named era; giant empires (more than 3 provinces) shatter into successor states and free burgs; all unravel and war exhaustion resets; every state crowns a fresh young ruler.
4. **Prestige carryover** — the Guild keeps its tier, vault, leased relics and chapterhouses, and `ageCount` rises. Living heroes pass into legend, and each hero of level 3+ is succeeded by a **scion** carrying the ancestor's best skill plus one permanent point per prestige age and their signature virtue.

### Where to read more
The design, data model and invariants are described in [`docs/plans/living-world.md`](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/living-world.md), [`docs/plans/lair-ascension.md`](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/lair-ascension.md) and [`docs/plans/living-idle-guild.md`](https://github.com/0xPaladin/Fantasy-Map-Generator/blob/master/docs/plans/living-idle-guild.md). The simulation code lives in `src/model/physical/living-generator.ts`; the HUD and inspector live in `src/controllers/living-hud.ts`.
