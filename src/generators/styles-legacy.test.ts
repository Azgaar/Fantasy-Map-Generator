import fs from "node:fs";
import path from "node:path";
import { expect, test, vi } from "vitest";
import { Styles } from "./styles";
import {
  burgGroupFromLegacy,
  isLegacyPreset,
  isStoreStyles,
  labelGroupFromLegacy,
  presetBagFor,
  presetFromLegacy,
  styleNodeFor
} from "./styles-legacy";
import fixture from "./styles-legacy-default.fixture.json";
import serializerFixture from "./styles-legacy-serializer.fixture.json";

test("detects the legacy selector-keyed format", () => {
  expect(isLegacyPreset(fixture)).toBe(true);
  expect(isLegacyPreset({ labels: {} })).toBe(false);
});

test("isStoreStyles tells the two record shapes apart", () => {
  expect(isStoreStyles(Styles.defaults)).toBe(true);
  expect(isStoreStyles({ labels: { groups: {} }, burgIcons: {}, anchors: {}, relief: {} })).toBe(false);
  expect(isStoreStyles(null)).toBe(false);
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
  expect(presetFromLegacy(bad as any, { onUnknown: "skip" }).map).toEqual(Styles.defaults.map);
  expect(warn).toHaveBeenCalledOnce();
});

test('the string "null" converts to a real null', () => {
  const styles = presetFromLegacy({ "#rivers": { opacity: "null" } } as any, { onUnknown: "skip" });
  expect(styles.rivers.attrs.opacity).toBeNull();
});

test("R5: an attribute absent from the legacy bag keeps the default, not null", () => {
  const styles = presetFromLegacy({ "#armies": { "font-size": 6, "box-size": 3 } } as any, { onUnknown: "skip" });
  expect(styles.military.attrs["stroke-dasharray"]).toBe(Styles.defaults.military.attrs["stroke-dasharray"]);
  expect(styles.military.attrs["stroke-linecap"]).toBe(Styles.defaults.military.attrs["stroke-linecap"]);
});

test("sea_island's legacy auto-filter routes to options.autoFilter", () => {
  const styles = presetFromLegacy(fixture as any);
  expect(styles.coastline.sea_island.options.autoFilter).toBe(1);
});

test("a mismatched data-size/font-size pair is BLOCKED", () => {
  const bad = { "#ruler": { "data-size": 20, "font-size": 21 } };
  expect(() => presetFromLegacy(bad as any)).toThrow(/unknown legacy attribute/);
});

test("R7: #provs' dead data-size is dropped, not routed", () => {
  const styles = presetFromLegacy({ "#provs": { "font-size": 10, "data-size": 10 } } as any);
  expect(styles.provinces.attrs["font-size"]).toBe(10);
  expect(JSON.stringify(styles).includes("data-size")).toBe(false);
});

// Pins the full custom-preset dialect: one bag per selector collectStyleData
// (public/modules/ui/style-presets.js) could ever write, so every attribute the legacy
// serializer could produce has a store home or a deliberate, tested drop.
test("R9: the legacy serializer's full attribute dialect converts with no unrouted keys", () => {
  const warn = vi.spyOn(console, "warn");
  warn.mockClear();
  expect(() => presetFromLegacy(serializerFixture as any)).not.toThrow();
  expect(
    warn,
    "every attribute collectStyleData could write must route to a store field, not fall through with a warning"
  ).not.toHaveBeenCalled();
});

test("R9: #provs' data-size stays a ruled-drop (dead cargo) even in the full-dialect fixture", () => {
  const styles = presetFromLegacy(serializerFixture as any);
  expect(
    "data-size" in (serializerFixture as any)["#provs"],
    "the fixture must still carry the dead data-size key to exercise the drop"
  ).toBe(true);
  expect(
    styles.provinces.attrs["font-size"],
    "#provs' data-size never came from collectStyleData - it's dead cargo left beside font-size in older saves, and presetFromLegacy must drop it rather than let it clobber font-size"
  ).toBe((serializerFixture as any)["#provs"]["font-size"]);
});

test("R9: #terrs > #landHeights never legitimately carried data-render, so it stays out of the fixture", () => {
  expect(
    "data-render" in (serializerFixture as any)["#terrs #landHeights"],
    "data-render was ruled out for landHeights (only #oceanHeights ever wrote it) - it must not appear in the dialect fixture at all, not even as a dropped key"
  ).toBe(false);
});

test("styleNodeFor resolves editor selections to live store nodes", () => {
  expect(styleNodeFor("rivers", "")).toEqual({ node: styles.rivers, layer: "rivers" });
  expect(styleNodeFor("rivers", "rivers")).toEqual({ node: styles.rivers, layer: "rivers" });
  expect(styleNodeFor("lakes", "freshwater")).toEqual({ node: styles.lakes.freshwater, layer: "lakes" });
  expect(styleNodeFor("terrs", "landHeights")).toEqual({ node: styles.heightmap.landHeights, layer: "heightmap" });
  expect(styleNodeFor("labels", "capital")).toEqual({ node: styles.labels.groups.capital, layer: "labels" });
  expect(styleNodeFor("burgIcons", "town")).toEqual({
    node: styles.burgIcons.burgIcons.groups.town,
    layer: "burgIcons"
  });
  expect(styleNodeFor("anchors", "capital")).toEqual({
    node: styles.burgIcons.anchors.groups.capital,
    layer: "burgIcons"
  });
  expect(styleNodeFor("regions", "statesHalo")).toEqual({ node: styles.states.statesHalo, layer: "states" });
});

test("styleNodeFor returns undefined for structural parents and unknown groups", () => {
  // #regions, #terrs, #icons and #goods are containers: styling lives on their children
  expect(styleNodeFor("regions", "")).toBeUndefined();
  expect(styleNodeFor("terrs", "")).toBeUndefined();
  expect(styleNodeFor("icons", "icons")).toBeUndefined();
  expect(styleNodeFor("goods", "goods")).toBeUndefined();
  expect(styleNodeFor("labels", "no-such-group")).toBeUndefined();
  expect(styleNodeFor("burgIcons", "no-such-group")).toBeUndefined();
});

test("numeric-looking string options coerce back to strings, not schema-rejected numbers", () => {
  const styles = presetFromLegacy(
    { "#oceanLayers": { layers: -6 }, "#scaleBar": { "data-label": 100 }, "#markets": { "data-icon": 8 } } as any,
    { onUnknown: "skip" }
  );
  expect(styles.ocean.oceanLayers.options.outline).toBe("-6");
  expect(styles.scaleBar.options.label).toBe("100");
  expect(styles.markets.options.icon).toBe("8");
});

test("legacy numeric stroke-dasharray values migrate to strings", () => {
  const styles = presetFromLegacy({ "#gridOverlay": { "stroke-dasharray": 5 } } as any);

  expect(styles.grid.attrs["stroke-dasharray"]).toBe("5");
});

test("labelGroupFromLegacy treats a zoom-faded opacity 0 as visible", () => {
  const group = labelGroupFromLegacy({ opacity: 0 });
  expect(group.attrs.opacity).toBe(1);
  expect(labelGroupFromLegacy({ opacity: 0.5 }).attrs.opacity).toBe(0.5);
  expect(labelGroupFromLegacy({ opacity: null }).attrs.opacity).toBeNull();
});

test("labelGroupFromLegacy keeps font-size when data-size is absent", () => {
  const group = labelGroupFromLegacy({ "font-size": "6%" });
  expect(group.attrs["font-size"]).toBe("6%");
});

test("labelGroupFromLegacy prefers a numeric data-size over font-size, stringified", () => {
  const group = labelGroupFromLegacy({ "data-size": 10, "font-size": 8.3 });
  expect(group.attrs["font-size"]).toBe("10");
});

const presetDir = path.join(__dirname, "../../public/styles");

test("all 12 shipped presets parse as the new format with zero warnings", () => {
  const files = fs
    .readdirSync(presetDir)
    .filter(f => f.endsWith(".json"))
    .map(f => path.join(presetDir, f));
  files.push(path.join(__dirname, "default-styles.json"));
  expect(files).toHaveLength(12);
  const warn = vi.spyOn(console, "warn");
  warn.mockClear();
  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(isLegacyPreset(json), file).toBe(false);
    Styles.parse(json);
  }
  expect(warn).not.toHaveBeenCalled();
});

test("the shipped default preset is exactly the converted fixture", () => {
  const shipped = JSON.parse(fs.readFileSync(path.join(__dirname, "default-styles.json"), "utf8"));
  expect(presetFromLegacy(fixture as any)).toEqual(shipped);
});

test("save.ts's master-compat shim: a top-level anchors:{} still parses clean", () => {
  const warn = vi.spyOn(console, "warn");
  const record = JSON.parse(JSON.stringify({ ...Styles.defaults, anchors: {} }));
  const parsed = Styles.parse(record);
  expect(parsed).toEqual(Styles.defaults);
  expect(warn).not.toHaveBeenCalled();
});

test("burg group size reads the pre-1.9x size attr when font-size is absent", () => {
  expect(burgGroupFromLegacy({ size: "0.8" }).options.size).toBe(0.8);
  expect(burgGroupFromLegacy({ "font-size": "2", size: "0.8" }).options.size).toBe(2);
  expect(burgGroupFromLegacy({}).options.size).toBe(1);
});

test("presetBagFor reads a legacy '#'-keyed preset bag directly", () => {
  expect(presetBagFor({ "#rivers": { opacity: 0.5 } }, "#rivers")).toEqual({ opacity: 0.5 });
});

test("presetBagFor resolves a store-format preset through the selector route table", () => {
  const preset = { map: {}, rivers: { attrs: { opacity: 0.7, filter: null } } };
  expect(presetBagFor(preset, "#rivers")).toEqual({ opacity: 0.7, filter: null });
});

test("presetBagFor tries selectors in order and returns undefined when none resolve", () => {
  const preset = { map: {}, routes: { groups: { roads: { attrs: { opacity: 0.9 } } } } };
  expect(presetBagFor(preset, "#roads", "#routes > #roads")).toEqual({ opacity: 0.9 });
  expect(presetBagFor(preset, "#nonexistent")).toBeUndefined();
});
