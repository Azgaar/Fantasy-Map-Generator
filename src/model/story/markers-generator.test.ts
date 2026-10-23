import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Marker } from "./markers-generator";

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

    globalThis.TIME = false;
    options.map.cultures.set = "world";
    globalThis.window = globalThis.window || ({} as any);

    globalThis.pack = {
      cells: {
        culture: Uint8Array.from([0, 2, 0, 0]),
        biome: Uint8Array.from([0, 3, 0, 0])
      },
      biomes: [{ name: "" }, { name: "" }, { name: "" }, { name: "Forest" }]
    } as any;

    globalThis.Names = {
      getCulture: () => "Aeloran"
    } as any;

    await import("./markers-generator");
    markers = globalThis.Markers;
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
    globalThis.Markers.rename(4, "Wishing Well");
    expect(pack.markers[0].name).toBe("Wishing Well");
    expect(() => globalThis.Markers.rename(0, "X")).toThrow("Marker 0 does not exist");
  });
});

describe("MarkersModule mines", () => {
  it("places mines only in burgs extracting an ore or mineral, named after it", async () => {
    await import("./markers-generator");
    const goods = [
      { i: 1, name: "Iron", tags: ["ore"] },
      { i: 2, name: "Grain", tags: ["food"] }
    ];
    globalThis.Goods = { get: (id: number) => goods.find(good => good.i === id) } as any;
    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        burg: [0, 1, 2, 3],
        good: [1, 1, 2, 1]
      },
      burgs: [
        {},
        { name: "Ironton", population: 1, production: [{ goodId: 1, units: 2 }] },
        { name: "Farmton", population: 1, production: [{ goodId: 2, units: 2 }] },
        { name: "Smithton", population: 1, production: [{ goodId: 1, units: 2, recipe: [] }] }
      ]
    } as any;
    const markers = globalThis.Markers as any;

    expect(markers.listMines(pack)).toEqual([1]);
    const marker = { i: 0, cell: 1 } as Marker;
    markers.addMine(marker, 1);
    expect(marker.name).toBe("Ironton — iron mining town");
  });
});

describe("MarkersModule migrations", () => {
  it("picks animals native to the biome and skips biomes without migrations", async () => {
    await import("./markers-generator");
    globalThis.pack = {
      cells: { i: [0, 1, 2], h: [30, 30, 30], pop: [0, 0, 0], biome: [10, 11, 1] }
    } as any;
    const markers = globalThis.Markers as any;

    expect(markers.listMigrations(pack)).toEqual([0, 2]);
    const marker = { i: 0, cell: 0 } as Marker;
    markers.addMigration(marker, 0);
    expect(["Reindeer", "Musk oxen", "Wolves", "Foxes", "Geese", "Hares", "Owls"]).toContain(
      marker.name.replace(" migration", "")
    );
  });
});
