import { describe, expect, it } from "vitest";
import {
  type Regiment,
  getCategoryForUnit,
  reconcileRegimentBlocks,
  syncRegimentTotals,
  Military
} from "./military-generator";
import type { UnitType } from "@/conquest/engine/common/content";

describe("Phase 2: Roster Units & Regiment Blocks", () => {
  const mockUnitTypes: Record<string, UnitType> = {
    spear: {
      id: "spear",
      name: "Spearmen",
      category: "melee",
      blocks: 0.15,
      men: 150,
      attack: 4,
      defense: 6,
      charge: 1,
      missile: 0,
      cost: 100,
      upkeep: 20
    },
    sword: {
      id: "sword",
      name: "Swordsmen",
      category: "melee",
      blocks: 0.15,
      men: 150,
      attack: 6,
      defense: 5,
      charge: 2,
      missile: 0,
      cost: 120,
      upkeep: 25
    },
    archers: {
      id: "archers",
      name: "Archers",
      category: "ranged",
      blocks: 0.12,
      men: 120,
      attack: 3,
      defense: 3,
      charge: 1,
      missile: 6,
      cost: 110,
      upkeep: 22
    },
    cavalry_knight: {
      id: "cavalry_knight",
      name: "Knights",
      category: "cavalry",
      blocks: 0.08,
      men: 80,
      attack: 8,
      defense: 7,
      charge: 8,
      missile: 0,
      cost: 250,
      upkeep: 50
    },
    trebuchet: {
      id: "trebuchet",
      name: "Trebuchet",
      category: "artillery",
      blocks: 0.04,
      men: 40,
      attack: 10,
      defense: 2,
      charge: 0,
      missile: 12,
      cost: 300,
      upkeep: 60
    }
  };

  describe("getCategoryForUnit", () => {
    it("classifies units based on UnitType category", () => {
      expect(getCategoryForUnit("spear", mockUnitTypes)).toBe("melee");
      expect(getCategoryForUnit("sword", mockUnitTypes)).toBe("melee");
      expect(getCategoryForUnit("archers", mockUnitTypes)).toBe("ranged");
      expect(getCategoryForUnit("cavalry_knight", mockUnitTypes)).toBe("cavalry");
      expect(getCategoryForUnit("trebuchet", mockUnitTypes)).toBe("artillery");
      expect(getCategoryForUnit("fleet", mockUnitTypes)).toBe("naval");
    });

    it("falls back to keyword regexes when unit is not in unitTypes", () => {
      expect(getCategoryForUnit("orc_boyz")).toBe("melee");
      expect(getCategoryForUnit("horse_archers")).toBe("cavalry");
      expect(getCategoryForUnit("longbowmen")).toBe("ranged");
      expect(getCategoryForUnit("bombard")).toBe("artillery");
      expect(getCategoryForUnit("war_galley")).toBe("naval");
    });
  });

  describe("syncRegimentTotals", () => {
    it("aggregates units slots into u and sets total troops a", () => {
      const reg: Regiment = {
        i: 0,
        a: 0,
        cell: 100,
        x: 10,
        y: 10,
        bx: 10,
        by: 10,
        u: {},
        n: 0,
        name: "1st Regiment",
        state: 1,
        icon: "⚔️",
        units: [
          { type: "spear", count: 150, exp: 1 },
          { type: "spear", count: 150, exp: 2 },
          { type: "archers", count: 120, exp: 0 }
        ]
      };

      syncRegimentTotals(reg, mockUnitTypes);
      expect(reg.a).toBe(420);
      expect(reg.u).toEqual({
        spear: 300,
        archers: 120
      });
    });

    it("handles fleet troops in naval regiments", () => {
      const reg: Regiment = {
        i: 1,
        a: 0,
        cell: 200,
        x: 20,
        y: 20,
        bx: 20,
        by: 20,
        u: { fleet: 250 },
        n: 1,
        name: "1st Fleet",
        state: 1,
        icon: "🌊",
        units: [{ type: "fleet", count: 250, exp: 0 }]
      };

      syncRegimentTotals(reg, mockUnitTypes);
      expect(reg.a).toBe(250);
      expect(reg.u.fleet).toBe(250);
    });
  });

  describe("reconcileRegimentBlocks", () => {
    it("quantizes headcount into unit blocks based on UnitType.men", () => {
      const reg: Regiment = {
        i: 0,
        a: 420,
        cell: 100,
        x: 10,
        y: 10,
        bx: 10,
        by: 10,
        u: { spear: 300, archers: 120 },
        n: 0,
        name: "1st Regiment",
        state: 1,
        icon: "⚔️"
      };

      reconcileRegimentBlocks(reg, mockUnitTypes);
      expect(reg.units).toBeDefined();
      expect(reg.units!.length).toBe(3); // 2 spear blocks of 150 + 1 archer block of 120
      expect(reg.units![0]).toEqual({ type: "spear", count: 150, exp: 0 });
      expect(reg.units![1]).toEqual({ type: "spear", count: 150, exp: 0 });
      expect(reg.units![2]).toEqual({ type: "archers", count: 120, exp: 0 });
      expect(reg.a).toBe(420);
    });

    it("preserves existing unit block experience when updating headcount", () => {
      const reg: Regiment = {
        i: 0,
        a: 300,
        cell: 100,
        x: 10,
        y: 10,
        bx: 10,
        by: 10,
        u: { spear: 300 },
        units: [
          { type: "spear", count: 150, exp: 3 },
          { type: "spear", count: 150, exp: 5 }
        ],
        n: 0,
        name: "Veteran Regiment",
        state: 1,
        icon: "⚔️"
      };

      // Increase spear count to 450 (3 blocks)
      reg.u.spear = 450;
      reconcileRegimentBlocks(reg, mockUnitTypes);

      expect(reg.units!.length).toBe(3);
      expect(reg.units![0].exp).toBe(3);
      expect(reg.units![1].exp).toBe(5);
      expect(reg.units![2].exp).toBe(0); // newly formed block gets 0 exp
    });

    it("enforces maximum 20 units limit", () => {
      const reg: Regiment = {
        i: 0,
        a: 5000,
        cell: 100,
        x: 10,
        y: 10,
        bx: 10,
        by: 10,
        u: { spear: 4500 }, // would be 30 blocks of 150
        n: 0,
        name: "Massive Regiment",
        state: 1,
        icon: "⚔️"
      };

      reconcileRegimentBlocks(reg, mockUnitTypes, 20);
      expect(reg.units!.length).toBe(20);
      expect(reg.a).toBe(3000); // 20 * 150 capped
    });
  });

  describe("MilitaryModule category helpers", () => {
    it("computes category counts across multi-unit regiments", () => {
      const reg: Regiment = {
        i: 0,
        a: 570,
        cell: 100,
        x: 10,
        y: 10,
        bx: 10,
        by: 10,
        u: {
          spear: 300,
          sword: 150,
          archers: 120
        },
        n: 0,
        name: "Combined Arms",
        state: 1,
        icon: "⚔️"
      };

      expect(Military.getCategoryCount(reg, "melee")).toBe(450); // 300 spear + 150 sword
      expect(Military.getCategoryCount(reg, "ranged")).toBe(120); // 120 archers
      expect(Military.getCategoryCount(reg, "cavalry")).toBe(0);
      expect(Military.getCategoryCount(reg, "artillery")).toBe(0);
    });
  });
});
