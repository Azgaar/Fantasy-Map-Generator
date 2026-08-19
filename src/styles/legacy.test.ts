import { describe, expect, test, vi } from "vitest";
import { applyStaticDefaults, isLegacyPreset, upgradeLegacyPreset } from "./legacy";
import fixture from "./legacy-default.fixture.json";

describe("upgradeLegacyPreset", () => {
  test("detects legacy", () => {
    expect(isLegacyPreset(fixture)).toBe(true);
    expect(isLegacyPreset({ routes: {} })).toBe(false);
  });

  test("routes selectors land under registry ids with children", () => {
    const d = upgradeLegacyPreset(fixture as Record<string, Record<string, unknown>>);
    expect(d.routes?.children?.roads?.attrs?.["stroke-width"]).toBeDefined();
    expect(d.heightmap?.children?.landHeights?.options).toMatchObject({ scheme: "bright" });
    expect((d.states?.children?.statesHalo?.options as { width?: number })?.width).toBe(10);
    expect(d.relief?.options).toEqual({ set: "simple", size: 1 }); // density → app options, dropped here
    expect(d.military?.options).toMatchObject({ boxSize: 3 });
  });

  test("burg icon/anchor groups carry presentation attrs alongside size and icon", () => {
    const d = upgradeLegacyPreset(fixture as Record<string, Record<string, unknown>>);
    const capitalIcon = d.burgIcons?.children?.capital;
    expect(capitalIcon?.attrs?.fill).toBe("#ffffff");
    expect(capitalIcon?.attrs?.stroke).toBe("#3e3e4b");
    expect(capitalIcon?.options).toEqual({ size: 2, icon: "#icon-square" });

    const capitalAnchor = d.anchors?.children?.capital;
    expect(capitalAnchor?.attrs?.fill).toBe("#ffffff");
    expect(capitalAnchor?.attrs?.stroke).toBe("#3e3e4b");
    expect(capitalAnchor?.options).toEqual({ size: 1.9 }); // #anchors > g#capital carries no data-icon
  });

  test("#terrs > #oceanHeights's data-render lands as heightmap.oceanHeights.options.render", () => {
    const d = upgradeLegacyPreset(fixture as Record<string, Record<string, unknown>>);
    // default.json's #terrs > #oceanHeights carries data-render: 0
    expect(d.heightmap?.children?.oceanHeights?.options).toMatchObject({ render: false });
  });

  test("statesBody and goodsCells survive as attrs-only children", () => {
    const d = upgradeLegacyPreset(fixture as Record<string, Record<string, unknown>>);
    expect(d.states?.children?.statesBody?.attrs).toEqual({ opacity: 0.4, filter: null });
    expect(d.goods?.children?.goodsCells?.attrs?.opacity).toBe(1);
  });

  test("#legendBox lands under legend.options.box, never on the legend layer's own attrs", () => {
    const d = upgradeLegacyPreset({ "#legendBox": { fill: "#ffffff", "fill-opacity": 0.5 } });
    expect(d.legend?.options?.box).toEqual({ fill: "#ffffff", fillOpacity: 0.5 });
    expect(d.legend?.attrs).toBeUndefined(); // tinting <g id="legend"> would tint the legend text
  });

  test("unknown selectors are skipped with a warning, not thrown", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = upgradeLegacyPreset({ "#notASelector": { opacity: 1 }, "#map": { fill: "#000" } });
    expect(d.map?.attrs?.fill).toBe("#000");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("#notASelector"));
    warn.mockRestore();
  });
});

describe("applyStaticDefaults", () => {
  test("fills in the three registry-static paint attrs only where missing", () => {
    const layers: Parameters<typeof applyStaticDefaults>[0] = {
      fogging: { attrs: { mask: "url(#custom-fog)" } }
    };
    applyStaticDefaults(layers);

    expect(layers.labels?.attrs?.["font-size"]).toBe("100px");
    expect(layers.fogging?.attrs?.mask).toBe("url(#custom-fog)"); // an explicit value is not overwritten
    expect(layers.vignette?.attrs?.mask).toBe("url(#vignette-mask)");
  });
});
