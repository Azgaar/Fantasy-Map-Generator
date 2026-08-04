import { describe, expect, it } from "vitest";
import type { LabelGroupOptions, LabelsOptions } from "@/types/labels";
import {
  createDefaultLabelsOptions,
  deriveLegacyLabelZoom,
  getLabelParentFontSize,
  isLabelGroupVisible,
  resolveLabelGroup,
  validateLabelGroupName,
  validateLabelZoom
} from "./label-policy";

const group: LabelGroupOptions = {
  name: "test",
  type: "added",
  active: true,
  layerDependency: null,
  zoom: { min: null, max: null },
  mode: "auto"
};
const labels: LabelsOptions = { resizeOnZoom: true, showAll: false, groups: [group] };

describe("Label Group visibility", () => {
  it.each([
    [false, false, true, true, true, false],
    [false, true, false, false, false, false],
    [true, true, false, false, false, true],
    [true, false, false, true, true, false],
    [true, false, true, false, true, false],
    [true, false, true, true, false, false],
    [true, false, true, true, true, true]
  ])("evaluates master=%s showAll=%s active=%s zoom=%s dependency=%s", (labelsLayerOn, showAll, active, zoomPasses, dependencyPasses, expected) => {
    expect(
      isLabelGroupVisible({
        labelsLayerOn,
        labels: { ...labels, showAll },
        group: {
          ...group,
          active,
          zoom: zoomPasses ? { min: 2, max: 10 } : { min: 3, max: 10 },
          layerDependency: "toggleContext"
        },
        scale: 2,
        layerIsOn: () => dependencyPasses
      })
    ).toBe(expected);
  });

  it("uses inclusive bounds and supports one-sided bounds", () => {
    const visible = (scale: number, min: number | null, max: number | null) =>
      isLabelGroupVisible({
        labelsLayerOn: true,
        labels,
        group: { ...group, zoom: { min, max } },
        scale,
        layerIsOn: () => true
      });

    expect(visible(2, 2, 10)).toBe(true);
    expect(visible(10, 2, 10)).toBe(true);
    expect(visible(1, null, 1)).toBe(true);
    expect(visible(200, 2, null)).toBe(true);
  });

  it("fails closed for unknown or off dependencies", () => {
    expect(
      isLabelGroupVisible({
        labelsLayerOn: true,
        labels,
        group: { ...group, layerDependency: "missing" },
        scale: 1,
        layerIsOn: () => false
      })
    ).toBe(false);
  });
});

describe("Label Group policy", () => {
  it.each([
    [22, { min: null, max: 4.45 }],
    [18, { min: null, max: 5.67 }],
    [10, { min: 0.2, max: 11 }],
    [6, { min: 1, max: 19 }],
    [5, { min: 1.4, max: 23 }],
    [4, { min: 2, max: 29 }]
  ])("derives legacy LOD for size %s", (size, expected) => {
    expect(deriveLegacyLabelZoom(size)).toEqual(expected);
  });

  it("validates zoom bounds", () => {
    expect(validateLabelZoom({ min: 2, max: 10 })).toBeNull();
    expect(validateLabelZoom({ min: null, max: null })).toBeNull();
    expect(validateLabelZoom({})).toBe("Zoom min is required");
    expect(validateLabelZoom({ min: Number.NaN, max: null })).toBe("Zoom min must be a finite number");
    expect(validateLabelZoom({ min: 10, max: 2 })).toBe("Minimum zoom cannot be greater than maximum zoom");
    expect(validateLabelZoom({ min: 0, max: null })).toBe("Zoom min must be between 0.01 and 200");
    expect(validateLabelZoom({ min: null, max: 201 })).toBe("Zoom max must be between 0.01 and 200");
  });

  it("validates Unicode identifiers and duplicates", () => {
    expect(validateLabelGroupName("royal_cities")).toBeNull();
    expect(validateLabelGroupName("river-port")).toBeNull();
    expect(validateLabelGroupName("_debug")).toBeNull();
    expect(validateLabelGroupName("Żółte-miasta")).toBeNull();
    expect(validateLabelGroupName("Royal Cities")).toBe(
      "Group name must start with a letter or underscore and contain only letters, digits, underscores, or dashes"
    );
    expect(validateLabelGroupName("12towns")).toBe(
      "Group name must start with a letter or underscore and contain only letters, digits, underscores, or dashes"
    );
    expect(validateLabelGroupName("states", ["states"])).toBe("Label Group names must be unique");
  });

  it("creates protected defaults and ordered Burg-managed groups", () => {
    const result = createDefaultLabelsOptions([
      { name: "town", order: 2, isDefault: true },
      { name: "capital", order: 0 },
      { name: "city", order: 1 }
    ]);

    expect(result.groups.map(group => group.name)).toEqual([
      "river",
      "route",
      "capital",
      "city",
      "town",
      "province",
      "added",
      "state"
    ]);
    expect(result.groups.find(group => group.name === "province")).toMatchObject({
      active: true,
      layerDependency: "toggleProvinces",
      zoom: { min: 1, max: 15 }
    });
    expect(result.groups.find(group => group.name === "town")?.type).toBe("burg");
  });

  it("preserves the dampened resizing curve on the parent", () => {
    expect(getLabelParentFontSize(1, true)).toBe(100);
    expect(getLabelParentFontSize(2, true)).toBe(75);
    expect(getLabelParentFontSize(4, true)).toBe(62.5);
    expect(getLabelParentFontSize(20, true)).toBe(52.5);
    expect(getLabelParentFontSize(20, false)).toBe(100);
  });

  it("resolves missing groups to the entity fallback", () => {
    const labels = createDefaultLabelsOptions([{ name: "town", order: 0, isDefault: true }]);
    const burgGroups = [{ name: "town", order: 0, isDefault: true }];
    expect(resolveLabelGroup("river", "missing", labels, burgGroups)).toBe("river");
    expect(resolveLabelGroup("burg", undefined, labels, burgGroups)).toBe("town");
    expect(resolveLabelGroup("state", "added", labels, burgGroups)).toBe("added");
  });
});
