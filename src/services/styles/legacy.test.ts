import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { isLegacyPreset, upgradeLegacyPreset } from "./legacy";

const defaultPreset = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-default.fixture.json"), "utf8"));

describe("upgradeLegacyPreset", () => {
  test("detects legacy format", () => {
    expect(isLegacyPreset(defaultPreset)).toBe(true);
    expect(isLegacyPreset({ layers: {} })).toBe(false);
  });

  test("routes flat layer attributes to presentation", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.fogging?.presentation).toMatchObject({ opacity: 0.98, fill: "#30426f" });
  });

  test("routes nested groups to children", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.routes?.children?.roads.presentation?.["stroke-width"]).toBeDefined();
    expect(style.layers.terrs?.children?.landHeights.options).toMatchObject({ scheme: "bright" });
  });

  test("routes renderer knobs to options with renames", () => {
    const style = upgradeLegacyPreset(defaultPreset);
    expect(style.layers.emblems?.children?.stateEmblems.options).toEqual({ size: 1 });
    expect(style.layers.oceanLayers?.options).toMatchObject({ layers: "-6,-3,-1", baseFill: "#466eab" });
    expect(style.layers.scaleBar?.options).toMatchObject({ back: expect.objectContaining({ top: 20 }) });
    expect(style.layers.terrain?.options).toEqual({ set: "simple", size: 1 }); // density dropped
    expect(style.layers.compass?.options).toEqual({ use: { x: 80, y: 80, scale: 0.25 } });
  });

  test("unknown selector throws by default", () => {
    expect(() => upgradeLegacyPreset({ "#notASelector": { opacity: 1 } })).toThrow(
      'Unknown legacy selector "#notASelector"'
    );
  });

  test("unknown selector is skipped when requested", () => {
    const style = upgradeLegacyPreset(
      { "#notASelector": { opacity: 1 }, "#map": { fill: "#000" } },
      { onUnknownSelector: "skip" }
    );
    expect(style.layers.map?.presentation).toMatchObject({ fill: "#000" });
  });

  // temporary until presets are converted: this reads the still-legacy public/styles/*.json directly
  test("every selector in every system preset is consumed (no silent drops) (temporary until presets are converted)", () => {
    const stylesDir = path.join(__dirname, "../../../public/styles");
    for (const file of fs.readdirSync(stylesDir)) {
      const preset = JSON.parse(fs.readFileSync(path.join(stylesDir, file), "utf8"));
      expect(() => upgradeLegacyPreset(preset)).not.toThrow();
    }
  });
});
