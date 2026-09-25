import fs from "node:fs";
import path from "node:path";
import { expect, test, vi } from "vitest";
import { Styles } from "./styles";
import {
  burgGroupFromLegacy,
  isLegacyPreset,
  isStoreStyles,
  labelGroupFromLegacy,
  normalizeStyles,
  presetBagFor,
  presetFromLegacy
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
  expect(styles.ocean.groups.oceanLayers.options.outline).toBe("-6,-3,-1");
  expect(styles.ocean.groups.pattern.attrs).toEqual({ href: "./images/pattern1.png", opacity: 0.2 });
  expect(styles.military.options).toEqual({ boxSize: 3 });
  expect(styles.coordinates.attrs["font-size"]).toBe("12px");
  expect(styles.states.groups.statesHalo.attrs["stroke-width"]).toBe(10);
  expect(styles.legend.options).toEqual({ columns: 8 });
  expect(styles.labels.groups.capital.attrs["font-family"]).toBe("Almendra SC");
  expect(styles.burgIcons.groups.capital.groups.icons.options.icon).toBe("#burgs-atlas-square");
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

test("the zoom-derived render values are dropped for their base: #coordinates font-size, #statesHalo stroke-width", () => {
  const styles = presetFromLegacy({
    "#coordinates": { "data-size": 14, "font-size": 3.2 },
    "#statesHalo": { "data-width": 8, "stroke-width": 0.5 }
  } as any);
  expect(styles.coordinates.attrs["font-size"]).toBe("14px");
  expect(styles.states.groups.statesHalo.attrs["stroke-width"]).toBe(8);
});

// the legacy base (data-size) is the authority; the plain font-size beside it is the zoom-derived render value
test("a base beside its render value wins: #ruler data-size over font-size", () => {
  const styles = presetFromLegacy({ "#ruler": { "data-size": 20, "font-size": 21 } } as any);
  expect(styles.rulers.attrs["font-size"]).toBe("20px");
});

// province labels moved to a labels group, so #provs' text attrs are dead cargo alongside data-size
test("R7: #provs' dead text attrs are dropped, not routed", () => {
  const styles = presetFromLegacy({ "#provs": { "font-size": 10, "data-size": 10, "font-family": "Serif" } } as any);
  expect(styles.provinces).toEqual(Styles.defaults.provinces);
  expect(JSON.stringify(styles.provinces)).not.toMatch(/data-size|font-/);
});

// Pins the full custom-preset dialect: one bag per selector collectStyleData
// (the pre-v1.150 style-presets.js) could ever write, so every attribute the legacy
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

test("R9: #provs' data-size and text attrs stay ruled-drops (dead cargo) even in the full-dialect fixture", () => {
  const styles = presetFromLegacy(serializerFixture as any);
  const provs = (serializerFixture as any)["#provs"];
  expect("data-size" in provs && "font-size" in provs, "the fixture must still carry the dead keys").toBe(true);
  expect(Object.keys(styles.provinces.attrs).sort()).toEqual(["filter", "opacity"]);
});

test("R9: #terrs > #landHeights never legitimately carried data-render, so it stays out of the fixture", () => {
  expect(
    "data-render" in (serializerFixture as any)["#terrs #landHeights"],
    "data-render was ruled out for landHeights (only #oceanHeights ever wrote it) - it must not appear in the dialect fixture at all, not even as a dropped key"
  ).toBe(false);
});

test("numeric-looking string options coerce back to strings, not schema-rejected numbers", () => {
  const styles = presetFromLegacy({ "#markets": { "data-icon": 8 } }, { onUnknown: "skip" });
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

test("labelGroupFromLegacy keeps font-weight", () => {
  expect(labelGroupFromLegacy({ "font-weight": "600" }).attrs["font-weight"]).toBe(600);
  expect(labelGroupFromLegacy({ "font-weight": "950" }).attrs["font-weight"]).toBe(950);
  expect(labelGroupFromLegacy({}).attrs["font-weight"]).toBeNull();
});

// pre-1.140 zoom auto-visibility hid a burg tier with an inline display: none, and a map saved while
// zoomed out carries it in the group's style attribute; harvested verbatim it hides the tier forever
test("labelGroupFromLegacy drops the zoom auto-visibility display from the style", () => {
  const legacy = { style: "text-shadow: white 0px 0px 4px; display: none;", "data-dx": 0, "data-dy": -0.4 };
  expect(labelGroupFromLegacy(legacy).attrs.style).toBe(
    "text-shadow: white 0px 0px 4px; transform: translate(0em, -0.4em)"
  );
  expect(labelGroupFromLegacy({ style: "display: none;" }).attrs.style).toBeNull();
  expect(labelGroupFromLegacy({ style: "text-shadow: white 0px 0px 4px" }).attrs.style).toBe(
    "text-shadow: white 0px 0px 4px"
  );
});

const presetDir = path.join(__dirname, "../../public/styles");

test("all 14 shipped presets parse as the new format with zero warnings", () => {
  const files = fs
    .readdirSync(presetDir)
    .filter(f => f.endsWith(".json"))
    .map(f => path.join(presetDir, f));
  files.push(path.join(__dirname, "default-styles.json"));
  expect(files).toHaveLength(15);
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

test("normalizeStyles folds the pre-1.154 fixed children under their element's groups", () => {
  const record: any = {
    states: { statesBody: { attrs: { opacity: 1 } }, statesHalo: { attrs: { opacity: 0.4 } } },
    ocean: { options: { bands: {} }, base: { attrs: { fill: "#000" } } },
    legend: { attrs: {}, box: { attrs: { fill: "#fff" } } },
    scaleBar: { attrs: {}, back: { attrs: {} } }
  };

  normalizeStyles(record);

  expect(record.states).toEqual({
    groups: { statesBody: { attrs: { opacity: 1 } }, statesHalo: { attrs: { opacity: 0.4 } } }
  });
  expect(record.ocean.groups.base).toEqual({ attrs: { fill: "#000" } });
  expect(record.ocean.options).toEqual({ bands: {} });
  expect(record.legend.groups.box).toEqual({ attrs: { fill: "#fff" } });
  expect(record.scaleBar.groups.back).toEqual({ attrs: {} });
});

test("normalizeStyles converts legacy CSS colors to hex", () => {
  const record: any = {
    rivers: { attrs: { fill: "rgb(18, 52, 86)", stroke: "rgba(0, 0, 0, 0.5)", filter: "url(#dropShadow05)" } },
    ocean: { groups: { base: { attrs: { fill: "#466eab" } } }, options: { color: "rgb(1, 2, 3)" } }
  };

  normalizeStyles(record);

  expect(record.rivers.attrs).toEqual({
    fill: "#123456",
    stroke: "#00000080",
    filter: "url(#dropShadow05)"
  });
  expect(record.ocean.groups.base.attrs.fill).toBe("#466eab");
  expect(record.ocean.options.color).toBe("#010203");
});

test("normalizeStyles merges the two burg records into one entry per group", () => {
  const record: any = {
    burgIcons: {
      burgIcons: { groups: { capital: { attrs: { fill: "#fff" }, options: { size: 2 } } } },
      anchors: { groups: { capital: { attrs: { fill: "#000" }, options: { size: 1.9 } }, port: { attrs: {} } } }
    }
  };

  normalizeStyles(record);

  expect(record.burgIcons.groups.capital).toEqual({
    groups: {
      icons: { attrs: { fill: "#fff" }, options: { size: 2 } },
      anchors: { attrs: { fill: "#000" }, options: { size: 1.9 } }
    }
  });
  expect(record.burgIcons.groups.port.groups.icons).toBeUndefined();
  expect(record.burgIcons.groups.port.groups.anchors).toEqual({ attrs: {} });
  expect(record.burgIcons.burgIcons).toBeUndefined();
  expect(record.burgIcons.anchors).toBeUndefined();
});

test("normalizeStyles leaves a record already in the current shape alone", () => {
  const record: any = {
    states: { groups: { statesBody: { attrs: {} } } },
    burgIcons: { groups: { capital: { groups: { icons: { attrs: {} }, anchors: { attrs: {} } } } } }
  };
  const before = structuredClone(record);

  normalizeStyles(record);

  expect(record).toEqual(before);
});
