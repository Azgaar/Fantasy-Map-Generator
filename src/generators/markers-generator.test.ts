import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

    globalThis.notes = [];

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

    markers.addEncounter("marker42", CELL);

    const note = globalThis.notes[0];
    expect(note.id).toBe("marker42");
    expect(note.name).toBe("Random encounter");
    expect(String(note.legend).includes(`https://deorum.vercel.app/encounter/${CELL}`)).toBe(true);
    expect(String(note.legend).includes("<iframe")).toBe(true);
  });

  it("falls back to a procedural culture/biome legend when offline", () => {
    setNavigator({ onLine: false });

    markers.addEncounter("marker7", CELL);

    const note = globalThis.notes[0];
    expect(note.id).toBe("marker7");
    expect(String(note.legend).includes("iframe")).toBe(false);
    expect(String(note.legend).includes("deorum")).toBe(false);
    expect(String(note.legend).includes("Aeloran")).toBe(true);
    expect(String(note.legend).includes("forest")).toBe(true);
  });

  it("treats a missing navigator (SSR / Node) as online", () => {
    setNavigator(undefined);

    markers.addEncounter("marker9", CELL);

    const note = globalThis.notes[0];
    expect(String(note.legend).includes("deorum.vercel.app")).toBe(true);
  });

  it("builds ordered candidate buckets in one pass", () => {
    const candidatePack = {
      cells: {
        i: [0, 1, 2, 3, 4, 5],
        h: Uint8Array.from([10, 20, 49, 50, 70, 80]),
        burg: Uint8Array.from([0, 1, 0, 0, 2, 0]),
        r: Uint8Array.from([0, 0, 3, 0, 0, 4]),
        culture: Uint8Array.from([0, 1, 1, 0, 2, 0]),
        pop: Float32Array.from([0, 2, 0, 4, 0, 1]),
        harbor: Uint8Array.from([0, 7, 2, 0, 8, 0]),
        biome: Uint8Array.from([0, 1, 2, 1, 2, 1])
      },
      biomes: [{ habitability: 0 }, { habitability: 5 }, { habitability: 0 }]
    } as any;

    const index = markers.buildCandidateIndex(candidatePack);

    expect(index.burg).toEqual([1, 4]);
    expect(index.river).toEqual([2, 5]);
    expect(index.land).toEqual([1, 2, 3, 4, 5]);
    expect(index.water).toEqual([0]);
    expect(index.high50).toEqual([3, 4, 5]);
    expect(index.high70).toEqual([4, 5]);
    expect(index.harbor).toEqual([1, 4]);
    expect(index.biome1).toEqual([1, 3, 5]);
    expect(index.habitable).toEqual([1, 3, 5]);
  });
});
