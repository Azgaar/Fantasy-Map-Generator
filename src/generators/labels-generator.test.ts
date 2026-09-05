import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LABEL_TYPES } from "./labels-generator";

let LabelsModule: typeof import("./labels-generator").LabelsModule;
let labels: import("./labels-generator").LabelsModule;

beforeAll(async () => {
  globalThis.window = globalThis as unknown as Window & typeof globalThis;
  ({ LabelsModule } = await import("./labels-generator"));
});

beforeEach(() => {
  globalThis.pack = {
    states: [{ i: 0 }, { i: 1, label: {} }],
    provinces: [],
    burgs: [],
    rivers: [],
    routes: [],
    addedLabels: [{ i: 1, label: { text: "Aldor", group: "added" } }]
  } as unknown as typeof pack;
  labels = new LabelsModule();
});

describe("LabelsModule", () => {
  it("detects entity label overrides", () => {
    expect(labels.hasOverride("state", 1)).toBe(true);
    expect(labels.hasOverride("state", 2)).toBe(false);
  });

  it("does not treat an added label's base text and group as overrides", () => {
    expect(labels.hasOverride("added", 1)).toBe(false);
  });

  it("detects presentation overrides on added labels", () => {
    pack.addedLabels[0].label.dx = 2;
    expect(labels.hasOverride("added", 1)).toBe(true);
  });

  it("restores an entity label to defaults", () => {
    labels.resetOverride("state", 1);
    expect(pack.states[1].label).toBeUndefined();
  });

  it("preserves an added label's base data on reset", () => {
    pack.addedLabels[0].label.dx = 2;
    labels.resetOverride("added", 1);
    expect(pack.addedLabels[0].label).toEqual({ text: "Aldor", group: "added" });
  });
});

describe("ensureBurgLabelGroups", () => {
  beforeEach(() => {
    globalThis.options = {
      ...globalThis.options,
      burgs: { groups: [{ name: "city" }, { name: "town" }, { name: "customgroup" }] },
      labels: {
        resizeOnZoom: true,
        showAll: false,
        groups: [{ name: "cities", type: "burg", zoom: { min: 1, max: 25 } }]
      }
    } as never;
  });

  it("adds registry entries for burg groups the label registry lacks", () => {
    labels.ensureBurgLabelGroups();
    const names = options.labels.groups.filter(g => g.type === "burg").map(g => g.name);
    expect(names.includes("city")).toBe(true);
    expect(names.includes("town")).toBe(true);
    expect(names.includes("customgroup")).toBe(true);
    // known modern names take their default bounds; unknown names get the fallback
    expect(options.labels.groups.find(g => g.name === "city")?.zoom).toEqual({ min: 1.4, max: 25 });
    expect(options.labels.groups.find(g => g.name === "customgroup")?.zoom).toEqual({ min: 2, max: 30 });
    // existing entries are left alone
    expect(options.labels.groups.find(g => g.name === "cities")?.zoom).toEqual({ min: 1, max: 25 });
  });

  it("is idempotent", () => {
    labels.ensureBurgLabelGroups();
    const count = options.labels.groups.length;
    labels.ensureBurgLabelGroups();
    expect(options.labels.groups.length).toBe(count);
  });
});

describe("parseStoredOptions", () => {
  it("restores label types whose groups are missing from the stored value", () => {
    const stored = JSON.stringify({ resizeOnZoom: true, showAll: false, groups: [] });
    const parsed = labels.parseStoredOptions(stored);
    for (const type of LABEL_TYPES) {
      expect(parsed.groups.some(group => group.type === type)).toBe(true);
    }
  });

  it("keeps stored groups the renderer can use", () => {
    const custom = { name: "outpost", type: "burg", zoom: { min: 3, max: 40 } };
    const parsed = labels.parseStoredOptions(JSON.stringify({ groups: [custom] }));
    expect(parsed.groups).toContainEqual(custom);
  });

  it("drops groups that are missing a name, a known type or zoom bounds", () => {
    const groups = [
      { type: "burg", zoom: { min: 1, max: 2 } },
      { name: "ghost", type: "spaceship", zoom: { min: 1, max: 2 } },
      { name: "noZoom", type: "burg" }
    ];
    const parsed = labels.parseStoredOptions(JSON.stringify({ groups }));
    const names = parsed.groups.map(group => group.name);
    expect(names.includes("ghost")).toBe(false);
    expect(names.includes("noZoom")).toBe(false);
  });

  it("falls back to the defaults when the stored value is absent or unusable", () => {
    const defaults = labels.getDefaultOptions();
    expect(labels.parseStoredOptions(null)).toEqual(defaults);
    expect(labels.parseStoredOptions("not json")).toEqual(defaults);
    expect(labels.parseStoredOptions("[1,2,3]")).toEqual(defaults);
  });

  it("keeps stored flags but repairs ones of the wrong type", () => {
    const parsed = labels.parseStoredOptions(JSON.stringify({ resizeOnZoom: false, showAll: "yes" }));
    expect(parsed.resizeOnZoom).toBe(false);
    expect(parsed.showAll).toBe(labels.getDefaultOptions().showAll);
  });
});
