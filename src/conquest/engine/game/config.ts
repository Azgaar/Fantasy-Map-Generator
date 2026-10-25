/**
 * Campaign configuration (settings/game.yaml, total-war/.plans/PLAN.md §6).
 * The resolved config object is stored in the campaign and hashed with the seed —
 * YAML edits never silently change an in-flight campaign.
 */

export interface CampaignConfig {
  turn: { startYear: number; seasonsPerYear: number };
  movement: {
    costDivisor: number;
    basePoints: number;
    roadMultiplier: number;
    trailMultiplier: number;
    stanceMultipliers: Record<string, number>;
  };
  battle: {
    maxRounds: number;
    routThreshold: number;
    attritionScale: number;
    wallBonusPerTier: number;
    encampBonus: number;
    ambushBonus: number;
    riverDefenderBonus: number;
    /** Ceilings on the summed per-side `UnitType.powers` / `resistArcane`. */
    magic: {
      wardCap: number;
      hexCap: number;
      /** Men per round. */
      healCap: number;
      terrorCap: number;
      /** Wall tiers. */
      arcaneSiegeCap: number;
      resistCap: number;
    };
  };
  economy: {
    taxPer1000Pop: number;
    corruptionPerStep: number;
    corruptionCap: number;
    startOrder: number;
    occupiedOrder: number;
    /**
     * Differentiate faction economies by the *map's own* tax form — Azgaar's
     * per-state `salesTax` / `pollTax`, compiled into the pack (ECOMONY-PLAN
     * Phase 1). Off by default: when false, income depends only on population
     * and every faction with the same land earns the same, which is what the
     * campaign was balanced against.
     *
     * Note FMG's own `DEFAULT_TAX_BY_FORM` gives a Republic the *lowest* salesTax
     * and a Theocracy the highest — so this makes theocracies the richest
     * extractors, not merchant republics.
     */
    taxFromMap: boolean;
    /** Public-order points per turn of `pollTax`, dragged off every owned region. */
    pollTaxOrderDrag: number;
    /**
     * Make *where* a region is matter economically, via the map's own goods
     * (`RegionStats.specialties`, compiled in Phase 2). Off by default.
     */
    specialtiesFromMap: boolean;
    /**
     * Income bonus per distinct specialty a region produces.
     *
     * Defaults are **measured, not guessed**: on the sample world a region's
     * specialty count runs 3…16 (median 7), so the naive 0.05/0.25 pairing put
     * 104 of 127 regions on the cap — the clamp became the whole effect and the
     * data stopped mattering. At 0.02 with a 0.35 cap **no** region clamps, and
     * income runs ×1.06…×1.32 across the map. Re-measure if the good data
     * changes; see ECONOMY-PLAN Phase 2.
     */
    specialtyIncomePerGood: number;
    /** Ceiling on the specialty bonus, so no region can run away. */
    specialtyCap: number;
    /**
     * Gold per **owned region** per turn, on top of army upkeep — the cost of
     * holding land: administrators, tolls, a token garrison, keeping roads up.
     *
     * Exists because army upkeep alone lets a large realm free-ride. Measured on
     * the sample world, Ithlonor holds 26 regions and fields almost no army, so
     * its income-to-upkeep ratio was **12.3** while a 3-region state ran at **0.85**
     * — a 14.4× spread that no single tax rate can close, because the cause is
     * that land and military size were never coupled.
     *
     * **Zero disables it**, so the shipped campaign is unchanged until a figure is
     * chosen deliberately. Note it is mildly regressive: it costs a big realm
     * little and a small, over-militarised one a lot. That is the intent — an
     * over-armed minor state *should* bleed — but it needs pairing with an AI that
     * won't over-recruit (ECONOMY-PLAN "balance" follow-ups), or small states get
     * a death spiral rather than a lesson.
     */
    garrisonUpkeepPerRegion: number;
    /**
     * **CAPACITY-PLAN Phase 3 — the capacity model turns on.**
     *
     * Off by default, and off means *bit-identical*: no gate, no attrition, no
     * development, and the gold economy exactly as it has always run. On, the
     * four capacity pools become the economy — armies, characters and
     * buildings are limited by **free capacity** rather than by a treasury, an
     * over-extended realm attrits, and settlements can be developed.
     *
     * On also **retires the gold income/upkeep block**: the pools are the
     * economy, so the treasury stops moving. Phase 5 reintroduces gold as the
     * purse (a diplomatic currency), Phase 6 re-points the AI at capacity, and
     * Phase 7 flips this default and deletes the gold code.
     */
    capacityMode: boolean;
  };
  /**
   * CAPACITY-PLAN Phase 3 — the capacity model's own constants. Every one of
   * them is a **balance knob**: they say how hard the pools bite, and none of
   * them touches a point value.
   */
  capacity: {
    /**
     * Fraction of a regiment's men lost per turn while its realm is over its
     * Military capacity. AER p1424: *"a Domain cannot sustain more troops,
     * infrastructure, or random catastrophes than its point totals allow"*.
     */
    attritionPerTurn: number;
    /** Order lost per turn in a region holding an over-capacity regiment. */
    overCapacityOrderCost: number;
    /** Turns a `Develop` commitment runs before the settlement is promoted. */
    developTurns: number;
    /** Wealth committed per turn while a development runs — the price. */
    developWPerTurn: number;
    /** Turns between organic growth steps. */
    growthTurns: number;
    /** Public order a region needs before it grows on its own. */
    growthOrderThreshold: number;
    /**
     * Development steps a settlement may take, per point of its region's
     * habitability (so `floor(habitability ÷ this)`). A town cannot outgrow
     * its province.
     */
    growthPerHabitability: number;
    /** Wealth loaded while a building is under construction. */
    constructionWPerTurn: number;
    /**
     * Capacity points of Wealth a point of gold buys, for **research** (the
     * tech tree's price in the capacity model).
     *
     * The shipped techs are priced in gold — 1,200 to 2,500 — which was
     * calibrated for a gold economy where a realm's whole treasury was a few
     * thousand. In the capacity model a realm's Wealth is tens of points, so
     * the same price is divided down to a few points: 500 gold a point makes
     * the Great Census 2.4 W, against the +5 % of a realm's Wealth generation
     * it buys. A tech that cost as much as it earned would never be worth
     * researching, and one that cost nothing would be free.
     */
    techCostPerGold: number;
    /**
     * Stability a region gains per turn for holding a friendly unit — the
     * price of a deliberate development is paid in stability, so the garrison
     * that keeps a province orderly is what funds its growth.
     */
    stabilityPerGarrison: number;
    /** Stability a region gains when one of its towns grows of its own accord. */
    stabilityPerGrowth: number;
    /** Stability a `Develop` commitment costs. */
    developStabilityCost: number;
    /**
     * Purse gold per point of Wealth converted (`WithdrawTreasure`,
     * CAPACITY-PLAN Phase 5). The plan's rate: **1 free W → 100 purse gold**.
     *
     * The conversion is bounded twice over: the Wealth is a *permanent* load on
     * the realm's W pool, so a realm's gold income can never exceed the Wealth
     * it generates — and successive conversions in one turn cost 1, 2, 3 … W,
     * so a realm is paid best for converting one at a time.
     */
    purseGoldPerW: number;
  };
  military: {
    maxUnitsPerArmy: number;
    replenishFraction: number;
    encampReplenishBonus: number;
  };
  saves: {
    /**
     * AER Domain value checks and saving throws (engine/game/saves.ts,
     * CAPACITY-PLAN Phase 4). **Off by default**: with it off, unrest resolves
     * the way it always has — the flat `rebellion.requiredTurns` count — and no
     * die is rolled anywhere, so flag-off runs stay bit-identical.
     *
     * Turning it on makes a Domain's *value* matter to the world rather than
     * only to the capacity ledger: a region whose order collapses now rolls
     * 1d20 + its Military modifier against DC 12 instead of rising automatically.
     */
    enabled: boolean;
    /** AER line 1437: Domain saving throws default to difficulty 12. */
    defaultDc: number;
    /**
     * Floors of AER's modifier bands (line 1425): 0–5 +0, 6–10 +1, 11–15 +2,
     * 16–20 +3. These are the *floors*, so 6 opens the +1 band. Re-measure if
     * the region tier ladder moves — the per-region values these bands are read
     * against are M 1…6 / W 0…7 / S 0…6 / C 0…5 on the sample world, which
     * puts every region on a +0…+1 roll.
     */
    bands: number[];
    /** Open-ended tail of the table: every +5 of value past the last band is +1 more. */
    bandStep: number;
  };
  victory: { regionFraction: number };
  diplomacy: {
    giftRelationPer100: number;
    breakReliabilityPenalty: number;
    breakRelationsPenalty: number;
    truceTurns: number;
    confederationMaxRegions: number;
    confederationRelationThreshold: number;
  };
  sieges: {
    garrisonWeakenPerTick: number;
    garrisonWeakenFloor: number;
    orderDamagePerTick: number;
  };
  rebellion: {
    orderThreshold: number;
    requiredTurns: number;
    brigandUnits: number;
  };
  seasons: {
    winterMovementMult: number;
    autumnIncomeBonus: number;
  };
  characters: {
    lordCost: number;
    agentCost: number;
    movementPoints: number;
    xpPerBattleWin: number;
    xpPerBattleLoss: number;
    xpPerLevel: number;
    skillPowerPerLevel: number;
    campaignMpPerLevel: number;
    economyIncomePerLevel: number;
    /**
     * The weight of the **Cunning** difference in an assassination attempt
     * (CAPACITY-PLAN Phase 6): the chance gains
     * `cunningTerm x (attacker free C − defender effective C)`.
     *
     * Cunning is the pool that says what your agents know and what theirs do,
     * so a spymaster with the run of the place assassinates better and a
     * counter-intelligence service defends better. 0.05 a point means a
     * four-point edge is worth a fifth of the attempt.
     */
    cunningTerm: number;
    /** Turns a sabotage suppresses a region's generation. */
    sabotageTurns: number;
    /** How near a region an agent must be to sabotage it (in regions). */
    sabotageRange: number;
    /**
     * How much a retained Bodyguard hardens the lord it guards — subtracted
     * from every assassination attempt against that lord.
     */
    bodyguardDefence: number;
  };
  pois: { discoveryGold: number };
  ai: {
    /** Recruit/build only when projected expenses stay under this share of income. */
    incomeBudgetShare: number;
    /** War turns after which exhaustion starts bending AI peace decisions. */
    warExhaustionTurns: number;
    /** Enemy armies within this many region steps of home trigger defense. */
    defenseRadius: number;
  };
}

export const DEFAULT_CONFIG: CampaignConfig = {
  turn: { startYear: 1332, seasonsPerYear: 4 },
  movement: {
    costDivisor: 10,
    basePoints: 60,
    roadMultiplier: 0.5,
    trailMultiplier: 0.8,
    stanceMultipliers: { normal: 1, march: 1.5, encamp: 0.7, ambush: 0.7, raid: 1 }
  },
  battle: {
    maxRounds: 6,
    routThreshold: 0.25,
    attritionScale: 0.35,
    wallBonusPerTier: 0.1,
    encampBonus: 0.1,
    ambushBonus: 0.3,
    riverDefenderBonus: 0.15,
    magic: { wardCap: 0.3, hexCap: 0.3, healCap: 40, terrorCap: 0.15, arcaneSiegeCap: 2, resistCap: 0.5 }
  },
  economy: {
    /**
     * Gold per 1,000 people, per turn. Scaled to Azgaar's own annual tax rate:
     * FMG charges `population / 100` per year, and a year is 4 turns
     * (`turn.seasonsPerYear`), so per-turn it must be `population / 400` —
     * i.e. 2.5 per 1,000. At the original 1.0 every faction ran a structural
     * deficit against its own starting armies (see `.plans/ECONOMY-PLAN.md`).
     *
     * NOTE: `content/docs/game.json` overrides this via {@link resolveConfig}.
     * Keep the two in sync — tests that pass DEFAULT_CONFIG directly are
     * otherwise validating a different economy than the one that ships.
     */
    taxPer1000Pop: 2.5,
    /**
     * Map-derived tax form is opt-in. Leave false unless you are deliberately
     * testing Phase 1: it changes every faction's income relative to the
     * others, and the shipped balance was tuned with it off.
     */
    taxFromMap: false,
    pollTaxOrderDrag: 20,
    specialtiesFromMap: false,
    specialtyIncomePerGood: 0.02,
    specialtyCap: 0.35,
    // Zero = off. Deliberately not pre-tuned: pick a figure against `bun run ledger`.
    garrisonUpkeepPerRegion: 0,
    // CAPACITY-PLAN Phase 3 — off until Phase 7 flips it.
    capacityMode: false,
    corruptionPerStep: 0.02,
    corruptionCap: 0.4,
    startOrder: 75,
    occupiedOrder: 25
  },
  military: { maxUnitsPerArmy: 20, replenishFraction: 0.25, encampReplenishBonus: 2 },
  saves: { enabled: false, defaultDc: 12, bands: [6, 11, 16, 21], bandStep: 5 },
  capacity: {
    attritionPerTurn: 0.1,
    overCapacityOrderCost: 3,
    developTurns: 4,
    developWPerTurn: 2,
    growthTurns: 6,
    growthOrderThreshold: 60,
    growthPerHabitability: 20,
    constructionWPerTurn: 1,
    techCostPerGold: 500,
    stabilityPerGarrison: 1,
    stabilityPerGrowth: 3,
    developStabilityCost: 4,
    purseGoldPerW: 100
  },
  victory: { regionFraction: 0.35 },
  diplomacy: {
    giftRelationPer100: 2,
    breakReliabilityPenalty: 15,
    breakRelationsPenalty: 30,
    truceTurns: 5,
    confederationMaxRegions: 4,
    confederationRelationThreshold: 60
  },
  sieges: {
    garrisonWeakenPerTick: 0.15,
    garrisonWeakenFloor: 0.4,
    orderDamagePerTick: 3
  },
  rebellion: { orderThreshold: 25, requiredTurns: 2, brigandUnits: 4 },
  seasons: { winterMovementMult: 0.8, autumnIncomeBonus: 0.15 },
  characters: {
    lordCost: 500,
    agentCost: 800,
    movementPoints: 90,
    xpPerBattleWin: 40,
    xpPerBattleLoss: 15,
    xpPerLevel: 100,
    skillPowerPerLevel: 0.05,
    campaignMpPerLevel: 0.1,
    economyIncomePerLevel: 0.05,
    cunningTerm: 0.05,
    sabotageTurns: 3,
    sabotageRange: 2,
    bodyguardDefence: 0.2
  },
  pois: { discoveryGold: 200 },
  ai: { incomeBudgetShare: 0.85, warExhaustionTurns: 20, defenseRadius: 2 }
};

/** Deep-merge parsed YAML over defaults; unknown keys are ignored (§6 principle 4). */
export function resolveConfig(parsed: unknown): CampaignConfig {
  const merge = (base: unknown, over: unknown): Record<string, unknown> => {
    if (typeof base !== "object" || base === null || typeof over !== "object" || over === null) {
      return (over ?? base) as Record<string, unknown>;
    }
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? merge(out[k], v) : v;
    }
    return out;
  };
  return merge(DEFAULT_CONFIG, parsed) as unknown as CampaignConfig;
}

// Reading settings from disk used to live here (`loadConfigFile`, the last
// `node:fs` + `Bun.YAML` import in the engine). It is now the harness's job, in
// src/server/settings.ts: the engine takes an already-resolved config object, so
// nothing under total-war/engine/ touches a filesystem or a platform API. That
// separation is what makes the engine bundleable for the browser.
