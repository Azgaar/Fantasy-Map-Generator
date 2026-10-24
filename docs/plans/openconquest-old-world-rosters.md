# Plan — Phase 5: *Warhammer: The Old World* Equivalent Faction Rosters

**Status:** Completed  
**Updated:** 2026-10-24  
**Prerequisite / Companion Plan:** [**`openconquest-magic-system.md`**](openconquest-magic-system.md) *(Phases 1–4: `spellcaster` & `monster` categories, 6×6 `MATCHUP` matrix, declarative `powers`, and `resistArcane`)*  
**Context:** Once the Magic & Monster system from [`openconquest-magic-system.md`](openconquest-magic-system.md) is in place, Phase 5 expands `src/conquest/content/docs/rosters/` to cover the complete lineup of *Warhammer: The Old World* factions using legally distinct, lore-evocative names and asymmetric mechanics.

---

## 1. Roster Lineup Overview

| Roster File | Roster ID | Display Name | *Old World* Archetype | Signature Playstyle & Magic Identity |
| :--- | :--- | :--- | :--- | :--- |
| **Upgraded Existing Rosters** | | | | |
| [`dwarf.json`](../../src/conquest/content/docs/rosters/dwarf.json) | `dwarfBase` | **Karaz Mountain Holds** | Dwarfen Mountain Holds | High armor, zero cavalry, innate `resistArcane`, Runesmith `ward` anvils, black-powder & gyro artillery |
| [`elf.json`](../../src/conquest/content/docs/rosters/elf.json) | `elfBase` | **Highborne Elven Realms** | High Elf Realms | Disciplined spears/bows, Phoenix `ward` infantry, High Magic Archmages (`ward`/`heal`/`arcaneSiege`), Star-Drakes |
| [`orc.json`](../../src/conquest/content/docs/rosters/orc.json) | `orcBase` | **Orc & Goblin War-Tribes** | Orc & Goblin Tribes | Cheap aggressive mobs, Black Orc elites, regenerating Trolls, Waaagh! Shamans (`hex`), Giants & Arachnaroks |
| **New Old World Rosters** | | | | |
| `empire.json` | `empireBase` | **Grand Electoral Empire** | Empire of Man | Combined-arms halberds & handgunners, War-Priests (`ward`/`heal`), Collegiate Battle Wizards, Gryphons & Steam Tanks |
| `chivalric.json` | `chivalricBase` | **Kingdom of the Sacred Grail** | Kingdom of Bretonnia | Peasant anvil + blessed Grail & Pegasus Knight hammer, Chalice Damsels (`ward`/`heal`), Royal Hippogryphs |
| `wood_elf.json` | `woodElfBase` | **Sylvan Deepwood Realms** | Wood Elf Realms | Elite Waywatcher archers, Wild Stag cavalry, Spellsingers (`ward`/`heal`/`hex`), Ancient Treemen & War-Hawks |
| `tomb_kings.json` | `tombKingsBase` | **Undying Sun-Dynasties** | Tomb Kings of Khemri | Unbreakable skeletal legions, massed chariots, Mortuary Priests (`heal`), Ushabti, Necrosphinxes & Skull Catapults |
| `vampire.json` | `vampireBase` | **Vampiric Blood-Counts** | Vampire Counts | Zero ranged troops; zombies/skeletons, ethereal Wraiths (`ward`/`terror`), Blood Knights, Necromancers (`heal`), Terrorgheists |
| `chaos.json` | `chaosBase` | **Hordes of the Ruinous Wastes** | Warriors of Chaos & Beastmen | Elite Chosen & Chaos Knights, Minotaurs, War-Mammoths (`terror`), Sorcerers of Ruin (`hex`), Hellcannons |
| `dark_elf.json` | `darkElfBase` | **Dread-Corsair Principalities** | Dark Elves | Armor-piercing repeater crossbows, frenzied Witch Elves, Raptor Knights, Dark Covens (`hex`), regenerating War Hydras |
| `skaven.json` | `skavenBase` | **Blighted Under-Empire** | Skaven | Massive Clanrat swarms (`blocks: 0.25`), Warplock Jezzails, Rat Ogres, Hell-Pit Abominations, Grey Seers & Warp-Cannons |
| `lizardmen.json` | `lizardmenBase` | **Saurian Temple-Cities** | Lizardmen | Cold-blooded Saurus cohorts, poison Skinks, Primeval Dinosaurs (Stegadons, Carnosaurs), apex Slann Star-Priests |
| `infernal_dwarf.json` | `infernalDwarfBase` | **Infernal Forge-Citadels** | Chaos Dwarfs | Blunderbuss firing lines, hobgoblin levies, Bull Centaurs, K'daai Fire-Daemons, Sorcerer-Prophets & Dreadquake Mortars |

---

## 2. Upgraded Existing Fantasy Rosters

### 2.1 `dwarf.json` (`dwarfBase` — Karaz Mountain Holds)
* **Faction Identity:** Unyielding mountain infantry and master engineers who spurn sorcery in favor of Runes of Warding and Spellbreaking (`resistArcane`).
* **Unit Pool:**

| Unit ID | Name | Category | Blocks (Men) | Atk / Def / Chg / Mis | Magic (`powers` & `resistArcane`) |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `dwarf_axe` | Dwarf Axemen | `melee` | 0.15 (150) | 7 / 13 / 3 / 0 | `resistArcane: 0.15` |
| `dwarf_crossbow` | Quarreller Crossbows | `ranged` | 0.12 (120) | 3 / 7 / 1 / 12 | `resistArcane: 0.15` |
| `thunderers` | Dwarf Thunderers | `ranged` | 0.12 (120) | 4 / 8 / 1 / 14 | `resistArcane: 0.15` |
| `ironbreakers` | Gromril Ironwardens | `melee` | 0.12 (120) | 9 / 18 / 3 / 3 | `resistArcane: 0.25`, `ward: 0.06` |
| `hammerers` | King's Hammerguard | `melee` | 0.12 (120) | 13 / 14 / 6 / 0 | `resistArcane: 0.20` |
| `dwarf_slayer` | Oathbound Slayers | `melee` | 0.10 (100) | 13 / 9 / 7 / 0 | `resistArcane: 0.15` |
| `runesmith_anvil` | Runelord & Anvil Guard | `spellcaster` | 0.02 (20) | 8 / 14 / 2 / 10 | `resistArcane: 0.35`, `ward: 0.14`, `hex: 0.06` |
| `gyro_bombard` | Steam-Copter Squadron | `cavalry` | 0.04 (40) | 7 / 10 / 9 / 12 | Fast aerial outriders |
| `organ_gun` | Multi-Barrel Organ Gun | `artillery` | 0.04 (40) | 3 / 5 / 0 / 18 | `resistArcane: 0.15` |

### 2.2 `elf.json` (`elfBase` — Highborne Elven Realms)
* **Faction Identity:** Ancient island-kingdom masters of combined arms, sacred wards, High Magic, and dragon-riding princes.
* **Unit Pool:**

| Unit ID | Name | Category | Blocks (Men) | Atk / Def / Chg / Mis | Magic (`powers` & `resistArcane`) |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `elf_spears` | Highborne Spearmen | `melee` | 0.15 (150) | 6 / 14 / 3 / 0 | — |
| `elf_archers` | Highborne Longbows | `ranged` | 0.12 (120) | 4 / 6 / 1 / 13 | — |
| `lott_seaguard` | Sea-Wardens (Spear & Bow) | `ranged` | 0.12 (120) | 7 / 11 / 2 / 11 | Hybrid melee/ranged |
| `swordmasters` | Blademasters of the White Tower | `melee` | 0.10 (100) | 14 / 13 / 6 / 0 | `resistArcane: 0.15` |
| `phoenix_guard` | Sanctuary Halberdiers | `melee` | 0.10 (100) | 10 / 17 / 4 / 0 | `ward: 0.12`, `terror: 0.03` |
| `elf_riders` | Elven Reaver Outriders | `cavalry` | 0.08 (80) | 9 / 9 / 10 / 6 | — |
| `dragon_princes` | Drake-Crested Heavy Lancers | `cavalry` | 0.06 (60) | 13 / 13 / 14 / 0 | `ward: 0.06` |
| `high_archmage` | High Magic Conclave | `spellcaster` | 0.02 (20) | 4 / 6 / 1 / 16 | `resistArcane: 0.20`, `ward: 0.12`, `hex: 0.08`, `heal: 8`, `arcaneSiege: 1` |
| `star_dragon` | Star-Drake & Frost-Phoenix | `monster` | 0.02 (20) | 18 / 16 / 15 / 12 | `ward: 0.06`, `terror: 0.08` |
| `elf_bolt` | Eagle-Claw Bolt Throwers | `artillery` | 0.04 (40) | 2 / 4 / 0 / 14 | — |

### 2.3 `orc.json` (`orcBase` — Orc & Goblin War-Tribes)
* **Faction Identity:** Unruly green tides backed by armored Black Orcs, regenerating River Trolls, Waaagh! Shamans, and towering Giants/Arachnaroks.
* **Unit Pool:**

| Unit ID | Name | Category | Blocks (Men) | Atk / Def / Chg / Mis | Magic (`powers` & `resistArcane`) |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `orc_boyz` | Orc Boyz | `melee` | 0.18 (180) | 8 / 8 / 5 / 0 | — |
| `black_orcs` | Iron-Clad Big 'Uns | `melee` | 0.12 (120) | 13 / 13 / 7 / 0 | — |
| `night_fanatics` | Cave-Goblin Whirling Fanatics | `melee` | 0.15 (150) | 14 / 4 / 10 / 0 | `hex: 0.04` |
| `orc_archers` | Arrer Boyz | `ranged` | 0.14 (140) | 4 / 4 / 1 / 9 | — |
| `warg_riders` | Wolf & Spider Riders | `cavalry` | 0.08 (80) | 10 / 7 / 10 / 4 | — |
| `boar_boyz` | War-Boar Savage Riders | `cavalry` | 0.08 (80) | 11 / 10 / 13 / 0 | — |
| `troll` | River & Stone Trolls | `monster` | 0.06 (60) | 13 / 10 / 8 / 0 | `resistArcane: 0.15`, `heal: 10`, `terror: 0.04` |
| `arachnarok` | Colossal Cave-Spider & Giant | `monster` | 0.02 (20) | 17 / 15 / 13 / 8 | `terror: 0.08` |
| `waaagh_shaman` | Waaagh! Shaman Cabal | `spellcaster` | 0.02 (20) | 5 / 5 / 2 / 15 | `hex: 0.12`, `arcaneSiege: 1` |
| `siege_bow` | Rock Lobbers & Doom-Divers | `artillery` | 0.04 (40) | 2 / 3 / 0 / 15 | — |

---

## 3. Detailed Specifications for New *Old World* Rosters

### 3.1 `empire.json` (`empireBase` — Grand Electoral Empire)
* **Inspiration:** The Empire of Man (State Troops, Nuln Gunnery, Knights of the Inner Circle, Warrior Priests of Sigmar, Imperial Colleges of Magic, Steam Tanks).
* **Units:**
  - `state_halberdiers` (*Electoral Halberdiers*, `melee`, `0.16` blocks): `atk 7, def 13, chg 3, mis 0`
  - `state_handgunners` (*Nuln State Handgunners*, `ranged`, `0.12` blocks): `atk 3, def 5, chg 1, mis 14`
  - `elector_greatswords` (*Elector's Stubborn Greatswords*, `melee`, `0.12` blocks): `atk 12, def 13, chg 6, mis 0`
  - `outrider_pistoleers` (*Outrider Repeaters*, `cavalry`, `0.06` blocks): `atk 7, def 8, chg 6, mis 11`
  - `inner_circle_knights` (*Grand Order Knights*, `cavalry`, `0.06` blocks): `atk 11, def 13, chg 13, mis 0`
  - `demigryph_knights` (*Demigryph Halberd-Knights*, `monster`, `0.04` blocks): `atk 14, def 14, chg 14, mis 0`, `powers: { terror: 0.04 }`
  - `templar_priests` (*Hammer-Priests & War-Altar*, `spellcaster`, `0.03` blocks): `atk 9, def 11, chg 4, mis 8`, `powers: { ward: 0.10, heal: 6 }`
  - `collegiate_wizards` (*Collegiate Battle Wizards*, `spellcaster`, `0.02` blocks): `atk 3, def 4, chg 0, mis 17`, `powers: { hex: 0.10, arcaneSiege: 1 }`
  - `steam_behemoth` (*Ironclad Steam Tank*, `monster`, `0.02` blocks): `atk 14, def 18, chg 14, mis 14`, `powers: { terror: 0.06 }`
  - `helstorm_battery` (*Helblaster & Rocket Battery*, `artillery`, `0.04` blocks): `atk 2, def 4, chg 0, mis 18`
  - *Garrisons:* `militia_spears`, `free_company_crossbows`

### 3.2 `chivalric.json` (`chivalricBase` — Kingdom of the Sacred Grail)
* **Inspiration:** Kingdom of Bretonnia (Peasant Men-at-Arms & Longbowmen, Lance formation Knights, Grail Knights, Pegasus Knights, Hippogryphs, Damsels of the Lady).
* **Units:**
  - `men_at_arms` (*Feudal Men-at-Arms*, `melee`, `0.18` blocks): `atk 5, def 11, chg 2, mis 0`
  - `peasant_longbows` (*Yeoman Stake-Bowmen*, `ranged`, `0.14` blocks): `atk 3, def 5, chg 1, mis 11`
  - `battle_pilgrims` (*Grail Reliquae Zealots*, `melee`, `0.14` blocks): `atk 8, def 12, chg 4, mis 0`, `powers: { ward: 0.06 }`
  - `knights_errant` (*Knights of the Lance*, `cavalry`, `0.08` blocks): `atk 10, def 11, chg 12, mis 0`
  - `questing_knights` (*Vow-Sworn Greatsword Knights*, `cavalry`, `0.06` blocks): `atk 13, def 12, chg 12, mis 0`
  - `grail_knights` (*Living Saints of the Chalice*, `cavalry`, `0.06` blocks): `atk 15, def 14, chg 16, mis 0`, `powers: { ward: 0.12, heal: 4 }`
  - `pegasus_knights` (*Royal Pegasus Lancers*, `monster`, `0.04` blocks): `atk 13, def 12, chg 15, mis 0`
  - `hippogryph_lords` (*Hippogryph Companions*, `monster`, `0.02` blocks): `atk 16, def 14, chg 15, mis 0`, `powers: { terror: 0.07 }`
  - `chalice_damsels` (*Prophetesses of the Lady*, `spellcaster`, `0.02` blocks): `atk 3, def 6, chg 1, mis 13`, `resistArcane: 0.20`, `powers: { ward: 0.15, heal: 10 }`
  - `blessed_trebuchet` (*Field Trebuchet*, `artillery`, `0.04` blocks): `atk 2, def 3, chg 0, mis 15`
  - *Garrisons:* `peasant_spear_levy`, `bowmen_levy`

### 3.3 `wood_elf.json` (`woodElfBase` — Sylvan Deepwood Realms)
* **Inspiration:** Wood Elf Realms (Athel Loren — Glade Guard, Waywatchers, Wardancers, Wild Riders of Kurnous, Dryads, Treemen, Spellsingers).
* **Units:**
  - `eternal_guard` (*Deepwood Eternal Spears*, `melee`, `0.14` blocks): `atk 8, def 14, chg 3, mis 0`
  - `dryad_spirits` (*Briar-Dryad Nymphs*, `melee`, `0.12` blocks): `atk 11, def 11, chg 6, mis 0`, `powers: { ward: 0.08, terror: 0.03 }`
  - `wardancers` (*Bladedancer Troupe*, `melee`, `0.10` blocks): `atk 14, def 9, chg 8, mis 0`, `powers: { ward: 0.10 }`
  - `glade_guard` (*Sylvan Starlight Archers*, `ranged`, `0.12` blocks): `atk 4, def 6, chg 1, mis 14`
  - `waywatchers` (*Shadow-Canopy Waywatchers*, `ranged`, `0.08` blocks): `atk 7, def 8, chg 2, mis 17`
  - `wild_stag_riders` (*Wild Hunt Stag Knights*, `cavalry`, `0.06` blocks): `atk 13, def 9, chg 15, mis 0`, `powers: { ward: 0.06, terror: 0.03 }`
  - `tree_kin` (*Ironbark Tree-Kin*, `monster`, `0.05` blocks): `atk 12, def 15, chg 9, mis 0`, `powers: { ward: 0.08, heal: 5, terror: 0.04 }`
  - `ancient_treeman` (*Ancient Elder-Treeman*, `monster`, `0.02` blocks): `atk 16, def 18, chg 11, mis 8`, `powers: { ward: 0.10, heal: 8, terror: 0.08 }`
  - `spellsingers` (*Weavers of the High Weald*, `spellcaster`, `0.02` blocks): `atk 4, def 6, chg 1, mis 14`, `powers: { ward: 0.10, hex: 0.10, heal: 10 }`
  - `thorn_ballista` (*Living Root Bolt-Thrower*, `artillery`, `0.04` blocks): `atk 3, def 4, chg 0, mis 13`
  - *Garrisons:* `kithband_wardens`, `glade_scouts`

### 3.4 `tomb_kings.json` (`tombKingsBase` — Undying Sun-Dynasties)
* **Inspiration:** Tomb Kings of Khemri (Skeleton cohorts, Chariot legions, Tomb Guard, Ushabti, Necropolis Knights, Warsphinx/Necrosphinx, Mortuary Cult Liche Priests, Screaming Skull Catapults).
* **Units:**
  - `sun_skeletons` (*Sun-Bleached Skeleton Cohorts*, `melee`, `0.20` blocks): `atk 5, def 10, chg 2, mis 0`
  - `asp_bowmen` (*Blessed Asp-Arrow Archers*, `ranged`, `0.15` blocks): `atk 3, def 5, chg 1, mis 10`
  - `tomb_guard` (*Bronze-Clad Tomb Guard*, `melee`, `0.14` blocks): `atk 9, def 14, chg 4, mis 0`, `powers: { hex: 0.04 }`
  - `royal_chariots` (*Golden War-Chariot Squadron*, `cavalry`, `0.08` blocks): `atk 9, def 9, chg 13, mis 5`
  - `necropolis_serpents` (*Necropolis Cobra-Knights*, `cavalry`, `0.05` blocks): `atk 12, def 13, chg 13, mis 0`, `powers: { terror: 0.04 }`
  - `ushabti` (*Stone-God Ushabti*, `monster`, `0.05` blocks): `atk 13, def 13, chg 10, mis 8`, `powers: { ward: 0.06, terror: 0.04 }`
  - `necrosphinx` (*Colossal Royal Necrosphinx*, `monster`, `0.02` blocks): `atk 18, def 17, chg 14, mis 0`, `powers: { ward: 0.08, terror: 0.08 }`
  - `liche_hierophants` (*Hierophants of the Mortuary Cult*, `spellcaster`, `0.02` blocks): `atk 3, def 5, chg 0, mis 13`, `powers: { heal: 16, ward: 0.08, hex: 0.06, arcaneSiege: 1 }`
  - `skull_catapult` (*Screaming Skull Catapult & Casket of Souls*, `artillery`, `0.04` blocks): `atk 2, def 4, chg 0, mis 16`, `powers: { terror: 0.05, hex: 0.05 }`
  - *Garrisons:* `risen_spearmen`, `risen_archers`

### 3.5 `vampire.json` (`vampireBase` — Vampiric Blood-Counts)
* **Inspiration:** Vampire Counts of Sylvania (Zombie/Skeleton hordes, Grave Guard, Ethereal Cairn Wraiths & Banshees, Blood Knights, Vargheists, Terrorgheists, Master Necromancers).
* **Units:**
  - `skeleton_warriors` (*Risen Barrow-Skeletons*, `melee`, `0.20` blocks): `atk 5, def 10, chg 2, mis 0`
  - `crypt_ghouls` (*Flesh-Feaster Crypt Ghouls*, `melee`, `0.15` blocks): `atk 9, def 7, chg 5, mis 0`
  - `grave_guard` (*Wight-Blade Barrow Guard*, `melee`, `0.12` blocks): `atk 11, def 14, chg 5, mis 0`, `powers: { hex: 0.05 }`
  - `cairn_wraiths` (*Ethereal Wraiths & Banshees*, `melee`, `0.06` blocks): `atk 10, def 12, chg 6, mis 9`, `powers: { ward: 0.18, terror: 0.06 }`
  - `black_knights` (*Wight-Steed Black Knights*, `cavalry`, `0.08` blocks): `atk 10, def 12, chg 12, mis 0`
  - `blood_knights` (*Vampire Blood-Order Knights*, `cavalry`, `0.05` blocks): `atk 15, def 14, chg 16, mis 0`, `powers: { heal: 6, terror: 0.05 }`
  - `vargheists` (*Winged Vargheists & Varghulfs*, `monster`, `0.04` blocks): `atk 14, def 10, chg 13, mis 0`, `powers: { heal: 6, terror: 0.05 }`
  - `terrorgheist` (*Abyssal Death-Shriek Terrorgheist*, `monster`, `0.02` blocks): `atk 16, def 14, chg 13, mis 14`, `powers: { heal: 6, terror: 0.09 }`
  - `necromancer_coven` (*Master Necromancers & Mortis Engine*, `spellcaster`, `0.02` blocks): `atk 4, def 6, chg 1, mis 12`, `powers: { heal: 18, hex: 0.10, ward: 0.06 }`
  - `corpse_balista` (*Bone-Thrower & Screaming Bell-Cart*, `artillery`, `0.04` blocks): `atk 3, def 5, chg 0, mis 12`, `powers: { heal: 4 }`
  - *Garrisons:* `shambling_thralls`, `fell_bat_swarms`

### 3.6 `chaos.json` (`chaosBase` — Hordes of the Ruinous Wastes)
* **Inspiration:** Warriors of Chaos & Beastmen Brayherds (Marauders, Chaos Warriors, Chosen, Chaos Knights, Minotaurs, Chaos War-Mammoths/Shaggoths, Sorcerer Lords, Hellcannons).
* **Units:**
  - `north_marauders` (*Northland Marauder Axes*, `melee`, `0.16` blocks): `atk 8, def 8, chg 6, mis 0`
  - `marauder_horsemen` (*Wasteland Javelin Horsemen*, `ranged`, `0.10` blocks): `atk 7, def 6, chg 7, mis 10`
  - `chaos_warriors` (*Hell-Forged Chaos Warriors*, `melee`, `0.12` blocks): `atk 12, def 15, chg 6, mis 0`, `powers: { ward: 0.05 }`
  - `chosen_champions` (*Chosen of the Dark Pantheon*, `melee`, `0.10` blocks): `atk 15, def 16, chg 8, mis 0`, `powers: { ward: 0.08, terror: 0.04 }`
  - `chaos_knights` (*Barding-Clad Dread Knights*, `cavalry`, `0.06` blocks): `atk 14, def 14, chg 14, mis 0`, `powers: { ward: 0.05, terror: 0.04 }`
  - `minotaur_herd` (*Blood-Gorged Minotaurs*, `monster`, `0.05` blocks): `atk 14, def 10, chg 13, mis 0`, `powers: { terror: 0.05 }`
  - `war_mammoth` (*Ruinous War-Mammoth & Dragon-Ogre*, `monster`, `0.02` blocks): `atk 18, def 16, chg 15, mis 8`, `powers: { terror: 0.08 }`
  - `ruin_sorcerers` (*Sorcerer-Lords of Ruin*, `spellcaster`, `0.02` blocks): `atk 6, def 8, chg 2, mis 17`, `powers: { hex: 0.14, arcaneSiege: 1, terror: 0.04 }`
  - `hellcannon` (*Daemon-Bound Hellcannon*, `artillery`, `0.03` blocks): `atk 8, def 8, chg 2, mis 18`, `powers: { terror: 0.05, arcaneSiege: 1 }`
  - *Garrisons:* `brayherd_ungors`, `chaos_warhounds`

### 3.7 `dark_elf.json` (`darkElfBase` — Dread-Corsair Principalities)
* **Inspiration:** Dark Elves of Naggaroth (Dreadspears, Repeater Crossbow Darkshards, Black Ark Corsairs, Witch Elves, Executioners/Black Guard, Cold One Knights, Dark Covens, War Hydras).
* **Units:**
  - `dreadspears` (*Dread-Spire Spearmen*, `melee`, `0.15` blocks): `atk 7, def 13, chg 3, mis 0`
  - `darkshards` (*Repeater Crossbow Darkshards*, `ranged`, `0.12` blocks): `atk 4, def 7, chg 1, mis 14`
  - `witch_furies` (*Blood-Cauldron Witch Furies*, `melee`, `0.12` blocks): `atk 14, def 7, chg 9, mis 0`, `powers: { ward: 0.06, hex: 0.06 }`
  - `black_tower_guard` (*Obsidian Guard & Executioners*, `melee`, `0.10` blocks): `atk 14, def 14, chg 7, mis 0`
  - `dark_riders` (*Raven-Cloak Outriders*, `cavalry`, `0.08` blocks): `atk 8, def 7, chg 9, mis 9`
  - `cold_one_knights` (*Dread-Raptor Lancers*, `cavalry`, `0.06` blocks): `atk 13, def 13, chg 13, mis 0`, `powers: { terror: 0.04 }`
  - `war_hydra` (*Many-Headed War-Hydra*, `monster`, `0.02` blocks): `atk 16, def 14, chg 12, mis 10`, `powers: { heal: 12, terror: 0.07 }`
  - `dark_sorceresses` (*Conclave of Dark Magic*, `spellcaster`, `0.02` blocks): `atk 4, def 5, chg 1, mis 18`, `powers: { hex: 0.14, ward: 0.06, arcaneSiege: 1 }`
  - `reaper_bolts` (*Reaper Multi-Bolt Throwers*, `artillery`, `0.04` blocks): `atk 3, def 4, chg 0, mis 15`
  - *Garrisons:* `corsair_watch`, `crossbow_watch`

### 3.8 `skaven.json` (`skavenBase` — Blighted Under-Empire)
* **Inspiration:** Skaven Under-Empire (Clanrats, Stormvermin, Warplock Jezzails, Plague Monks, Doom-Wheels, Rat Ogres, Hell-Pit Abominations, Grey Seers, Warp-Lightning Cannons).
* **Units:**
  - `clanrats` (*Swarming Clan-Vermin*, `melee`, `0.24` blocks): `atk 5, def 7, chg 2, mis 0`
  - `stormvermin` (*Black-Fur Storm-Halberds*, `melee`, `0.16` blocks): `atk 9, def 12, chg 4, mis 0`
  - `plague_censer_monks` (*Frenzied Plague-Censer Monks*, `melee`, `0.14` blocks): `atk 13, def 6, chg 7, mis 0`, `powers: { hex: 0.08 }`
  - `warplock_jezzails` (*Blight-Stone Jezzail Teams*, `ranged`, `0.08` blocks): `atk 3, def 4, chg 1, mis 16`
  - `poison_globadiers` (*Blight-Wind Globadiers*, `ranged`, `0.08` blocks): `atk 4, def 5, chg 1, mis 13`, `powers: { hex: 0.06 }`
  - `doomwheels` (*Whirling Warp-Wheels*, `cavalry`, `0.04` blocks): `atk 12, def 10, chg 14, mis 10`, `powers: { terror: 0.04 }`
  - `rat_ogres` (*Mutated Vermin-Ogres*, `monster`, `0.06` blocks): `atk 13, def 9, chg 11, mis 0`, `powers: { terror: 0.04 }`
  - `pit_abomination` (*Hell-Pit Flesh Behemoth*, `monster`, `0.02` blocks): `atk 17, def 13, chg 13, mis 0`, `powers: { heal: 10, terror: 0.08 }`
  - `grey_seers` (*Horned-Bell Seers & Warlocks*, `spellcaster`, `0.02` blocks): `atk 4, def 5, chg 1, mis 16`, `powers: { hex: 0.12, arcaneSiege: 1, terror: 0.04 }`
  - `warp_cannon` (*Blight-Lightning Cannon & Plagueclaw*, `artillery`, `0.04` blocks): `atk 2, def 3, chg 0, mis 19`, `powers: { arcaneSiege: 1 }`
  - *Garrisons:* `vermin_thralls`, `night_runner_slings`

### 3.9 `lizardmen.json` (`lizardmenBase` — Saurian Temple-Cities)
* **Inspiration:** Lizardmen of Lustria (Saurus Warriors, Temple Guard, Skink Skirmishers, Cold One Riders, Kroxigors, Stegadons, Carnosaurs, Slann Mage-Priests, Solar Bastiladons).
* **Units:**
  - `saurus_cohorts` (*Primeval Saurus Cohorts*, `melee`, `0.15` blocks): `atk 9, def 14, chg 4, mis 0`
  - `temple_guard` (*Star-Chamber Temple Guard*, `melee`, `0.12` blocks): `atk 11, def 16, chg 5, mis 0`, `resistArcane: 0.20`, `powers: { ward: 0.08 }`
  - `skink_blowpipes` (*Crested Skink Poison-Darts*, `ranged`, `0.14` blocks): `atk 3, def 5, chg 1, mis 11`, `powers: { hex: 0.04 }`
  - `horned_one_riders` (*Cold-Blooded Raptor Cavalry*, `cavalry`, `0.06` blocks): `atk 12, def 12, chg 12, mis 0`
  - `kroxigors` (*Sacred River-Kroxigors*, `monster`, `0.05` blocks): `atk 13, def 12, chg 10, mis 0`, `powers: { terror: 0.04 }`
  - `ancient_stegadon` (*Engine-of-the-Gods Stegadon*, `monster`, `0.02` blocks): `atk 15, def 17, chg 14, mis 12`, `powers: { ward: 0.08, terror: 0.07 }`
  - `alpha_carnosaur` (*Apex Sun-Carnosaur*, `monster`, `0.02` blocks): `atk 18, def 14, chg 15, mis 0`, `powers: { terror: 0.08 }`
  - `slann_star_priest` (*Palanquin Star-Priest*, `spellcaster`, `0.01` blocks): `atk 2, def 8, chg 0, mis 18`, `resistArcane: 0.30`, `powers: { ward: 0.16, hex: 0.12, heal: 10, arcaneSiege: 2 }`
  - `solar_bastiladon` (*Solar-Crystal Bastiladon*, `artillery`, `0.03` blocks): `atk 6, def 15, chg 4, mis 16`, `powers: { heal: 6 }`
  - *Garrisons:* `cohort_spears`, `skink_watch`

### 3.10 `infernal_dwarf.json` (`infernalDwarfBase` — Infernal Forge-Citadels)
* **Inspiration:** Chaos Dwarfs (Infernal Guard, Hailshot Blunderbusses, Hobgoblin Cutthroats, Bull Centaur Renders, K'daai Fireborn/Destroyers, Daemonsmith Sorcerer-Prophets, Dreadquake Mortars).
* **Units:**
  - `hobgoblin_levy` (*Steppe-Thrall Cutthroats*, `melee`, `0.18` blocks): `atk 5, def 7, chg 3, mis 0`
  - `infernal_ironsworn` (*Obsidian Forge-Guard*, `melee`, `0.12` blocks): `atk 10, def 17, chg 4, mis 0`, `resistArcane: 0.15`, `powers: { ward: 0.06 }`
  - `hailshot_blunderbuss` (*Infernal Blunderbuss Line*, `ranged`, `0.12` blocks): `atk 5, def 9, chg 1, mis 15`
  - `bull_centaurs` (*Brazen Bull-Centaur Renders*, `cavalry`, `0.05` blocks): `atk 14, def 13, chg 14, mis 0`, `powers: { terror: 0.04 }`
  - `kdaai_fireborn` (*Cinder-Bound Fire Daemons*, `monster`, `0.05` blocks): `atk 15, def 11, chg 12, mis 6`, `powers: { ward: 0.10, terror: 0.05 }`
  - `kdaai_destroyer` (*Colossal Brazen Destroyer*, `monster`, `0.02` blocks): `atk 18, def 16, chg 15, mis 0`, `powers: { ward: 0.08, terror: 0.08 }`
  - `sorcerer_prophets` (*Daemonsmith Sorcerer-Prophets*, `spellcaster`, `0.02` blocks): `atk 6, def 11, chg 2, mis 16`, `resistArcane: 0.20`, `powers: { hex: 0.12, arcaneSiege: 1 }`
  - `dreadquake_mortar` (*Earthshaker Dread-Mortar*, `artillery`, `0.03` blocks): `atk 3, def 6, chg 0, mis 20`, `powers: { hex: 0.06, arcaneSiege: 1 }`
  - *Garrisons:* `thrall_spearmen`, `hobgoblin_bows`

---

## 4. Automatic Culture & State Binding (`inferRosterForCulture`)

Update `DEFAULT_ROSTER_MAP` and `inferRosterForCulture` in [`src/conquest/engine/common/content.ts`](../../src/conquest/engine/common/content.ts) so generated maps in FMG (`highFantasy`, `darkFantasy`, and custom worlds) automatically assign the appropriate *Old World* roster:

| Culture / Race Pattern | Mapped Roster ID | Matches FMG Default Cultures |
| :--- | :--- | :--- |
| `/(dwarf|dwarv|dunirr|khazad)/i` | `dwarfBase` | `Dunirr (Dwarven)`, `Khazadur (Dwarven)` |
| `/(infernal|chaos dwarf|hashut|zharr)/i` | `infernalDwarfBase` | Custom / Dark Fantasy Dwarves |
| `/(dark elf|dark elvish|trow|lothian|drow|corsair)/i` | `darkElfBase` | `Trow (Dark Elfish)`, `Lothian (Dark Elfish)` |
| `/(wood elf|sylvan|weald|glade)/i` | `woodElfBase` | Custom Wood Elf / Forest Elfish cultures |
| `/(elf|elv|eldar|quenian)/i` | `elfBase` | `Quenian (Elfish)`, `Eldar (Elfish)` |
| `/(orc|ork|goblin|uruk|ugluk|kobold)/i` | `orcBase` | `Uruk (Orkish)`, `Ugluk (Orkish)`, `Kobold (Goblin)` |
| `/(skaven|ratmen|vermin|blight|arachnid|arago)/i` | `skavenBase` | `Arago (Arachnid)` |
| `/(lizard|saurian|serpent|snaga|drakonic|rake)/i` | `lizardmenBase` | `Aj'Snaga (Serpents)`, `Rake (Drakonic)` |
| `/(chaos|yotunn|giant|norse|wasteland|ruin)/i` | `chaosBase` | `Yotunn (Giants)`, `Norse` |
| `/(vampir|undead|sylvanian|barrow|necromanc)/i` | `vampireBase` | Custom Undead / Vampire states |
| `/(tomb|khemri|nehekhar|mummy|pharaoh)/i` | `tombKingsBase` | Custom Desert Undead / Ancient states |
| `/(chivalr|breton|grail|luarian)/i` | `chivalricBase` | `Luarian` |
| `/(empire|elector|sigmar|schwarzen)/i` | `empireBase` | `Schwarzen` |

---

## 5. Implementation Checklist

1. **Complete Magic Engine Prerequisites ([`openconquest-magic-system.md`](openconquest-magic-system.md)):**
   - ✅ Implemented Phases 1–4 (`spellcaster` & `monster` categories, 6×6 `MATCHUP`, `powers`, `resistArcane`, `BattleSession` refactor, and unit tests).
2. **Upgrade Existing Fantasy Rosters:**
   - ✅ Updated [`src/conquest/content/docs/rosters/dwarf.json`](../../src/conquest/content/docs/rosters/dwarf.json), [`elf.json`](../../src/conquest/content/docs/rosters/elf.json), and [`orc.json`](../../src/conquest/content/docs/rosters/orc.json) with runic resistance, high magic, monsters, and faction buildings/tech.
3. **Author New Old World Roster JSON Files:**
   - ✅ Created `empire.json`, `chivalric.json`, `wood_elf.json`, `tomb_kings.json`, `vampire.json`, `chaos.json`, `dark_elf.json`, `skaven.json`, `lizardmen.json`, and `infernal_dwarf.json` under `src/conquest/content/docs/rosters/`.
4. **Register & Bind in Engine:**
   - ✅ Imported and registered all new rosters in [`src/conquest/content/bundled.ts`](../../src/conquest/content/bundled.ts).
   - ✅ Expanded `DEFAULT_ROSTER_MAP` and `inferRosterForCulture` in [`src/conquest/engine/common/content.ts`](../../src/conquest/engine/common/content.ts).
5. **Verify & Document:**
   - ✅ Added roster validation, archetype coverage, and culture inference tests in [`src/conquest/test/content.test.ts`](../../src/conquest/test/content.test.ts).
   - ✅ Updated [`docs/openconquest/README.md`](../openconquest/README.md) with the expanded roster catalog.
