import { describe, expect, it } from "vitest";
import { currentContent } from "@/conquest/content/store";
import {
  createProvinceLair,
  getLairDef,
  instantiateLairUnits,
  LAIR_CATALOG,
  LAIR_NATURE_IDS,
  pickLairForTrouble,
  TROUBLE_TO_LAIR_MAPPINGS
} from "./living-lairs";

describe("living-lairs (Slice 1: Lair Catalog, Unit Templates, and Trouble Mappings)", () => {
  it("defines exactly 20 distinct Lair Natures", () => {
    expect(LAIR_NATURE_IDS).toHaveLength(20);
    const uniqueIds = new Set(LAIR_NATURE_IDS);
    expect(uniqueIds.size).toBe(20);

    for (const id of LAIR_NATURE_IDS) {
      const def = LAIR_CATALOG[id];
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.raidThreshold).toBeGreaterThanOrEqual(4);
      expect(def.raidThreshold).toBeLessThanOrEqual(6);
      expect(def.raidUnits.length).toBeGreaterThan(0);
      expect(def.defenderUnits.length).toBeGreaterThan(0);
      expect(["burg", "ruin", "resource"]).toContain(def.defaultTheme);
      expect(def.markerIcon).toBeTruthy();
    }
  });

  it("references valid unit types defined in the Conquest content catalog", () => {
    const { unitTypes } = currentContent().content;
    for (const id of LAIR_NATURE_IDS) {
      const def = LAIR_CATALOG[id];
      for (const u of def.raidUnits) {
        expect(unitTypes[u.unitTypeId], `Lair ${id} raid unit ${u.unitTypeId} exists in unitTypes`).toBeDefined();
        expect(u.count).toBeGreaterThan(0);
      }
      for (const u of def.defenderUnits) {
        expect(unitTypes[u.unitTypeId], `Lair ${id} defender unit ${u.unitTypeId} exists in unitTypes`).toBeDefined();
        expect(u.count).toBeGreaterThan(0);
      }
    }
  });

  it("instantiates ArmyUnit records with correct men counts and attributes", () => {
    const def = getLairDef("ancient_evil");
    const defenders = instantiateLairUnits(def.defenderUnits);
    // 3 dead_legion, 1 gorgon_behemoth, 1 necromancer = 5 units
    expect(defenders).toHaveLength(5);
    for (const unit of defenders) {
      expect(unit.count).toBeGreaterThan(0);
      expect(unit.exp).toBe(0);
      expect(unit.type).toBeTruthy();
    }
  });

  it("creates a ProvinceLair with bounded level (4..10) and correct fields", () => {
    const lowLair = createProvinceLair("bandit_camp", 42, 2, "burg");
    expect(lowLair.level).toBe(4);
    expect(lowLair.cell).toBe(42);
    expect(lowLair.theme).toBe("burg");
    expect(lowLair.fortified).toBe(false);
    expect(lowLair.raidThreshold).toBe(4);
    expect(lowLair.raidPending).toBe(false);
    expect(lowLair.seasonsActive).toBe(0);

    const highLair = createProvinceLair("ancient_fort", 99, 15, "ruin", 10);
    expect(highLair.level).toBe(10);
    expect(highLair.burgId).toBe(10);
    expect(highLair.fortified).toBe(true);
    expect(highLair.raidThreshold).toBe(5);
  });

  it("maps Trouble archetypes to thematic Lairs with fallback", () => {
    expect(pickLairForTrouble("angry_dead")).toBe("ancient_evil");
    expect(pickLairForTrouble("dark_wizards")).toBe("mad_wizard");
    expect(pickLairForTrouble("riotous_thugs")).toBe("thieves_stronghold");
    expect(pickLairForTrouble("monsters")).toBe("monster_nest");

    // All mapped trouble targets are valid lair IDs
    for (const [troubleId, lairs] of Object.entries(TROUBLE_TO_LAIR_MAPPINGS)) {
      expect(lairs.length).toBeGreaterThan(0);
      for (const lairId of lairs) {
        expect(LAIR_CATALOG[lairId], `Mapping for ${troubleId} -> ${lairId} must be valid`).toBeDefined();
      }
    }

    // Unmapped fallback
    const fallback = pickLairForTrouble("non_existent_trouble");
    expect(LAIR_CATALOG[fallback]).toBeDefined();
  });
});
