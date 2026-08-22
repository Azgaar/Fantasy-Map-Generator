import { describe, expect, it } from "vitest";
import mainSource from "../../../public/main.js?raw";
import layersSource from "../../../public/modules/ui/layers.js?raw";
import styleUiSource from "../../../public/modules/ui/style.js?raw";
import stylePresetsSource from "../../../public/modules/ui/style-presets.js?raw";
import burgEditorSource from "../../controllers/burg-editor.ts?raw";
import markerEditorSource from "../../controllers/markers-editor.ts?raw";
import riverCreatorSource from "../../controllers/river-creator.ts?raw";
import riverEditorSource from "../../controllers/river-editor.ts?raw";
import riversOverviewSource from "../../controllers/rivers-overview.ts?raw";
import routeCreatorSource from "../../controllers/route-creator.ts?raw";
import routeEditorSource from "../../controllers/route-editor.ts?raw";
import routeGroupsEditorSource from "../../controllers/route-groups-editor.ts?raw";
import routesOverviewSource from "../../controllers/routes-overview.ts?raw";
import riverGeneratorSource from "../../generators/river-generator.ts?raw";
import routesGeneratorSource from "../../generators/routes-generator.ts?raw";
import exportSource from "../../services/io/export.ts?raw";
import loadSource from "../../services/io/load.ts?raw";
import saveSource from "../../services/io/save.ts?raw";
import drawBiomesSource from "../draw-biomes.ts?raw";
import drawBordersSource from "../draw-borders.ts?raw";
import drawGoodsSource from "../draw-goods.ts?raw";
import drawIceSource from "../draw-ice.ts?raw";
import drawMarketsSource from "../draw-markets.ts?raw";
import drawMilitarySource from "../draw-military.ts?raw";
import drawTemperatureSource from "../draw-temperature.ts?raw";
import drawTradeSource from "../draw-trade-animation.ts?raw";
import renderersIndex from "../index.ts?raw";
import pointSymbolsSource from "../point-symbols.ts?raw";
import pointSymbolSceneSource from "../scene/layers/point-symbol-scene.ts?raw";
import populationMilitarySceneSource from "../scene/layers/population-military-scene.ts?raw";
import staticOverlaySceneSource from "../scene/layers/static-overlay-scene.ts?raw";
import denseOverlaysSource from "../viewport/dense-overlays.ts?raw";
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
    expect(layersSource.includes('redrawPixiLayer("cultures", "cults")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("religions", "relig")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("provinces", "provs")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("zones", "zones")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("cells", "cells")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("grid", "gridOverlay")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("precipitation", "prec")')).toBe(true);
    expect(layersSource.includes('detail: {command: "invalidate-layer", layer: "rivers"}')).toBe(true);
    expect(layersSource.includes('detail: {command: "invalidate-layer", layer: "routes"}')).toBe(true);
    expect(layersSource.includes('"#pattern_"')).toBe(false);
    expect(layersSource.includes("getGappedFillPaths")).toBe(false);
    expect([layersSource, drawBiomesSource, drawBordersSource].join("\n").includes("ownership-request")).toBe(false);
    expect(drawBiomesSource.includes("getIsolines")).toBe(false);
    expect(drawBordersSource.includes("buildBorderPaths(pack)")).toBe(false);
    expect(drawTemperatureSource.includes('invalidatePixiRendererLayer("temperature")')).toBe(true);
    expect(drawTemperatureSource.includes("connectVertices")).toBe(false);
    expect(layersSource.includes("ViewportPrecipitation")).toBe(false);
    expect(layersSource.includes("Rivers.getRiverPath")).toBe(false);
    expect(layersSource.includes("Routes.getPath(route)")).toBe(false);
  });

  it("persists migrated visibility and semantic opacity instead of deriving them from SVG paths", () => {
    expect(saveSource.includes("capturePixiLayerVisibility(style")).toBe(true);
    expect(loadSource.includes("getStoredPixiLayerVisibility(style, layer)")).toBe(true);
    expect(styleUiSource.includes("setPixiLayerOpacity")).toBe(true);
    expect(stylePresetsSource.includes("syncPixiCellStylePreset(presetJson)")).toBe(true);
  });

  it("keeps river and route editing out of the removed persistent SVG layer groups", () => {
    const editorSources = [
      riverCreatorSource,
      riverEditorSource,
      riversOverviewSource,
      routeCreatorSource,
      routeEditorSource,
      routeGroupsEditorSource,
      routesOverviewSource
    ].join("\n");
    expect(editorSources.includes('select("#rivers")')).toBe(false);
    expect(editorSources.includes('select("#routes")')).toBe(false);
    expect(riverEditorSource.includes('data-renderer-overlay", "transient"')).toBe(true);
    expect(routeEditorSource.includes('data-renderer-overlay", "transient"')).toBe(true);
    expect(routeCreatorSource.includes('data-renderer-overlay", "transient"')).toBe(true);
    expect(riverEditorSource.includes("getTotalLength")).toBe(false);
    expect(routeEditorSource.includes('selectedRoute.attr("id")')).toBe(false);
    expect(riverEditorSource.includes('selectedRiver.attr("id")')).toBe(false);
    expect(riverGeneratorSource.includes('select("#rivers")')).toBe(false);
    expect(routesGeneratorSource.includes('select("#viewbox").select(`#route')).toBe(false);
  });

  it("renders burgs and markers only through renderer-neutral Pixi point symbols", () => {
    expect(layersSource.includes('redrawPixiLayer("burgIcons")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("markers")')).toBe(true);
    expect(renderersIndex.includes("draw-burg-icons")).toBe(false);
    expect(renderersIndex.includes("draw-markers")).toBe(false);
    expect(pointSymbolsSource.includes('invalidatePixiRendererLayer("burgIcons")')).toBe(true);
    expect(pointSymbolsSource.includes('invalidatePixiRendererLayer("markers")')).toBe(true);
    expect(pointSymbolSceneSource.includes("buildBurgPointSymbolScene")).toBe(true);
    expect(pointSymbolSceneSource.includes("buildMarkerPointSymbolScene")).toBe(true);
    expect(burgEditorSource.includes('select("#burgIcons")')).toBe(false);
    expect(burgEditorSource.includes('select("#anchors")')).toBe(false);
    expect(markerEditorSource.includes('select("#markers")')).toBe(false);
    expect(markerEditorSource.includes('select<SVGGElement, unknown>("#debug")')).toBe(true);
    expect(mainSource.includes('attr("id", "burgIcons")')).toBe(false);
    expect(mainSource.includes('attr("id", "anchors")')).toBe(false);
    expect(mainSource.includes('attr("id", "markers")')).toBe(false);
    expect(controllerSource.includes('"#burgIcons"')).toBe(true);
    expect(controllerSource.includes('"#anchors"')).toBe(true);
    expect(controllerSource.includes('"#markers"')).toBe(true);
    expect(controllerSource.includes("document.querySelector(selector)?.remove()")).toBe(true);
  });

  it("renders ice, goods, and markets only through renderer-neutral Pixi scenes", () => {
    expect(layersSource.includes('redrawPixiLayer("ice")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("goods")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("markets")')).toBe(true);
    expect([drawGoodsSource, drawIceSource, drawMarketsSource].join("\n").includes('from "d3"')).toBe(false);
    expect(drawGoodsSource.includes('invalidatePixiRendererLayer("goods")')).toBe(true);
    expect(drawIceSource.includes('invalidatePixiRendererLayer("ice")')).toBe(true);
    expect(drawMarketsSource.includes('invalidatePixiRendererLayer("markets")')).toBe(true);
    expect(mainSource.includes('append("g").attr("id", "ice")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "goods")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "markets")')).toBe(false);
    for (const selector of ['"#ice"', '"#goods"', '"#goodsCells"', '"#goodsIcons"', '"#goodsBurgs"', '"#markets"']) {
      expect(controllerSource.includes(selector)).toBe(true);
    }
  });

  it("renders population and military only through renderer-neutral Pixi scenes", () => {
    expect(layersSource.includes('redrawPixiLayer("population")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("military")')).toBe(true);
    expect(drawMilitarySource.includes('from "d3"')).toBe(false);
    expect(drawMilitarySource.includes('invalidatePixiRendererLayer("military")')).toBe(true);
    expect(populationMilitarySceneSource.includes("buildPopulationScene")).toBe(true);
    expect(populationMilitarySceneSource.includes("buildMilitaryScene")).toBe(true);
    expect(denseOverlaysSource.includes("ViewportPopulation")).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "population")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "armies")')).toBe(false);
    expect(mainSource.includes('attr("id", "rural")')).toBe(false);
    expect(mainSource.includes('attr("id", "urban")')).toBe(false);
    for (const selector of ['"#population"', '"#rural"', '"#urban"', '"#armies"']) {
      expect(controllerSource.includes(selector)).toBe(true);
    }
    expect(exportSource.includes("#armies image")).toBe(false);
  });

  it("renders compass and trade through Pixi without live SVG transitions", () => {
    expect(layersSource.includes('redrawPixiLayer("compass")')).toBe(true);
    expect(layersSource.includes('redrawPixiLayer("trade")')).toBe(true);
    expect(staticOverlaySceneSource.includes("buildCompassScene")).toBe(true);
    expect(drawTradeSource.includes("requestAnimationFrame")).toBe(true);
    expect(drawTradeSource.includes('from "d3"')).toBe(false);
    expect(drawTradeSource.includes("document.createElementNS")).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "compass")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "tradeAnimation")')).toBe(false);
    expect(controllerSource.includes('"#compass"')).toBe(true);
    expect(controllerSource.includes('"#tradeAnimation"')).toBe(true);
    expect(exportSource.includes("add wind rose")).toBe(false);
    expect(saveSource.includes("cloneTradeAnimation")).toBe(false);
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
