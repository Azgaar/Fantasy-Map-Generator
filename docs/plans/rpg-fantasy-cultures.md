# Plan — RPG Fantasy Culture Set

Updated: 2026-10-25. Status: **implemented**. Decisions taken: 44 cultures defined
with 24 placed, 11 new namebases (no separate Gnomish base), `Quenar (High Elf)`, Feudal humans on
the `Human Generic` base, and faction titles implemented with register-aware naming.

**Blocking dependency:** [namebase-ids.md](namebase-ids.md) — name bases must be identified by
stable five-letter id before any of this lands. Under index identity, adding eleven bases is only
"safe" by luck of appending; under id identity it is safe by construction.

## The idea

High Fantasy is the classic register, but it is not a tabletop bestiary: thirteen races and four
human cultures, no halflings, gnomes, fey, celestials, fiends, undead, sea peoples, constructs or
aberrations, and no peoples of the desert, jungle, tundra or underdark. A GM who wants a map of
"the campaign world" runs out of peoples.

**RPG Fantasy** is the kitchen sink, made a *selection* rather than a list. It defines roughly
forty cultures and places twenty-four, weighted by `odd`, so two maps generated from the same set
are different worlds — the same trick Dark Fantasy uses with 34 defined / 18 placed, at a larger
scale.

## The mechanics this design leans on

| Piece | File | Work |
| --- | --- | --- |
| Dropdown entry | `CULTURE_SETS`, `src/generators/cultures-generator.ts:11` | one entry |
| Roster | `CulturesGenerator.getDefault()`, new branch after the Astral branches | authoring |
| Namebases | `src/data/name-bases.ts`, new ids `HALFL`…`TRIBA` | authoring |
| Pin schema | `src/components/options-schema.ts:15` (enum from the keys) | none |
| Options dropdown | `src/components/options/tabs/options-tab.ts:285` (loops the entries) | none |
| Culture type | `defineCultureType()` — derived from the center | none |

- `max` caps the user's *Cultures number*; `odd` is the inclusion weight in `selectCultures`
  (`cultures-generator.ts:1284`). Defining 40 with `max: 24` is exactly this mechanism.
- Bases are **settlement-name corpora**, not grammars: `b` is a comma-separated list and a Markov
  chain learns its syllables; every burg, state and province name descends from it. This is why
  several peoples share one base (a family) instead of one base per culture.
- A culture references a base by **id** once [namebase-ids.md](namebase-ids.md) lands, so new bases
  never move existing references and the set branch can use id literals.

## Roster — 44 defined, 24 placed

`odd` is the inclusion weight, habitat is the `sort` intent. ★ marks a new base; numbers are
stock base indices. Culture types are left to `defineCultureType()`.

### Elves & kin

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Quenar (High Elf) | Elven 33 | 1 | temperate forest | noldor |
| Sylvan (Wood Elf) | Elven 33 | 0.9 | deep forest | fantasy3 |
| Drow (Dark Elf) | Dark Elven 34 | 0.8 | warm, low ground | hessen |
| Aelvar (Sea Elf) | ★Merfolk 60 | 0.35 | coast & isles | vesicaPiscis |

### Dwarves & smallfolk

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Khazad (Mountain Dwarf) | Dwarven 35 | 1 | high elevation | ironHills |
| Hearthdwarf (Hill Dwarf) | Dwarven 35 | 0.9 | mid hills | erebor |
| Duergar (Deep Dwarf) | Dwarven 35 | 0.45 | low, warm | pavise |
| Halfling (Hobbit) | ★Halfling 55 | 1 | temperate lowland river | round |
| Gnome (Tinker) | ★Halfling 55 | 0.6 | temperate hills | oval |

### Goblinoids, giants & dragonspawn

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Orc | Orc 37 | 1 | harsh, high | urukHai |
| Goblin | Goblin 36 | 1 | warm lowland | moriaOrc |
| Hobgoblin (Legion) | Orc 37 | 0.6 | temperate plains | targe |
| Skaven (Ratmen) | Goblin 36 | 0.65 | underworld, caves | pavise |
| Troll | Giant 38 | 0.5 | cold, wet | swiss |
| Ogre | Giant 38 | 0.4 | dry hills | horsehead2 |
| Dragonborn | Draconic 39 | 0.6 | mountains, desert | fantasy2 |
| Kobold | Goblin 36 | 0.3 | warm caves | fantasy1 |
| Lizardfolk | Serpents 41 | 0.6 | tropical wetlands | fantasy4 |

### Beastfolk & fey

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Lionkin (Catfolk) | ★Beastfolk 61 | 0.45 | warm plains | horsehead |
| Wolfkin (Werefolk) | ★Beastfolk 61 | 0.35 | cold forest | round |
| Aarakocra (Birdfolk) | ★Beastfolk 61 | 0.35 | mountain peaks | vesicaPiscis |
| Minotaur (Bullkin) | Giant 38 | 0.35 | hills | spanish |
| Fey (Fair Folk) | ★Fey 56 | 0.6 | deep forest | fantasy5 |
| Sidhe (Lake Fey) | ★Fey 56 | 0.3 | lake, river | diamond |
| Genasi (Elemental) | ★Elemental 62 | 0.4 | climate extremes | hexagon |

### Dark powers & divine

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Tiefling (Fiendblood) | ★Infernal 57 | 0.55 | arid, warm | targe2 |
| Demon (Fiend) | ★Infernal 57 | 0.25 | worst cells | no |
| Vampire (Nightblood) | ★Grave 59 | 0.5 | cold, dark | baroque |
| Lich (Necromancer) | ★Grave 59 | 0.3 | remote | oldFrench |
| Aasimar (Celestial) | ★Celestial 58 | 0.35 | high mountains | boeotian |
| Chosen (Oracle) | ★Celestial 58 | 0.25 | temperate river | flag |

### Constructs & aberrations

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Warforged (Construct) | ★Construct 63 | 0.35 | anywhere | square |
| Aboleth (Eldritch) | ★Eldritch 64 | 0.2 | remote coast | dovetail |
| Mindflayer (Eldritch) | ★Eldritch 64 | 0.2 | temperate lowland | wedged |

### Humans

| Culture | Base | odd | Habitat | Shield |
| --- | --- | --- | --- | --- |
| Imperial (Human) | Roman 8 | 1 | temperate river, lake | roman |
| Feudal (Human) | Human Generic 32 | 1 | temperate lowland | heater |
| Nordlander (Human) | Nordic 6 | 0.9 | cold coast | french |
| Steppe Rider (Human) | Mongolian 30 | 0.8 | dry steppe | banner |
| Desert Nomad (Human) | Arabic 18 | 0.8 | hot arid | gonfalon |
| Islander (Human) | Hawaiian 25 | 0.5 | tropical coast | oval |
| Jungle Tribe (Human) | ★Tribal 65 | 0.6 | rainforest | pennon |
| Tundra Tribe (Human) | ★Tribal 65 | 0.4 | cold | guidon |
| Eastern Empire (Human) | Japanese 12 | 0.5 | temperate | dovetail |
| Southern Kingdom (Human) | Swahili 28 | 0.4 | warm | pennant |

## New namebases — 11, ids `HALFL`–`TRIBA`

Samples show the register; each base ships 80–150 names. Ids come from
[namebase-ids.md](namebase-ids.md) and are permanent, so the corpus can be rewritten later without
touching a single culture.

| Base | id | i | min/max | d | Register | Samples |
| --- | --- | --- | --- | --- | --- | --- |
| Halfling | HALFL | 55 | 5/12 | `lnst` | English compounds, hearth & harvest | Barleybottom, Thistlewick, Amblecote, Nettlebarrow, Honeyburrow |
| Fey | FEYFO | 56 | 5/13 | `lrnm` | gossamer, dream-logic | Gossamer, Mothvale, Briarheart, Shimmerglade, Dreamthorn |
| Infernal | INFER | 57 | 5/13 | `rxz` | harsh Latinate, brimstone | Malachar, Vexiron, Ashmaw, Brimstone, Carnifex |
| Celestial | CELES | 58 | 5/12 | `ln` | soft, `-iel` / `-ael` | Aureliel, Seraphel, Luminara, Sanctiel, Zenithar |
| Grave | GRAVE | 59 | 5/13 | `rn` | morne, crypt, ossuary | Mournhold, Gravewell, Cryptmoor, Ossuary, Wraithfen |
| Merfolk | MERFO | 60 | 5/12 | `lrnm` | tide & coral | Coralreach, Tidewell, Saltspire, Brineholm, Kelpgate |
| Beastfolk | BEAST | 61 | 4/11 | `rk` | growl plus animal compound | Fangmoor, Clawreach, Howlstead, Tuskridge, Thundermane |
| Elemental | ELEME | 62 | 5/12 | `lnr` | substance & weather | Emberfall, Cinderpeak, Stoneheart, Aqualith, Frostcore |
| Construct | CONST | 63 | 5/12 | `rn` | forged & geared | Ironwrought, Gearhold, Anvilgate, Brasswatch, Runespire |
| Eldritch | ELDRI | 64 | 4/13 | `rl` | alien, clipped, apostrophes | Xulthar, Nyxhal, Vhor'ram, Thulgrave, Ommphalos |
| Tribal | TRIBA | 65 | 4/9 | `nk` | short, open syllables | Ugor, Tambo, Kesh, Wata, Boma |

Corpus rules, enforced by test:

- no entry may contain a comma (the separator), `|` or `/` (serialization)
- no digits; apostrophes, spaces and hyphens are allowed (Elven and Dark Elven already use them)
- no duplicates inside a base; ids are unique, and no two bases share a name (`getBase` resolves by id)
- `min >= 2`, `max > min`, `max <= 20`, `d` is lowercase letters only
- bases of one family must not share a settlement name

## Set wiring

```ts
rpgFantasy: { name: "RPG Fantasy", max: 24, probability: 4 }
```

The `getDefault()` branch sits after the Astral branches. After
[namebase-ids.md](namebase-ids.md), bases are referenced by id literal rather than by name lookup,
so a typo is no longer a silent `-1`. Ids are plain strings, so the compiler cannot catch a typo;
the set-acceptance test that every referenced id exists does. With forty entries, use named habitat
scorers rather than forty bespoke lambdas:

```ts
const n = (cell) => Math.ceil((s[cell] / sMax) * 3);
const habitat = {
  forest: (i) => n(i) / bd(i, [6, 7, 8, 9], 10),
  highland: (i) => n(i) + h[i],
  arid: (i) => n(i) / td(i, 25),
  polar: (i) => n(i) / td(i, -10),
  coastal: (i) => n(i) * (cells.haven[i] ? 1 : 0.2),
  underworld: (i) => n(i) / td(i, 20) + (sMax - h[i]),
  open: (i) => n(i)
};
```

Each culture then reads `{ name, base: "FEYFO", odd, sort: habitat.forest, shield }`.

## Phase 4b — faction titles

The Astral sets already give a state its own word ("United Federation", "Compact") from the
culture base's `groups.polities`, applied by an action. RPG Fantasy wants the same seam with a
fantasy register: **Kingdom, Duchy, Clan, Tribe, Order, Magocracy, Free Cities, Cult**.

Design:

1. Extend the group data with `provinces` (`Duchy`, `March`, `Domain`, `Fief`, `Hold`), so a
   province is not called a "sector" on a fantasy map.
2. Extract the group reading and word picking from `src/generators/astral-naming.ts` into a new
   `src/generators/polity-naming.ts`; `astral-naming.ts` keeps star systems and re-exports what the
   existing tests import.
3. Make the action register-aware: same controller, message and confirmation chosen by the map's
   culture set ("Apply RPG naming" / "Apply Astral naming"). `sectorWordFor` falls back to
   `SECTOR_WORDS` when a base has no `provinces` group, so Astral behaviour is unchanged.
4. RPG bases carry `polities` + `provinces` only from this phase on. Before it, they carry neither —
   otherwise the Astral action would rename RPG states and call their provinces sectors.

## Phases

- [x] **0. Decisions** — 40 defined / 24 placed, no separate Gnomish base, `Quenar (High Elf)`,
      Feudal humans on `Human Generic`, faction titles in Phase 3b.
- [x] **1. Namebase ids** — [namebase-ids.md](namebase-ids.md). Done: bases carry five-letter ids and
      cultures reference them, so the eleven new bases cannot re-point saved maps.
- [x] **2. Bases** — add `HALFL`–`TRIBA` in batches of 3–4; extend `src/data/name-bases.test.ts`
      with the content-rules suite for the new bases.
- [x] **3. Set** — `CULTURE_SETS` entry, `getDefault()` branch, habitat scorers.
- [x] **4a. Tests** — set acceptance (24 placed, bases inside the RPG family, real shields, callable
      sorts), habitat scoring, `configuration-schema.test.ts` accepts `rpgFantasy`.
- [x] **4b. Naming** — faction titles as described above, plus tests for register selection and the
      no-group fallback.
- [x] **5. Docs** — `docs/wiki/Culture-sets.md` (table row + full section), `MERGING.md` touch
      points, README plan table.

## Verification

```sh
npm run test                                  # node suite, includes the base content rules
npm run generate:assistant-context            # required after any src change
```

Browser tests are not needed: nothing here touches the DOM. E2E is not needed.

## Pitfalls

- **Ids are permanent.** A shipped id never changes and is never reused; assigning a new base an
  existing id silently steals that base's cultures on every saved map.
- **Commas.** A stray comma quietly splits one corpus entry into two.
- **Name collisions.** Culture bases resolve by id, but two bases sharing a display name still make
  the editors ambiguous; keep names unique too.
- **All-low `odd`.** `selectCultures` retries at most 200 draws; keep the human/classic entries near
  1 so a map never starves.
- **The Astral action reads any base with groups**, not only Astral sets (see Phase 4b, step 4).
- `package-lock.json` churn in this worktree is unrelated; revert it rather than commit it.