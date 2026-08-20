import { describe, expect, it } from "vitest";
import layersSource from "../../../public/modules/ui/layers.js?raw";
import stylePresetsSource from "../../../public/modules/ui/style-presets.js?raw";
import styleUiSource from "../../../public/modules/ui/style.js?raw";
import drawBiomesSource from "../draw-biomes.ts?raw";
import drawBordersSource from "../draw-borders.ts?raw";
import exportSource from "../../services/io/export.ts?raw";
import loadSource from "../../services/io/load.ts?raw";
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

  it("routes migrated thematic fills to Pixi without isoline or ownership fallback branches", () => {
    expect(layersSource.includes('redrawPixiCellLayer("cultures", "cults")')).toBe(true);
    expect(layersSource.includes('redrawPixiCellLayer("religions", "relig")')).toBe(true);
    expect(layersSource.includes('redrawPixiCellLayer("provinces", "provs")')).toBe(true);
    expect(layersSource.includes("getGappedFillPaths")).toBe(false);
    expect([layersSource, drawBiomesSource, drawBordersSource].join("\n").includes("ownership-request")).toBe(false);
    expect(drawBiomesSource.includes("getIsolines")).toBe(false);
    expect(drawBordersSource.includes("buildBorderPaths(pack)")).toBe(false);
  });

  it("persists migrated visibility and semantic opacity instead of deriving them from SVG paths", () => {
    expect(saveSource.includes("capturePixiLayerVisibility(style")).toBe(true);
    expect(loadSource.includes("getStoredPixiLayerVisibility(style, layer)")).toBe(true);
    expect(styleUiSource.includes("setPixiCellLayerOpacity")).toBe(true);
    expect(stylePresetsSource.includes("syncPixiCellStylePreset(presetJson)")).toBe(true);
  });

  it("uses Pixi as the authoritative base for viewport raster exports", () => {
    expect(controllerSource.includes("getCanvas:")).toBe(true);
    expect(exportSource.includes("getPixiRendererCanvas()")).toBe(true);
    expect(exportSource.indexOf("context.drawImage(pixiCanvas")).toBeLessThan(
      exportSource.indexOf("context.drawImage(overlay")
    );
    expect(exportSource.includes('throw new Error("Pixi renderer is not ready for raster export")')).toBe(true);
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
