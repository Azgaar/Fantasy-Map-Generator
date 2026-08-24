import { describe, expect, it } from "vitest";
import type { Style } from "@/types/style";
import {
  applyLegacyStylePresetToMapStyle,
  type LegacyStylePreset,
  serializeMapStyleToLegacyPreset
} from "./legacy-style-preset-adapter";

describe("legacy style preset adapter", () => {
  it("converts physical, thematic, line, and entity attributes without reading the DOM", () => {
    const appStyle = { mapRenderer: undefined } as Pick<Style, "mapRenderer">;
    const preset: LegacyStylePreset = {
      "#burgIcons > g#capital": {
        fill: "#ffeecc",
        "font-size": 2.5,
        "stroke-width": 0.7
      },
      "#compass": { opacity: 0.6 },
      "#compass > use": { transform: "translate(44 55) scale(.4)" },
      "#gridOverlay": {
        dx: 3,
        opacity: 0.75,
        "stroke-dasharray": "2 1",
        "stroke-width": 1.25,
        type: "square"
      },
      "#ice": { fill: "#ddeeff", opacity: 0.8, stroke: "#abcdee", "stroke-width": 2 },
      "#landHeights": { curve: "curveLinear", opacity: 0.9, scheme: "natural", skip: 2 },
      "#markets": { "data-icon": "★", "data-size": 6, "fill-opacity": 0.12 },
      "#oceanBase": { fill: "#123456" },
      "#oceanHeights": { "data-render": 1, scheme: "blue" },
      "#roads": { opacity: 0.5, stroke: "#aa5500", "stroke-width": 1.1 },
      "#statesBody": { opacity: 0.42 },
      "#statesHalo": { "data-width": 12, filter: "blur(6px)", opacity: 0.3 },
      "#cults": { filter: null, opacity: 0.6, stroke: "#765432", "stroke-width": 0.8 },
      "#map": { filter: "url(#filter-sepia)" },
      "#texture": { "data-href": "texture.png", "data-x": 8, mask: "url(#land)" },
      "#tradeAnimation": { opacity: 0.35 }
    };

    const result = applyLegacyStylePresetToMapStyle(appStyle, preset, ["capital"]);

    expect(result.ocean.color).toBe("#123456");
    expect(result.texture).toMatchObject({ href: "texture.png", mask: "land", x: 8 });
    expect(result.height.land).toMatchObject({ curve: "curveLinear", opacity: 0.9, scheme: "natural", skip: 2 });
    expect(result.height.ocean).toMatchObject({ render: true, scheme: "blue" });
    expect(result.states.opacity).toBe(0.42);
    expect(result.states.halo).toEqual({ blur: 6, opacity: 0.3, width: 12 });
    expect(result.cultures.stroke).toMatchObject({ color: "#765432", width: 0.8 });
    expect(result.filter).toBe("url(#filter-sepia)");
    expect(result.grid).toMatchObject({ dx: 3, opacity: 0.75, type: "square" });
    expect(result.grid.stroke).toMatchObject({ dash: "2 1", width: 1.25 });
    expect(result.routes.roles.roads).toMatchObject({ color: "#aa5500", opacity: 0.5, width: 1.1 });
    expect(result.ice.default.fill).toMatchObject({ color: "#ddeeff", opacity: 0.8 });
    expect(result.burgIcons.icons.roles.capital).toMatchObject({ fill: "#ffeecc", size: 2.5, strokeWidth: 0.7 });
    expect(result.markets).toMatchObject({ areaOpacity: 0.12, icon: "★", radius: 6 });
    expect(result.compass).toMatchObject({ opacity: 0.6, scale: 0.4, x: 44, y: 55 });
    expect(result.trade.opacity).toBe(0.35);
    expect(appStyle.mapRenderer).toEqual(result);
  });

  it("falls back safely for invalid numeric and enum attributes", () => {
    const appStyle = { mapRenderer: undefined } as Pick<Style, "mapRenderer">;
    const result = applyLegacyStylePresetToMapStyle(appStyle, {
      "#gridOverlay": { opacity: "invalid", "stroke-linecap": "invalid", type: "invalid" }
    });

    expect(result.grid.opacity).toBe(1);
    expect(result.grid.stroke.cap).toBe("butt");
    expect(result.grid.type).toBe("pointyHex");
  });

  it("serializes renderer-owned styles without consulting SVG carriers", () => {
    const appStyle = { mapRenderer: undefined } as Pick<Style, "mapRenderer">;
    const rendererStyle = applyLegacyStylePresetToMapStyle(
      appStyle,
      {
        "#freshwater": { fill: "#55aacc", opacity: 0.6, stroke: "#224466", "stroke-width": 0.8 },
        "#provinceBorders": { opacity: 0.4, stroke: "#112233", "stroke-dasharray": "1 2" },
        "#terrs #landHeights": { opacity: 0.7, scheme: "natural", terracing: 3 },
        "#texture": { "data-href": "paper.png", mask: "url(#water)", opacity: 0.25 }
      },
      ["town"]
    );

    const serialized = serializeMapStyleToLegacyPreset(rendererStyle, ["town"]);

    expect(serialized["#provinceBorders"]).toMatchObject({
      opacity: 0.4,
      stroke: "#112233",
      "stroke-dasharray": "1 2"
    });
    expect(serialized["#freshwater"]).toMatchObject({ fill: "#55aacc", opacity: 0.6, stroke: "#224466" });
    expect(serialized["#terrs #landHeights"]).toMatchObject({ opacity: 0.7, scheme: "natural", terracing: 3 });
    expect(serialized["#texture"]).toMatchObject({ "data-href": "paper.png", mask: "url(#water)", opacity: 0.25 });
    expect(serialized["#burgIcons > g#town"]?.["data-icon"]).toMatch(/^#icon-/);
  });
});
