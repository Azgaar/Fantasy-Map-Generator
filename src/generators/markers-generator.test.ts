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
});
