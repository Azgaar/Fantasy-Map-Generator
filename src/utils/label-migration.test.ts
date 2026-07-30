import { describe, expect, it } from "vitest";
import type { Province } from "@/generators/provinces-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { LabelStyles } from "@/types/labels";
import type { LabelWorld } from "./label-group-transactions";
import { migrateLabelConfiguration } from "./label-migration";

const burgGroups: BurgGroup[] = [
  { name: "capital", order: 0 },
  { name: "town", order: 1, isDefault: true }
];

function createWorld(): LabelWorld {
  return {
    states: [{}, { i: 1 }],
    provinces: [0 as unknown as Province, { i: 1 } as Province],
    burgs: [{}, { i: 1, group: "town" }],
    labels: []
  };
}

describe("Label configuration migration", () => {
  it("converts flat legacy styles, addedLabels references, and per-group LOD once", () => {
    const styles: LabelStyles = {
      groups: {
        states: { "data-size": 22, "font-size": 14 },
        town: { "data-size": 4 },
        addedLabels: { "font-size": 18 }
      }
    };
    const world = createWorld();
    world.labels.push({ i: 1, text: "Free", pathPoints: [], group: "addedLabels" });

    const labels = migrateLabelConfiguration({
      styles,
      world,
      burgGroups,
      resizeOnZoom: false,
      stateMode: "full",
      provinceStyle: { fill: "#654321", "font-family": "Georgia", "font-size": 10 }
    });

    expect(labels.resizeOnZoom).toBe(false);
    expect(labels.groups.find(group => group.name === "states")).toMatchObject({
      zoom: { min: null, max: 4.45 },
      mode: "full"
    });
    expect(labels.groups.find(group => group.name === "provinces")).toMatchObject({
      active: true,
      layerDependency: "toggleProvinces"
    });
    expect(styles.groups.provinces).toMatchObject({
      fill: "#654321",
      "font-family": "Georgia",
      "font-size": "10%"
    });
    expect(world.labels[0].group).toBe("added");
    expect(styles.groups.states).toEqual({ "font-size": "22%" });
    expect(styles.groups.addedLabels).toBeUndefined();
  });

  it("infers mixed custom group type by count with deterministic tie order", () => {
    const styles: LabelStyles = { groups: { shared: { "font-size": 12 } } };
    const world = createWorld();
    world.states[1].label = { group: "shared" };
    world.provinces[1].label = { group: "shared" };
    world.burgs[1].label = { group: "shared" };
    world.labels.push({ i: 1, text: "Free", pathPoints: [], group: "shared" });

    const labels = migrateLabelConfiguration({ styles, world, burgGroups });

    expect(labels.groups.find(group => group.name === "shared")?.type).toBe("states");
  });

  it("migrates flat custom references that collide with a Burg-managed group", () => {
    const styles: LabelStyles = { groups: { capital: { "font-size": "6px" } } };
    const world = createWorld();
    world.labels.push({ i: 1, text: "Custom", pathPoints: [], group: "capital" });

    const labels = migrateLabelConfiguration({ styles, world, burgGroups });

    expect(labels.groups.find(group => group.name === "capital")).toMatchObject({
      type: "burgs",
      zoom: { min: 1, max: 19 }
    });
    expect(labels.groups.find(group => group.name === "capital_migrated")?.type).toBe("added");
    expect(world.labels[0].group).toBe("capital_migrated");
    expect(styles.groups.capital_migrated).toEqual({ "font-size": "6%" });
  });

  it("defaults an unused custom group to Added", () => {
    const styles: LabelStyles = { groups: { unused: { "font-size": 12 } } };

    const labels = migrateLabelConfiguration({ styles, world: createWorld(), burgGroups });

    expect(labels.groups.find(group => group.name === "unused")?.type).toBe("added");
  });

  it("resolves repeated added-name collisions deterministically", () => {
    const styles: LabelStyles = {
      groups: {
        addedLabels: { "font-size": 18 },
        added: { "font-size": 12 },
        added_migrated: { "font-size": 11 }
      }
    };
    const world = createWorld();
    world.labels.push({ i: 1, text: "Old custom", pathPoints: [], group: "added" });

    migrateLabelConfiguration({ styles, world, burgGroups });

    expect(styles.groups.added_migrated_2).toEqual({ "font-size": "12%" });
    expect(world.labels[0].group).toBe("added_migrated_2");
  });

  it("renames a legacy custom added group when the old default is absent", () => {
    const styles: LabelStyles = { groups: { added: { "font-size": 12 } } };
    const world = createWorld();
    world.labels.push({ i: 1, text: "Old custom", pathPoints: [], group: "added" });

    const labels = migrateLabelConfiguration({ styles, world, burgGroups });

    expect(styles.groups.added_migrated).toEqual({ "font-size": "12%" });
    expect(styles.groups.added).toBeDefined();
    expect(world.labels[0].group).toBe("added_migrated");
    expect(labels.groups.find(group => group.name === "added")).toMatchObject({ type: "added" });
  });

  it("renames a legacy custom group that collides with the new Province default", () => {
    const styles: LabelStyles = {
      groups: {
        provinces: { "font-size": 14 },
        provinces_migrated: { "font-size": 12 }
      }
    };
    const world = createWorld();
    world.labels.push({ i: 1, text: "Old custom", pathPoints: [], group: "provinces" });

    const labels = migrateLabelConfiguration({ styles, world, burgGroups });

    expect(styles.groups.provinces_migrated_2).toEqual({ "font-size": "14%" });
    expect(styles.groups.provinces).toBeDefined();
    expect(world.labels[0].group).toBe("provinces_migrated_2");
    expect(labels.groups.find(group => group.name === "provinces")).toMatchObject({
      type: "provinces",
      layerDependency: "toggleProvinces"
    });
  });

  it("does not recalculate modern authored LOD", () => {
    const styles: LabelStyles = { groups: { states: { "font-size": "40%" } } };
    const world = createWorld();
    const current = {
      resizeOnZoom: true,
      showAll: false,
      groups: [
        {
          name: "states",
          type: "states" as const,
          active: true,
          layerDependency: null,
          zoom: { min: 3, max: 18 },
          mode: "auto" as const
        }
      ]
    };

    const labels = migrateLabelConfiguration({ current, styles, world, burgGroups });

    expect(labels.groups.find(group => group.name === "states")?.zoom).toEqual({ min: 3, max: 18 });
  });

  it("rejects malformed stored options and rebuilds valid defaults", () => {
    const styles: LabelStyles = { groups: {} };
    const malformed = {
      resizeOnZoom: true,
      showAll: false,
      groups: [{}]
    } as unknown as Parameters<typeof migrateLabelConfiguration>[0]["current"];

    const labels = migrateLabelConfiguration({
      current: malformed,
      styles,
      world: createWorld(),
      burgGroups
    });

    expect(labels.groups.map(group => group.name)).toEqual(["states", "capital", "town", "provinces", "added"]);
    expect(labels.groups.every(group => group.name && group.type && group.zoom)).toBe(true);
  });

  it("rejects incomplete zoom bounds and protected groups with the wrong type", () => {
    const styles: LabelStyles = { groups: {} };
    const malformed = {
      resizeOnZoom: true,
      showAll: false,
      groups: [
        {
          name: "states",
          type: "added",
          active: true,
          layerDependency: null,
          zoom: {},
          mode: "auto"
        }
      ]
    } as unknown as Parameters<typeof migrateLabelConfiguration>[0]["current"];

    const labels = migrateLabelConfiguration({
      current: malformed,
      styles,
      world: createWorld(),
      burgGroups
    });

    expect(labels.groups.find(group => group.name === "states")).toMatchObject({
      type: "states",
      zoom: { min: null, max: 4.45 }
    });
  });
});
