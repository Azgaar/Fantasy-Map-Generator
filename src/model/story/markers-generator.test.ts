import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Goods } from "@/model/economy/goods-generator";
import { Names } from "@/model/society/names-generator";
import type { Marker } from "./markers-generator";
import { Markers } from "./markers-generator";

const NAV_KEY = "navigator";

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, NAV_KEY, {
    value,
    configurable: true,
    writable: true
  });
}

describe("MarkersModule.addEncounter", () => {
  let markers: any;
  const CELL = 1;
  let originalNavigatorDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, NAV_KEY);

    options.map.cultures.set = "world";
    globalThis.window = globalThis.window || ({} as any);

    globalThis.pack = {
      cells: {
        culture: Uint8Array.from([0, 2, 0, 0]),
        biome: Uint8Array.from([0, 3, 0, 0])
      },
      biomes: [{ name: "" }, { name: "" }, { name: "" }, { name: "Forest" }]
    } as any;

    Object.assign(Names, {
      getCulture: () => "Aeloran"
    });

    await import("./markers-generator");
    markers = Markers;
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, NAV_KEY, originalNavigatorDescriptor);
    } else {
      delete (globalThis as any)[NAV_KEY];
    }
  });

  it("uses the Deorum iframe legend when the browser is online", () => {
    setNavigator({ onLine: true });

    const marker = { i: 42, cell: CELL } as Marker;
    markers.addEncounter(marker, CELL);

    expect(marker.name).toBe("Random encounter");
    expect(String(marker.note).includes(`https://deorum.vercel.app/encounter/${CELL}`)).toBe(true);
    expect(String(marker.note).includes("<iframe")).toBe(true);
  });

  it("falls back to a procedural culture/biome legend when offline", () => {
    setNavigator({ onLine: false });

    const marker = { i: 7, cell: CELL } as Marker;
    markers.addEncounter(marker, CELL);

    expect(String(marker.note).includes("iframe")).toBe(false);
    expect(String(marker.note).includes("deorum")).toBe(false);
    expect(String(marker.note).includes("Aeloran")).toBe(true);
    expect(String(marker.note).includes("forest")).toBe(true);
  });

  it("treats a missing navigator (SSR / Node) as online", () => {
    setNavigator(undefined);

    const marker = { i: 9, cell: CELL } as Marker;
    markers.addEncounter(marker, CELL);

    expect(String(marker.note).includes("deorum.vercel.app")).toBe(true);
  });
});

describe("MarkersModule.rename", () => {
  it("renames a marker by id", async () => {
    await import("./markers-generator");
    globalThis.pack = { markers: [{ i: 4, name: "Old Well" }] } as any;
    Markers.rename(4, "Wishing Well");
    expect(pack.markers[0].name).toBe("Wishing Well");
    expect(() => Markers.rename(0, "X")).toThrow("Marker 0 does not exist");
  });
});

describe("MarkersModule mines", () => {
  it("places mines in burgs on an ore or mineral, played out where the burg extracts none", async () => {
    await import("./markers-generator");
    const goods = [
      { i: 1, name: "Iron", tags: ["ore"] },
      { i: 2, name: "Grain", tags: ["food"] }
    ];
    Object.assign(Goods, { get: (id: number) => goods.find(good => good.i === id) });
    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        burg: [0, 1, 2, 3],
        good: [1, 1, 2, 1]
      },
      burgs: [
        {},
        { i: 1, name: "Ironton", population: 1, production: [[1, 2]] },
        { i: 2, name: "Farmton", population: 1, production: [[2, 2]] },
        { i: 3, name: "Smithton", population: 1, production: [[3, 2]] } // sits on iron but makes no iron
      ],
      deals: [[1, 1, 1, 0, 2, 1, 0, 0, 0]]
    } as any;
    const markers = Markers as any;

    expect(markers.listMines(pack)).toEqual([1, 3]);
    const mine = { i: 0, cell: 1 } as Marker;
    markers.addMine(mine, 1);
    expect(mine.name).toBe("Ironton — iron mining town");
    const old = { i: 1, cell: 3 } as Marker;
    markers.addMine(old, 3);
    expect(old.name).toBe("Smithton — old iron mine");
  });
});

describe("MarkersModule weighted pick", () => {
  it("draws once, in proportion to the weights, and removes the pick", () => {
    const markers = Markers as any;
    const random = Math.random;
    Math.random = () => 0.5;
    const cells = [10, 11, 12];
    const weights = [1, 0, 3];
    expect(markers.extractWeighted(cells, weights)).toEqual([12]);
    expect(cells).toEqual([10, 11]);
    expect(weights).toEqual([1, 0]);
    expect(markers.extractWeighted([7, 8], [0, 0])).toEqual([8]); // uniform without any weight
    Math.random = random;
  });
});

describe("MarkersModule guild halls", () => {
  const cloth = { i: 1, name: "Cloth", tags: [], value: 10, recipes: [{ 2: 1 }] };
  const wool = { i: 2, name: "Wool", tags: [], value: 1 };
  const guildsOf = (production: Record<number, number[][]>, states: Record<number, number> = {}) => {
    Object.assign(Goods, { get: (id: number) => [cloth, wool].find(good => good.i === id) });
    const burgs = Object.entries(production).map(([i, made]) => ({ i: +i, state: states[+i] ?? 1, production: made }));
    globalThis.pack = { burgs: [{}, ...burgs] } as any;
    return (Markers as any).indexGuilds() as Map<number, { good: { i: number }; renown: number }>;
  };

  it("fames a burg that leads the good's many makers, without a set share of the world", () => {
    const small = Object.fromEntries(Array.from({ length: 24 }, (_, k) => [k + 2, [[1, 0.5]]]));
    const guilds = guildsOf({ 1: [[1, 3]], ...small }); // 20% of the world and of its state, among 25 makers
    expect(guilds.has(1)).toBe(false); // 0.2 × √(25 × 0.2) is short of it

    const elsewhere = Object.fromEntries(Object.keys(small).map(i => [i, 2]));
    const famed = guildsOf({ 1: [[1, 3]], ...small }, elsewhere); // the same, and all of its state
    expect(famed.get(1)?.good.i).toBe(1);
    expect(famed.size).toBe(1);
  });

  it("skips a good that is a burg's sideline or too little", () => {
    expect(guildsOf({ 1: [[1, 1]] }).size).toBe(0); // worth 10 a day
    const silk = { i: 3, name: "Silk", tags: [], value: 100, recipes: [{ 2: 1 }] };
    Object.assign(Goods, { get: (id: number) => [cloth, wool, silk].find(good => good.i === id) });
    globalThis.pack = {
      burgs: [
        {},
        {
          i: 1,
          state: 1,
          production: [
            [1, 2],
            [3, 1]
          ]
        }
      ]
    } as any;
    expect((Markers as any).indexGuilds().get(1).good).toBe(silk); // cloth is a sixth of its work
  });

  it("skips raw goods and removed burgs", () => {
    expect(guildsOf({ 1: [[2, 500]] }).size).toBe(0);
    Object.assign(Goods, { get: () => cloth });
    globalThis.pack = { burgs: [{}, { i: 1, removed: true, production: [[1, 50]] }] } as any;
    expect((Markers as any).indexGuilds().size).toBe(0);
  });
});

describe("MarkersModule migrations", () => {
  it("picks animals native to the biome and skips biomes without migrations", async () => {
    await import("./markers-generator");
    globalThis.pack = {
      cells: { i: [0, 1, 2], h: [30, 30, 30], pop: [0, 0, 0], biome: [10, 11, 1] }
    } as any;
    const markers = Markers as any;

    expect(markers.listMigrations(pack)).toEqual([0, 2]);
    const marker = { i: 0, cell: 0 } as Marker;
    markers.addMigration(marker, 0);
    expect(["Reindeer", "Musk oxen", "Wolves", "Foxes", "Geese", "Hares", "Owls"]).toContain(
      marker.name.replace(" migration", "")
    );
  });
});

describe("MarkersModule customs houses", () => {
  it("lists one road crossing for each pair of states trading under tariffs", () => {
    const markers = Markers as any;
    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3, 4],
        state: [1, 2, 1, 2, 3],
        // 0-1 and 2-3 cross by road between states 1 and 2; 3-4 by a trail into state 3
        routes: [{ 1: 0 }, { 0: 0 }, { 3: 0 }, { 2: 0, 4: 1 }, { 3: 1 }]
      },
      routes: [
        { i: 0, group: "roads" },
        { i: 1, group: "trails" }
      ]
    } as any;
    markers.tradeSource = pack.deals;
    markers.tradeIndex = {
      tariffs: new Map([
        [markers.getStatePair(1, 2), 5],
        [markers.getStatePair(2, 3), 9]
      ])
    };
    expect(markers.listCustomsHouses(pack)).toEqual([0]);
    expect(markers.getCustomsBorder(3)).toEqual({ state: 1, tariffs: 5 });
    markers.tradeIndex = undefined;
  });
});

describe("MarkersModule trade index", () => {
  it("sums the economy run again once its deals are replaced", () => {
    const markers = Markers as any;
    globalThis.pack = { burgs: [{}], markets: [], deals: [] } as any;
    const first = markers.trade;
    expect(markers.trade).toBe(first);
    pack.deals = [];
    expect(markers.trade).not.toBe(first);
  });
});
