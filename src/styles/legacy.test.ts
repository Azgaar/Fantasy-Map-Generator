import { expect, test, vi } from "vitest";
import { DEFAULT_STYLES } from "./defaults";
import { isLegacyPreset, presetFromLegacy } from "./legacy";
import fixture from "./legacy-default.fixture.json";

test("detects the legacy selector-keyed format", () => {
  expect(isLegacyPreset(fixture)).toBe(true);
  expect(isLegacyPreset({ labels: {} })).toBe(false);
});

test("converts the frozen default preset without warnings", () => {
  const warn = vi.spyOn(console, "warn");
  const styles = presetFromLegacy(fixture as any);
  expect(warn).not.toHaveBeenCalled();
  expect(styles.relief.options).toEqual({ set: "simple", size: 1, density: 0.4 });
  expect(styles.ocean.oceanLayers.options.outline).toBe("-6,-3,-1");
  expect(styles.ocean.options.patternOpacity).toBe(0.2);
  expect(styles.military.options).toEqual({ fontSize: 6, boxSize: 3 });
  expect(styles.labels.groups.capital.attrs["font-family"]).toBe("Almendra SC");
  expect(styles.burgIcons.burgIcons.groups.capital.options.icon).toBe("#icon-square");
});

test("unknown selector throws by default, skips on request", () => {
  const bad = { "#nope": { opacity: 1 } };
  expect(() => presetFromLegacy(bad as any)).toThrow(/unknown legacy selector/);
  const warn = vi.spyOn(console, "warn");
  expect(presetFromLegacy(bad as any, { onUnknown: "skip" }).map).toEqual(DEFAULT_STYLES.map);
  expect(warn).toHaveBeenCalledOnce();
});

test('the string "null" converts to a real null', () => {
  const styles = presetFromLegacy({ "#rivers": { opacity: "null" } } as any, { onUnknown: "skip" });
  expect(styles.rivers.attrs.opacity).toBeNull();
});

test("R5: an attribute absent from the legacy bag keeps the default, not null", () => {
  const styles = presetFromLegacy({ "#armies": { "font-size": 6, "box-size": 3 } } as any, { onUnknown: "skip" });
  expect(styles.military.attrs["stroke-dasharray"]).toBe(DEFAULT_STYLES.military.attrs["stroke-dasharray"]);
  expect(styles.military.attrs["stroke-linecap"]).toBe(DEFAULT_STYLES.military.attrs["stroke-linecap"]);
});

test("sea_island's legacy auto-filter routes to options.autoFilter", () => {
  const styles = presetFromLegacy(fixture as any);
  expect(styles.coastline.sea_island.options.autoFilter).toBe(1);
});

test("a mismatched data-size/font-size pair is BLOCKED", () => {
  const bad = { "#ruler": { "data-size": 20, "font-size": 21 } };
  expect(() => presetFromLegacy(bad as any)).toThrow(/unknown legacy attribute/);
});
