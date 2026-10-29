import { beforeEach, describe, expect, it } from "vitest";
import { assignStateRoster, resolveForPack } from "@/conquest/engine/common/content";

describe("Phase 1: State Roster Binding", () => {
  describe("inferRosterForCulture & assignStateRoster", () => {
    it("preserves an existing valid rosterId on the state", () => {
      const state = { rosterId: "elfBase", culture: 1, type: "Generic" };
      const cultures = [undefined, { i: 1, name: "Kazad (Dwarven)", type: "Generic" }];
      expect(assignStateRoster(state, cultures)).toBe("elfBase");
    });

    it("infers dwarfBase from (Dwarven) or (Dwarf) race tags", () => {
      const state = { culture: 1, type: "Generic" };
      const cultures = [undefined, { i: 1, name: "Kazad (Dwarven)", type: "Generic" }];
      expect(assignStateRoster(state, cultures)).toBe("dwarfBase");
    });

    it("infers elfBase from (Elven) or (Elf) race tags or names", () => {
      const state = { culture: 1, type: "Generic" };
      const cultures = [undefined, { i: 1, name: "Ithilien (Elven)", type: "Generic" }];
      expect(assignStateRoster(state, cultures)).toBe("elfBase");
    });

    it("infers orcBase from (Orcish) or (Goblin) race tags", () => {
      const state = { culture: 1, type: "Generic" };
      const cultures = [undefined, { i: 1, name: "Gorgoroth (Orcish)", type: "Generic" }];
      expect(assignStateRoster(state, cultures)).toBe("orcBase");
    });

    it("infers steppeBase from Nomadic culture type or state type", () => {
      const stateNomadicType = { culture: 1, type: "Nomadic" };
      const culturesGeneric = [undefined, { i: 1, name: "Valyrian (Human)", type: "Generic" }];
      expect(assignStateRoster(stateNomadicType, culturesGeneric)).toBe("steppeBase");

      const stateGenericType = { culture: 1, type: "Generic" };
      const culturesNomadic = [undefined, { i: 1, name: "Riders", type: "Nomadic" }];
      expect(assignStateRoster(stateGenericType, culturesNomadic)).toBe("steppeBase");
    });

    it("infers dwarfBase for Highland culture with mountain/rock/stone themes", () => {
      const state = { culture: 1, type: "Highland" };
      const cultures = [undefined, { i: 1, name: "Stonepeak Clans", type: "Highland" }];
      expect(assignStateRoster(state, cultures)).toBe("dwarfBase");
    });

    it("falls back to commonBase when no thematic race or type matches", () => {
      const state = { culture: 1, type: "Generic" };
      const cultures = [undefined, { i: 1, name: "Kingdom of Valen (Human)", type: "Generic" }];
      expect(assignStateRoster(state, cultures)).toBe("commonBase");
    });
  });

  describe("resolveForPack state.rosterId precedence", () => {
    it("respects state.rosterId directly when compiling resolved faction content", () => {
      const cultures = [{ i: 1, name: "Valen (Human)" }];
      const factions = [{ id: 1, name: "State 1", culture: 1, rosterId: "dwarfBase" }];

      const dummyContent: any = {
        hash: "test",
        unitTypes: {},
        rosters: {
          commonBase: { id: "commonBase", units: {}, recruitable: [] },
          dwarfBase: { id: "dwarfBase", units: {}, recruitable: [] }
        },
        cultures: [],
        factions: [],
        buildings: [],
        tech: [],
        victory: {},
        events: [],
        defaultRoster: "commonBase",
        defaultVictory: "standard"
      };

      const resolved = resolveForPack({ cultures, factions }, dummyContent);
      expect(resolved.factions["1"]?.rosterId).toBe("dwarfBase");
    });
  });

  describe("StatesModule setRoster and setCulture integration", () => {
    let StatesModule: any;

    beforeEach(async () => {
      globalThis.TIME = false;
      globalThis.window = globalThis.window || ({} as any);
      globalThis.pack = {
        states: [
          { i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 },
          {
            i: 1,
            name: "Ironpeak",
            culture: 1,
            type: "Generic",
            rosterId: "commonBase",
            salesTax: 0,
            pollTax: 0,
            treasury: 0
          }
        ],
        cultures: [
          { i: 0, name: "Wildlands" },
          { i: 1, name: "Midlanders (Human)", type: "Generic" },
          { i: 2, name: "Kazad (Dwarven)", type: "Highland" }
        ],
        burgs: [],
        markets: [],
        deals: [],
        biomes: []
      } as any;

      StatesModule = (await import("@/model/political/states-generator")).States;
    });

    it("sets roster explicitly via setRoster", () => {
      StatesModule.setRoster(1, "orcBase");
      expect(globalThis.pack.states[1].rosterId).toBe("orcBase");
    });

    it("re-evaluates rosterId when culture changes via setCulture", () => {
      StatesModule.setCulture(1, 2);
      expect(globalThis.pack.states[1].culture).toBe(2);
      expect(globalThis.pack.states[1].rosterId).toBe("dwarfBase");
    });
  });
});
