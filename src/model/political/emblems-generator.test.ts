import { describe, expect, it } from "vitest";
import { charges } from "@/data/emblems/charges";
import { IconSets } from "@/model/icon-sets";
import "./burgs-generator";
import "@/model/economy/goods-generator";
import "@/model/physical/relief-generator";
import { EmblemsGenerator } from "./emblems-generator";

describe("EmblemsGenerator", () => {
  it("maps every declared charge to one file in its category", () => {
    const emblems = new EmblemsGenerator();
    const catalog = charges as unknown as Record<string, Record<string, number>>;
    const files = emblems.iconSets.flatMap(set => IconSets.files(set.id).map(name => [set.id.slice(8), name]));
    const names = files.map(([, name]) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const [category, name] of files) {
      expect(name in catalog[category]).toBe(true);
      expect(emblems.chargeIcon(name)).toBe(`charges-${category}-${name}`);
    }
    for (const set of emblems.iconSets) {
      const category = set.id.slice(8);
      for (const name of Object.keys(catalog[category])) {
        expect(emblems.chargeIcon(name)).toBe(`charges-${category}-${name}`);
      }
    }
  });

  it("selects shield shapes from explicit data without reading the DOM", () => {
    const emblems = new EmblemsGenerator();
    globalThis.pack = {
      cultures: [
        { i: 0, shield: "round" },
        { i: 1, shield: "polish" }
      ],
      states: [{ i: 0 }, { i: 1, coa: { shield: "hessen", t1: "gules" } }]
    } as unknown as typeof pack;

    expect(emblems.getShield(1, undefined, "culture")).toBe("polish");
    expect(emblems.getShield(1, 1, "state")).toBe("hessen");
    expect(emblems.getShield(1, undefined, "french")).toBe("french");
  });

  it("keeps only the placement fields an emblem has", () => {
    const emblems = new EmblemsGenerator();
    expect(emblems.placement({ t1: "gules", size: 0, x: 12 })).toStrictEqual({ size: 0, x: 12 });
    expect(emblems.placement({ icon: "custom-00000000" })).toStrictEqual({});
    expect(emblems.placement(undefined)).toStrictEqual({});
  });
});
