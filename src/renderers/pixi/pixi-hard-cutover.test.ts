import { describe, expect, it } from "vitest";
import mainSource from "../../application/main-runtime.ts?raw";
import componentsIndexSource from "../../components/index.ts?raw";
import layersSource from "../../components/layers/layer-controls-runtime.ts?raw";
import mapTooltipSource from "../../components/map-tooltip.ts?raw";
import styleUiSource from "../../components/style/style-editor-runtime.ts?raw";
import stylePresetsSource from "../../components/style/style-presets-runtime.ts?raw";
import zoomSource from "../../components/zoom.ts?raw";
import biomesEditorSource from "../../controllers/biomes-editor.ts?raw";
import burgEditorSource from "../../controllers/burg-editor.ts?raw";
import burgsOverviewSource from "../../controllers/burgs-overview.ts?raw";
import coastlineVertexEditorSource from "../../controllers/coastline-vertex-editor.ts?raw";
import compassEditorSource from "../../controllers/compass-editor.ts?raw";
import culturesEditorSource from "../../controllers/cultures-editor.ts?raw";
import diplomacyEditorSource from "../../controllers/diplomacy-editor.ts?raw";
import emblemsEditorSource from "../../controllers/emblems-editor.ts?raw";
import goodsEditorSource from "../../controllers/goods-editor.ts?raw";
import heightmapEditorSource from "../../controllers/heightmap-editor.ts?raw";
import iceEditorSource from "../../controllers/ice-editor.ts?raw";
import labelSpreadSource from "../../controllers/label-spread.ts?raw";
import labelsEditorSource from "../../controllers/labels-editor.ts?raw";
import lakesEditorSource from "../../controllers/lakes-editor.ts?raw";
import markerEditorSource from "../../controllers/markers-editor.ts?raw";
import marketsOverviewSource from "../../controllers/markets-overview.ts?raw";
import measurersEditorSource from "../../controllers/measurers-editor.ts?raw";
import militaryOverviewSource from "../../controllers/military-overview.ts?raw";
import provincesEditorSource from "../../controllers/provinces-editor.ts?raw";
import regimentEditorSource from "../../controllers/regiment-editor.ts?raw";
import regimentsOverviewSource from "../../controllers/regiments-overview.ts?raw";
import reliefEditorSource from "../../controllers/relief-editor.ts?raw";
import religionsEditorSource from "../../controllers/religions-editor.ts?raw";
import riverCreatorSource from "../../controllers/river-creator.ts?raw";
import riverEditorSource from "../../controllers/river-editor.ts?raw";
import riversOverviewSource from "../../controllers/rivers-overview.ts?raw";
import routeCreatorSource from "../../controllers/route-creator.ts?raw";
import routeEditorSource from "../../controllers/route-editor.ts?raw";
import routeGroupsEditorSource from "../../controllers/route-groups-editor.ts?raw";
import routesOverviewSource from "../../controllers/routes-overview.ts?raw";
import statesEditorSource from "../../controllers/states-editor.ts?raw";
import territoryEditorUtilsSource from "../../controllers/territory-editor-utils.ts?raw";
import transformToolSource from "../../controllers/transform-tool.ts?raw";
import zonesEditorSource from "../../controllers/zones-editor.ts?raw";
import riverGeneratorSource from "../../generators/river-generator.ts?raw";
import routesGeneratorSource from "../../generators/routes-generator.ts?raw";
import indexSource from "../../index.html?raw";
import exportSource from "../../services/io/export.ts?raw";
import loadSource from "../../services/io/load.ts?raw";
import saveSource from "../../services/io/save.ts?raw";
import drawBiomesSource from "../draw-biomes.ts?raw";
import drawBordersSource from "../draw-borders.ts?raw";
import drawEmblemsSource from "../draw-emblems.ts?raw";
import drawGoodsSource from "../draw-goods.ts?raw";
import drawIceSource from "../draw-ice.ts?raw";
import drawMarketsSource from "../draw-markets.ts?raw";
import drawMilitarySource from "../draw-military.ts?raw";
import drawTemperatureSource from "../draw-temperature.ts?raw";
import drawTradeSource from "../draw-trade-animation.ts?raw";
import renderersIndex from "../index.ts?raw";
import domainOverlaySource from "../interaction/map-domain-overlay.ts?raw";
import interactionOverlaySource from "../interaction/map-interaction-overlay.ts?raw";
import labelsRendererSource from "../labels/labels-renderer.ts?raw";
import brushCircleSource from "../overlays/brush-circle.ts?raw";
import pointSymbolsSource from "../point-symbols.ts?raw";
import coordinateSceneSource from "../scene/layers/coordinate-scene.ts?raw";
import emblemSceneSource from "../scene/layers/emblem-scene.ts?raw";
import labelSceneSource from "../scene/layers/label-scene.ts?raw";
import pointSymbolSceneSource from "../scene/layers/point-symbol-scene.ts?raw";
import populationMilitarySceneSource from "../scene/layers/population-military-scene.ts?raw";
import reliefSceneSource from "../scene/layers/relief-sprite-scene.ts?raw";
import staticOverlaySceneSource from "../scene/layers/static-overlay-scene.ts?raw";
import view3dSource from "../view-3d-renderer.ts?raw";
import denseOverlaysSource from "../viewport/dense-overlays.ts?raw";
import legacySvgImportSource from "./legacy-svg-import.ts?raw";
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
    expect(indexSource.includes("modules/ui/layers.js")).toBe(false);
    expect(indexSource.includes("modules/ui/style-presets.js")).toBe(false);
    expect(indexSource.includes("main.js")).toBe(false);
    expect(indexSource.includes("libs/d3.min.js")).toBe(false);
    expect(indexSource.includes('src="application/main-runtime.ts"')).toBe(true);
    expect(indexSource.indexOf('id="toggleRivers"')).toBeGreaterThan(indexSource.indexOf('id="toggleBorders"'));
    expect(indexSource.includes('onclick="toggleTexture(event)"')).toBe(false);
    expect(indexSource.includes('onclick="toggleMarketsLayer(event)"')).toBe(false);
    expect(indexSource.includes('onchange="handleLayersPresetChange')).toBe(false);
    expect(indexSource.includes('onchange="requestStylePresetChange')).toBe(false);
    expect(componentsIndexSource.includes("initializeLayerControlsRuntime()")).toBe(true);
    expect(layersSource.includes("exposeCompatibilityCommands")).toBe(false);
    for (const operation of [
      "drawActiveLayers",
      "isLayerOn",
      "redrawLayer",
      "restoreSavedPreset",
      "setLayerVisibility",
      "toggleLayer"
    ]) {
      expect(layersSource.includes(operation)).toBe(true);
    }
    expect(mainSource.includes("LayerControls.restoreSavedPreset()")).toBe(true);
    expect(mainSource.includes("LayerControls.drawActiveLayers()")).toBe(true);
    expect(mainSource.includes("window.LayerControls")).toBe(false);
    expect(mainSource.includes("window.StylePresets")).toBe(false);
    expect(mainSource.includes("window.OptionsController")).toBe(false);
    expect(mainSource.includes("initializeApplicationState(")).toBe(true);
    expect(mainSource.includes("initializeViewportSurface()")).toBe(true);
    expect(mainSource.includes("bindApplicationController({")).toBe(true);
    expect(mainSource.includes("bindWorldGenerationController({")).toBe(true);
    expect(styleUiSource.includes("window.LayerControls.isLayerOn(")).toBe(true);
  });

  it("does not reconstruct Pixi-owned SVG during save or export", () => {
    expect(saveSource.includes("materializePixiSvgFallback")).toBe(false);
    expect(exportSource.includes("materializePixiSvgFallback")).toBe(false);
    expect(saveSource.includes("Pixi-owned layers are intentionally absent")).toBe(true);
  });

  it("routes migrated thematic fills to Pixi without isoline or ownership fallback branches", () => {
    for (const ownership of [
      'toggleCultures: "cultures"',
      'toggleReligions: "religions"',
      'toggleProvinces: "provinces"',
      'toggleZones: "zones"',
      'toggleCells: "cells"',
      'toggleGrid: "grid"',
      'togglePrecipitation: "precipitation"'
    ]) {
      expect(layersSource.includes(ownership)).toBe(true);
    }
    expect(layersSource.includes('invalidatePixiRendererLayer("rivers")')).toBe(true);
    expect(layersSource.includes('invalidatePixiRendererLayer("routes")')).toBe(true);
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
    expect(saveSource.includes("style.mapLayerOrder = LayerControls.getLayerOrder()")).toBe(true);
    expect(loadSource.includes("getStoredPixiLayerVisibility(style, layer)")).toBe(true);
    expect(loadSource.includes("LayerControls.setLayerOrder(style.mapLayerOrder)")).toBe(true);
    expect(styleUiSource.includes("window.MapStyleControls.setLayerOpacity")).toBe(true);
    expect(styleUiSource.includes("function setPixiLayerOpacity")).toBe(false);
    expect(stylePresetsSource.includes("window.MapStyleControls.applyLegacyPreset(presetJson)")).toBe(true);
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
    expect(riverEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(riverEditorSource.includes('select("#debug")')).toBe(false);
    expect(riverEditorSource.includes("getPointer")).toBe(false);
    expect(routeEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(routeEditorSource.includes('select("#debug")')).toBe(false);
    expect(routeEditorSource.includes("getPointer")).toBe(false);
    expect(routeCreatorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(routeCreatorSource.includes('select("#debug")')).toBe(false);
    expect(routeCreatorSource.includes("getPointer")).toBe(false);
    expect(riverCreatorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(riverCreatorSource.includes('select("#debug")')).toBe(false);
    expect(riverCreatorSource.includes("getPointer")).toBe(false);
    expect(riverEditorSource.includes("getTotalLength")).toBe(false);
    expect(routeEditorSource.includes('selectedRoute.attr("id")')).toBe(false);
    expect(riverEditorSource.includes('selectedRiver.attr("id")')).toBe(false);
    expect(riverGeneratorSource.includes('select("#rivers")')).toBe(false);
    expect(routesGeneratorSource.includes('select("#viewbox").select(`#route')).toBe(false);
  });

  it("previews territory assignments from typed working copies instead of temporary SVG polygons", () => {
    const territorySources = [
      biomesEditorSource,
      culturesEditorSource,
      religionsEditorSource,
      statesEditorSource,
      provincesEditorSource,
      zonesEditorSource
    ];
    for (const source of territorySources) {
      expect(source.includes('select("#temp")')).toBe(false);
      expect(source.includes('attr("id", "temp")')).toBe(false);
      expect(source.includes("getPackPolygon")).toBe(false);
      expect(source.includes("getPointer")).toBe(false);
    }
    expect(territoryEditorUtilsSource.includes("TerritoryAssignmentSession")).toBe(true);
    expect(territoryEditorUtilsSource.includes("ZoneAssignmentSession")).toBe(true);
    expect(culturesEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(religionsEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
  });

  it("derives territory highlights and fog paths from domain assignments", () => {
    expect(domainOverlaySource.includes("getIsolines(pack")).toBe(true);
    expect(interactionOverlaySource.includes('geometry.kind === "path"')).toBe(true);
    for (const source of [
      biomesEditorSource,
      diplomacyEditorSource,
      statesEditorSource,
      provincesEditorSource,
      zonesEditorSource
    ]) {
      for (const legacyAccess of [
        'select("#regions")',
        'select("#statesBody")',
        'select("#statesHalo")',
        'unknown>("#provs")',
        'unknown>("#zones")',
        "select(`#biomes >",
        'select("#debug")'
      ]) {
        expect(source.includes(legacyAccess)).toBe(false);
      }
    }
    expect(statesEditorSource.includes("getAssignmentPath(pack.cells.state")).toBe(true);
    expect(provincesEditorSource.includes("getAssignmentPath(pack.cells.province")).toBe(true);
    expect(zonesEditorSource.includes("getCellsPath(zone.cells)")).toBe(true);
  });

  it("edits feature vertices by domain ID without legacy paths or debug circles", () => {
    for (const source of [lakesEditorSource, coastlineVertexEditorSource]) {
      expect(source.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
      expect(source.includes('select("#debug")')).toBe(false);
      expect(source.includes("getFeaturePath")).toBe(false);
      expect(source.includes("getPackPolygon")).toBe(false);
      expect(source.includes("moveFeatureVertex")).toBe(true);
    }
  });

  it("edits stable relief entities through Pixi picking and overlay handles", () => {
    expect(reliefEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(reliefEditorSource.includes('select("#terrain")')).toBe(false);
    expect(reliefEditorSource.includes("getPointer")).toBe(false);
    expect(reliefEditorSource.includes("moveReliefIcon")).toBe(true);
    expect(reliefSceneSource.includes("relief[index].i ?? index")).toBe(true);
  });

  it("edits Pixi labels from domain data and shared overlay handles", () => {
    expect(labelsEditorSource.includes("getSceneLabel(type, id)")).toBe(true);
    expect(labelsEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(labelsEditorSource.includes("setLabelOverride")).toBe(true);
    expect(labelsEditorSource.includes("querySelector<SVGTextElement>(`#labels")).toBe(false);
    expect(labelsEditorSource.includes('select("#debug")')).toBe(false);
    expect(labelsEditorSource.includes("getPointer")).toBe(false);
    expect(labelSpreadSource.includes('querySelector<SVGGElement>("#labels")')).toBe(false);
    expect(burgsOverviewSource.includes('select("#labels")')).toBe(false);
    expect(burgsOverviewSource.includes("updateMapInteractionOverlay")).toBe(true);
  });

  it("edits and summarizes military entities without removed SVG army nodes", () => {
    expect(regimentEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(regimentEditorSource.includes("pickPixiRenderer")).toBe(true);
    expect(regimentEditorSource.includes("moveMilitaryRegiment")).toBe(true);
    for (const source of [regimentEditorSource, regimentsOverviewSource, militaryOverviewSource]) {
      expect(source.includes("#armies")).toBe(false);
      expect(source.includes("getPointer")).toBe(false);
    }
  });

  it("keeps measurer lines overlay-owned while editing them through shared handles", () => {
    expect(measurersEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(measurersEditorSource.includes("moveMeasurerPoint")).toBe(true);
    expect(measurersEditorSource.includes("getPixiMapPointAtClient")).toBe(true);
    expect(measurersEditorSource.includes("getScreenCTM")).toBe(false);
    expect(measurersEditorSource.includes("measurerDrag")).toBe(false);
    expect(measurersEditorSource.includes('select("#ruler")')).toBe(false);
  });

  it("keeps heightmap topology in a transient workspace with shared coordinates and commands", () => {
    expect(heightmapEditorSource.includes("getPixiMapPointAtClient")).toBe(true);
    expect(heightmapEditorSource.includes("commitHeightValues")).toBe(true);
    expect(heightmapEditorSource.includes("linearFeatureStart")).toBe(true);
    expect(heightmapEditorSource.includes("getPointer")).toBe(false);
    expect(heightmapEditorSource.includes('select("#debug")')).toBe(false);
    expect(heightmapEditorSource.includes('.attr("id", "heights")')).toBe(true);
  });

  it("edits Pixi emblems through stable scene data and the shared overlay", () => {
    expect(emblemsEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(emblemsEditorSource.includes("buildEmblemScene")).toBe(true);
    expect(emblemsEditorSource.includes("moveEmblem")).toBe(true);
    expect(emblemsEditorSource.includes('select<SVGElement, unknown>("#emblems")')).toBe(false);
    expect(emblemsEditorSource.includes("dragEmblem")).toBe(false);
  });

  it("renders burgs and markers only through renderer-neutral Pixi point symbols", () => {
    expect(layersSource.includes('toggleBurgIcons: "burgIcons"')).toBe(true);
    expect(layersSource.includes('toggleMarkers: "markers"')).toBe(true);
    expect(renderersIndex.includes("draw-burg-icons")).toBe(false);
    expect(renderersIndex.includes("draw-markers")).toBe(false);
    expect(pointSymbolsSource.includes('invalidatePixiRendererLayer("burgIcons")')).toBe(true);
    expect(pointSymbolsSource.includes('invalidatePixiRendererLayer("markers")')).toBe(true);
    expect(pointSymbolSceneSource.includes("buildBurgPointSymbolScene")).toBe(true);
    expect(pointSymbolSceneSource.includes("buildMarkerPointSymbolScene")).toBe(true);
    expect(burgEditorSource.includes('select("#burgIcons")')).toBe(false);
    expect(burgEditorSource.includes('select("#anchors")')).toBe(false);
    expect(markerEditorSource.includes('select("#markers")')).toBe(false);
    expect(markerEditorSource.includes('from "d3"')).toBe(false);
    expect(markerEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(mainSource.includes('attr("id", "burgIcons")')).toBe(false);
    expect(mainSource.includes('attr("id", "anchors")')).toBe(false);
    expect(mainSource.includes('attr("id", "markers")')).toBe(false);
    expect(legacySvgImportSource.includes('"#viewbox > #icons"')).toBe(true);
    expect(controllerSource.includes("removeLegacyRendererGroups()")).toBe(true);
  });

  it("renders ice, goods, and markets only through renderer-neutral Pixi scenes", () => {
    expect(layersSource.includes('toggleIce: "ice"')).toBe(true);
    expect(layersSource.includes('toggleGoods: "goods"')).toBe(true);
    expect(layersSource.includes('toggleMarketsLayer: "markets"')).toBe(true);
    expect([drawGoodsSource, drawIceSource, drawMarketsSource].join("\n").includes('from "d3"')).toBe(false);
    expect(drawGoodsSource.includes('invalidatePixiRendererLayer("goods")')).toBe(true);
    expect(drawIceSource.includes('invalidatePixiRendererLayer("ice")')).toBe(true);
    expect(drawMarketsSource.includes('invalidatePixiRendererLayer("markets")')).toBe(true);
    expect(mainSource.includes('append("g").attr("id", "ice")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "goods")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "markets")')).toBe(false);
    for (const selector of ['"#viewbox > #ice"', '"#viewbox > #goods"', '"#viewbox > #markets"']) {
      expect(legacySvgImportSource.includes(selector)).toBe(true);
    }
    expect(iceEditorSource.includes('select<SVGGElement, unknown>("#ice")')).toBe(false);
    expect(iceEditorSource.includes("getPointer")).toBe(false);
    expect(iceEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(goodsEditorSource.includes("getPointer")).toBe(false);
    expect(marketsOverviewSource.includes("marketsTemp")).toBe(false);
    expect(marketsOverviewSource.includes('select("#markets")')).toBe(false);
    expect(marketsOverviewSource.includes("getPointer")).toBe(false);
    expect(drawMarketsSource.includes("updateMapInteractionOverlay")).toBe(true);
  });

  it("renders population and military only through renderer-neutral Pixi scenes", () => {
    expect(layersSource.includes('togglePopulation: "population"')).toBe(true);
    expect(layersSource.includes('toggleMilitary: "military"')).toBe(true);
    expect(drawMilitarySource.includes('from "d3"')).toBe(false);
    expect(drawMilitarySource.includes('invalidatePixiRendererLayer("military")')).toBe(true);
    expect(populationMilitarySceneSource.includes("buildPopulationScene")).toBe(true);
    expect(populationMilitarySceneSource.includes("buildMilitaryScene")).toBe(true);
    expect(denseOverlaysSource.includes("ViewportPopulation")).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "population")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "armies")')).toBe(false);
    expect(mainSource.includes('attr("id", "rural")')).toBe(false);
    expect(mainSource.includes('attr("id", "urban")')).toBe(false);
    for (const selector of ['"#viewbox > #population"', '"#viewbox > #armies"']) {
      expect(legacySvgImportSource.includes(selector)).toBe(true);
    }
    expect(exportSource.includes("#armies image")).toBe(false);
  });

  it("renders labels through renderer-neutral scenes after deterministic font readiness", () => {
    expect(layersSource.includes('measure("labels", window.drawLabels)')).toBe(true);
    expect(labelsRendererSource.includes('invalidatePixiRendererLayer("labels")')).toBe(true);
    expect(labelsRendererSource.includes("createLabelElements")).toBe(false);
    expect(labelSceneSource.includes("buildLabelScene")).toBe(true);
    expect(legacySvgImportSource.includes('"#viewbox > #labels"')).toBe(true);
  });

  it("renders coordinates through camera-neutral scene data without live SVG graticules", () => {
    expect(layersSource.includes('toggleCoordinates: "coordinates"')).toBe(true);
    expect(layersSource.includes("geoGraticule")).toBe(false);
    expect(layersSource.includes("DOMPoint")).toBe(false);
    expect(coordinateSceneSource.includes("buildCoordinateScene")).toBe(true);
    expect(coordinateSceneSource.includes("document.")).toBe(false);
    expect(legacySvgImportSource.includes('"#viewbox > #coordinates"')).toBe(true);
  });

  it("renders emblems through cached Pixi textures without a live SVG emblem layer", () => {
    expect(layersSource.includes('toggleEmblems: "emblems"')).toBe(true);
    expect(drawEmblemsSource.includes('invalidatePixiRendererLayer("emblems")')).toBe(true);
    expect(drawEmblemsSource.includes('from "d3"')).toBe(false);
    expect(emblemSceneSource.includes("buildEmblemScene")).toBe(true);
    expect(emblemSceneSource.includes("document.")).toBe(false);
    expect(emblemSceneSource.includes("pixi.js")).toBe(false);
    expect(zoomSource.includes("renderGroupCOAs")).toBe(false);
    expect(legacySvgImportSource.includes('"#viewbox > #emblems"')).toBe(true);
    expect(loadSource.includes('turnOnPixiLayer(\n        "emblems"')).toBe(true);
  });

  it("renders compass and trade through Pixi without live SVG transitions", () => {
    expect(layersSource.includes('toggleCompass: "compass"')).toBe(true);
    expect(layersSource.includes('toggleTrade: "trade"')).toBe(true);
    expect(staticOverlaySceneSource.includes("buildCompassScene")).toBe(true);
    expect(drawTradeSource.includes("requestAnimationFrame")).toBe(true);
    expect(drawTradeSource.includes('from "d3"')).toBe(false);
    expect(drawTradeSource.includes("document.createElementNS")).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "compass")')).toBe(false);
    expect(mainSource.includes('append("g").attr("id", "tradeAnimation")')).toBe(false);
    expect(legacySvgImportSource.includes('"#viewbox > #compass"')).toBe(true);
    expect(compassEditorSource.includes("MAP_INTERACTION_HANDLE_EVENT")).toBe(true);
    expect(compassEditorSource.includes("updateCompassStyle")).toBe(true);
    expect(compassEditorSource.includes("#compass")).toBe(false);
    expect(legacySvgImportSource.includes('"#viewbox > #tradeAnimation"')).toBe(true);
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
    expect(exportSource.includes("renderPixiRasterFrame")).toBe(true);
    expect(exportSource.includes("createRasterExportPlan")).toBe(true);
    expect(exportSource.includes("getPixiRasterCapabilities")).toBe(true);
    expect(exportSource.includes("cancelPngTilesExport")).toBe(true);
    expect(exportSource.includes("renderFullMapRaster")).toBe(true);
    expect(transformToolSource.includes("renderFullMapRaster")).toBe(true);
    expect(transformToolSource.includes("getMapURL")).toBe(false);
    expect(view3dSource.includes("renderFullMapRaster")).toBe(true);
    expect(view3dSource.includes("ExportMap.getMapURL")).toBe(false);
    expect(indexSource.includes("ExportMap.exportToSvg")).toBe(false);
    expect(exportSource.includes("SVG export is unavailable with the Pixi renderer")).toBe(true);
  });

  it("uses renderer picking and a transient accessible overlay for map inspection and brushes", () => {
    expect(mapTooltipSource.includes("pickPixiRenderer")).toBe(true);
    expect(mapTooltipSource.includes("getPixiMapPointAtClient")).toBe(true);
    expect(mapTooltipSource.includes("event.target")).toBe(false);
    expect(mapTooltipSource.includes("getPointer")).toBe(false);
    expect(mapTooltipSource.includes("getComposedPath")).toBe(false);
    expect(interactionOverlaySource.includes("setPointerCapture")).toBe(true);
    expect(interactionOverlaySource.includes('setAttribute("tabindex"')).toBe(true);
    expect(interactionOverlaySource.includes("screenToWorld")).toBe(true);
    expect(brushCircleSource.includes("#debug")).toBe(false);
    expect(saveSource.includes('querySelector("#mapInteractionOverlay")?.remove()')).toBe(true);
    expect(saveSource.includes('querySelector("#mapInteractionSurface")?.remove()')).toBe(true);
    expect(exportSource.includes('select("#mapInteractionOverlay").remove()')).toBe(true);
    expect(exportSource.includes('select("#mapInteractionSurface").remove()')).toBe(true);
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
