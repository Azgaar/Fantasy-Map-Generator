import { describe, expect, it } from "vitest";
import exportSource from "../../services/io/export.ts?raw";
import saveSource from "../../services/io/save.ts?raw";
import renderersIndex from "../index.ts?raw";
import controllerSource from "./pixi-renderer-controller.ts?raw";
import loaderSource from "./pixi-renderer-loader.ts?raw";

describe("Pixi hard cutover", () => {
  it("boots the production renderer without a URL flag, theme, disable path, or console global", () => {
    expect(renderersIndex.includes('import "./pixi/pixi-renderer-loader"')).toBe(true);
    expect(loaderSource.includes("activatePixiRendererOwnership()")).toBe(true);
    expect(loaderSource.includes("pixiRendererController.start()")).toBe(true);
    expect(loaderSource.includes("URLSearchParams")).toBe(false);
    expect(loaderSource.includes("PixiMapPrototype")).toBe(false);
    expect(controllerSource.includes("disable:")).toBe(false);
    expect(controllerSource.includes("setTheme")).toBe(false);
  });

  it("does not reconstruct Pixi-owned SVG during save or export", () => {
    expect(saveSource.includes("materializePixiSvgFallback")).toBe(false);
    expect(exportSource.includes("materializePixiSvgFallback")).toBe(false);
    expect(saveSource.includes("Pixi-owned layers are intentionally absent")).toBe(true);
  });

  it("uses the production surface and contains no prototype identifiers", () => {
    const productionSources = [controllerSource, loaderSource, renderersIndex, saveSource, exportSource].join("\n");
    expect(controllerSource.includes('"pixi-map-renderer"')).toBe(true);
    expect(controllerSource.includes('"pixi-renderer-active"')).toBe(true);
    expect(productionSources.includes("pixi-map-prototype")).toBe(false);
    expect(productionSources.includes("pixi-prototype-states")).toBe(false);
    expect(productionSources.includes("pixi-prototype-biomes")).toBe(false);
  });
});
