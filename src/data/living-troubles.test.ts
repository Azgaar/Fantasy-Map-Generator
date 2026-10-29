import { describe, expect, it } from "vitest";
import { LAIR_CATALOG, STATE_CAPABLE_LAIR_IDS } from "./living-lairs";
import {
  BURG_TROUBLE_IDS,
  getTroubleDef,
  isTroubleStatePromotable,
  RESOURCE_TROUBLE_IDS,
  RUIN_TROUBLE_IDS,
  STATE_PROMOTABLE_TROUBLE_IDS,
  TROUBLE_CATALOG,
  troubleUnitMatchMultiplier,
  UNIT_ROLE_POOLS
} from "./living-troubles";

describe("living-troubles (Slice 1: Trouble Catalog, State Promotion Profiles, and Unit Roles)", () => {
  it("defines all 46 distinct Trouble archetypes across thematic tables", () => {
    const keys = Object.keys(TROUBLE_CATALOG);
    expect(keys).toHaveLength(46);

    for (const id of keys) {
      const def = TROUBLE_CATALOG[id];
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(["m", "w", "s"]).toContain(def.pool);
      expect(["disorder", "uprising", "poverty", "ignorance", "despair", "corruption"]).toContain(def.save);
      expect(["guardsmen", "military", "merchant", "sage", "prophet", "magistrate"]).toContain(def.requiredRole);
    }

    expect(BURG_TROUBLE_IDS).toHaveLength(20);
    expect(RUIN_TROUBLE_IDS).toHaveLength(20);
    expect(RESOURCE_TROUBLE_IDS).toHaveLength(20);
  });

  it("classifies exactly 19 state-promotable Troubles and 27 non-promotable hazards", () => {
    expect(STATE_PROMOTABLE_TROUBLE_IDS).toHaveLength(19);
    const promotableSet = new Set(STATE_PROMOTABLE_TROUBLE_IDS);
    const capableLairsSet = new Set(STATE_CAPABLE_LAIR_IDS);

    for (const [id, def] of Object.entries(TROUBLE_CATALOG)) {
      if (promotableSet.has(id)) {
        expect(def.canPromoteToState).toBe(true);
        expect(isTroubleStatePromotable(id)).toBe(true);
        expect(def.stateForm).toBeTruthy();
        expect(def.stateLairId, `Promotable trouble ${id} has stateLairId`).toBeDefined();
        expect(
          capableLairsSet.has(def.stateLairId!),
          `Trouble ${id} stateLairId ${def.stateLairId} is a state-capable lair`
        ).toBe(true);
        expect(LAIR_CATALOG[def.stateLairId!], `Trouble ${id} paired lair exists`).toBeDefined();
      } else {
        expect(def.canPromoteToState).toBe(false);
        expect(isTroubleStatePromotable(id)).toBe(false);
        expect(def.stateLairId).toBeUndefined();
      }
    }
  });

  it("retrieves trouble definitions with fallback via getTroubleDef", () => {
    const demagogue = getTroubleDef("demagogue");
    expect(demagogue.id).toBe("demagogue");
    expect(demagogue.canPromoteToState).toBe(true);
    expect(demagogue.stateForm).toBe("Revolutionary Tribune");

    const fallback = getTroubleDef("non_existent_trouble");
    expect(fallback).toBe(TROUBLE_CATALOG.monsters);
  });

  it("computes troubleUnitMatchMultiplier correctly based on role and pool match", () => {
    const def = getTroubleDef("riotous_thugs"); // pool: m, requiredRole: guardsmen
    expect(troubleUnitMatchMultiplier(def, "guardsmen")).toBe(1); // exact role
    expect(troubleUnitMatchMultiplier(def, "military")).toBe(2); // same pool (m), different role
    expect(troubleUnitMatchMultiplier(def, "sage")).toBe(3); // wrong pool (w)
    expect(troubleUnitMatchMultiplier(def, undefined)).toBe(3); // no unit
  });

  it("maintains consistent pool mapping in UNIT_ROLE_POOLS", () => {
    expect(UNIT_ROLE_POOLS.guardsmen).toBe("m");
    expect(UNIT_ROLE_POOLS.military).toBe("m");
    expect(UNIT_ROLE_POOLS.merchant).toBe("w");
    expect(UNIT_ROLE_POOLS.sage).toBe("w");
    expect(UNIT_ROLE_POOLS.prophet).toBe("s");
    expect(UNIT_ROLE_POOLS.magistrate).toBe("s");
  });
});
