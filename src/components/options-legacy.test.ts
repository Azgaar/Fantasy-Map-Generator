import { beforeEach, describe, expect, it, vi } from "vitest";
import { Coastline } from "@/generators/coastline-generator";
import { adoptLegacyOptions } from "./options-legacy";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("location", new URL("http://localhost/"));
  (globalThis as Record<string, unknown>).localStorage = {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, value),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    }
  };
});

const seed = (entries: Record<string, string>) => {
  for (const [key, value] of Object.entries(entries)) store.set(key, value);
};

/** The whole boot path, so a migrated value is asserted after the schema has seen it */
const restore = async () => {
  vi.resetModules();
  const { Options } = await import("./options-model");
  Options.restore();
  return { options: globalThis.options, defaults: Options.getDefaultOptions() };
};

const A_UNIT = { icon: "x", name: "legion", rural: 0.2, urban: 0.1, crew: 1, power: 1, type: "melee", separate: 0 };
const A_BURG_GROUP = { name: "My Ports", order: 1, active: true };
const A_LABEL_GROUP = { name: "My States", type: "state", zoom: { min: 2, max: null } };

describe("adoptLegacyOptions", () => {
  it("is a no-op for a browser that never had the namespace", () => {
    seed({ "fmg-options": "{}", "fmg-locks": "{}", preset: "political" });
    expect(adoptLegacyOptions()).toBeNull();
    expect([...store.keys()]).toEqual(["fmg-options", "fmg-locks", "preset"]);
  });

  it("clears the whole namespace, adopted and discarded alike", () => {
    seed({ themeColor: "#3366aa", statesNumber: "37", winds: "10,20", presetStyle: "ancient", preset: "political" });
    adoptLegacyOptions();
    expect([...store.keys()]).toEqual(["preset"]);
  });

  it("runs once: a second call finds nothing and returns null", () => {
    seed({ themeColor: "#3366aa" });
    expect(adoptLegacyOptions()).not.toBeNull();
    expect(adoptLegacyOptions()).toBeNull();
  });

  it("drops a set that is not valid JSON without losing the sets beside it", () => {
    seed({ military: JSON.stringify([A_UNIT]), "burg-groups": "{not json" });
    const migrated = adoptLegacyOptions() as { map: Record<string, Record<string, unknown>> };
    expect(migrated.map.military.units).toEqual([A_UNIT]);
    expect(migrated.map.burgs).toBeUndefined();
  });

  it("takes only the groups out of the labels wrapper", () => {
    seed({ "options-labels": JSON.stringify({ resizeOnZoom: false, showAll: true, groups: [A_LABEL_GROUP] }) });
    const migrated = adoptLegacyOptions() as { map: Record<string, Record<string, unknown>> };
    expect(migrated.map.labels.groups).toEqual([A_LABEL_GROUP]);
  });

  it("survives a labels wrapper with no groups in it", () => {
    seed({ "options-labels": JSON.stringify({ resizeOnZoom: false }) });
    const migrated = adoptLegacyOptions() as { map: Record<string, Record<string, unknown>> };
    expect(migrated.map.labels.groups).toBeUndefined();
  });

  it("rounds a truncated coastline out from today's defaults", () => {
    seed({ "coastline-settings": JSON.stringify({ minEdge: 4 }) });
    const migrated = adoptLegacyOptions() as { map: { coastline: Record<string, number> } };
    expect(migrated.map.coastline).toEqual({ ...Coastline.getDefaultSettings(), minEdge: 4 });
  });
});

describe("Options.restore, migrating", () => {
  it("adopts the preferences and the definition sets", async () => {
    seed({
      themeColor: "#3366aa",
      uiSize: "1.7",
      tooltipSize: "22",
      onloadBehavior: "lastSaved",
      noReminder: "true",
      military: JSON.stringify([A_UNIT]),
      "burg-groups": JSON.stringify([A_BURG_GROUP]),
      "options-labels": JSON.stringify({ groups: [A_LABEL_GROUP] }),
      "coastline-settings": JSON.stringify({ ...Coastline.getDefaultSettings(), minEdge: 4 }),
      "trade-animation": JSON.stringify({
        displayType: "land",
        concurrent: 99,
        duration: 111,
        landDurationModifier: 9,
        segmentChangePause: 222,
        markerSize: 8
      })
    });

    const { options } = await restore();
    expect(options.app.ui.themeColor).toBe("#3366aa");
    expect(options.app.ui.size).toBe(1.7);
    expect(options.app.ui.tooltipSize).toBe(22);
    expect(options.app.onLoad).toBe("lastSaved");
    expect(options.app.autosave.remind).toBe(false);
    expect(options.app.trade.animation.concurrent).toBe(99);
    expect(options.map.military.units).toEqual([A_UNIT]);
    // a set with no default burg group gets one, since `defineGroup` assigns no burg without it
    expect(options.map.burgs.groups).toEqual([{ ...A_BURG_GROUP, isDefault: true }]);
    // a type left with no group of its own draws no labels, so the missing ones come back
    expect(options.map.labels.groups[0]).toEqual(A_LABEL_GROUP);
    expect(new Set(options.map.labels.groups.map(group => group.type))).toEqual(
      new Set(["state", "province", "burg", "river", "route", "added"])
    );
    expect(options.map.coastline).toEqual({ ...Coastline.getDefaultSettings(), minEdge: 4 });
  });

  it("leaves the pins, winds and the style preset behind", async () => {
    seed({ statesNumber: "37", template: "archipelago", winds: "10,20,30,40,50,60", presetStyle: "ancient" });
    const { options, defaults } = await restore();
    expect(options.generation.states.limit).toBe(defaults.generation.states.limit);
    expect(options.generation.template).toBe(defaults.generation.template);
  });

  it("drops the one unrepairable entry of a set, not the set around it", async () => {
    seed({
      military: JSON.stringify([A_UNIT, { name: "broken" }]),
      "burg-groups": JSON.stringify([A_BURG_GROUP])
    });
    const { options } = await restore();
    expect(options.map.military.units).toEqual([A_UNIT]);
    expect(options.map.burgs.groups).toEqual([{ ...A_BURG_GROUP, isDefault: true }]);
  });

  it("refuses a set of the wrong type without costing the sets or the preferences beside it", async () => {
    seed({
      "burg-groups": JSON.stringify({ not: "an array" }),
      military: JSON.stringify([A_UNIT]),
      themeColor: "#3366aa"
    });
    const { options, defaults } = await restore();
    expect(options.map.burgs.groups).toEqual(defaults.map.burgs.groups);
    expect(options.map.military.units).toEqual([A_UNIT]);
    expect(options.app.ui.themeColor).toBe("#3366aa");
  });

  it("repairs one bad field of a preference group rather than dropping the group", async () => {
    seed({ "trade-animation": JSON.stringify({ concurrent: "many", duration: 111 }) });
    const { options, defaults } = await restore();
    expect(options.app.trade.animation.concurrent).toBe(defaults.app.trade.animation.concurrent);
    expect(options.app.trade.animation.duration).toBe(111);
  });

  it("keeps what this browser already stored over what the old namespace says", async () => {
    seed({
      "fmg-options": JSON.stringify({ app: { ui: { themeColor: "#111111" } } }),
      themeColor: "#3366aa",
      uiSize: "1.7"
    });
    const { options } = await restore();
    expect(options.app.ui.themeColor).toBe("#111111"); // stored wins
    expect(options.app.ui.size).toBe(1.7); // legacy still fills what the stored object lacks
  });

  it("ignores an empty stored value instead of reading it as zero", async () => {
    seed({ uiSize: "", speakerVoice: "", themeColor: "" });
    const { options, defaults } = await restore();
    expect(options.app.ui.size).toBe(defaults.app.ui.size);
    expect(options.app.ui.themeColor).toBe(defaults.app.ui.themeColor);
  });

  it("ignores a non-numeric value for a numeric preference", async () => {
    seed({ tooltipSize: "abc", autosaveInterval: "NaN" });
    const { options, defaults } = await restore();
    expect(options.app.ui.tooltipSize).toBe(defaults.app.ui.tooltipSize);
    expect(options.app.autosave.interval).toBe(defaults.app.autosave.interval);
  });

  it("persists what it migrated, so the next boot starts from the object", async () => {
    seed({ themeColor: "#3366aa", military: JSON.stringify([A_UNIT]) });
    await restore();
    const persisted = JSON.parse(store.get("fmg-options") as string);
    expect(persisted.app.ui.themeColor).toBe("#3366aa");
    expect(persisted.map.military.units).toEqual([A_UNIT]);
  });
});
