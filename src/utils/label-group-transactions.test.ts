import { beforeEach, describe, expect, it } from "vitest";
import type { AddedLabel } from "@/generators/labels";
import type { Province } from "@/generators/provinces-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { LabelStyles, LabelsOptions } from "@/types/labels";
import {
  assignLabelGroup,
  createLabelGroup,
  deleteLabelGroup,
  type LabelWorld,
  reconcileBurgLabelGroups,
  renameLabelGroup
} from "./label-group-transactions";
import { createDefaultLabelsOptions } from "./label-policy";

const burgGroups: BurgGroup[] = [
  { name: "capital", order: 0 },
  { name: "town", order: 1, isDefault: true }
];
let labels: LabelsOptions;
let styles: LabelStyles;
let world: LabelWorld;

beforeEach(() => {
  labels = createDefaultLabelsOptions(burgGroups);
  styles = {
    groups: Object.fromEntries(labels.groups.map(group => [group.name, { fill: group.name, "font-size": "10%" }]))
  };
  world = {
    states: [{}, { i: 1, label: { group: "custom" } }],
    provinces: [0 as unknown as Province, { i: 1, label: { group: "custom" } } as Province],
    burgs: [{}, { i: 1, group: "capital", label: { group: "custom" } }, { i: 2, group: "town" }],
    labels: [{ i: 1, text: "Free", pathPoints: [], group: "custom" } as AddedLabel]
  };
});

describe("Label Group transactions", () => {
  it("creates a group from its type default and always starts in auto mode", () => {
    const states = labels.groups.find(group => group.name === "states")!;
    states.mode = "full";
    states.active = false;
    states.zoom = { min: 3, max: 18 };

    const created = createLabelGroup({ labels, styles, burgGroups, name: "regional", type: "states" });

    expect(created).toEqual({
      name: "regional",
      type: "states",
      active: false,
      layerDependency: null,
      zoom: { min: 3, max: 18 },
      mode: "auto"
    });
    expect(styles.groups.regional).toEqual(styles.groups.states);
    expect(labels.groups.map(group => group.name).slice(0, 2)).toEqual(["states", "regional"]);
  });

  it("rejects protected rename and deletion", () => {
    expect(() =>
      renameLabelGroup({ labels, styles, world, burgGroups, oldName: "states", newName: "countries" })
    ).toThrow("protected");
    expect(() => deleteLabelGroup({ labels, styles, world, burgGroups, name: "town" })).toThrow("protected");
  });

  it("renames options, style, and all four entity references transactionally", () => {
    createLabelGroup({ labels, styles, burgGroups, name: "custom", type: "added" });

    renameLabelGroup({ labels, styles, world, burgGroups, oldName: "custom", newName: "regional" });

    expect(labels.groups.some(group => group.name === "regional")).toBe(true);
    expect(styles.groups.regional).toBeDefined();
    expect(styles.groups.custom).toBeUndefined();
    expect(world.states[1].label?.group).toBe("regional");
    expect(world.provinces[1].label?.group).toBe("regional");
    expect(world.burgs[1].label?.group).toBe("regional");
    expect(world.labels[0].group).toBe("regional");
  });

  it("deletes mixed assignments using each entity fallback", () => {
    createLabelGroup({ labels, styles, burgGroups, name: "custom", type: "provinces" });

    const counts = deleteLabelGroup({ labels, styles, world, burgGroups, name: "custom" });

    expect(counts).toEqual({ states: 1, provinces: 1, burgs: 1, added: 1 });
    expect(world.states[1].label?.group).toBeUndefined();
    expect(world.provinces[1].label?.group).toBeUndefined();
    expect(world.burgs[1].label?.group).toBeUndefined();
    expect(world.labels[0].group).toBe("added");
  });

  it("bulk-assigns only selected entities of the requested type", () => {
    world.states.push({ i: 2 });

    assignLabelGroup(world, "states", [1], "added");

    expect(world.states[1].label?.group).toBe("added");
    expect(world.states[2].label).toBeUndefined();
    expect(world.provinces[1].label?.group).toBe("custom");
  });

  it("reconciles Burg add, rename, and delete without changing manual surviving overrides", () => {
    world.burgs[1].label = { group: "states" };
    reconcileBurgLabelGroups({
      labels,
      styles,
      world,
      previousGroups: burgGroups,
      nextGroups: [
        { name: "metropolis", order: 0 },
        { name: "village", order: 1, isDefault: true }
      ],
      renames: { capital: "metropolis" }
    });

    expect(labels.groups.filter(group => group.type === "burgs").map(group => group.name)).toEqual([
      "metropolis",
      "village"
    ]);
    expect(world.burgs[1].group).toBe("metropolis");
    expect(world.burgs[1].label?.group).toBe("states");
    expect(labels.groups.some(group => group.name === "town")).toBe(false);
  });

  it("inserts new Burg groups in Burg order", () => {
    reconcileBurgLabelGroups({
      labels,
      styles,
      world,
      previousGroups: burgGroups,
      nextGroups: [
        { name: "capital", order: 0 },
        { name: "city", order: 1 },
        { name: "town", order: 2, isDefault: true }
      ]
    });

    expect(labels.groups.filter(group => group.type === "burgs").map(group => group.name)).toEqual([
      "capital",
      "city",
      "town"
    ]);
  });

  it("rejects a new Burg group that collides with a custom Label Group", () => {
    createLabelGroup({ labels, styles, burgGroups, name: "royal", type: "states" });
    const labelsBefore = structuredClone(labels);
    const stylesBefore = structuredClone(styles);
    const worldBefore = structuredClone(world);

    expect(() =>
      reconcileBurgLabelGroups({
        labels,
        styles,
        world,
        previousGroups: burgGroups,
        nextGroups: [
          { name: "metropolis", order: 0 },
          { name: "town", order: 1, isDefault: true },
          { name: "royal", order: 2 }
        ],
        renames: { capital: "metropolis" }
      })
    ).toThrow("collides");
    expect(labels).toEqual(labelsBefore);
    expect(styles).toEqual(stylesBefore);
    expect(world).toEqual(worldBefore);
  });
});
