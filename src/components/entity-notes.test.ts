import { beforeEach, describe, expect, it } from "vitest";
import {
  getElementId,
  getEntityName,
  getNote,
  listNotes,
  parseRefKey,
  refKey,
  removeNote,
  resolveElementId,
  setNote
} from "./entity-notes";

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

describe("resolveElementId", () => {
  it.each([
    ["burg7", { type: "burg", id: 7 }],
    ["burgLabel7", { type: "burg", id: 7 }],
    ["stateLabel3", { type: "state", id: 3 }],
    ["provinceLabel2", { type: "province", id: 2 }],
    ["river12", { type: "river", id: 12 }],
    ["riverLabel12", { type: "river", id: 12 }],
    ["route5", { type: "route", id: 5 }],
    ["routeLabel5", { type: "route", id: 5 }],
    ["feature_9", { type: "feature", id: 9 }],
    ["marker4", { type: "marker", id: 4 }],
    ["zone1", { type: "zone", id: 1 }],
    ["journey2", { type: "journey", id: 2 }],
    ["segment2_5", { type: "journey", id: 2 }],
    ["market8", { type: "market", id: 8 }],
    ["addedLabel6", { type: "addedLabel", id: 6 }],
    ["regiment3-1", { type: "regiment", id: 3, sub: 1 }]
  ])("maps %s to its entity", (elementId, expected) => {
    expect(resolveElementId(elementId)).toEqual(expected);
  });

  it.each(["freshwater", "viewbox", "", null, undefined, "burg", "notAnId12"])("ignores %s", elementId => {
    expect(resolveElementId(elementId)).toBeUndefined();
  });

  it("round-trips a reference through its element id", () => {
    expect(getElementId({ type: "regiment", id: 3, sub: 1 })).toBe("regiment3-1");
    expect(resolveElementId(getElementId({ type: "feature", id: 9 })!)).toEqual({ type: "feature", id: 9 });
  });

  it("has no element for an entity that is not drawn on its own", () => {
    expect(getElementId({ type: "culture", id: 1 })).toBeUndefined();
  });
});

describe("note access", () => {
  it("reads and writes the note on the entity", () => {
    const ref = { type: "burg", id: 1 } as const;
    expect(getNote(ref)).toBe("A river port");

    setNote(ref, "Rebuilt after the flood");
    expect(pack.burgs[1].note).toBe("Rebuilt after the flood");
  });

  it("removes the field rather than storing an empty note", () => {
    removeNote({ type: "burg", id: 1 });
    expect("note" in pack.burgs[1]).toBe(false);
  });

  it("reports a missing entity instead of creating one", () => {
    expect(setNote({ type: "burg", id: 99 }, "ghost")).toBe(false);
    expect(pack.burgs).toHaveLength(2);
  });

  it("addresses a regiment through its state", () => {
    const ref = { type: "regiment", id: 1, sub: 0 } as const;
    expect(getNote(ref)).toBe("Elite");
    expect(getEntityName(ref)).toBe("1st Cavalry");
  });

  it("names a state by its full name and a river by name and type", () => {
    expect(getEntityName({ type: "state", id: 1 })).toBe("Duchy of Ardenia");
    expect(getEntityName({ type: "river", id: 1 })).toBe("Ald River");
  });
});

describe("keys", () => {
  it.each([
    [{ type: "burg", id: 1 } as const, "burg:1"],
    [{ type: "regiment", id: 3, sub: 2 } as const, "regiment:3-2"]
  ])("round-trips %o", (ref, key) => {
    expect(refKey(ref)).toBe(key);
    expect(parseRefKey(key)).toEqual(ref);
  });

  it("rejects a key of an unknown type", () => {
    expect(parseRefKey("dragon:1")).toBeUndefined();
    expect(parseRefKey("burg")).toBeUndefined();
  });
});

describe("listNotes", () => {
  it("collects notes from every collection, grouped by entity type", () => {
    expect(listNotes().map(entry => entry.key)).toEqual([
      "burg:1",
      "marker:4",
      "feature:1",
      "regiment:1-0",
      "culture:1"
    ]);
  });

  it("skips entities without a note", () => {
    expect(listNotes().some(entry => entry.key === "zone:1")).toBe(false);
  });

  it("labels each entry with the entity name", () => {
    expect(listNotes().find(entry => entry.key === "marker:4")?.label).toBe("Mount Doom");
  });
});
