import { beforeEach, describe, expect, it } from "vitest";
import { MapEntities } from "@/components/map-entities";
import { Notes } from "./notes";

beforeEach(() => {
  globalThis.pack = {
    burgs: [0, { i: 1, name: "Vaeltown", note: "A river port" }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Ardenia", fullName: "Duchy of Ardenia", military: [{ i: 0, name: "1st Cavalry", note: "Elite" }] }
    ],
    markers: [{ i: 4, type: "volcanoes", name: "Mount Doom", note: "Active volcano" }],
    rivers: [0, { i: 1, name: "Ald", type: "River" }],
    features: [0, { i: 1, name: "Mirror Lake", note: "Deep and cold" }],
    zones: [0, { i: 1, name: "Plague" }],
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Aeloran", note: "Horse people" }
    ],
    routes: [],
    provinces: [],
    journeys: [],
    markets: [],
    addedLabels: [],
    religions: [],
    biomes: [],
    goods: []
  } as unknown as typeof pack;
});

describe("note access", () => {
  it("reads and writes the note on the entity", () => {
    const ref = { type: "burg", id: 1 } as const;
    expect(Notes.get(ref)).toBe("A river port");

    Notes.set(ref, "Rebuilt after the flood");
    expect(pack.burgs[1].note).toBe("Rebuilt after the flood");
  });

  it("removes the field rather than storing an empty note", () => {
    Notes.remove({ type: "burg", id: 1 });
    expect("note" in pack.burgs[1]).toBe(false);
  });

  it("reports a missing entity instead of creating one", () => {
    expect(Notes.set({ type: "burg", id: 99 }, "ghost")).toBe(false);
    expect(pack.burgs).toHaveLength(2);
  });

  it("addresses a regiment through its state", () => {
    const ref = { type: "regiment", id: 1, sub: 0 } as const;
    expect(Notes.get(ref)).toBe("Elite");
    expect(MapEntities.getName(ref)).toBe("1st Cavalry");
  });

  it("names a state by its full name and a river by name and type", () => {
    expect(MapEntities.getName({ type: "state", id: 1 })).toBe("Duchy of Ardenia");
    expect(MapEntities.getName({ type: "river", id: 1 })).toBe("Ald River");
  });
});

describe("listNotes", () => {
  it("collects notes from every collection, grouped by entity type", () => {
    expect(Notes.list().map(entry => entry.key)).toEqual([
      "burg:1",
      "marker:4",
      "feature:1",
      "regiment:1-0",
      "culture:1"
    ]);
  });

  it("skips entities without a note", () => {
    expect(Notes.list().some(entry => entry.key === "zone:1")).toBe(false);
  });

  it("labels each entry with the entity name", () => {
    expect(Notes.list().find(entry => entry.key === "marker:4")?.label).toBe("Mount Doom");
  });
});

it("collects notes on route zero and omits removed entities", () => {
  pack.routes = [{ i: 0, name: "First road", note: "Oldest trade route" }] as typeof pack.routes;
  pack.burgs[1].removed = true;
  expect(Notes.list().some(entry => entry.key === "route:0")).toBe(true);
  expect(Notes.list().some(entry => entry.key === "burg:1")).toBe(false);
});
