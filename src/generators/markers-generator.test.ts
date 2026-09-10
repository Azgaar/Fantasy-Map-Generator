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
