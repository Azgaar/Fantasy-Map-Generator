// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(async () => {
  await Promise.all([
    import("./burgs-generator"),
    import("./states-generator"),
    import("./provinces-generator"),
    import("./cultures-generator"),
    import("./religions-generator"),
    import("./biomes-generator"),
    import("./zones-generator"),
    import("./routes-generator"),
    import("./features-generator"),
    import("./markers-generator")
  ]);
});

beforeEach(() => {
  vi.stubGlobal("options", {
    map: {
      units: { population: { scale: 1000, urbanization: { rate: 2 } } },
      burgs: { groups: [{ name: "town" }, { name: "city" }, { name: "gone", removed: true }] }
    }
  });
});

describe("recolor", () => {
  it.each([
    ["States", "states"],
    ["Provinces", "provinces"],
    ["Cultures", "cultures"],
    ["Religions", "religions"],
    ["Biomes", "biomes"],
    ["Zones", "zones"]
  ])("%s.recolor sets a HEX color and rejects anything else", (model, key) => {
    vi.stubGlobal("pack", { [key]: [{ i: 0 }, { i: 1, color: "#000000" }, { i: 2, removed: true }] });
    const owner = (globalThis as Record<string, any>)[model];
    owner.recolor(1, "#A1B2C3");
    expect(pack[key as "states"][1].color).toBe("#A1B2C3");
    owner.recolor(1, "red");
    expect(pack[key as "states"][1].color).toBe("#ff0000");
    expect(() => owner.recolor(1, "not a color")).toThrow("HEX color");
    expect(() => owner.recolor(1, 5)).toThrow("HEX color");
    if (model !== "Zones") expect(() => owner.recolor(2, "#fff")).toThrow("does not exist");
    expect(() => owner.recolor(9, "#fff")).toThrow("does not exist");
  });
});

describe("Burgs", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", { burgs: [0, { i: 1, name: "Vel", group: "town", walls: 0 }, { i: 2, removed: true }] });
  });

  it("setPopulation takes people and stores population points", () => {
    Burgs.setPopulation(1, 12_000);
    expect(pack.burgs[1].population).toBe(6);
    expect(() => Burgs.setPopulation(1, -1)).toThrow("non-negative");
    expect(() => Burgs.setPopulation(2, 1)).toThrow("Burg 2 does not exist");
  });

  it("setGroup accepts existing groups only", () => {
    Burgs.setGroup(1, "city");
    expect(pack.burgs[1].group).toBe("city");
    expect(() => Burgs.setGroup(1, "gone")).toThrow("must be one of: town, city");
  });

  it("setType and setBuilding validate their choice", () => {
    Burgs.setType(1, "Naval");
    expect(pack.burgs[1].type).toBe("Naval");
    expect(() => Burgs.setType(1, "Elvish")).toThrow("The type must be one of");
    Burgs.setBuilding(1, "walls", true);
    expect(pack.burgs[1].walls).toBe(1);
    Burgs.setBuilding(1, "walls", false);
    expect(pack.burgs[1].walls).toBe(0);
    expect(() => Burgs.setBuilding(1, "plaza", true)).toThrow("The building must be one of");
  });
});

describe("full names", () => {
  it("sets a state's and a province's full name", () => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1, name: "Orwin" }],
      provinces: [{ i: 0 }, { i: 1, name: "Vel" }]
    });
    States.setFullName(1, " Grand Duchy of Orwin ");
    Provinces.setFullName(1, "County of Vel");
    expect(pack.states[1].fullName).toBe("Grand Duchy of Orwin");
    expect(pack.provinces[1].fullName).toBe("County of Vel");
    expect(() => States.setFullName(1, " ")).toThrow("must not be empty");
  });
});

describe("Cultures and Religions", () => {
  it("setType accepts culture types only", () => {
    vi.stubGlobal("pack", { cultures: [{ i: 0 }, { i: 1, type: "Generic" }] });
    Cultures.setType(1, "Highland");
    expect(pack.cultures[1].type).toBe("Highland");
    expect(() => Cultures.setType(1, "Elvish")).toThrow("The type must be one of");
  });

  it("setDeity sets and clears the deity", () => {
    vi.stubGlobal("pack", { religions: [{ i: 0 }, { i: 1, deity: "Old One" }] });
    Religions.setDeity(1, " Sun Father ");
    expect(pack.religions[1].deity).toBe("Sun Father");
    Religions.setDeity(1, "");
    expect(pack.religions[1].deity).toBeNull();
  });
});

describe("Biomes", () => {
  it("renames and sets habitability", () => {
    vi.stubGlobal("pack", { biomes: [{ i: 0, name: "Marine", habitability: 0 }] });
    Biomes.rename(0, "Deep sea");
    Biomes.setHabitability(0, 40);
    expect(pack.biomes[0]).toMatchObject({ name: "Deep sea", habitability: 40 });
    expect(() => Biomes.setHabitability(0, -5)).toThrow("non-negative");
    expect(() => Biomes.rename(3, "X")).toThrow("Biome 3 does not exist");
  });
});

describe("Zones", () => {
  it("renames, retypes and hides by zone id", () => {
    vi.stubGlobal("pack", { zones: [{ i: 4, name: "Old", type: "Invasion", color: "#000" }] });
    Zones.rename(4, "The Long War");
    Zones.setType(4, "War");
    Zones.setHidden(4, true);
    expect(pack.zones[0]).toMatchObject({ name: "The Long War", type: "War", hidden: true });
    Zones.setHidden(4, false);
    expect(pack.zones[0].hidden).toBeUndefined();
    expect(() => Zones.rename(0, "X")).toThrow("Zone 0 does not exist");
  });
});

describe("Routes and Features", () => {
  it("rename by id and reject missing ones", () => {
    vi.stubGlobal("pack", { routes: [{ i: 3, group: "roads" }], features: [{}, { i: 1, name: "Old" }] });
    Routes.rename(3, "King's Road");
    Features.rename(1, "Isle of Varn");
    expect(pack.routes[0].name).toBe("King's Road");
    expect(pack.features[1].name).toBe("Isle of Varn");
    expect(() => Routes.rename(0, "X")).toThrow("Route 0 does not exist");
    expect(() => Features.rename(7, "X")).toThrow("Feature 7 does not exist");
  });
});

describe("Markers", () => {
  it("sets icon, type and visibility", () => {
    vi.stubGlobal("pack", { markers: [{ i: 2, icon: "❓", type: "unknown" }] });
    Markers.setIcon(2, "🌋");
    Markers.setType(2, "volcano");
    Markers.setHidden(2, true);
    expect(pack.markers[0]).toMatchObject({ icon: "🌋", type: "volcano", hidden: true });
    Markers.setHidden(2, false);
    expect(pack.markers[0].hidden).toBeUndefined();
    expect(() => Markers.setIcon(2, " ")).toThrow("must not be empty");
    expect(() => Markers.setType(9, "x")).toThrow("Marker 9 does not exist");
  });
});
