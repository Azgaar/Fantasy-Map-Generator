// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Emblems } from "./emblems-generator";
import { Lore } from "./lore";

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
    import("./river-generator"),
    import("./features-generator"),
    import("./markers-generator"),
    import("./military-generator"),
    import("./added-labels"),
    import("./pack-generator"),
    import("./labels-generator"),
    import("./journeys/journeys-generator"),
    import("./transports-generator"),
    import("./goods-generator"),
    import("./markets-generator")
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
    expect(() => Burgs.setBuilding(1, "tavern", true)).toThrow("The building must be one of");
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

describe("state forms", () => {
  it("sets the government with a listed form name and keeps it for a custom one", () => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1, name: "Orwin", form: "Monarchy", formName: "Kingdom", fullName: "Kingdom of Orwin" }]
    });
    States.setForm(1, "Free City");
    expect(pack.states[1]).toMatchObject({ form: "Republic", formName: "Free City", fullName: "Free City of Orwin" });
    States.setForm(1, "Holy Dominion");
    expect(pack.states[1]).toMatchObject({ form: "Republic", formName: "Holy Dominion" });
    States.setForm(1, "Holy Dominion", "Theocracy");
    expect(pack.states[1].form).toBe("Theocracy");
    States.setForm(1, "");
    expect(pack.states[1]).toMatchObject({ form: "Theocracy", fullName: "Orwin" });
    expect("formName" in pack.states[1]).toBe(false);
    expect(() => States.setForm(1, "Realm", "Tyranny")).toThrow("The form must be one of");
  });
});

describe("population", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1 }],
      burgs: [0, { i: 1, cell: 1, state: 1, population: 1 }, { i: 2, cell: 2, state: 1, population: 3 }],
      cells: {
        i: Uint32Array.from([0, 1, 2, 3]),
        h: Uint8Array.from([10, 30, 30, 30]),
        state: Uint16Array.from([0, 1, 1, 0]),
        burg: Uint16Array.from([0, 1, 2, 0]),
        area: Float32Array.from([1, 1, 1, 1]),
        pop: Float32Array.from([0, 1, 3, 5])
      }
    });
  });

  it("scales a state's cells and burgs to totals in people", () => {
    States.setPopulation(1, 8000, 16000);
    expect([...pack.cells.pop]).toEqual([0, 2, 6, 5]);
    expect(pack.burgs.slice(1).map(burg => (burg as { population: number }).population)).toEqual([2, 6]);
    expect(pack.states[1]).toMatchObject({ rural: 8, urban: 8 });
  });

  it("spreads a population evenly over an area that had none", () => {
    pack.cells.pop.fill(0);
    States.setPopulation(1, 4000, 0);
    expect([...pack.cells.pop]).toEqual([0, 2, 2, 0]);
    expect(() => States.setPopulation(1, -1, 0)).toThrow("non-negative");
    pack.burgs[1].state = pack.burgs[2].state = 0;
    expect(() => States.setPopulation(1, 0, 10)).toThrow("no burgs");
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
    vi.stubGlobal("pack", { markers: [{ i: 2, icon: "glyph-2753", type: "unknown" }] });
    Markers.setIcon(2, "🌋");
    Markers.setType(2, "volcano");
    Markers.setHidden(2, true);
    expect(pack.markers[0]).toMatchObject({ icon: "glyph-1f30b", type: "volcano", hidden: true });
    Markers.setIcon(2, "glyph-2694");
    expect(pack.markers[0].icon).toBe("glyph-2694");
    Markers.setHidden(2, false);
    expect(pack.markers[0].hidden).toBeUndefined();
    expect(() => Markers.setIcon(2, " ")).toThrow("must not be empty");
    expect(() => Markers.setType(9, "x")).toThrow("Marker 9 does not exist");
  });
});

describe("Burgs: capital, move, remove", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      burgs: [
        0,
        { i: 1, name: "Vel", cell: 1, state: 1, capital: 1 },
        { i: 2, name: "Orn", cell: 2, state: 1, capital: 0 }
      ],
      states: [{ i: 0 }, { i: 1, capital: 1, center: 1 }],
      provinces: [{ i: 0 }, { i: 1, burg: 2 }],
      markets: [],
      cells: {
        burg: [0, 1, 2, 0, 0],
        state: [0, 1, 1, 0, 0],
        province: [0, 1, 1, 1, 0],
        h: [10, 30, 30, 30, 30],
        f: [0, 1, 1, 1, 1]
      }
    });
    vi.spyOn(Burgs, "changeGroup").mockImplementation(() => {});
  });

  it("setCapital moves the capital and the state center", () => {
    Burgs.setCapital(2);
    expect(pack.burgs[2].capital).toBe(1);
    expect(pack.burgs[1].capital).toBe(0);
    expect(pack.states[1]).toMatchObject({ capital: 2, center: 2 });
    pack.burgs[2].state = 0;
    expect(() => Burgs.setCapital(2)).toThrow("neutral lands");
  });

  it("remove refuses capitals and clears the province capital", () => {
    expect(() => Burgs.remove(1)).toThrow("is a capital");
    Burgs.remove(2);
    expect(pack.burgs[2].removed).toBe(true);
    expect(pack.cells.burg[2]).toBe(0);
    expect(pack.provinces[1].burg).toBe(0);
  });

  it("move takes a free land cell and keeps a capital in its state and province", () => {
    vi.spyOn(Pack, "requireCell").mockImplementation((x: unknown) => x as number);
    const portWater = vi.spyOn(Burgs as unknown as { portWater: () => number }, "portWater").mockReturnValue(0);
    pack.burgs[2].port = 7;
    Burgs.move(2, 3, 5);
    expect(pack.burgs[2]).toMatchObject({ cell: 3, state: 0, x: 3, y: 5, port: 0 });
    expect(pack.provinces[1].center).toBe(3);
    expect(portWater).toHaveBeenCalledWith(3);
    expect([...pack.cells.burg]).toEqual([0, 1, 0, 2, 0]);
    expect(() => Burgs.move(2, 0, 0)).toThrow("in the water");
    expect(() => Burgs.move(2, 1, 0)).toThrow("already has burg 1");
    expect(() => Burgs.move(2, 4, 0)).toThrow("capital of province 1");
    expect(() => Burgs.move(1, 4, 0)).toThrow("cannot be moved into another state");
  });
});

describe("States", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [
        { i: 0, diplomacy: [] },
        { i: 1, name: "Orwin", diplomacy: ["x", "x", "Neutral"], provinces: [1], military: [{ i: 0, name: "1st" }] },
        { i: 2, name: "Kahor", diplomacy: ["x", "Neutral", "x"], provinces: [], military: [{ i: 0, name: "Guard" }] }
      ],
      provinces: [{ i: 0 }, { i: 1, state: 1 }],
      burgs: [0, { i: 1, state: 1, capital: 1 }, { i: 2, state: 2, capital: 1 }],
      cells: { state: [0, 1, 1, 2], province: [0, 1, 0, 0] }
    });
    vi.spyOn(Burgs, "changeGroup").mockImplementation(() => {});
    for (const method of ["findNeighbors", "collectStatistics", "getPoles"] as const)
      vi.spyOn(States, method).mockImplementation(() => {});
  });

  it("setRelation sets both sides and records the change", () => {
    States.setRelation(2, 1, "Vassal");
    expect(pack.states[2].diplomacy![1]).toBe("Vassal");
    expect(pack.states[1].diplomacy![2]).toBe("Suzerain");
    expect(States.getChronicle().at(-1)).toEqual(["Vassalization", "Kahor became a vassal of Orwin"]);
    expect(() => States.setRelation(1, 2, "Besties")).toThrow("The relation must be one of");
    expect(() => States.setRelation(1, 1, "Ally")).toThrow("two different states");
  });

  it("remove leaves neutral lands and burgs and removes provinces", () => {
    States.remove(1);
    expect(pack.states[1]).toEqual({ i: 1, removed: true });
    expect(pack.provinces[1].removed).toBe(true);
    expect([...pack.cells.state]).toEqual([0, 0, 0, 2]);
    expect([...pack.cells.province]).toEqual([0, 0, 0, 0]);
    expect(pack.burgs[1]).toMatchObject({ state: 0, capital: 0 });
  });

  it("merge hands lands, burgs, provinces and regiments to the ruling state", () => {
    States.merge(2, [1]);
    expect(pack.states[1].removed).toBe(true);
    expect([...pack.cells.state]).toEqual([0, 2, 2, 2]);
    expect(pack.burgs[1]).toMatchObject({ state: 2, capital: 0 });
    expect(pack.provinces[1].state).toBe(2);
    expect(pack.states[2].provinces).toEqual([1]);
    expect(pack.states[2].military!.map(({ i, name }) => [i, name])).toEqual([
      [0, "Guard"],
      [1, "1st"]
    ]);
  });
});

describe("Provinces", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1, capital: 1, provinces: [1] }, { i: 2, capital: 2, provinces: [] }],
      provinces: [{ i: 0 }, { i: 1, state: 1, name: "Vel", formName: "County", burg: 0, center: 1 }],
      burgs: [0, { i: 1, cell: 2, state: 1 }, { i: 2, cell: 3, state: 2 }, { i: 3, cell: 1, state: 1 }],
      cells: { state: [0, 1, 1, 2], province: [0, 1, 0, 0], burg: [0, 3, 1, 2] }
    });
    for (const method of ["findNeighbors", "collectStatistics", "getPoles"] as const)
      vi.spyOn(States, method).mockImplementation(() => {});
  });

  it("setState gives a province with its lands and burgs to another state", () => {
    Provinces.setState(1, 2);
    expect([...pack.cells.state]).toEqual([0, 2, 1, 2]);
    expect(pack.burgs[3].state).toBe(2);
    expect(pack.states[1].provinces).toEqual([]);
    expect(pack.states[2].provinces).toEqual([1]);
    pack.cells.province[3] = 1;
    expect(() => Provinces.setState(1, 1)).toThrow("holds the capital");
  });

  it("setForm rebuilds the full name, setCapital takes a burg inside, remove frees the cells", () => {
    Provinces.setForm(1, "Duchy");
    expect(pack.provinces[1].fullName).toBe("Vel Duchy");
    Provinces.setCapital(1, 3);
    expect(pack.provinces[1]).toMatchObject({ burg: 3, center: 1 });
    expect(() => Provinces.setCapital(1, 1)).toThrow("not in province 1");
    Provinces.remove(1);
    expect(pack.provinces[1]).toEqual({ i: 1, removed: true });
    expect([...pack.cells.province]).toEqual([0, 0, 0, 0]);
    expect(pack.states[1].provinces).toEqual([]);
  });
});

describe("Cultures and Religions removal", () => {
  it("frees cells, burgs, states and origins", () => {
    vi.stubGlobal("pack", {
      cultures: [{ i: 0 }, { i: 1 }, { i: 2, origins: [1] }],
      religions: [{ i: 0 }, { i: 1 }, { i: 2, origins: [1, 0] }],
      burgs: [0, { i: 1, culture: 1 }],
      states: [{ i: 0 }, { i: 1, culture: 1 }],
      cells: { culture: [0, 1, 2], religion: [1, 1, 2] }
    });
    Cultures.remove(1);
    Religions.remove(1);
    expect([...pack.cells.culture]).toEqual([0, 0, 2]);
    expect([...pack.cells.religion]).toEqual([0, 0, 2]);
    expect(pack.burgs[1].culture).toBe(0);
    expect(pack.states[1].culture).toBe(0);
    expect(pack.cultures[2].origins).toEqual([0]);
    expect(pack.religions[2].origins).toEqual([0]);
    expect(() => Religions.setType(2, "Pantheon")).toThrow("The type must be one of");
    expect(() => Religions.setExpansion(2, "world")).toThrow("The expansion must be one of");
    expect(() => Cultures.setExpansionism(2, 100)).toThrow("from 0 to 99");
  });
});

describe("Zones, Markers, Routes, labels and regiments", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      cells: { i: [0, 1, 2], routes: { 0: { 1: 5 }, 1: { 0: 5 } } },
      zones: [{ i: 0, name: "War", type: "Invasion", cells: [0] }],
      markers: [{ i: 0, name: "Pit", type: "caves", icon: "🦇", cell: 0 }],
      routes: [
        {
          i: 5,
          group: "roads",
          points: [
            [0, 0, 0],
            [1, 1, 1]
          ]
        }
      ],
      addedLabels: [{ i: 1, x: 0, y: 0, label: { text: "Here be dragons" } }],
      states: [{ i: 0 }, { i: 1, military: [{ i: 3, name: "1st" }] }]
    });
    vi.stubGlobal("styles", { routes: { groups: { roads: {}, trails: {} } } });
  });

  it("adds, reshapes and removes zones", () => {
    expect(Zones.add("Plague", "Disease", [1, 1, 2])).toBe(1);
    expect(pack.zones[1]).toMatchObject({ name: "Plague", type: "Disease", cells: [1, 2] });
    expect(() => Zones.setCells(1, [7])).toThrow("cell ids from 0 to 2");
    Zones.remove(0);
    expect(pack.zones.map(({ i }) => i)).toEqual([1]);
  });

  it("places a custom marker at a point and removes markers by id", () => {
    vi.spyOn(Pack, "requireCell").mockReturnValue(2);
    vi.stubGlobal("options", { map: { cultures: { set: "european" } } });
    const id = Markers.place(10, 20, "shrine", "Old Shrine");
    expect(pack.markers.find(marker => marker.i === id)).toMatchObject({
      cell: 2,
      type: "shrine",
      icon: "glyph-2753",
      name: "Old Shrine"
    });
    Markers.remove(0);
    expect(() => Markers.remove(0)).toThrow("Marker 0 does not exist");
  });

  it("regroups and removes routes by id with their cell links", () => {
    Routes.setGroup(5, "trails");
    expect(pack.routes[0].group).toBe("trails");
    expect(() => Routes.setGroup(5, "canals")).toThrow("The group must be one of: roads, trails");
    Routes.remove(5);
    expect(pack.routes).toEqual([]);
    expect(pack.cells.routes).toEqual({ 0: {}, 1: {} });
  });

  it("renames and removes added labels and regiments", () => {
    AddedLabels.rename(1, "No dragons");
    expect(pack.addedLabels[0].label.text).toBe("No dragons");
    AddedLabels.remove(1);
    expect(pack.addedLabels).toEqual([]);
    Military.rename(1, 3, "Iron Guard");
    expect(pack.states[1].military![0].name).toBe("Iron Guard");
    Military.remove(1, 3);
    expect(pack.states[1].military).toEqual([]);
    expect(() => Military.remove(1, 3)).toThrow("Regiment 1-3 does not exist");
  });
});

describe("founding at a map point", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      cells: {
        h: [10, 30, 30],
        state: [0, 1, 1],
        burg: [0, 0, 1],
        culture: [0, 1, 1],
        province: [0, 1, 1],
        r: [0, 0, 0],
        b: [0, 0, 0],
        i: [0, 1, 2]
      },
      burgs: [0, { i: 1, cell: 2, capital: 1, state: 1 }],
      states: [{ i: 0 }, { i: 1, capital: 1 }],
      provinces: [0, { i: 1, state: 1, burg: 1, center: 2 }],
      cultures: [{ i: 0 }, { i: 1, center: 1 }],
      religions: [{ i: 0 }],
      addedLabels: []
    });
  });

  it("refuses water, occupied centers and existing capitals", () => {
    const at = (cell: number) => vi.spyOn(Pack, "requireCell").mockReturnValue(cell);
    at(0);
    for (const model of [States, Provinces, Cultures, Religions, Rivers])
      expect(() => model.add(1, 1)).toThrow("water");
    at(1);
    expect(() => Cultures.add(1, 1)).toThrow("Cell 1 is already a culture center");
    at(2);
    expect(() => States.add(1, 1)).toThrow("Burg 1 is already a capital");
    expect(() => Provinces.declareIndependence(1)).toThrow("holds its state's capital");
  });

  it("places a label in an added label group", () => {
    vi.spyOn(Pack, "requireCell").mockReturnValue(1);
    vi.stubGlobal("options", {
      map: {
        labels: {
          groups: [
            { name: "added", type: "added" },
            { name: "x", type: "state" }
          ]
        }
      }
    });
    expect(AddedLabels.place(5, 6, " Here be dragons ", "added")).toBe(1);
    expect(pack.addedLabels[0]).toEqual({ i: 1, x: 5, y: 6, label: { text: "Here be dragons", group: "added" } });
    expect(() => AddedLabels.place(5, 6, "Text", "x")).toThrow("The group must be one of: added");
  });

  it("builds routes between two existing burgs only", () => {
    vi.stubGlobal("styles", { routes: { groups: { roads: {} } } });
    expect(() => Routes.add(1, 1, "roads")).toThrow("two different burgs");
    expect(() => Routes.add(1, 7, "roads")).toThrow("Burg 7 does not exist");
    expect(() => Routes.add(1, 2, "canals")).toThrow("The group must be one of: roads");
  });
});

describe("locks, treasuries and links", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      burgs: [0, { i: 1, name: "Vel" }],
      states: [{ i: 0 }, { i: 1, salesTax: 0, pollTax: 0, treasury: 0 }],
      provinces: [{ i: 0 }, { i: 1 }],
      cultures: [{ i: 0 }, { i: 1 }],
      religions: [{ i: 0 }, { i: 1 }],
      routes: [{ i: 4, points: [] }],
      markers: [{ i: 0 }],
      journeys: [{ i: 2, segments: [] }]
    });
  });

  it.each([
    ["Burgs", 1, "burgs"],
    ["States", 1, "states"],
    ["Provinces", 1, "provinces"],
    ["Cultures", 1, "cultures"],
    ["Religions", 1, "religions"],
    ["Routes", 4, "routes"],
    ["Markers", 0, "markers"],
    ["Journeys", 2, "journeys"]
  ])("%s.setLocked stores only a lock", (model, id, key) => {
    const owner = (globalThis as Record<string, any>)[model];
    const entity = () => (pack as any)[key].find((item: { i: number }) => item?.i === id);
    owner.setLocked(id, true);
    expect(entity().lock).toBe(true);
    owner.setLocked(id, false);
    expect("lock" in entity()).toBe(false);
  });

  it("sets treasuries, taxes and preview links within their bounds", () => {
    Burgs.setTreasury(1, 12.345);
    expect(pack.burgs[1].treasury).toBe(12.35);
    States.setTaxes(1, 0.2, 1.5);
    States.setTreasury(1, 900);
    expect(pack.states[1]).toMatchObject({ salesTax: 0.2, pollTax: 1.5, treasury: 900 });
    expect(() => States.setTaxes(1, 2, 0)).toThrow("from 0 to 1");
    expect(() => States.setTreasury(0, 1)).toThrow("Neutral lands");
    Burgs.setLink(1, "https://example.com/map.png");
    expect(pack.burgs[1].link).toBe("https://example.com/map.png");
    expect(() => Burgs.setLink(1, "javascript:alert(1)")).toThrow("http(s) URL");
    Burgs.setLink(1, "");
    expect("link" in pack.burgs[1]).toBe(false);
  });
});

describe("States: chronicle, painting and merging as provinces", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [
        { i: 0, diplomacy: [["Old war", "It ended"]] },
        { i: 1, name: "Orwin", center: 1, capital: 1, color: "#aa0000", provinces: [1], military: [] },
        { i: 2, name: "Kahor", center: 3, capital: 2, color: "#0000aa", formName: "Duchy", provinces: [], military: [] }
      ],
      provinces: [{ i: 0 }, { i: 1, state: 1, center: 1, name: "Vel" }],
      burgs: [0, { i: 1, cell: 1, state: 1, capital: 1 }, { i: 2, cell: 3, state: 2, capital: 1 }],
      cells: {
        i: [0, 1, 2, 3, 4],
        h: [10, 30, 30, 30, 30],
        state: [0, 1, 1, 2, 2],
        province: [0, 1, 1, 0, 0],
        burg: [0, 1, 0, 2, 0],
        culture: [0, 1, 1, 1, 1],
        c: [[1], [0, 2], [1, 3], [2, 4], [3]]
      }
    });
    vi.spyOn(Burgs, "changeGroup").mockImplementation(() => {});
    for (const method of ["findNeighbors", "collectStatistics", "getPoles"] as const)
      vi.spyOn(States, method).mockImplementation(() => {});
    vi.spyOn(Provinces, "getPoles").mockImplementation(() => {});
  });

  it("edits chronicle entries as escaped text", () => {
    States.setChronicleEntry(1, ["Peace", "<b>Orwin</b> & Kahor"]);
    expect(States.getChronicle()[1]).toEqual(["Peace", "&lt;b&gt;Orwin&lt;/b&gt; &amp; Kahor"]);
    States.setChronicleEntry(0, []);
    expect(States.getChronicle()).toHaveLength(1);
    expect(() => States.setChronicleEntry(5, ["x"])).toThrow("does not exist");
  });

  it("gives cells to a state with their burgs and province, never another state's center", () => {
    vi.spyOn(Burgs, "getType").mockReturnValue("Generic");
    vi.spyOn(Emblems, "generate").mockReturnValue({ t1: "or" });
    vi.spyOn(Emblems, "getShield").mockReturnValue("heater");
    vi.stubGlobal("Names", { getState: () => "Marca", getCultureShort: () => "M" });
    States.setCells(2, [2]);
    expect([...pack.cells.state]).toEqual([0, 1, 2, 2, 2]);
    expect(pack.provinces[2]).toMatchObject({ i: 2, state: 2, center: 2, name: "Vel" }); // the split-off part of Vel
    expect([...pack.cells.province]).toEqual([0, 1, 2, 0, 0]);
    expect(pack.states[2].provinces).toEqual([2]);
    expect(() => States.setCells(2, [1])).toThrow("center of state 1");
    expect(() => States.setCells(2, [0])).toThrow("water");
    States.setCells(0, [4]);
    expect(pack.cells.state[4]).toBe(0);
  });

  it("merges a state as one province of the ruling state", () => {
    States.merge(1, [2], true);
    expect(pack.states[2].removed).toBe(true);
    expect(pack.provinces[2]).toMatchObject({ i: 2, state: 1, name: "Kahor", formName: "Duchy", burg: 2, center: 3 });
    expect([...pack.cells.province]).toEqual([0, 1, 1, 2, 2]);
    expect(pack.states[1].provinces).toEqual([1, 2]);
  });
});

describe("Provinces: merge and painting", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1, provinces: [1, 2] }, { i: 2, provinces: [3] }],
      provinces: [
        { i: 0 },
        { i: 1, state: 1, center: 1, burg: 0 },
        { i: 2, state: 1, center: 2, burg: 5 },
        { i: 3, state: 2, center: 3 }
      ],
      cells: { i: [0, 1, 2, 3], h: [30, 30, 30, 30], state: [1, 1, 1, 2], province: [0, 1, 2, 3] }
    });
    vi.spyOn(Provinces, "getPoles").mockImplementation(() => {});
  });

  it("merges provinces of one state into the primary one", () => {
    expect(() => Provinces.merge(1, [3])).toThrow("belongs to another state");
    Provinces.merge(1, [2]);
    expect(pack.provinces[2]).toEqual({ i: 2, removed: true });
    expect(pack.provinces[1].burg).toBe(5);
    expect([...pack.cells.province]).toEqual([0, 1, 1, 3]);
    expect(pack.states[1].provinces).toEqual([1]);
  });

  it("paints only cells of its state and never another province's center", () => {
    Provinces.setCells(1, [0]);
    expect(pack.cells.province[0]).toBe(1);
    expect(() => Provinces.setCells(1, [3])).toThrow("not in state 1");
    expect(() => Provinces.setCells(1, [2])).toThrow("center of province 2");
    expect(() => Provinces.setCells(0, [0])).toThrow("Province 0 does not exist");
  });
});

describe("Cultures and Religions: origins, codes, centers, cells and shields", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      cultures: [{ i: 0 }, { i: 1, origins: [0] }, { i: 2, origins: [1] }, { i: 3, origins: [2], center: 3 }],
      religions: [{ i: 0 }, { i: 1, origins: [0] }, { i: 2, origins: [1] }],
      states: [{ i: 0 }, { i: 1, culture: 1, coa: { t1: "or", shield: "heater" } }],
      provinces: [{ i: 0 }, { i: 1, center: 2, coa: { icon: "castle" } }],
      burgs: [0, { i: 1, cell: 2, culture: 1, coa: { t1: "or", shield: "heater" } }],
      cells: { i: [0, 1, 2, 3], h: [10, 30, 30, 30], culture: [0, 1, 1, 3], religion: [0, 1, 1, 2], burg: [0, 0, 1, 0] }
    });
  });

  it("sets origins without loops and short codes", () => {
    Cultures.setOrigins(3, [1, 2]);
    expect(pack.cultures[3].origins).toEqual([1, 2]);
    expect(() => Cultures.setOrigins(1, [3])).toThrow("descends from 1");
    expect(() => Cultures.setOrigins(2, [2])).toThrow("descends from 2");
    expect(() => Religions.setOrigins(2, [0, 0 + 9])).toThrow("Origin 9 does not exist");
    Religions.setCode(2, "Sol");
    expect(pack.religions[2].code).toBe("Sol");
    expect(() => Cultures.setCode(1, "Long")).toThrow("1 to 3 characters");
  });

  it("moves centers onto free land and paints cells, burgs following the culture", () => {
    vi.spyOn(Pack, "requireCell").mockReturnValue(3);
    expect(() => Cultures.moveCenter(1, 0, 0)).toThrow("already the center of culture 3");
    vi.spyOn(Pack, "requireCell").mockReturnValue(1);
    Cultures.moveCenter(1, 0, 0);
    expect(pack.cultures[1].center).toBe(1);
    Cultures.setCells(3, [2]);
    expect(pack.cells.culture[2]).toBe(3);
    expect(pack.burgs[1].culture).toBe(3);
    Religions.setCells(0, [1, 2]);
    expect([...pack.cells.religion]).toEqual([0, 0, 0, 2]);
    expect(() => Religions.setCells(1, [0])).toThrow("water");
  });

  it("gives a culture's heraldic emblems its shield shape, leaving pictures alone", () => {
    Cultures.setEmblemShape(1, "french");
    expect(pack.cultures[1].shield).toBe("french");
    expect(pack.states[1].coa!.shield).toBe("french");
    expect(pack.burgs[1].coa!.shield).toBe("french");
    expect(pack.provinces[1].coa).toEqual({ icon: "castle" });
    expect(() => Cultures.setEmblemShape(1, "blob")).toThrow("The shape must be one of");
  });
});

describe("Lore", () => {
  it("renames the map and sets its calendar and description", () => {
    const lore = { name: "Old", description: "", calendar: { year: 1, era: "Old Era", eraShort: "OE" } };
    vi.stubGlobal("options", { map: { lore } });
    Lore.rename(" Saltmarsh ");
    Lore.setYear(1204.4);
    Lore.setEra("Age of Ash", "AA");
    Lore.setDescription("Wet.");
    expect(lore).toEqual({
      name: "Saltmarsh",
      description: "Wet.",
      calendar: { year: 1204, era: "Age of Ash", eraShort: "AA" }
    });
    Lore.setEra("Winter Era");
    expect(lore.calendar.eraShort).toBe("WE");
    expect(() => Lore.rename(" ")).toThrow("must not be empty");
    expect(() => Lore.setYear(Number.NaN)).toThrow("The year must be a number");
  });
});

describe("Biomes and Features", () => {
  it("paints land cells with a living biome", () => {
    vi.stubGlobal("pack", {
      biomes: [{ i: 0 }, { i: 1 }, { i: 2, removed: true }],
      cells: { i: [0, 1, 2], h: Uint8Array.from([10, 30, 30]), biome: Uint8Array.from([0, 1, 0]) }
    });
    Biomes.setCells(1, [2]);
    expect(() => Biomes.setCells(1, [0])).toThrow("is water");
    expect(() => Biomes.setCells(0, [1])).toThrow("water biome");
    expect(() => Biomes.setCells(2, [1])).toThrow("Biome 2 does not exist");
    expect([...pack.cells.biome]).toEqual([0, 1, 1]);
  });

  it("adds custom biomes and removes only unused custom ones", () => {
    vi.stubGlobal("pack", {
      biomes: Array.from({ length: 13 }, (_, i) => ({ i, name: `B${i}` })),
      cells: { biome: Uint8Array.from([1, 12]) }
    });
    expect(Biomes.add("Ashland", "#555555", 5)).toBe(13);
    expect(pack.biomes[13]).toMatchObject({ i: 13, name: "Ashland", color: "#555555", habitability: 5 });
    expect(() => Biomes.remove(12)).toThrow("generated biome");
    pack.cells.biome[1] = 13;
    expect(() => Biomes.remove(13)).toThrow("still has cells");
    pack.cells.biome[1] = 12;
    Biomes.remove(13);
    expect(pack.biomes[13].removed).toBe(true);
  });

  it("sets subtypes within the type, lake groups and own coastlines", () => {
    vi.stubGlobal("pack", {
      features: [0, { i: 1, type: "lake", subtype: "freshwater" }, { i: 2, type: "island", subtype: "lake_island" }]
    });
    vi.stubGlobal("styles", { lakes: { groups: { freshwater: {}, salt: {} } } });
    vi.stubGlobal("options", { map: { coastline: { enabled: true, maxDepth: 4 } } });
    Features.setSubtype(1, "salt");
    expect(pack.features[1].subtype).toBe("salt");
    expect(() => Features.setSubtype(1, "sea")).toThrow("The subtype must be one of");
    expect(() => Features.setSubtype(2, "isle")).toThrow("lake island");
    Features.setGroup(1, "salt");
    expect(pack.features[1].group).toBe("salt");
    expect(() => Features.setGroup(2, "salt")).toThrow("not a lake");
    Features.setCoastline(1, { maxDepth: 2 });
    expect(pack.features[1].coastline).toEqual({ enabled: true, maxDepth: 2 });
    expect(() => Features.setCoastline(1, { maxDepth: "2" } as never)).toThrow("must be a number");
    Features.setCoastline(1, null);
    expect("coastline" in pack.features[1]).toBe(false);
  });
});

describe("Rivers and Routes", () => {
  it("sets a mainstem without loops and a width", () => {
    vi.stubGlobal("pack", {
      rivers: [
        { i: 1, parent: 0, basin: 1, cells: [] },
        { i: 2, parent: 1, basin: 1, cells: [] },
        { i: 3, parent: 0, basin: 3, cells: [] }
      ]
    });
    vi.spyOn(Rivers, "updateWidth").mockImplementation(() => {});
    expect(() => Rivers.setParent(1, 2)).toThrow("flows into river 1");
    Rivers.setParent(1, 3);
    expect(pack.rivers.map(({ basin }) => basin)).toEqual([3, 3, 3]);
    Rivers.setWidth(2, 0.5, 1.2);
    expect(pack.rivers[1]).toMatchObject({ sourceWidth: 0.5, widthFactor: 1.2 });
    expect(() => Rivers.setWidth(2, -1, 1)).toThrow("non-negative");
  });

  it("creates, splits and joins routes with their cell links", () => {
    vi.stubGlobal("pack", { routes: [], cells: { f: [1, 1, 1, 1], routes: {} } });
    vi.stubGlobal("styles", { routes: { groups: { roads: {} } } });
    vi.spyOn(Pack, "requireCell").mockImplementation((x: unknown) => x as number);
    const id = Routes.create(
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0]
      ],
      "roads"
    );
    expect(pack.cells.routes[1]).toEqual({ 0: id, 2: id });
    const tail = Routes.split(id, 2);
    expect(pack.routes.map(({ points }) => points.map(point => point[2]))).toEqual([
      [0, 1, 2],
      [2, 3]
    ]);
    expect(pack.cells.routes[3]).toEqual({ 2: tail });
    expect(() => Routes.split(id, 0)).toThrow("not an inner point");
    Routes.join(id, tail);
    expect(pack.routes.map(({ i }) => i)).toEqual([id]);
    expect(pack.cells.routes[3]).toEqual({ 2: id });
  });
});

describe("Markers and Labels", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      markers: [{ i: 0, x: 1, y: 1, cell: 0 }],
      states: [{ i: 0 }, { i: 1, label: { dx: 5 } }],
      provinces: [],
      burgs: [],
      rivers: [],
      routes: [],
      addedLabels: [{ i: 1, label: { text: "Here", group: "added", dx: 3 } }]
    });
    vi.stubGlobal("options", {
      map: {
        labels: {
          groups: [
            { name: "states", type: "state" },
            { name: "added", type: "added" }
          ]
        }
      }
    });
  });

  it("moves, pins and restyles markers within the editor's bounds", () => {
    vi.spyOn(Pack, "requireCell").mockReturnValue(4);
    Markers.move(0, 10.04, 20.06);
    expect(pack.markers[0]).toMatchObject({ x: 10, y: 20.1, cell: 4 });
    Markers.setPinned(0, true);
    Markers.setAppearance(0, { size: 40, pin: "shield", fill: "#ff0000" });
    expect(pack.markers[0]).toMatchObject({ pinned: true, size: 40, pin: "shield", fill: "#ff0000" });
    expect(() => Markers.setAppearance(0, { pin: "star" })).toThrow("The pin must be one of");
    expect(() => Markers.setAppearance(0, { fill: 'red" onload="x' })).toThrow("HEX color");
    Markers.setAppearance(0, { fill: null });
    expect("fill" in pack.markers[0]).toBe(false);
  });

  it("regroups, lays out and resets labels of any entity", () => {
    Labels.setGroup("state", 1, "states");
    expect(pack.states[1].label).toEqual({ dx: 5, group: "states" });
    expect(() => Labels.setGroup("state", 1, "nope")).toThrow("The label group must be one of");
    Labels.setLayout("added", 1, { fontSize: 150, hidden: true, dx: null });
    expect(pack.addedLabels[0].label).toEqual({ text: "Here", group: "added", fontSize: 150, hidden: true });
    expect(() => Labels.setLayout("added", 1, { fontSize: 5 })).toThrow("from 30 to 300");
    Labels.reset("added", 1);
    expect(pack.addedLabels[0].label).toEqual({ text: "Here", group: "added" });
    expect(() => Labels.reset("burg", 9)).toThrow("burg label 9 does not exist");
  });
});

describe("Military", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [
        { i: 0 },
        { i: 1, military: [{ i: 0, u: { infantry: 5, archers: 3 }, a: 8, x: 10, y: 10, n: 0 }] },
        { i: 2, military: [{ i: 0, u: { infantry: 1 }, a: 1, x: 0, y: 0, n: 0 }] }
      ],
      cells: { p: [[5, 6]], h: [30] }
    });
    vi.stubGlobal("options", {
      map: { military: { units: [{ name: "infantry" }, { name: "archers" }] }, graph: { width: 100, height: 100 } }
    });
    vi.stubGlobal("styles", { military: { options: { boxSize: 3 } } });
    vi.spyOn(Military, "getName").mockReturnValue("New");
    vi.spyOn(Military, "generateNote").mockImplementation(() => {});
  });

  it("sets a state's alert, scaling its regiments", () => {
    pack.states[1].alert = 2;
    Military.setAlert(1, 1);
    expect(pack.states[1].alert).toBe(1);
    expect(pack.states[1].military![0]).toMatchObject({ u: { infantry: 3, archers: 2 }, a: 5 });
    expect(() => Military.setAlert(1, -1)).toThrow("non-negative");
    expect(() => Military.setAlert(0, 1)).toThrow("State 0 does not exist");
  });

  it("sets regiment icons as references, turning text into a glyph", () => {
    Military.setIcon(1, 0, "⚔️");
    expect(pack.states[1].military![0].icon).toBe("glyph-2694-fe0f");
  });

  it("raises, staffs, splits and attaches regiments", () => {
    vi.spyOn(Pack, "requireCell").mockReturnValue(0);
    const id = Military.add(1, 5, 6);
    expect(pack.states[1].military![1]).toMatchObject({ i: id, x: 5, y: 6, bx: 5, by: 6, n: 0, a: 0, name: "New" });
    Military.setUnits(1, id, { infantry: 4 });
    expect(pack.states[1].military![1]).toMatchObject({ u: { infantry: 4 }, a: 4 });
    expect(() => Military.setUnits(1, id, { dragons: 1 })).toThrow("The unit must be one of");
    const half = Military.split(1, 0);
    expect(pack.states[1].military!.find(({ i }) => i === half)).toMatchObject({
      u: { infantry: 2, archers: 1 },
      a: 3,
      y: 16
    });
    expect(pack.states[1].military![0]).toMatchObject({ u: { infantry: 3, archers: 2 }, a: 5 });
    Military.attach(1, 0, 2, 0);
    expect(pack.states[2].military![0]).toMatchObject({ u: { infantry: 4, archers: 2 }, a: 6 });
    expect(pack.states[1].military!.some(({ i }) => i === 0)).toBe(false);
    expect(() => Military.rotate(1, id, 270)).toThrow("from -180 to 180");
  });
});

describe("Emblems", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      states: [{ i: 0 }, { i: 1, coa: { t1: "or", shield: "heater", size: 2, x: 5, y: 6 } }],
      provinces: [{ i: 0 }],
      burgs: [0]
    });
    vi.stubGlobal("options", { map: { graph: { width: 100, height: 100 } } });
  });

  it("sets a heraldic emblem in the generator's vocabulary, keeping its placement", () => {
    Emblems.set("state:1", { t1: "azure", shield: "french", division: { division: "perPale", t: "or" } });
    expect(pack.states[1].coa).toEqual({
      t1: "azure",
      shield: "french",
      division: { division: "perPale", t: "or" },
      size: 2,
      x: 5,
      y: 6
    });
    expect(() => Emblems.set("state:1", { t1: "plaid" })).toThrow("field tincture");
    expect(() => Emblems.set("burg:1", { t1: "or" })).toThrow("not a state, province or burg");
  });

  it("places an emblem on the map, null returning it to automatic", () => {
    Emblems.place("state:1", 50, null, 1.5);
    expect(pack.states[1].coa).toMatchObject({ x: 50, size: 1.5 });
    expect("y" in pack.states[1].coa!).toBe(false);
    expect(() => Emblems.place("state:1", 500, 1, 1)).toThrow("from 0 to 100");
  });
});

describe("Journeys", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      journeys: [
        {
          i: 0,
          name: "Quest",
          type: "Quest",
          color: "#000000",
          segments: [
            { i: 0, name: "A", transport: "Walk", speed: 5, distance: 0, points: [] },
            { i: 1, name: "B", transport: "Walk", speed: 5, distance: 0, points: [] }
          ]
        }
      ],
      cells: { i: [0, 1, 2] }
    });
  });

  it("edits journeys and their segments", () => {
    vi.spyOn(Transports, "getDomain").mockReturnValue("land");
    Journeys.rename(0, "Pilgrimage");
    Journeys.setHidden(0, true);
    expect(pack.journeys[0]).toMatchObject({ name: "Pilgrimage", visible: false });
    Journeys.moveSegment(0, 1, 0);
    expect(pack.journeys[0].segments.map(({ i }) => i)).toEqual([1, 0]);
    Journeys.setSegment(0, 1, { name: "Start", duration: 4, color: "#00ff00", hidden: true });
    expect(pack.journeys[0].segments[0]).toMatchObject({
      name: "Start",
      duration: 4,
      color: "#00ff00",
      visible: false
    });
    expect(() => Journeys.setSegment(0, 1, { teleport: true } as never)).toThrow("Unknown segment field teleport");
    expect(() => Journeys.setSegment(0, 1, { speed: -1 })).toThrow("non-negative");
    Journeys.removeSegment(0, 1);
    expect(pack.journeys[0].segments.map(({ i }) => i)).toEqual([0]);
    Journeys.remove(0);
    expect(() => Journeys.remove(0)).toThrow("Journey 0 does not exist");
  });
});

describe("Goods and Markets", () => {
  beforeEach(() => {
    vi.stubGlobal("pack", {
      goods: [
        { i: 1, name: "Salt", tags: [], value: 2, unit: "", icon: "🧂", color: "#ffffff" },
        { i: 2, name: "Fish", tags: [], value: 1, unit: "", icon: "🐟", color: "#0000ff" }
      ],
      markets: [{ i: 1, centerBurgId: 1, color: "#000000", goods: {} }]
    });
  });

  it("edits goods and their production rules, never their distribution code", () => {
    Goods.rename(1, "Rock salt");
    Goods.setPrice(1, 3);
    Goods.setTags(1, ["Food", " food", "trade"]);
    Goods.setProduction(1, { chance: 20, recipes: [{ 2: 1 }], multipliers: { cultureType: { Naval: 2 } } });
    expect(pack.goods[0]).toMatchObject({
      name: "Rock salt",
      value: 3,
      tags: ["food", "trade"],
      chance: 20,
      recipes: [{ 2: 1 }],
      multipliers: { cultureType: { Naval: 2 } }
    });
    expect(() => Goods.setProduction(1, { distribution: "alert(1)" } as never)).toThrow(
      "Unknown production rule distribution"
    );
    expect(() => Goods.setProduction(1, { recipes: [{ 9: 1 }] })).toThrow("unknown 9");
    Goods.setProduction(1, { recipes: null });
    expect("recipes" in pack.goods[0]).toBe(false);
  });

  it("renames markets, empty taking the burg's name again", () => {
    Markets.rename(1, "Grand Bazaar");
    Markets.recolor(1, "#123456");
    expect(pack.markets[0]).toMatchObject({ name: "Grand Bazaar", color: "#123456" });
    Markets.rename(1, " ");
    expect("name" in pack.markets[0]).toBe(false);
    expect(() => Markets.rename(9, "X")).toThrow("Market 9 does not exist");
  });
});
