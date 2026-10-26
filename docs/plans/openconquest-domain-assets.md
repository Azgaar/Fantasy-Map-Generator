# Plan — Aligning OpenConquest to TTRPG Domain Management & Asset Rules

**Status:** Completed  
**Completed:** 2026-10-26 (Commits: `4a65c971`, `1d6b9213`, `c28e0bcc`, `d8d1ae6c`)  
**Source Material:** *In Light Snow, Three Thousand Realms* (AER Domain Management Rules)  
**Target Module:** [`src/conquest/`](../../src/conquest) & [`docs/openconquest/README.md`](../openconquest/README.md)

---

## 1. Executive Summary & Gap Analysis

OpenConquest already implements several foundational elements of the TTRPG domain rules (from earlier `CAPACITY-PLAN` phases):
- **Value Modifier Table (`src/conquest/engine/game/saves.ts`)**: `valueModifier()` implements the exact `0–5 (+0)`, `6–10 (+1)`, `11–15 (+2)`, `16–20 (+3)`, `+5 (+1)` table.
- **Scores Ignore Upkeep**: `regionValues()` computes raw generation without subtracting upkeep, matching *"Upkeep costs do not subtract from a Domain's scores."*
- **Six Domain Saving Throws**: `rollSave()` implements `uprising`, `disorder` (Military), `poverty`, `ignorance` (Wealth), and `despair`, `corruption` (Social) against default DC 12.
- **Upgrade Consumption**: Higher-tier chain buildings (`tier > 1`) require and consume their `tier - 1` predecessor.

However, **five major areas** diverge from or are missing relative to the TTRPG rules for **building assets** and **default asset coverage**:

1. **Asset Construction ("Establish an Asset") uses a flat turn timer instead of the 3-Check Value Roll System**:
   - In the TTRPG rules, establishing any asset requires **three successful value checks** (one each for **Military**, **Wealth**, and **Social**) against $\text{DC} = 12 + |\text{benefit or upkeep in that pool}|$, with a **pity mechanic** (*"Each failed roll for a value decreases all difficulties by 1 point, provided the Domain continues to try to establish the asset each turn"*).
   - `rollValueCheck()` already exists in [`saves.ts`](../../src/conquest/engine/game/saves.ts#L318) but is never called by `buildBuilding()` in [`commands.ts`](../../src/conquest/engine/game/commands.ts#L596).
2. **Only 12 of the 34 TTRPG Assets exist in `default.json`**:
   - Missing chains: **School 1–3** (*School*, *Academy*, *Great Academy*) and **Militia 1–3** (*Militia Muster*, *Organized Militia*, *Veteran Guard*).
   - Missing all **11 Cultural Customs** (*Brutal Tyranny*, *Burning Creed*, *Democratic Traditions*, *Devil Worshipers*, *Dwarf Friend*, *Halfling Affinity*, *Mercantile*, *Religious Fervor*, *Slavery*, *Spartan Culture*, *Well-Educated*).
   - Missing all **8 Unchained (`No Type`) Assets** (*Community Aid*, *Hell Shrine*, *Military Spending*, *Necromantic Cult*, *Processing Camp*, *Resource Extractor*, *Siege Supplies*, *United Efforts*).
3. **Existing Assets in `default.json` lack their special TTRPG mechanical effects**:
   - *Barracks 1 / Training Grounds 2 / War Academy 3* only grant $+2 / +4 / +8\text{ M}$ capacity, omitting their signature rule: eliminating the upkeep cost of **1 / 2 / 4 military units** based in the city.
4. **Asset Lifecycle Commands (`Disband`, Conquest Destruction, Multi-Instance `Siege Supplies`)**:
   - No `DisbandBuilding` command exists to voluntarily remove an asset or sacrifice assets when upkeep exceeds capacity.
   - *Siege Supplies* can be built **up to twice** in a single location, whereas the engine currently hard-blocks any duplicate `buildingId`.
5. **Supporting Domain Mechanics Tied to Assets (Treasure & Atrocity)**:
   - Several listed assets directly interact with **Treasure** (spending Treasure to boost *Establish an Asset* checks) and **Atrocity** (*Brutal Tyranny*, *Devil Worshipers*, *Hell Shrine*, *Necromantic Cult*, and forcing failed asset checks to succeed via Atrocity points).

---

## 2. Pillar 1: Complete Default Asset Roster (`default.json`)

We will expand [`src/conquest/content/docs/rosters/default.json`](../../src/conquest/content/docs/rosters/default.json) from 16 buildings to **38 assets** (all **34 TTRPG assets** + OpenConquest's 4 maritime/cunning assets `port1` and `informants1..3`).

### 2.1 Master Table of All 34 TTRPG Assets to Include in `default.json`

| ID | Name | Type / Chain | M | W | S | Check DCs (M / W / S) | Special Mechanical Effect |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`school1`** | **School** | `school` · T1 | 0 | +2 | 0 | 12 / 14 / 12 | Generates +2 W. |
| **`school2`** | **Academy** | `school` · T2 | 0 | +4 | -1 | 12 / 16 / 13 | Requires `school1`. Generates +4 W, loads 1 S upkeep. |
| **`school3`** | **Great Academy** | `school` · T3 | 0 | +8 | -2 | 12 / 20 / 14 | Requires `school2`. Generates +8 W, loads 2 S upkeep. |
| **`barracks1`** | **Barracks** | `military` · T1 | +2 | 0 | 0 | 14 / 12 / 12 | Generates +2 M. **1 military unit** based in region has 0 upkeep (`freeGarrisonUnits: 1`). |
| **`barracks2`** | **Training Grounds** | `military` · T2 | +4 | -1 | 0 | 16 / 13 / 12 | Requires `barracks1`. Generates +4 M, loads 1 W. **2 military units** in region have 0 upkeep (`freeGarrisonUnits: 2`). |
| **`barracks3`** | **War Academy** | `military` · T3 | +8 | -1 | -1 | 20 / 13 / 13 | Requires `barracks2`. Generates +8 M, loads 1 W, 1 S. **4 military units** in region have 0 upkeep (`freeGarrisonUnits: 4`). |
| **`walls1`** | **Palisade** | `defense` · T1 | +2 | 0 | 0 | 14 / 12 / 12 | Generates +2 M, +1 Wall tier. Unlocks Barrier fortifications. |
| **`walls2`** | **Wall** *(Stone Walls)* | `defense` · T2 | +4 | -1 | 0 | 16 / 13 / 12 | Requires `walls1`. Generates +4 M, loads 1 W, +1 Wall tier. Unlocks Towers & Harbor Chains. |
| **`walls3`** | **Layered Walls** | `defense` · T3 | +8 | -2 | 0 | 20 / 14 / 12 | Requires `walls2`. Generates +8 M, loads 2 W, +1 Wall tier (+1 Order/turn). Unlocks Citadels. |
| **`market1`** | **Market** | `economy` · T1 | 0 | +2 | 0 | 12 / 14 / 12 | Generates +2 W (+5% tax income). |
| **`market2`** | **Trade Center** | `economy` · T2 | -1 | +4 | 0 | 13 / 16 / 12 | Requires `market1`. Generates +4 W, loads 1 M (+8% tax income). |
| **`market3`** | **Mercantile Guilds** | `economy` · T3 | -1 | +8 | -1 | 13 / 20 / 13 | Requires `market2`. Generates +8 W, loads 1 M, 1 S (+12% tax income). |
| **`militia1`** | **Militia Muster** | `militia` · T1 | +1 | 0 | 0 | 13 / 12 / 12 | Generates +1 M. Spawns **2 Militia** (`levy_spear`) automatically when defending region in battle. |
| **`militia2`** | **Organized Militia** | `militia` · T2 | +2 | -1 | 0 | 14 / 13 / 12 | Requires `militia1`. Generates +2 M, loads 1 W. Spawns **4 Militia** (`levy_spear`) on defense. |
| **`militia3`** | **Veteran Guard** | `militia` · T3 | +4 | -2 | 0 | 16 / 14 / 12 | Requires `militia2`. Generates +4 M, loads 2 W. Spawns **4 Heavy Infantry** (`sword`) on defense. |
| **`temple1`** | **Shrine** | `order` · T1 | 0 | 0 | +2 | 12 / 12 / 14 | Generates +2 S (+2 Public Order/turn). |
| **`temple2`** | **Temple** | `order` · T2 | 0 | -1 | +4 | 12 / 13 / 16 | Requires `temple1`. Generates +4 S, loads 1 W (+3 Public Order/turn). |
| **`temple3`** | **Great Temple** | `order` · T3 | 0 | -2 | +8 | 12 / 14 / 20 | Requires `temple2`. Generates +8 S, loads 2 W (+4 Public Order/turn). |
| **`custom_brutal_tyranny`** | **Brutal Tyranny** | `custom` (Domain) | +4 | 0 | 0 | 16 / 12 / 12 | Domain-wide. Halves Atrocity gains (rounded down); triples Atrocity rebel pool on uprising. |
| **`custom_burning_creed`** | **Burning Creed** | `custom` (Domain) | 0 | 0 | +4 | 12 / 12 / 16 | Domain-wide. Unlocks elven military units (`elfBase` allies) and removes Scarce penalty. |
| **`custom_democratic`** | **Democratic Traditions** | `custom` (Domain) | 0 | +2 | +2 | 12 / 14 / 14 | Domain-wide. +3 to one save/value check per turn; natural 1 loses next domain action. |
| **`custom_devil_worshipers`** | **Devil Worshipers** | `custom` (Domain) | +4 | +4 | 0 | 16 / 16 / 12 | Domain-wide. Atrocity decreases by 1/turn; ungarrisoned regions generate 0 M/W/S! |
| **`custom_dwarf_friend`** | **Dwarf Friend** | `custom` (Domain) | 0 | +4 | 0 | 12 / 16 / 12 | Domain-wide. Unlocks dwarven military units (`dwarfBase` allies). Incompatible with *Slavery*. |
| **`custom_halfling_affinity`** | **Halfling Affinity** | `custom` (Domain) | 0 | +2 | +2 | 12 / 14 / 14 | Domain-wide. Unlocks halfling military units (`halflingBase` allies). |
| **`custom_mercantile`** | **Mercantile** | `custom` (Domain) | 0 | +4 | 0 | 12 / 16 / 12 | Domain-wide. Doubles Wealth capacity generated by all *Market*, *Trade Center*, and *Mercantile Guilds*. |
| **`custom_religious_fervor`** | **Religious Fervor** | `custom` (Domain) | 0 | 0 | +4 | 12 / 12 / 16 | Domain-wide. Doubles Social capacity generated by all *Shrine*, *Temple*, and *Great Temple*. |
| **`custom_slavery`** | **Slavery** | `custom` (Domain) | 0 | +4 | -2 | 12 / 16 / 14 | Domain-wide. One asset per region has 0 upkeep. Incompatible with *Dwarf Friend*. |
| **`custom_spartan_culture`** | **Spartan Culture** | `custom` (Domain) | +4 | 0 | 0 | 16 / 12 / 12 | Domain-wide. Doubles Military capacity generated by all *Barracks*, *Training Grounds*, and *War Academy*. |
| **`custom_well_educated`** | **Well-Educated** | `custom` (Domain) | 0 | +2 | +2 | 12 / 14 / 14 | Domain-wide. Doubles Wealth capacity generated by all *School*, *Academy*, and *Great Academy*. |
| **`community_aid`** | **Community Aid** | `unchained` (`No Type`) | 0 | -2* | +1* | 12 / 14 / 13 | Converts location Wealth into Social: 2 W upkeep → +1 S generated (capped at location W output). |
| **`hell_shrine`** | **Hell Shrine** | `unchained` (`No Type`) | +2 | +4 | +2 | 14 / 16 / 14 | Generates +2 M, +4 W, +2 S. Ignores 5 Atrocity points; nat 1 on check/save adds +2 Atrocity. |
| **`military_spending`** | **Military Spending** | `unchained` (`No Type`) | +1* | -2* | 0 | 13 / 14 / 12 | Converts location Wealth into Military: 2 W upkeep → +1 M generated (capped at location W output). |
| **`necromantic_cult`** | **Necromantic Cult** | `unchained` (`No Type`) | 0 | 0 | -2 | 12 / 12 / 14 | Loads 2 S upkeep. Unlocks Undead units; each undead unit recruited adds +2 Atrocity. |
| **`processing_camp`** | **Processing Camp** | `resource` (`No Type`) | +1* | +2 (-1*) | 0 | 12 / 14 / 12 | Resource location only. Base +2 W; converts 1 W upkeep → +1 M or +1 S (up to Resource W output). |
| **`resource_extractor`** | **Resource Extractor** | `resource` (`No Type`) | 0 | +2 | 0 | 12 / 14 / 12 | Resource location only. Generates +2 W. |
| **`siege_supplies`** | **Siege Supplies** | `unchained` (`No Type`) | -2 | 0 | 0 | 14 / 12 / 12 | Loads 2 M upkeep. Stores 20 HD of supplies (buffers siege attrition). **May be built twice** (`maxInstances: 2`). |
| **`united_efforts`** | **United Efforts** | `unchained` (`No Type`) | +1* | -2* | +1* | 13 / 14 / 13 | Converts location Wealth/Social into Military or Social (2 upkeep → +1 output, capped at location output). |

---

## 3. Pillar 2: Schema Extensions in `content.ts`

Update `BuildingDef` and `BuildingEffects` in [`src/conquest/engine/common/content.ts`](../../src/conquest/engine/common/content.ts):

```ts
export type AssetKind = "structure" | "custom" | "unchained" | "resource";

export interface BuildingEffects {
  walls?: number;
  incomePct?: number;
  orderPerTurn?: number;
  unlock?: string[];
  capacity?: CapacityPoints;
  upkeep?: CapacityPoints;
  /** Number of military units stationed in this region whose capacity upkeep is waived (Barracks 1/2/4). */
  freeGarrisonUnits?: number;
  /** Temporary defensive units spawned automatically when this location is attacked (Militia 1/2/3). */
  militiaDefense?: {
    unitType: string;
    count: number;
  };
  /** Doubles (or scales) the capacity output of all buildings in a target chain across the Domain (Customs). */
  chainMultiplier?: {
    chain: string;
    pool: "m" | "w" | "s" | "c";
    factor: number;
  };
  /** Waives the upkeep of N building assets per region across the Domain (Slavery = 1). */
  freeBuildingUpkeepPerRegion?: number;
  /** Converts location capacity from one pool into another (Community Aid, Military Spending, Processing Camp, United Efforts). */
  conversion?: {
    from: "w" | "s";
    to: "m" | "w" | "s";
    /** Upkeep points of `from` required per 1 point of `to` generated (2 for Aid/Spending/Efforts, 1 for Processing Camp). */
    ratio: number;
  };
  /** Siege supply hit dice stored (Siege Supplies = 20 HD). */
  siegeSupplies?: number;
  /** Atrocity points ignored by the Domain while this asset stands (Hell Shrine = 5). */
  atrocityIgnore?: number;
  /** Atrocity modifiers (Brutal Tyranny, Devil Worshipers, Necromantic Cult). */
  atrocityMod?: {
    gainMultiplier?: number;
    revoltMultiplier?: number;
    perTurnDelta?: number;
    perRecruitPenalty?: number;
  };
  /** If true, regions in the Domain generate 0 capacity unless garrisoned by a friendly army (Devil Worshipers). */
  requiresGarrisonToProduce?: boolean;
  /** Bonus available once per turn to a Domain value check or save (Democratic Traditions = +3). */
  rollBonusPerTurn?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  /** Asset category: tiered "structure" (default), domain-wide "custom", standalone "unchained", or "resource". */
  kind?: AssetKind;
  chain: string;
  tier: number;
  settlementKinds: ("major" | "minor")[];
  /** Maximum copies allowed in a single region (default 1; 2 for Siege Supplies). */
  maxInstances?: number;
  /** Mutually exclusive asset IDs (e.g. Dwarf Friend vs. Slavery). */
  incompatibleWith?: string[];
  cost: number;
  turns?: number;
  requires?: string;
  group?: string;
  effects: BuildingEffects;
}
```

### Validation Rules in `parseBuildingsDoc` (`content.ts`)
- When `kind === "structure"` (default): enforce unique `(group, chain, tier)` and require `tier - 1` predecessor in the same chain.
- When `kind === "custom"`, `"unchained"`, or `"resource"`: allow multiple assets to share `chain: "custom"` or `chain: "unchained"` without colliding on `tier: 1`, since each is a distinct standalone or cultural asset rather than a linear upgrade ladder.

---

## 4. Pillar 3: Aligning "Establish an Asset" Construction Mechanics

### 4.1 Three-Check Construction State (`state.ts`)
Update `RegionState.construction` in [`src/conquest/engine/game/state.ts`](../../src/conquest/engine/game/state.ts):

```ts
export interface ConstructionProject {
  buildingId: string;
  /** Legacy turn countdown when `config.saves.enabled` is false. */
  turnsLeft: number;
  /** Three required AER value checks (M, W, S). */
  checks?: { m: boolean; w: boolean; s: boolean };
  /** Cumulative difficulty reduction (+1 per failed check while continuously establishing). */
  pityBonus?: number;
}
```

### 4.2 Computing Check Difficulties (`saves.ts` / `commands.ts`)
Add pure helper `assetCheckDifficulties(building: BuildingDef, pityBonus = 0)`:
- For each pool $p \in \{m, w, s\}$:
  $$\text{magnitude}_p = \max\!\left(\text{building.effects.capacity?.[p]} ?? 0,\, \text{building.effects.upkeep?.[p]} ?? 0\right)$$
  $$\text{DC}_p = \max\!\left(2,\, 12 + \text{magnitude}_p - \text{pityBonus}\right)$$
- Matches the rulebook examples:
  - *Great Temple* (`M: 0, W: -2, S: +8`) → `DCs: { m: 12, w: 14, s: 20 }`.
  - *Palisade* (`M: +2, W: 0, S: 0`) → `DCs: { m: 14, w: 12, s: 12 }`.

### 4.3 Executing `Establish an Asset` Rolls (`commands.ts` & `economy.ts`)
1. **Starting Construction (`BuildBuilding`)**:
   - Validates ownership, settlement kind, prerequisites (`requires`), `incompatibleWith` (e.g. *Slavery* vs *Dwarf Friend*), `maxInstances` (allowing 2 *Siege Supplies*), and capacity upkeep headroom.
   - For `kind === "custom"`, checks across all regions owned by the faction so a Custom can only be established once per Domain.
   - Initializes `regionState.construction = { buildingId, turnsLeft: building.turns ?? 3, checks: { m: false, w: false, s: false }, pityBonus: 0 }`.
2. **Advancing Construction via Value Checks**:
   - When `config.saves.enabled` is `true`:
     - On each construction step (either via an explicit `EstablishAssetStep` command with optional `spendTreasure` / `useAtrocity` parameters, or automatically once per turn during `economyTick`):
     - Select the next unchecked pool in order `["m", "w", "s"]`.
     - Roll `rollValueCheck(ctx, regionId, pool)` (`1d20 + modifier`).
     - Apply optional **Democratic Traditions** bonus (`+3` once per turn; natural 1 skips next turn's action).
     - Apply optional **Treasure** boost (`+1` per pre-spent Treasure up to 5, or **post-roll auto-rescue** spending 2 Treasure per +1 needed up to +2 if the faction has reserve Treasure and missed by $\le 2$).
     - Apply optional **Atrocity** override (if enabled by ruler policy, adds `dc - total` Atrocity points to force success).
     - **Outcome**:
       - If `total >= dc`: mark `checks[pool] = true` and emit `AssetCheckRolled { success: true }`.
       - If `total < dc`: increment `pityBonus += 1` (*"Each failed roll for a value decreases all difficulties by 1 point"*) and emit `AssetCheckRolled { success: false, newPityBonus }`.
     - **Completion**: Once `checks.m && checks.w && checks.s` are all `true`:
       - If `kind === "structure"`, remove any lower-tier building of the same `chain` in `regionState.buildings`.
       - Push `buildingId` to `regionState.buildings`.
       - Clear `regionState.construction = null` and emit `BuildingCompleted`.
   - When `config.saves.enabled` is `false`:
     - Preserves the existing `turnsLeft` countdown so all legacy deterministic replay tests remain 100% bit-identical.

### 4.4 Disbanding Assets & Deficit Sacrifice (`commands.ts` & `economy.ts`)
- Add `{ type: "DisbandBuilding"; regionId: number; buildingId: string; suppressCustom?: boolean }` to `commandTypes.ts`:
  - Removes one instance of `buildingId` from `regionState.buildings`.
  - Refuses to disband a `custom` asset unless `suppressCustom: true` (which inflicts $-15$ public order across the Domain) or the faction is currently in capacity deficit for a pool that the custom loads.
- In `economyTick` (`economy.ts`):
  - If a faction's `load > gen` in M, W, or S and config enables strict AER deficit enforcement, automatically disband the highest-upkeep non-custom asset in that pool (or log an `AssetSacrificed` event) when upkeep cannot be sustained.

---

## 5. Pillar 4: Engine Integration of Asset Benefits (`capacity.ts`, `battle.ts`, `sieges.ts`)

### 5.1 Capacity Ledger & Upkeep Modifiers (`src/conquest/engine/game/capacity.ts`)
Update `recomputeCapacity(ctx)` and `regionValues(ctx, regionId)`:
1. **Domain-Wide Customs (`kind === "custom"`)**:
   - Deduplicate `custom` assets per faction so their base `effects.capacity` and `effects.upkeep` are counted **once per faction**, regardless of which region holds them.
2. **Chain Multipliers (`Mercantile`, `Religious Fervor`, `Spartan Culture`, `Well-Educated`)**:
   - If a faction holds a custom with `chainMultiplier: { chain, pool, factor }`, multiply the `effects.capacity[pool]` of every standing building in `chain` across all regions owned by that faction by `factor` (e.g., `2×`).
   - Also reflected in `regionValues()` so Domain check modifiers benefit from doubled School/Temple/Market/Barracks scores!
3. **Slavery Upkeep Waiver (`freeBuildingUpkeepPerRegion: 1`)**:
   - In each region owned by a faction with *Slavery*, sort standing buildings by total upkeep points (`m + w + s + c`) descending and waive the upkeep of the costliest building.
4. **Barracks Garrison Upkeep Waiver (`freeGarrisonUnits: 1 | 2 | 4`)**:
   - For each region with a *Barracks* (1), *Training Grounds* (2), or *War Academy* (4), collect friendly army units currently stationed on cells belonging to that region.
   - Sort those units by their capacity load (`blocks × (m + w + s + c)`) descending and waive the capacity load of the top $N$ units!
5. **Devil Worshipers Garrison Requirement (`requiresGarrisonToProduce: true`)**:
   - If a faction holds *Devil Worshipers*, any region it owns that does **not** currently have a friendly military unit stationed in it produces `0` static and building capacity for that turn.
6. **Regional Value Conversions (`Community Aid`, `Military Spending`, `Processing Camp`, `United Efforts`)**:
   - When present in an unsuppressed region, verify the region generates at least `ratio` points in `conversion.from` (`w` or `s`), then add `ratio` to `load[from]` and `+1` to `gen[to]`.
7. **Resource Location Gate (`kind === "resource"`)**:
   - *Processing Camp* and *Resource Extractor* require the region to either contain a resource/mine POI or have at least one trade good specialty (`region.stats.specialties.length > 0`).

### 5.2 Militia Defense Injection (`src/conquest/engine/game/battle.ts` & `commands.ts`)
- When a battle occurs at a settlement or within a region being defended by its owner:
  - Inspect the region's standing buildings for `effects.militiaDefense` (*Militia Muster* → 2 `levy_spear`, *Organized Militia* → 4 `levy_spear`, *Veteran Guard* → 4 `sword`).
  - Append temporary `ArmyUnit` slots (tagged `temporaryMilitia: true`) to the defender's `BattleSide`.
  - In `finalizeBattle`, strip `temporaryMilitia` units before writing surviving units back to the campaign state, matching *"These units do not exist outside the battle, and any damage or loss is recovered at the start of the next domain turn."*

### 5.3 Siege Supplies Buffer (`src/conquest/engine/game/sieges.ts`)
- Each standing `siege_supplies` asset in a besieged region provides `20` HD of supply (up to `40` HD if two are built).
- Each turn of siege consumes `10` HD of stored supplies before `siege.progress` begins weakening the defenders by 15%/turn.
- Once a siege is lifted, supply reserves replenish automatically at the start of the next turn.

### 5.4 Treasure & Atrocity State (`src/conquest/engine/game/state.ts` & `commands.ts`)
- Add optional `treasure?: number` and `atrocity?: number` to `FactionState` (default `0`).
- Add commands:
  - `AccumulateTreasure`: Wealth check (`1d20 + W mod`) in the faction's capital/target region vs $\text{DC} = 8 + \text{treasure}$; on success, `treasure += 1d4`.
  - `PunishAtrocity`: Consumes a `scapegoat` asset to reduce `atrocity` by `1d4 + 2` (max once per year / 4 turns).
- In `recomputeCapacity()`: if effective Atrocity ($\max(0, \text{atrocity} - \sum \text{atrocityIgnore})$) $> 0$, add $2 + \lfloor \text{effectiveAtrocity} / 4 \rfloor$ to `load.m`, `load.w`, and `load.s`.

---

## 6. Pillar 5: UI, Editors & Documentation Updates

1. **In-App Config & State Editors (`src/conquest/ui/content/config.ts`, `state-forces.ts`)**:
   - Display asset `kind` (`structure`, `custom`, `unchained`, `resource`), check DCs (`M / W / S`), and special effect badges (`Free Garrison`, `Militia Defense`, `Chain ×2`, `Max 2`).
   - Show active 3-check construction progress (`M ✓ | W ✓ | S … (DC 14, -1 pity)`) in the region inspector and State Forces dialog.
   - Add a **Disband** button on standing regional buildings in gameplay mode.
2. **Documentation (`docs/openconquest/README.md`)**:
   - Update the Default Regional Assets table to list all **38 default assets** grouped by category (6 Tiered Chains, 11 Domain Customs, 8 Unchained/Resource Assets, and 4 Maritime/Intrigue Assets).
   - Update the *Process of Creating Building Assets* section to document the **3-Check Value Roll System (`Establish an Asset`)**, DC calculation ($12 + |\text{value}|$), failed-roll pity bonus ($-1\text{ DC}$), and Treasure/Atrocity check modifiers.

---

## 7. Phased Implementation Roadmap

| Phase | Scope | Key Files |
| :--- | :--- | :--- |
| **Phase 1: Schema & All 34 Default Assets** | Extend `BuildingDef` & `BuildingEffects` (`kind`, `maxInstances`, `incompatibleWith`, `freeGarrisonUnits`, `militiaDefense`, `chainMultiplier`, `freeBuildingUpkeepPerRegion`, `conversion`, `siegeSupplies`, `atrocityIgnore`, `atrocityMod`, `requiresGarrisonToProduce`, `rollBonusPerTurn`). Populate all 34 TTRPG assets in `default.json` and update `conceptToChain` in `state.ts`. | `src/conquest/engine/common/content.ts`<br>`src/conquest/content/docs/rosters/default.json`<br>`src/conquest/engine/game/state.ts` |
| **Phase 2: 3-Check "Establish an Asset" & Disband** | Implement `assetCheckDifficulties()`, 3-check construction state (`checks: { m, w, s }`, `pityBonus`), `EstablishAsset` value check rolls in `commands.ts` / `economy.ts`, `maxInstances` support (for *Siege Supplies*), `incompatibleWith` validation, and `DisbandBuilding` command. | `src/conquest/engine/game/saves.ts`<br>`src/conquest/engine/game/commands.ts`<br>`src/conquest/engine/game/commandTypes.ts`<br>`src/conquest/engine/game/economy.ts`<br>`src/conquest/engine/game/events.ts` |
| **Phase 3: Asset Effects in Capacity, Battles & Sieges** | Wire `freeGarrisonUnits` (Barracks 1–3), `chainMultiplier` (Mercantile, Religious Fervor, Spartan Culture, Well-Educated), `freeBuildingUpkeepPerRegion` (Slavery), `conversion` (Community Aid, Military Spending, Processing Camp, United Efforts), and `requiresGarrisonToProduce` (Devil Worshipers) into `capacity.ts`. Wire `militiaDefense` into `battle.ts` and `siegeSupplies` into `sieges.ts`. | `src/conquest/engine/game/capacity.ts`<br>`src/conquest/engine/game/battle.ts`<br>`src/conquest/engine/game/sieges.ts` |
| **Phase 4: Treasure & Atrocity Integration** | Add `treasure` and `atrocity` to `FactionState`, implement `AccumulateTreasure`, Treasure spending on asset checks/saves, Atrocity check forcing & upkeep penalties, *Hell Shrine* / *Brutal Tyranny* / *Necromantic Cult* hooks, and `PunishAtrocity`. | `src/conquest/engine/game/state.ts`<br>`src/conquest/engine/game/commands.ts`<br>`src/conquest/engine/game/capacity.ts`<br>`src/conquest/engine/game/world.ts` |
| **Phase 5: UI, Tests & README Documentation** | Update `config.ts` / `state-forces.ts` for new asset kinds and 3-check progress UI, add unit tests in `src/conquest/test/`, and update `docs/openconquest/README.md` with the complete 38-asset table and 3-check workflow. | `src/conquest/ui/content/config.ts`<br>`src/conquest/ui/content/state-forces.ts`<br>`src/conquest/test/content.test.ts`<br>`src/conquest/test/saves.test.ts`<br>`docs/openconquest/README.md` |
