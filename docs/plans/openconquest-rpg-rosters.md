# Plan — RPG Fantasy Culture Set & Warhammer Force Roster Alignment

**Status:** Implemented  
**Updated:** 2026-10-25  
**Prerequisites:** [**`rpg-fantasy-cultures.md`**](rpg-fantasy-cultures.md), [**`openconquest-old-world-rosters.md`**](openconquest-old-world-rosters.md), [**`openconquest-magic-system.md`**](openconquest-magic-system.md)  
**Context:** Cross-referencing the `rpgFantasy` culture set against OpenConquest's *Warhammer: The Old World* force rosters revealed:
1. **Ratmen (`Skaven`)** had a complete force roster (`skaven.json`) but no culture entry in `rpgFantasy`.
2. **`Lich (Necromancer)`** and **`Vampire (Nightblood)`** both resolved to `vampireBase`, leaving `tombKingsBase` (`tomb_kings.json`) unclaimed by any `rpgFantasy` culture.
3. **Human & Dwarf Binding Gaps:** `Imperial (Human)` missed `empireBase`, `Feudal (Human)` missed `chivalricBase`, `Eastern Empire (Human)` misbound to `empireBase` instead of `eastAsiaBase`, `Duergar (Deep Dwarf)` fell to generic `dwarfBase` instead of `infernalDwarfBase`, and `ottomanBase` / `mughalBase` / `renaissanceBase` had no inference rules in `inferRosterForCulture`.
4. **Missing Force JSON Data:** 23 `rpgFantasy` cultures (including major Warhammer equivalents like **Ogre Kingdoms**, **Daemons of Chaos**, **Beastmen Brayherds**, and **Mootland Halflings**, plus RPG staples like Fey, Dragonborn, Celestials, Sea Elves, Elementals, Constructs, Eldritch Aberrations, and Primal Tribes) lacked force JSON data and fell back to generic `commonBase`.

This plan resolves every gap so all **44 `rpgFantasy` cultures** (43 existing + `Skaven (Ratmen)`) map to bespoke, asymmetric force rosters with zero `commonBase` fallbacks.

---

## 1. Culture Set Addition: `Skaven (Ratmen)`

Add **`Skaven (Ratmen)`** to the `rpgFantasy` culture set in [`src/generators/cultures-generator.ts`](../../src/generators/cultures-generator.ts):

| Culture | Base | odd | Habitat | Shield | Mapped Roster |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `Skaven (Ratmen)` | `GOBLI` (Goblin 36) | `0.65` | `habitat.underworld` | `pavise` | `skavenBase` (`skaven.json`) |

- Uses the existing `GOBLI` namebase (harsh, skittering subterranean syllables) to preserve the 11-base `RPG_BASES` invariant in `src/data/name-bases.test.ts`.
- Brings `rpgFantasy` from 43 defined cultures to **44 defined / 24 placed**.

---

## 2. Reassignments & Binding Fixes in Existing Rosters

Update `inferRosterForCulture` in [`src/conquest/engine/common/content.ts`](../../src/conquest/engine/common/content.ts) to fix culture-to-roster resolution order and regex coverage:

| Culture | Previous Resolution | New Resolution | Fix |
| :--- | :--- | :--- | :--- |
| **`Lich (Necromancer)`** | `vampireBase` | **`tombKingsBase`** (`tomb_kings.json`) | Move `lich\|necromanc` from `vampireBase` to `tombKingsBase` so Liches claim the Undying Sun-Dynasties while Vampires keep `vampireBase`. |
| **`Skaven (Ratmen)`** | *(not in set)* | **`skavenBase`** (`skaven.json`) | Matches existing `/(skaven\|ratmen\|vermin\|blight\|arachnid\|arago)/i`. |
| **`Duergar (Deep Dwarf)`** | `dwarfBase` | **`infernalDwarfBase`** (`infernal_dwarf.json`) | Add `duergar\|deep dwarf` to `infernalDwarfBase` check before generic `dwarfBase`. |
| **`Eastern Empire (Human)`** | `empireBase` *(misbound)* | **`eastAsiaBase`** (`east_asia.json`) | Evaluate `eastAsiaBase` (`/(eastern empire\|east asia\|cathay\|yamoto\|hantzu\|koryo\|guantzu)/i`) **before** `empireBase`. |
| **`Imperial (Human)`** | `commonBase` *(missed)* | **`empireBase`** (`empire.json`) | Add `imperial` to `/(empire\|imperial\|elector\|sigmar\|schwarzen)/i`. |
| **`Feudal (Human)`** | `commonBase` *(missed)* | **`chivalricBase`** (`chivalric.json`) | Add `feudal` to `/(chivalr\|feudal\|breton\|grail\|luarian)/i`. |
| **`Nordlander (Human)`** | `commonBase` *(missed)* | **`chaosBase`** (`chaos.json`) | Add `nordlander\|norse\|norsca` to `chaosBase` (Northland Marauders, Huscarls, War-Mammoths). |
| **`Desert Nomad (Human)`** | `steppeBase` | **`ottomanBase`** (`ottoman.json`) | Match `/(ottoman\|turchian\|turan\|desert nomad\|eurabic)/i` before generic `nomad` check. |
| **`Southern Kingdom (Human)`** | `commonBase` *(missed)* | **`mughalBase`** (`mughal.json`) | Match `/(mughal\|southern kingdom\|kiswaili\|yoruba)/i` (War Elephants, Shamshir Infantry, Zamburaks). |

---

## 3. New Force Roster JSON Specifications (12 New Rosters)

To cover all remaining cultures without falling back to `commonBase`, author **12 new roster JSON files** under `src/conquest/content/docs/rosters/` (expanding the catalog from 19 to **31 rosters**):

| Roster File | Roster ID | Display Name | Cultures Covered | Archetype & Playstyle Identity |
| :--- | :--- | :--- | :--- | :--- |
| `ogre.json` | `ogreBase` | **Maw-Tribe Ogre Kingdoms** | `Ogre`, `Troll`, `Yotunn (Giants)` | *Warhammer Ogre Kingdoms*: Low-block monstrous infantry (`0.06–0.08`), Gnoblar chaff (`0.22`), Leadbelchers, Mournfangs, Trolls, Butcher Gut-Casters, Stonehorns |
| `demon.json` | `demonBase` | **Legions of the Infernal Abyss** | `Demon (Fiend)`, `Tiefling (Fiendblood)` | *Warhammer Daemons of Chaos*: Hellblade Tieflings, Blood-Render Fiends, Brimstone Imps, Plague Hulks, Abyssal Pit-Fiends, Hell-Pact Warlocks, Soul-Grinders |
| `beastfolk.json` | `beastfolkBase` | **Primal Beastfolk War-Herds** | `Minotaur (Bullkin)`, `Lionkin (Catfolk)`, `Wolfkin (Werefolk)`, `Aarakocra (Birdfolk)` | *Beastmen Brayherds & Beastkin*: High-charge ambush packs, Lionkin Spears, Aarakocra Dive-Harriers, Werefolk Skin-Wolves (`heal`), Minotaurs, Bray-Shamans, Cygors |
| `halfling.json` | `halflingBase` | **Shire-Moot & Tinker Guilds** | `Halfling (Hobbit)`, `Gnome (Tinker)` | *The Mootland & Gnome Artificers*: Shire-Watch Spears, Master Slingers, Pony Bounders, Clockwork Tinkers, Illusionist Tricksters (`ward`/`hex`), Hot-Pot Catapults |
| `fey.json` | `feyBase` | **Seelie & Twilight Fey Courts** | `Fey (Fair Folk)`, `Sidhe (Lake Fey)` | *Feywild & Lake Sidhe*: Gossamer Blade-Dancers (`ward`), Pixie Dart-Swarms, Kelpie & Unicorn Lancers, Glamour Enchanters (`ward`/`heal`/`hex`), Faerie Dragons, Starlight Ballistas |
| `dragonborn.json` | `dragonbornBase` | **Draconic Flame-Citadels** | `Dragonborn`, `Rake (Drakonic)` | *Dragon-Blooded Legions*: Heavy scaled phalanxes (`resistArcane`), Breath-Weapon Vanguard, Drake-Knights, Dragon-Sorcerers, Elder Wyrms (`terror`), Dragonfire Bombards |
| `celestial.json` | `celestialBase` | **Radiant Celestial Host** | `Aasimar (Celestial)`, `Chosen (Oracle)` | *Angelic Host & Divine Oracles*: Sanctified Phalanxes (`resistArcane`), Sun-Bow Archers, Valkyrie Lancers, Oracle Hierophants (`ward`/`heal`), Seraphic Archons, Sunfire Reliquaries |
| `merfolk.json` | `merfolkBase` | **Pelagic Reef-Thalassocracies** | `Aelvar (Sea Elf)` | *Sea Elves & Deepkin*: Coral-Glaive Marines, Harpoon Crossbows, Hippocampus Lancers, Tide-Weaver Mystics (`ward`/`hex`), Abyssal Krakens, Torsion Harpoon-Engines |
| `elemental.json` | `elementalBase` | **Primordial Elemental Nexus** | `Genasi (Elemental)` | *Genasi & Elemental Conclaves*: Earth-Guard Infantry, Ember-Spark Bowmen, Zephyr Wind-Riders, Magma/Frost Myrmidons, Elementalists (`arcaneSiege`), Primordial Titans, Tempest Catapults |
| `construct.json` | `constructBase` | **Clockwork & Golem Foundries** | `Warforged (Construct)` | *Warforged & Arcane Golems*: High-armor, high-`resistArcane` forged cohorts, Repeater-Arm Arbalests, Clockwork Striders, Artificer Forgemasters (`heal`/`ward`), Adamantine Colossus, Steam-Mortars |
| `eldritch.json` | `eldritchBase` | **Void-Spawned Aberrant Synods** | `Aboleth (Eldritch)`, `Mindflayer (Eldritch)` | *Illithid & Aboleth Cults*: Mind-Thrall swarms, Psionic Mind-Blast Adepts (`hex`), Tentacle Horrors, Elder-Brain Savants (`hex`/`terror`/`arcaneSiege`), Void-Leviathans, Rift-Projectors |
| `tribal.json` | `tribalBase` | **Primal Wildland Confederacies** | `Jungle Tribe (Human)`, `Tundra Tribe (Human)`, `Islander (Human)` | *Primal Hunter-Tribes*: Hide-Shield Stalkers, Poison-Blowpipe & Bone-Bow Hunters, Raptor & Mammoth Outriders, Totem Shamans (`ward`/`heal`), Great War-Beasts, Fire-Pitch Throwers |

---

### 3.1 `ogre.json` (`ogreBase` — Maw-Tribe Ogre Kingdoms)
* **Inspiration:** *Warhammer: Ogre Kingdoms* & Giantkin (`Ogre`, `Troll`).
* **Units:**
  - `gnoblar_fighters` (*Scrap-Flint Gnoblar Mob*, `melee`, `0.22` blocks): `atk 4, def 6, chg 2, mis 0`
  - `ogre_bulls` (*Gut-Plate Ogre Bulls*, `melee`, `0.08` blocks): `atk 11, def 10, chg 9, mis 0`
  - `ironguts` (*Great-Mace Irongut Veterans*, `melee`, `0.06` blocks): `atk 14, def 13, chg 11, mis 0`, `requiresGood: 4`
  - `leadbelchers` (*Cannon-Tube Leadbelchers*, `ranged`, `0.06` blocks): `atk 8, def 9, chg 6, mis 15`, `requiresGood: 4`
  - `mournfang_cavalry` (*Mournfang Tusk-Cavalry*, `cavalry`, `0.05` blocks): `atk 14, def 13, chg 15, mis 0`, `powers: { terror: 0.04 }`
  - `river_trolls` (*Regenerating Bile-Trolls*, `monster`, `0.06` blocks): `atk 13, def 10, chg 8, mis 0`, `resistArcane: 0.15`, `powers: { heal: 10, terror: 0.04 }`
  - `stonehorn_behemoth` (*Frost-Peak Stonehorn & Thundertusk*, `monster`, `0.02` blocks): `atk 18, def 17, chg 16, mis 8`, `powers: { ward: 0.06, terror: 0.08 }`
  - `slaughter_butchers` (*Maw-Butchers & Firebellies*, `spellcaster`, `0.02` blocks): `atk 8, def 9, chg 4, mis 13`, `powers: { heal: 12, ward: 0.08, hex: 0.08 }`
  - `ironblaster` (*Rhinox-Drawn Ironblaster Cannon*, `artillery`, `0.03` blocks): `atk 9, def 10, chg 8, mis 18`, `requiresGood: 4`
  - *Garrisons:* `gnoblar_watch` (`melee`), `gnoblar_trappers` (`ranged`)

### 3.2 `demon.json` (`demonBase` — Legions of the Infernal Abyss)
* **Inspiration:** *Warhammer: Daemons of Chaos* & Fiendblood Legions (`Demon (Fiend)`, `Tiefling (Fiendblood)`).
* **Units:**
  - `tiefling_hellblades` (*Fiendblood Hellblade Vanguard*, `melee`, `0.15` blocks): `atk 9, def 10, chg 5, mis 0`, `resistArcane: 0.10`
  - `blood_renders` (*Crimson Bloodletter Fiends*, `melee`, `0.12` blocks): `atk 14, def 9, chg 9, mis 0`, `powers: { ward: 0.08, terror: 0.03 }`
  - `plague_hulks` (*Blight-Swollen Plaguebearers*, `melee`, `0.12` blocks): `atk 9, def 16, chg 3, mis 0`, `powers: { ward: 0.12, hex: 0.06, heal: 5 }`
  - `brimstone_imps` (*Warp-Flame Horrors & Imps*, `ranged`, `0.12` blocks): `atk 4, def 6, chg 1, mis 14`, `powers: { ward: 0.06, hex: 0.05 }`
  - `hellsteed_flayers` (*Juggernaut & Hellsteed Riders*, `cavalry`, `0.06` blocks): `atk 14, def 13, chg 15, mis 0`, `powers: { ward: 0.08, terror: 0.04 }`
  - `fiend_stalkers` (*Soporific Slaanesh-Fiends*, `monster`, `0.05` blocks): `atk 14, def 11, chg 12, mis 0`, `powers: { hex: 0.08, terror: 0.05 }`
  - `abyssal_pit_lord` (*Arch-Daemon of the Pit*, `monster`, `0.02` blocks): `atk 19, def 16, chg 16, mis 10`, `resistArcane: 0.20`, `powers: { ward: 0.10, terror: 0.09, arcaneSiege: 1 }`
  - `hellpact_warlocks` (*Infernal Pact-Sorcerers*, `spellcaster`, `0.02` blocks): `atk 5, def 7, chg 2, mis 17`, `powers: { hex: 0.14, ward: 0.06, arcaneSiege: 1 }`
  - `soul_grinder` (*Abyssal Soul-Grinder Engine*, `artillery`, `0.03` blocks): `atk 10, def 12, chg 6, mis 18`, `powers: { ward: 0.06, terror: 0.05, arcaneSiege: 1 }`
  - *Garrisons:* `cultist_thralls` (`melee`), `imp_firethrowers` (`ranged`)

### 3.3 `beastfolk.json` (`beastfolkBase` — Primal Beastfolk War-Herds)
* **Inspiration:** *Warhammer: Beastmen Brayherds* & RPG Beastkin (`Minotaur`, `Lionkin`, `Wolfkin`, `Aarakocra`).
* **Units:**
  - `gor_raiders` (*Wildhorn Pack-axes*, `melee`, `0.18` blocks): `atk 8, def 8, chg 7, mis 0`
  - `lionkin_spears` (*Savannah Mane-Guard Phalanx*, `melee`, `0.14` blocks): `atk 11, def 12, chg 8, mis 0`, `requiresGood: 4`
  - `aarakocra_harriers` (*Sky-Peak Javelin Harriers*, `ranged`, `0.10` blocks): `atk 7, def 7, chg 8, mis 13`
  - `centigor_chargers` (*Feral Centigor Outriders*, `cavalry`, `0.08` blocks): `atk 11, def 9, chg 13, mis 0`
  - `wolfkin_pack` (*Werefolk Skin-Wolf Berserkers*, `monster`, `0.06` blocks): `atk 14, def 10, chg 12, mis 0`, `powers: { heal: 6, terror: 0.04 }`
  - `minotaur_bloodgorgers` (*Blood-Gorged Bullkin Herd*, `monster`, `0.05` blocks): `atk 15, def 11, chg 14, mis 0`, `powers: { terror: 0.06 }`
  - `gorgon_behemoth` (*Four-Armed Herd-Ghorgon*, `monster`, `0.02` blocks): `atk 18, def 14, chg 15, mis 0`, `powers: { heal: 8, terror: 0.08 }`
  - `bray_shamans` (*Herdstone Bray-Shamans*, `spellcaster`, `0.02` blocks): `atk 5, def 6, chg 2, mis 14`, `powers: { hex: 0.12, ward: 0.08 }`
  - `cygor_hurler` (*Soul-Sight Cygor Boulder-Hurler*, `artillery`, `0.03` blocks): `atk 9, def 10, chg 6, mis 16`, `resistArcane: 0.25`, `powers: { terror: 0.05, arcaneSiege: 1 }`
  - *Garrisons:* `ungor_spears` (`melee`), `ungor_raiders` (`ranged`)

### 3.4 `halfling.json` (`halflingBase` — Shire-Moot & Tinker Guilds)
* **Inspiration:** *Mootland Halflings* & *Gnome Tinker Enclaves* (`Halfling`, `Gnome`).
* **Units:**
  - `shire_wardens` (*Mootland Pitchfork & Halberd Watch*, `melee`, `0.16` blocks): `atk 6, def 12, chg 2, mis 0`, `resistArcane: 0.15`
  - `burrow_billmen` (*Badger-Gate Heavy Billmen*, `melee`, `0.14` blocks): `atk 8, def 14, chg 3, mis 0`, `requiresGood: 4`, `resistArcane: 0.15`
  - `master_slingers` (*Skipper-Stone Master Slingers*, `ranged`, `0.15` blocks): `atk 3, def 7, chg 1, mis 12`, `resistArcane: 0.15`
  - `tinker_arbalests` (*Gnome Clockwork Repeater-Crossbows*, `ranged`, `0.12` blocks): `atk 4, def 8, chg 1, mis 15`, `requiresGood: 4`
  - `pony_bounders` (*Shire Pony & Ram-Rider Outriders*, `cavalry`, `0.08` blocks): `atk 9, def 10, chg 10, mis 5`
  - `clockwork_knights` (*Gnomish Steam-Suit Striders*, `monster`, `0.05` blocks): `atk 12, def 15, chg 10, mis 6`, `requiresGood: 4`
  - `war_wagon_pot` (*Armored Cook-Wagon & Steam Calliope*, `monster`, `0.03` blocks): `atk 11, def 16, chg 9, mis 12`, `powers: { heal: 8, ward: 0.08 }`
  - `illusion_tinkers` (*Gnome Illusionists & Alchemists*, `spellcaster`, `0.02` blocks): `atk 3, def 7, chg 1, mis 14`, `resistArcane: 0.20`, `powers: { ward: 0.14, hex: 0.10 }`
  - `hotpot_catapult` (*Mootland Boiling Hot-Pot & Bombards*, `artillery`, `0.04` blocks): `atk 2, def 5, chg 0, mis 16`, `powers: { hex: 0.06 }`
  - *Garrisons:* `moot_militia` (`melee`), `hedge_slingers` (`ranged`)

### 3.5 `fey.json` (`feyBase` — Seelie & Twilight Fey Courts)
* **Inspiration:** *Seelie / Unseelie Feywild* & *Sidhe of the Lake* (`Fey`, `Sidhe`).
* **Units:**
  - `gossamer_dancers` (*Gossamer Thorn-Bladedancers*, `melee`, `0.12` blocks): `atk 12, def 11, chg 7, mis 0`, `powers: { ward: 0.12 }`
  - `sidhe_spears` (*Silver-Mist Sidhe Phalanx*, `melee`, `0.14` blocks): `atk 9, def 14, chg 4, mis 0`, `resistArcane: 0.20`, `powers: { ward: 0.08 }`
  - `pixie_dartswarms` (*Glamour-Wing Pixie Dart Swarms*, `ranged`, `0.14` blocks): `atk 3, def 8, chg 2, mis 13`, `powers: { ward: 0.10, hex: 0.06 }`
  - `starlight_archers` (*Twilight Gossamer Longbows*, `ranged`, `0.10` blocks): `atk 5, def 7, chg 2, mis 16`
  - `kelpie_lancers` (*Lake-Kelpie & Stag Courser Knights*, `cavalry`, `0.06` blocks): `atk 13, def 12, chg 15, mis 0`, `powers: { ward: 0.08 }`
  - `unicorn_monarchs` (*Silverhorn Unicorn & Briar-Nymphs*, `monster`, `0.04` blocks): `atk 14, def 14, chg 14, mis 0`, `resistArcane: 0.25`, `powers: { ward: 0.10, heal: 8 }`
  - `faerie_drake` (*Prismatic Dream-Drake*, `monster`, `0.02` blocks): `atk 16, def 15, chg 13, mis 12`, `powers: { ward: 0.10, hex: 0.08, terror: 0.06 }`
  - `glamour_weavers` (*Archfey Enchanters of the Court*, `spellcaster`, `0.02` blocks): `atk 4, def 7, chg 1, mis 16`, `resistArcane: 0.25`, `powers: { ward: 0.14, hex: 0.12, heal: 10 }`
  - `moonbeam_arc` (*Moonlight Crystal Arc-Thrower*, `artillery`, `0.04` blocks): `atk 2, def 5, chg 0, mis 15`, `powers: { hex: 0.05 }`
  - *Garrisons:* `thorn_sentinels` (`melee`), `sprite_archers` (`ranged`)

### 3.6 `dragonborn.json` (`dragonbornBase` — Draconic Flame-Citadels)
* **Inspiration:** *Dragon-Blooded Empires & Elder Drakes* (`Dragonborn`, `Rake (Drakonic)`).
* **Units:**
  - `scaled_phalanx` (*Dragonscale Shield-Phalanx*, `melee`, `0.14` blocks): `atk 9, def 15, chg 4, mis 0`, `requiresGood: 4`, `resistArcane: 0.15`
  - `flamebreath_vanguard` (*Breath-Weapon Shock Greatswords*, `melee`, `0.12` blocks): `atk 13, def 13, chg 7, mis 8`, `requiresGood: 4`, `resistArcane: 0.15`
  - `wyrmbow_cohort` (*Dragonbone Greatbow Cohort*, `ranged`, `0.12` blocks): `atk 5, def 8, chg 2, mis 14`, `resistArcane: 0.10`
  - `drake_lancers` (*Wingless Guard-Drake Cavalry*, `cavalry`, `0.06` blocks): `atk 13, def 14, chg 14, mis 0`, `powers: { terror: 0.04 }`
  - `wyvern_riders` (*Sky-Peak Wyvern Riders*, `monster`, `0.04` blocks): `atk 15, def 13, chg 14, mis 6`, `powers: { terror: 0.05 }`
  - `elder_firewyrm` (*Ancient Sovereign Fire-Wyrm*, `monster`, `0.02` blocks): `atk 19, def 17, chg 16, mis 14`, `resistArcane: 0.25`, `powers: { ward: 0.08, terror: 0.09, arcaneSiege: 1 }`
  - `draconic_sorcerers` (*Bloodline Flame-Sorcerers*, `spellcaster`, `0.02` blocks): `atk 6, def 8, chg 2, mis 17`, `resistArcane: 0.20`, `powers: { ward: 0.08, hex: 0.12, arcaneSiege: 1 }`
  - `dragonfire_bombard` (*Bronze Dragonfire Cannon*, `artillery`, `0.04` blocks): `atk 3, def 6, chg 0, mis 18`, `requiresGood: 4`, `powers: { arcaneSiege: 1 }`
  - *Garrisons:* `scale_levy` (`melee`), `drake_crossbows` (`ranged`)

### 3.7 `celestial.json` (`celestialBase` — Radiant Celestial Host)
* **Inspiration:** *Angelic Host & Divine Oracle Sanctuaries* (`Aasimar`, `Chosen`).
* **Units:**
  - `sanctified_phalanx` (*Radiant Halo-Shield Phalanx*, `melee`, `0.14` blocks): `atk 8, def 16, chg 4, mis 0`, `resistArcane: 0.20`, `powers: { ward: 0.06 }`
  - `judicator_greatswords` (*Solar-Blade Judicators*, `melee`, `0.10` blocks): `atk 14, def 14, chg 7, mis 0`, `requiresGood: 4`, `powers: { ward: 0.08 }`
  - `sunbow_chorus` (*Aasimar Sun-Bow Archers*, `ranged`, `0.12` blocks): `atk 4, def 8, chg 1, mis 15`, `powers: { ward: 0.05 }`
  - `valkyrie_lancers` (*Winged Valkyrie & Pegasus Host*, `cavalry`, `0.06` blocks): `atk 14, def 13, chg 15, mis 0`, `powers: { ward: 0.08, heal: 4 }`
  - `solar_lions` (*Celestial Winged Sun-Lions*, `monster`, `0.04` blocks): `atk 15, def 14, chg 13, mis 0`, `powers: { ward: 0.08, terror: 0.05 }`
  - `seraph_archon` (*Six-Winged Seraphic Archon*, `monster`, `0.02` blocks): `atk 18, def 17, chg 15, mis 12`, `resistArcane: 0.30`, `powers: { ward: 0.14, heal: 10, terror: 0.07 }`
  - `oracle_hierophants` (*Chosen Oracles of the High See*, `spellcaster`, `0.02` blocks): `atk 4, def 8, chg 1, mis 15`, `resistArcane: 0.25`, `powers: { ward: 0.16, heal: 14, hex: 0.06 }`
  - `sunfire_reliquary` (*Lumen-Pillar Chariot & Sun-Engine*, `artillery`, `0.04` blocks): `atk 3, def 6, chg 0, mis 17`, `powers: { ward: 0.06, arcaneSiege: 1 }`
  - *Garrisons:* `temple_wardens` (`melee`), `acolyte_bows` (`ranged`)

### 3.8 `merfolk.json` (`merfolkBase` — Pelagic Reef-Thalassocracies)
* **Inspiration:** *Sea Elves, Tritons & Deepkin* (`Aelvar (Sea Elf)`).
* **Units:**
  - `coral_glaives` (*Coral-Clad Trident Phalanx*, `melee`, `0.15` blocks): `atk 7, def 14, chg 3, mis 0`
  - `abyssal_reavers` (*Trench-Blade Shock Marines*, `melee`, `0.12` blocks): `atk 13, def 11, chg 7, mis 0`
  - `riptide_bows` (*Pelagic Spine-Bowmen*, `ranged`, `0.12` blocks): `atk 4, def 7, chg 1, mis 14`
  - `hippocampus_lancers` (*Crested Hippocampus & Eel Knights*, `cavalry`, `0.07` blocks): `atk 12, def 12, chg 14, mis 0`, `powers: { ward: 0.06 }`
  - `leviathan_turtle` (*Armored Reef-Leviathan Shell*, `monster`, `0.03` blocks): `atk 14, def 18, chg 11, mis 10`, `powers: { ward: 0.08, terror: 0.06 }`
  - `abyssal_kraken` (*Trench-Spawned War-Kraken*, `monster`, `0.02` blocks): `atk 18, def 15, chg 14, mis 0`, `powers: { heal: 8, terror: 0.08 }`
  - `tide_weavers` (*Maelstrom Tide-Caller Mystics*, `spellcaster`, `0.02` blocks): `atk 4, def 6, chg 1, mis 15`, `powers: { ward: 0.12, hex: 0.10, heal: 8, arcaneSiege: 1 }`
  - `harpoon_ballista` (*Torsion Reef-Harpoon Battery*, `artillery`, `0.04` blocks): `atk 2, def 5, chg 0, mis 16`
  - *Garrisons:* `reef_spears` (`melee`), `shell_skirmishers` (`ranged`)

### 3.9 `elemental.json` (`elementalBase` — Primordial Elemental Nexus)
* **Inspiration:** *Genasi & Primordial Elemental Conclaves* (`Genasi`).
* **Units:**
  - `terralith_guard` (*Basalt & Granite-Heart Infantry*, `melee`, `0.14` blocks): `atk 8, def 17, chg 4, mis 0`, `resistArcane: 0.20`, `powers: { ward: 0.06 }`
  - `ignis_blademasters` (*Cinder-Blade Flame Dancers*, `melee`, `0.12` blocks): `atk 14, def 10, chg 8, mis 0`, `powers: { hex: 0.05 }`
  - `spark_bowmen` (*Storm-Arc & Ember Bowmen*, `ranged`, `0.12` blocks): `atk 4, def 7, chg 1, mis 15`
  - `zephyr_striders` (*Gale-steed Wind-Riders*, `cavalry`, `0.07` blocks): `atk 11, def 10, chg 14, mis 6`, `powers: { ward: 0.06 }`
  - `magma_myrmidons` (*Bound Frost & Magma Myrmidons*, `monster`, `0.05` blocks): `atk 14, def 14, chg 11, mis 0`, `powers: { ward: 0.08, terror: 0.04 }`
  - `primordial_titan` (*Colossal Caldera & Storm Titan*, `monster`, `0.02` blocks): `atk 18, def 17, chg 15, mis 12`, `resistArcane: 0.25`, `powers: { ward: 0.10, terror: 0.08, arcaneSiege: 1 }`
  - `nexus_conclave` (*Primordial Elementalist Conclave*, `spellcaster`, `0.02` blocks): `atk 4, def 7, chg 1, mis 18`, `resistArcane: 0.20`, `powers: { hex: 0.14, ward: 0.08, arcaneSiege: 2 }`
  - `tempest_catapult` (*Fulminating Lightning-Thrower*, `artillery`, `0.04` blocks): `atk 2, def 5, chg 0, mis 18`, `powers: { arcaneSiege: 1 }`
  - *Garrisons:* `stone_watch` (`melee`), `cinder_slings` (`ranged`)

### 3.10 `construct.json` (`constructBase` — Clockwork & Golem Foundries)
* **Inspiration:** *Warforged & Arcane Golem Foundries* (`Warforged`).
* **Units:**
  - `ironwrought_cohorts` (*Ironwrought Bulwark Cohorts*, `melee`, `0.14` blocks): `atk 8, def 16, chg 3, mis 0`, `requiresGood: 4`, `resistArcane: 0.25`
  - `runeblade_juggernauts` (*Heavy Piston-Glaive Juggernauts*, `melee`, `0.10` blocks): `atk 13, def 15, chg 7, mis 0`, `requiresGood: 4`, `resistArcane: 0.25`
  - `arbalest_automatons` (*Integrated Repeater-Arm Automatons*, `ranged`, `0.12` blocks): `atk 4, def 9, chg 1, mis 14`, `requiresGood: 4`, `resistArcane: 0.20`
  - `clockwork_chargers` (*Brass-Steed Lancer Constructs*, `cavalry`, `0.06` blocks): `atk 12, def 14, chg 14, mis 0`, `requiresGood: 4`, `resistArcane: 0.20`
  - `shield_guardians` (*Runic Shield-Guardian Golems*, `monster`, `0.05` blocks): `atk 13, def 17, chg 9, mis 0`, `resistArcane: 0.30`, `powers: { ward: 0.12 }`
  - `adamantine_colossus` (*Foundry-Forged Adamantine Colossus*, `monster`, `0.02` blocks): `atk 18, def 19, chg 14, mis 8`, `resistArcane: 0.35`, `powers: { ward: 0.10, terror: 0.08, arcaneSiege: 1 }`
  - `artificer_forgemasters` (*Grand Artificers & Repair Drones*, `spellcaster`, `0.02` blocks): `atk 6, def 10, chg 2, mis 13`, `resistArcane: 0.25`, `powers: { heal: 14, ward: 0.12 }`
  - `steam_mortar` (*High-Pressure Foundry Bombard*, `artillery`, `0.04` blocks): `atk 2, def 6, chg 0, mis 19`, `requiresGood: 4`, `powers: { arcaneSiege: 1 }`
  - *Garrisons:* `sentry_automatons` (`melee`), `bolt_turrets` (`ranged`)

### 3.11 `eldritch.json` (`eldritchBase` — Void-Spawned Aberrant Synods)
* **Inspiration:** *Mindflayer Synods & Aboleth Deep-Cults* (`Aboleth`, `Mindflayer`).
* **Units:**
  - `mind_thralls` (*Enthralled Husk-Host*, `melee`, `0.20` blocks): `atk 5, def 8, chg 2, mis 0`
  - `deep_scions` (*Chitin-Clawed Deep Scions*, `melee`, `0.12` blocks): `atk 11, def 12, chg 6, mis 0`, `powers: { hex: 0.05 }`
  - `psionic_adepts` (*Mind-Blast Psionic Thralls*, `ranged`, `0.10` blocks): `atk 4, def 6, chg 1, mis 14`, `resistArcane: 0.20`, `powers: { hex: 0.08, terror: 0.03 }`
  - `void_skimmers` (*Phase-Spider & Tentacle Outriders*, `cavalry`, `0.06` blocks): `atk 12, def 10, chg 13, mis 0`, `powers: { ward: 0.08, terror: 0.04 }`
  - `chuul_aberrations` (*Pincer-Shell Chuul Horrors*, `monster`, `0.05` blocks): `atk 14, def 13, chg 10, mis 0`, `resistArcane: 0.20`, `powers: { hex: 0.06, terror: 0.05 }`
  - `aboleth_leviathan` (*Ancient Aboleth & Elder Brain-Drake*, `monster`, `0.02` blocks): `atk 17, def 15, chg 13, mis 12`, `resistArcane: 0.30`, `powers: { ward: 0.10, hex: 0.10, terror: 0.09 }`
  - `illithid_savants` (*Illithid Arcanist Synod*, `spellcaster`, `0.02` blocks): `atk 5, def 7, chg 1, mis 17`, `resistArcane: 0.30`, `powers: { hex: 0.16, terror: 0.06, arcaneSiege: 1 }`
  - `rift_projector` (*Far-Realm Void-Rift Engine*, `artillery`, `0.03` blocks): `atk 2, def 4, chg 0, mis 17`, `powers: { hex: 0.06, arcaneSiege: 1 }`
  - *Garrisons:* `thrall_watch` (`melee`), `cult_slingers` (`ranged`)

### 3.12 `tribal.json` (`tribalBase` — Primal Wildland Confederacies)
* **Inspiration:** *Jungle, Tundra & Archipelago Hunter-Tribes* (`Jungle Tribe`, `Tundra Tribe`, `Islander`).
* **Units:**
  - `hide_warriors` (*Hide-Shield Club & Spear Braves*, `melee`, `0.18` blocks): `atk 7, def 10, chg 5, mis 0`
  - `jaguar_stalkers` (*Obsidian-Macuahuitl Ambushers*, `melee`, `0.14` blocks): `atk 12, def 9, chg 8, mis 0`
  - `blowpipe_hunters` (*Venom-Dart & Bone-Bow Hunters*, `ranged`, `0.15` blocks): `atk 4, def 6, chg 2, mis 12`, `powers: { hex: 0.05 }`
  - `outrigger_harpoons` (*Whalebone Harpoon Javelineers*, `ranged`, `0.12` blocks): `atk 6, def 7, chg 4, mis 11`
  - `beast_outriders` (*Raptor & Reindeer-Stag Outriders*, `cavalry`, `0.08` blocks): `atk 10, def 9, chg 12, mis 4`
  - `totem_warbeasts` (*Great White-Bear & Jungle Tiger Pack*, `monster`, `0.05` blocks): `atk 14, def 11, chg 12, mis 0`, `powers: { terror: 0.05 }`
  - `thunder_mammoth` (*Tundra War-Mammoth & Behemoth*, `monster`, `0.02` blocks): `atk 17, def 16, chg 15, mis 6`, `powers: { terror: 0.08 }`
  - `spirit_shamans` (*Totem Spirit-Walkers & Witch-Doctors*, `spellcaster`, `0.02` blocks): `atk 4, def 6, chg 1, mis 13`, `resistArcane: 0.15`, `powers: { ward: 0.12, heal: 12, hex: 0.08 }`
  - `pitch_throwers` (*Fire-Pitch Tension Catapults*, `artillery`, `0.04` blocks): `atk 2, def 4, chg 0, mis 14`
  - *Garrisons:* `tribal_spears` (`melee`), `tribal_bows` (`ranged`)

---

## 4. Complete 44-Culture `rpgFantasy` → Force Roster Matrix

After implementing Phases 1–3, every single culture in `rpgFantasy` resolves deterministically to a dedicated force roster:

| Category | Culture Name | Base ID | Resolved Roster ID | Roster File |
| :--- | :--- | :---: | :--- | :--- |
| **Elves & kin** | `Quenar (High Elf)` | `ELVEN` | `elfBase` | `elf.json` |
| | `Sylvan (Wood Elf)` | `ELVEN` | `woodElfBase` | `wood_elf.json` |
| | `Drow (Dark Elf)` | `DARKE` | `darkElfBase` | `dark_elf.json` |
| | `Aelvar (Sea Elf)` | `MERFO` | `merfolkBase` | `merfolk.json` *(new)* |
| **Dwarves & smallfolk** | `Khazad (Mountain Dwarf)` | `DWARV` | `dwarfBase` | `dwarf.json` |
| | `Hearthdwarf (Hill Dwarf)` | `DWARV` | `dwarfBase` | `dwarf.json` |
| | `Duergar (Deep Dwarf)` | `DWARV` | `infernalDwarfBase` | `infernal_dwarf.json` *(rebound)* |
| | `Halfling (Hobbit)` | `HALFL` | `halflingBase` | `halfling.json` *(new)* |
| | `Gnome (Tinker)` | `HALFL` | `halflingBase` | `halfling.json` *(new)* |
| **Goblinoids, giants & dragonspawn** | `Orc` | `ORCIS` | `orcBase` | `orc.json` |
| | `Goblin` | `GOBLI` | `orcBase` | `orc.json` |
| | `Hobgoblin (Legion)` | `ORCIS` | `orcBase` | `orc.json` |
| | `Kobold` | `GOBLI` | `orcBase` | `orc.json` |
| | `Skaven (Ratmen)` *(new)* | `GOBLI` | `skavenBase` | `skaven.json` *(claimed)* |
| | `Troll` | `GIANT` | `ogreBase` | `ogre.json` *(new)* |
| | `Ogre` | `GIANT` | `ogreBase` | `ogre.json` *(new)* |
| | `Dragonborn` | `DRACO` | `dragonbornBase` | `dragonborn.json` *(new)* |
| | `Lizardfolk` | `SERPE` | `lizardmenBase` | `lizardmen.json` |
| **Beastfolk & fey** | `Lionkin (Catfolk)` | `BEAST` | `beastfolkBase` | `beastfolk.json` *(new)* |
| | `Wolfkin (Werefolk)` | `BEAST` | `beastfolkBase` | `beastfolk.json` *(new)* |
| | `Aarakocra (Birdfolk)` | `BEAST` | `beastfolkBase` | `beastfolk.json` *(new)* |
| | `Minotaur (Bullkin)` | `GIANT` | `beastfolkBase` | `beastfolk.json` *(new)* |
| | `Fey (Fair Folk)` | `FEYFO` | `feyBase` | `fey.json` *(new)* |
| | `Sidhe (Lake Fey)` | `FEYFO` | `feyBase` | `fey.json` *(new)* |
| | `Genasi (Elemental)` | `ELEME` | `elementalBase` | `elemental.json` *(new)* |
| **Dark powers & divine** | `Tiefling (Fiendblood)` | `INFER` | `demonBase` | `demon.json` *(new)* |
| | `Demon (Fiend)` | `INFER` | `demonBase` | `demon.json` *(new)* |
| | `Vampire (Nightblood)` | `GRAVE` | `vampireBase` | `vampire.json` |
| | `Lich (Necromancer)` | `GRAVE` | `tombKingsBase` | `tomb_kings.json` *(claimed)* |
| | `Aasimar (Celestial)` | `CELES` | `celestialBase` | `celestial.json` *(new)* |
| | `Chosen (Oracle)` | `CELES` | `celestialBase` | `celestial.json` *(new)* |
| **Constructs & aberrations** | `Warforged (Construct)` | `CONST` | `constructBase` | `construct.json` *(new)* |
| | `Aboleth (Eldritch)` | `ELDRI` | `eldritchBase` | `eldritch.json` *(new)* |
| | `Mindflayer (Eldritch)` | `ELDRI` | `eldritchBase` | `eldritch.json` *(new)* |
| **Humans** | `Imperial (Human)` | `ROMAN` | `empireBase` | `empire.json` *(rebound)* |
| | `Feudal (Human)` | `HUMAN` | `chivalricBase` | `chivalric.json` *(rebound)* |
| | `Nordlander (Human)` | `NORDI` | `chaosBase` | `chaos.json` *(rebound)* |
| | `Steppe Rider (Human)` | `MONGO` | `steppeBase` | `steppe.json` |
| | `Desert Nomad (Human)` | `ARABI` | `ottomanBase` | `ottoman.json` *(rebound)* |
| | `Islander (Human)` | `HAWAI` | `tribalBase` | `tribal.json` *(new)* |
| | `Jungle Tribe (Human)` | `TRIBA` | `tribalBase` | `tribal.json` *(new)* |
| | `Tundra Tribe (Human)` | `TRIBA` | `tribalBase` | `tribal.json` *(new)* |
| | `Eastern Empire (Human)` | `JAPAN` | `eastAsiaBase` | `east_asia.json` *(rebound)* |
| | `Southern Kingdom (Human)` | `SWAHI` | `mughalBase` | `mughal.json` *(rebound)* |

---

## 5. Phased Implementation Checklist

1. **Phase 1 — Add `Skaven (Ratmen)` to `rpgFantasy` Culture Set:**
   - Add `{ name: "Skaven (Ratmen)", base: "GOBLI", odd: 0.65, sort: habitat.underworld, shield: "pavise" }` in [`src/generators/cultures-generator.ts`](../../src/generators/cultures-generator.ts).
   - Update [`docs/plans/rpg-fantasy-cultures.md`](rpg-fantasy-cultures.md) and the 44-culture count assertion in [`src/data/name-bases.test.ts`](../../src/data/name-bases.test.ts).
2. **Phase 2 — Author the 12 Missing Force Roster JSON Files:**
   - Create `ogre.json`, `demon.json`, `beastfolk.json`, `halfling.json`, `fey.json`, `dragonborn.json`, `celestial.json`, `merfolk.json`, `elemental.json`, `construct.json`, `eldritch.json`, and `tribal.json` in `src/conquest/content/docs/rosters/`.
   - Register all 12 new rosters in [`src/conquest/content/bundled.ts`](../../src/conquest/content/bundled.ts) and `DEFAULT_ROSTER_MAP` in [`src/conquest/engine/common/content.ts`](../../src/conquest/engine/common/content.ts).
3. **Phase 3 — Update `inferRosterForCulture` & Reassign Tomb Kings / Existing Rosters:**
   - Reassign `Lich (Necromancer)` to `tombKingsBase`, `Duergar (Deep Dwarf)` to `infernalDwarfBase`, `Imperial (Human)` to `empireBase`, `Feudal (Human)` to `chivalricBase`, `Nordlander (Human)` to `chaosBase`, `Eastern Empire (Human)` to `eastAsiaBase`, `Desert Nomad (Human)` to `ottomanBase`, and `Southern Kingdom (Human)` to `mughalBase`.
   - Wire all 12 new roster IDs into `inferRosterForCulture`.
4. **Phase 4 — Verification & Documentation:**
   - Add full test coverage in [`src/conquest/test/content.test.ts`](../../src/conquest/test/content.test.ts) verifying that all 31 rosters validate cleanly and all 44 `rpgFantasy` cultures resolve to their dedicated non-default force rosters.
   - Update [`docs/openconquest/README.md`](../openconquest/README.md) with the expanded 31-roster catalog.
