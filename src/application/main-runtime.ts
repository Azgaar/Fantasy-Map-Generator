// Azgaar and contributors, 2017-2026. MIT License
// https://github.com/Azgaar/Fantasy-Map-Generator

import {
  interpolateSpectral,
  leastIndex,
  max,
  mean,
  median,
  min,
  polygonArea,
  range,
  scaleSequential,
  select
} from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { LayerControls } from "@/components/layers/layer-controls";
import { OptionsController, type RegenerateOptions } from "@/components/options/options-controller";
import { StylePresets } from "@/components/style/style-presets-controller";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { getCultureGenerationSettings } from "@/controllers/culture-generation-settings";
import { getStateExpansionSettings } from "@/controllers/state-generation-settings";
import type { Burg } from "@/generators/burgs-generator";
import { bindWorldGenerationController } from "@/generators/world-generation-controller";
import { clearLegend } from "@/renderers/draw-legend";
import { drawScaleBar } from "@/renderers/draw-scalebar";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import { unfog } from "@/renderers/overlays/fogging";
import { tradeAnimation } from "@/renderers/trade-animation";
import { initiateAutosave } from "@/services/autosave";
import { cleanupData } from "@/services/versioning";
import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";
import {
  calculateVoronoi,
  createTypedArray,
  debounce,
  ensureEl,
  findEl,
  gauss,
  generateSeed,
  getPackPolygon,
  minmax,
  normalize,
  P,
  parseError,
  rand,
  rn,
  shouldRegenerateGrid,
  TYPED_ARRAY_MAX
} from "@/utils";
import { stored } from "@/utils/preferences";
import { bindApplicationController } from "./application-controller";
import { initializeApplicationState } from "./application-state";
import { getViewportSurface, initializeViewportSurface } from "./viewport-surface";
import { endViewSession, startViewSession } from "./view-session-state";
import {
  getWorkspaceMode,
  initializeWorkspaceMode,
  registerWorkspaceModeTransitionHandler
} from "./workspace-mode";

// set debug options
const PRODUCTION = Boolean(location.hostname && location.hostname !== "localhost" && location.hostname !== "127.0.0.1");
const DEBUG = JSON.safeParse(localStorage.getItem("debug") || "") || {};
const INFO = true;
const TIME = true;
const WARN = true;
const ERROR = true;

// detect device
const MOBILE =
  window.innerWidth < 600 ||
  Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);

if (PRODUCTION && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err => {
      console.error("ServiceWorker registration failed: ", err);
    });
  });
}

// Initialize only the intentional SVG viewport/editor overlays. Persistent map content is Pixi-owned.
const initialViewport = initializeViewportSurface();

// assign events separately as not a viewbox child
initialViewport.scaleBar
  .on("mousemove", () => tip("Click to open Units Editor"))
  .on("click", () => window.Controllers.UnitsEditor.open());
initialViewport.legend
  .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
  .on("click", () => clearLegend());

const mapWidthInput = ensureEl<HTMLInputElement>("mapWidthInput");
const mapHeightInput = ensureEl<HTMLInputElement>("mapHeightInput");
const initialGraphWidth = +mapWidthInput.value;
const initialGraphHeight = +mapHeightInput.value;
const era = ensureEl<HTMLInputElement>("eraInput").value;

const app = initializeApplicationState({
  DEBUG,
  ERROR,
  INFO,
  MOBILE,
  TIME,
  WARN,
  color: scaleSequential(interpolateSpectral),
  customization: 0,
  distanceScale: +ensureEl<HTMLInputElement>("distanceScaleInput").value,
  graphHeight: initialGraphHeight,
  graphWidth: initialGraphWidth,
  mapCoordinates: { latT: 0, latN: 0, latS: 0, lonT: 0, lonW: 0, lonE: 0 },
  mapHistory: [],
  modules: {},
  notes: [],
  options: {
    year: +ensureEl<HTMLInputElement>("yearInput").value,
    era,
    eraShort: era
      .split(" ")
      .map(word => word[0])
      .join(""),
    pinNotes: false,
    winds: [225, 45, 225, 315, 135, 315],
    temperatureEquator: 27,
    temperatureNorthPole: -30,
    temperatureSouthPole: -15,
    mapSize: 100, // map size in % of the world
    latitude: 50, // North-South map shift in %, 50 is centered on equator
    longitude: 50, // West-East map shift in %, 50 is centered on prime meridian
    prec: 100, // precipitation modifier in %
    showBurgPreview: true,
    burgs: {
      groups: JSON.safeParse(localStorage.getItem("burg-groups") || "") || Burgs.getDefaultGroups()
    },
    labels: JSON.safeParse(localStorage.getItem("options-labels") || "") || Labels.getDefaultOptions(),
    military: Military.getDefaultOptions(),
    trade: {
      animation: JSON.safeParse(localStorage.getItem("trade-animation") || "") || tradeAnimation.getDefaultOptions()
    }
  },
  populationRate: +ensureEl<HTMLInputElement>("populationRateInput").value,
  scale: 1,
  style: {
    labels: { groups: {} },
    relief: { set: "simple", size: 1, density: 0.4 }
  },
  svgHeight: initialGraphHeight,
  svgWidth: initialGraphWidth,
  urbanDensity: +ensureEl<HTMLInputElement>("urbanDensityInput").value,
  urbanization: +ensureEl<HTMLInputElement>("urbanizationInput").value,
  viewX: 0,
  viewY: 0
});

initializeWorkspaceMode({ onCapabilityDenied: message => tip(message, false, "error") });
registerWorkspaceModeTransitionHandler(nextMode => {
  if (nextMode === "view") {
    if (app.customization) {
      tip("Finish or cancel the active editing workflow before entering View mode", false, "error");
      return false;
    }
    startViewSession(new Map(LayerControls.getSnapshot().layers.map(layer => [layer.id, layer.visible])));
    return true;
  }

  endViewSession((layerId, visible) => LayerControls.setLayerVisibility(layerId, visible));
  return true;
});
window.addEventListener("map:loaded", () => {
  if (getWorkspaceMode() === "view") {
    startViewSession(new Map(LayerControls.getSnapshot().layers.map(layer => [layer.id, layer.visible])));
  }
});

OptionsController.applyStoredOptions();
app.graphWidth = +mapWidthInput.value;
app.graphHeight = +mapHeightInput.value;
app.svgWidth = app.graphWidth;
app.svgHeight = app.graphHeight;

document.addEventListener("DOMContentLoaded", async () => {
  // binds the zoom behaviour and its handlers (see src/components/viewbox-events.ts), so it has to
  // run before checkLoadParameters - deep links (MFCG, a stored view position) zoom the map on load
  applyDefaultViewboxEvents();

  if (!location.hostname) {
    const wiki = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally";
    const messageHtml = /* html */ `Fantasy Map Generator cannot run serverless. Follow the <a href="${wiki}" target="_blank">instructions</a> on how you can easily run a local web-server`;

    window.showMessageDialog({
      id: "serverlessLoadingErrorDialog",
      messageHtml,
      title: "Loading error",
      width: "28em"
    });
  } else {
    hideLoading();
    await checkLoadParameters();
  }
  initiateAutosave();
});

function hideLoading() {
  select("#loading").transition().duration(3000).style("opacity", 0);
  select("#optionsContainer").transition().duration(2000).style("opacity", 1);
  select("#tooltip").transition().duration(3000).style("opacity", 1);
}

function showLoading() {
  select("#loading").transition().duration(200).style("opacity", 1);
  select("#optionsContainer").transition().duration(100).style("opacity", 0);
  select("#tooltip").transition().duration(200).style("opacity", 0);
}

// decide which map should be loaded or generated on page load
async function checkLoadParameters() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  // of there is a valid maplink, try to load .map/.gz file from URL
  if (params.get("maplink")) {
    WARN && console.warn("Load map from URL");
    const maplink = params.get("maplink")!;
    const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;
    const valid = pattern.test(maplink);
    if (valid) {
      setTimeout(() => {
        window.Services.Load.loadMapFromURL(maplink, true);
      }, 1000);
      return;
    } else window.Services.Load.showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // if there is a seed (user of MFCG provided), generate map for it
  if (params.get("seed")) {
    WARN && console.warn("Generate map for seed");
    await generateMapOnLoad();
    return;
  }

  // check if there is a map saved to indexedDB
  if (ensureEl<HTMLSelectElement>("onloadBehavior").value === "lastSaved") {
    try {
      const blob = await ldb.get("lastMap");
      if (blob) {
        WARN && console.warn("Loading last stored map");
        window.Services.Load.uploadMap(blob);
        return;
      }
    } catch (error) {
      ERROR && console.error(error);
    }
  }

  // else generate random map
  WARN && console.warn("Generate random map");
  generateMapOnLoad();
}

async function generateMapOnLoad() {
  await StylePresets.applyOnLoad(); // apply previously selected default or custom style
  await generate(); // generate map
  LayerControls.restoreSavedPreset(); // apply saved layers preset and render layers
  LayerControls.drawActiveLayers();
  OptionsController.fitMapToScreen();
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
}

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const fromMGCG = params.get("from") === "MFCG" && document.referrer;
  if (fromMGCG) {
    if (params.get("seed")?.length === 13) {
      // show back burg from MFCG
      const burgSeed = params.get("seed")!.slice(-4);
      params.set("burg", burgSeed);
    } else {
      // select burg for MFCG
      findBurgForMFCG(params);
      return;
    }
  }

  const scaleParam = params.get("scale");
  const cellParam = params.get("cell");
  const burgParam = params.get("burg");

  if (scaleParam || cellParam || burgParam) {
    const scale = Number(scaleParam) || 8;

    if (cellParam) {
      const cell = Number(params.get("cell"));
      const [x, y] = app.pack.cells.p[cell];
      zoomTo(x, y, scale, 1600);
      return;
    }

    if (burgParam) {
      const burg = Number.isNaN(+burgParam)
        ? app.pack.burgs.find(burg => burg.name === burgParam)
        : app.pack.burgs[+burgParam];
      if (!burg) return;

      const { x, y } = burg;
      zoomTo(x, y, scale, 1600);
      return;
    }

    const x = Number(params.get("x")) || app.graphWidth / 2;
    const y = Number(params.get("y")) || app.graphHeight / 2;
    zoomTo(x, y, scale, 1600);
  }
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params: URLSearchParams): void {
  const cells = app.pack.cells,
    burgs = app.pack.burgs;
  if (app.pack.burgs.length < 2) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  // used for selection
  const size = Number(params.get("size"));
  const coast = Number(params.get("coast"));
  const port = Number(params.get("port"));
  const river = Number(params.get("river"));

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, 0, !river);
  if (!selection.length) selection = [burgs[1]]; // select first if nothing is found

  function defineSelection(coast: number | boolean, port: number | boolean, river: number | boolean): Burg[] {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  }

  // select a burg with closest population from selection
  const selected = leastIndex(
    selection,
    (a, b) => Math.abs((a.population ?? 0) - size) - Math.abs((b.population ?? 0) - size)
  );
  const burgId = selected === undefined ? 0 : selection[selected].i;
  if (!burgId) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  const b = burgs[burgId];
  const referrer = new URL(document.referrer);
  const mutableBurg = b as unknown as Record<string, unknown>;
  for (const p of referrer.searchParams) {
    if (p[0] === "name") b.name = p[1];
    else if (p[0] === "size") b.population = +p[1];
    else if (p[0] === "seed") mutableBurg.MFCG = +p[1];
    else if (p[0] === "shantytown") b.shanty = +p[1];
    else mutableBurg[p[0]] = +p[1]; // other parameters
  }
  const requestedName = params.get("name");
  if (requestedName && requestedName !== "null") b.name = requestedName;

  if (LayerControls.isLayerOn("toggleLabels")) drawLabels();

  zoomTo(b.x, b.y, 8, 1600);
  tip(`Here stands the glorious city of ${b.name}`, true, "success", 15000);
}

// add drag to upload logic, pull request from @evyatron
void (function addDragToUpload() {
  document.addEventListener("dragover", e => {
    e.stopPropagation();
    e.preventDefault();
    ensureEl("mapOverlay").style.display = "";
  });

  document.addEventListener("dragleave", () => {
    ensureEl("mapOverlay").style.display = "none";
  });

  document.addEventListener("drop", e => {
    e.stopPropagation();
    e.preventDefault();

    const overlay = ensureEl("mapOverlay");
    overlay.style.display = "none";
    const items = e.dataTransfer?.items;
    if (!items || items.length !== 1) return; // no files or more than one
    const file = items[0].getAsFile();
    if (!file) return;

    if (!file.name.endsWith(".map") && !file.name.endsWith(".gz")) {
      window.showMessageDialog({
        id: "invalidMapFileDialog",
        messageHtml: "Please upload a map file (<i>.map</i> or <i>.gz</i> formats) you have previously downloaded",
        title: "Invalid file format"
      });
      return;
    }

    // all good - show uploading text and load the map
    overlay.style.display = "";
    overlay.innerHTML = "Uploading<span>.</span><span>.</span><span>.</span>";
    if (closeDialogs) closeDialogs();
    window.Services.Load.uploadMap(file, () => {
      overlay.style.display = "none";
      overlay.innerHTML = "Drop a map file to open";
    });
  });
})();

async function generate(config?: string | RegenerateOptions) {
  let generationGroupOpen = false;

  try {
    const timeStart = performance.now();
    window.MapPerformance?.reset();
    const measureStep = <T>(name: string, action: () => T): T =>
      window.MapPerformance ? window.MapPerformance.measure(name, action) : action();
    const generationOptions = typeof config === "object" ? config : undefined;
    const { seed: precreatedSeed, graph: precreatedGraph } = generationOptions || {};

    setSeed(precreatedSeed);
    if (INFO) {
      console.group(`Generated Map ${app.seed}`);
      generationGroupOpen = true;
    }

    await measureStep("generation:grid", async () => {
      OptionsController.applyGraphSize();
      OptionsController.randomize();
      if (shouldRegenerateGrid(app.grid, precreatedSeed, app.graphWidth, app.graphHeight)) {
        app.grid =
          (precreatedGraph as Grid | undefined) ||
          ((await measureStep("generation:grid:voronoi", () =>
            window.GridGeneration.generate({
              seed: app.seed,
              graphWidth: app.graphWidth,
              graphHeight: app.graphHeight,
              cellsDesired: Number(pointsInput.dataset.cells)
            })
          )) as Grid);
      } else delete (app.grid.cells as Partial<Grid["cells"]>).h;
      app.grid.cells.h = await measureStep("generation:grid:heightmap", () => HeightmapGenerator.generate(app.grid));
      app.pack = {} as PackedGraph;
    });
    await yieldGeneration("grid");

    measureStep("generation:climate", () => {
      measureStep("generation:features:grid", () => Features.markupGrid());
      measureStep("generation:lakes:grid", () => {
        addLakesInDeepDepressions();
        openNearSeaLakes();
      });
      measureStep("generation:ocean-layers", () => OceanLayers());
      defineMapSize();
      calculateMapCoordinates();
      measureStep("generation:temperature", () => calculateTemperatures());
      measureStep("generation:precipitation", () => generatePrecipitation());
    });
    await yieldGeneration("climate");

    measureStep("generation:repack", () => {
      measureStep("generation:graph:repack", () => reGraph());
      measureStep("generation:features:pack", () => Features.markupPack());
      Measurers.createDefaultRuler();
      measureStep("generation:rivers", () => Rivers.generate());
      measureStep("generation:biomes", () => Biomes.generate());
      Features.defineGroups();
      measureStep("generation:ice", () => Ice.generate());
      measureStep("generation:goods", () => Goods.generate());
    });
    await yieldGeneration("repack");

    measureStep("generation:settlements", () => {
      rankCells();
      measureStep("generation:cultures", () => {
        Cultures.generate();
        Cultures.expand(getCultureGenerationSettings());
      });
      measureStep("generation:burgs", () => Burgs.generate());
      measureStep("generation:states", () => States.generate(getStateExpansionSettings()));
      measureStep("generation:routes", () => Routes.generate());
      measureStep("generation:religions", () => Religions.generate());
      Burgs.specify();
      States.collectStatistics();
      States.defineStateForms();
      measureStep("generation:provinces", () => Provinces.generate());
      Provinces.getPoles();
      Rivers.specify();
      Lakes.defineNames();
    });
    await yieldGeneration("settlements");

    measureStep("generation:economy-and-overlays", () => {
      measureStep("generation:markets", () => Markets.generate());
      measureStep("generation:production", () => Production.produce());
      measureStep("generation:taxes", () => States.collectTaxes());
      measureStep("generation:military", () => Military.generate());
      measureStep("generation:markers", () => Markers.generate());
      measureStep("generation:zones", () => Zones.generate());
      measureStep("generation:labels", () => AddedLabels.initiate());
    });

    drawScaleBar(getViewportSurface().scaleBar, app.scale);
    Names.getMapName(false);

    const duration = performance.now() - timeStart;
    window.MapPerformance?.record("generation:total", duration);
    WARN && console.warn(`TOTAL: ${rn(duration / 1000, 2)}s`);
    showStatistics();
  } catch (error) {
    ERROR && console.error(error);
    const parsedError = parseError(error as Error);
    clearMainTip();

    const messageHtml = /* html */ `An error has occurred on map generation. Please retry. <br />If error is critical, clear the stored data and try again.
      <p id="errorBox">${parsedError}</p>`;
    window.showMessageDialog({
      actions: [
        { close: false, label: "Cleanup data", onClick: cleanupData },
        { label: "Regenerate", onClick: () => regenerateMap("generation error") },
        { label: "Ignore" }
      ],
      id: "generationErrorDialog",
      messageHtml,
      title: "Generation error",
      width: "32em"
    });
  } finally {
    if (generationGroupOpen) console.groupEnd();
  }
}

async function yieldGeneration(stage: string): Promise<void> {
  window.dispatchEvent(new CustomEvent("map:generation-progress", { detail: { stage } }));
  const browserScheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } })
    .scheduler;
  if (browserScheduler?.yield) return browserScheduler.yield();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

// set map seed (string!)
function setSeed(precreatedSeed?: string): void {
  if (!precreatedSeed) {
    const first = !app.mapHistory[0];
    const params = new URL(window.location.href).searchParams;
    const urlSeed = params.get("seed");
    if (first && params.get("from") === "MFCG" && urlSeed?.length === 13) app.seed = urlSeed.slice(0, -4);
    else if (first && urlSeed) app.seed = urlSeed;
    else app.seed = generateSeed();
  } else {
    app.seed = precreatedSeed;
  }

  ensureEl<HTMLInputElement>("optionsSeed").value = app.seed;
  Math.random = aleaPRNG(app.seed);
}

function addLakesInDeepDepressions() {
  TIME && console.time("addLakesInDeepDepressions");
  const elevationLimit = +ensureEl<HTMLOutputElement>("lakeElevationLimitOutput").value;
  if (elevationLimit === 80) return;

  const { cells, features } = app.grid;
  const { c, h, b } = cells;

  for (const i of cells.i) {
    if (b[i] || h[i] < 20) continue;

    const minHeight = min(c[i].map(c => h[c])) ?? h[i];
    if (h[i] > minHeight) continue;

    let deep = true;
    const threshold = h[i] + elevationLimit;
    const queue = [i];
    const checked = [];
    checked[i] = true;

    // check if elevated cell can potentially pour to water
    while (deep && queue.length) {
      const q = queue.pop();
      if (q === undefined) break;

      for (const n of c[q]) {
        if (checked[n]) continue;
        if (h[n] >= threshold) continue;
        if (h[n] < 20) {
          deep = false;
          break;
        }

        checked[n] = true;
        queue.push(n);
      }
    }

    // if not, add a lake
    if (deep) {
      const lakeCells = [i].concat(c[i].filter(n => h[n] === h[i]));
      addLake(lakeCells);
    }
  }

  function addLake(lakeCells: number[]): void {
    const f = features.length;

    lakeCells.forEach(i => {
      cells.h[i] = 19;
      cells.t[i] = -1;
      cells.f[i] = f;
      c[i].forEach(n => {
        if (!lakeCells.includes(n)) cells.t[n] = 1;
      });
    });

    features.push({ i: f, land: false, border: false, type: "lake" });
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
}

// near sea lakes usually get a lot of water inflow, most of them should break threshold and flow out to sea (see Ancylus Lake)
function openNearSeaLakes() {
  if (ensureEl<HTMLInputElement>("templateInput").value === "Atoll") return; // no need for Atolls

  const cells = app.grid.cells;
  const features = app.grid.features;
  if (!features.find(f => f.type === "lake")) return; // no lakes
  TIME && console.time("openLakes");
  const LIMIT = 22; // max height that can be breached by water
  const lakeCells = new Map<number, number[]>();
  for (const cellId of cells.i) {
    const featureId = cells.f[cellId];
    if (features[featureId].type !== "lake") continue;
    const indexed = lakeCells.get(featureId);
    if (indexed) indexed.push(cellId);
    else lakeCells.set(featureId, [cellId]);
  }

  for (const i of cells.i) {
    const lakeFeatureId = cells.f[i];
    if (features[lakeFeatureId].type !== "lake") continue; // not a lake

    check_neighbours: for (const c of cells.c[i]) {
      if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue; // water cannot break this

      for (const n of cells.c[c]) {
        const ocean = cells.f[n];
        if (features[ocean].type !== "ocean") continue; // not an ocean
        removeLake(c, lakeFeatureId, ocean);
        break check_neighbours;
      }
    }
  }

  function removeLake(thresholdCellId: number, lakeFeatureId: number, oceanFeatureId: number): void {
    cells.h[thresholdCellId] = 19;
    cells.t[thresholdCellId] = -1;
    cells.f[thresholdCellId] = oceanFeatureId;
    cells.c[thresholdCellId].forEach(c => {
      if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
    });

    for (const cellId of lakeCells.get(lakeFeatureId) ?? []) cells.f[cellId] = oceanFeatureId;
    features[lakeFeatureId].type = "ocean"; // mark former lake as ocean
  }

  TIME && console.timeEnd("openLakes");
}

// define map size and position based on template and random factor
function defineMapSize() {
  const [size, latitude, longitude] = getSizeAndLatitude();
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options
  if (randomize || !stored("mapSize")) app.options.mapSize = size;
  if (randomize || !stored("latitude")) app.options.latitude = latitude;
  if (randomize || !stored("longitude")) app.options.longitude = longitude;

  function getSizeAndLatitude() {
    const template = ensureEl<HTMLInputElement>("templateInput").value; // heightmap template

    if (template === "africa-centric") return [45, 53, 38];
    if (template === "arabia") return [20, 35, 35];
    if (template === "atlantics") return [42, 23, 65];
    if (template === "britain") return [7, 20, 51.3];
    if (template === "caribbean") return [15, 40, 74.8];
    if (template === "east-asia") return [11, 28, 9.4];
    if (template === "eurasia") return [38, 19, 27];
    if (template === "europe") return [20, 16, 44.8];
    if (template === "europe-accented") return [14, 22, 44.8];
    if (template === "europe-and-central-asia") return [25, 10, 39.5];
    if (template === "europe-central") return [11, 22, 46.4];
    if (template === "europe-north") return [7, 18, 48.9];
    if (template === "greenland") return [22, 7, 55.8];
    if (template === "hellenica") return [8, 27, 43.5];
    if (template === "iceland") return [2, 15, 55.3];
    if (template === "indian-ocean") return [45, 55, 14];
    if (template === "mediterranean-sea") return [10, 29, 45.8];
    if (template === "middle-east") return [8, 31, 34.4];
    if (template === "north-america") return [37, 17, 87];
    if (template === "us-centric") return [66, 27, 100];
    if (template === "us-mainland") return [16, 30, 77.5];
    if (template === "world") return [78, 27, 40];
    if (template === "world-from-pacific") return [75, 32, 30]; // longitude doesn't fit

    const part = app.grid.features.some(f => f.land && f.border); // if land goes over map borders
    const max = part ? 80 : 100; // max size
    const lat = () => gauss(P(0.5) ? 40 : 60, 20, 25, 75); // latitude shift

    if (!part) {
      if (template === "pangea") return [100, 50, 50];
      if (template === "shattered" && P(0.7)) return [100, 50, 50];
      if (template === "continents" && P(0.5)) return [100, 50, 50];
      if (template === "archipelago" && P(0.35)) return [100, 50, 50];
      if (template === "highIsland" && P(0.25)) return [100, 50, 50];
      if (template === "lowIsland" && P(0.1)) return [100, 50, 50];
    }

    if (template === "pangea") return [gauss(70, 20, 30, max), lat(), 50];
    if (template === "volcano") return [gauss(20, 20, 10, max), lat(), 50];
    if (template === "mediterranean") return [gauss(25, 30, 15, 80), lat(), 50];
    if (template === "peninsula") return [gauss(15, 15, 5, 80), lat(), 50];
    if (template === "isthmus") return [gauss(15, 20, 3, 80), lat(), 50];
    if (template === "atoll") return [gauss(3, 2, 1, 5, 1), lat(), 50];
    if (template === "loneIsland") return [gauss(5, 2, 2, 10, 1), lat(), 50];

    return [gauss(30, 20, 15, max), lat(), 50]; // Continents, Archipelago, High Island, Low Island
  }
}

// calculate map position on globe
function calculateMapCoordinates() {
  const sizeFraction = app.options.mapSize / 100;
  const latShift = app.options.latitude / 100;
  const lonShift = app.options.longitude / 100;

  const latT = rn(sizeFraction * 180, 1);
  const latN = rn(90 - (180 - latT) * latShift, 1);
  const latS = rn(latN - latT, 1);

  const lonT = rn(Math.min((app.graphWidth / app.graphHeight) * latT, 360), 1);
  const lonE = rn(180 - (360 - lonT) * lonShift, 1);
  const lonW = rn(lonE - lonT, 1);
  app.mapCoordinates = { latT, latN, latS, lonT, lonW, lonE };
}

// temperature model, trying to follow real-world data
// based on http://www-das.uwyo.edu/~geerts/cwx/app.notes/chap16/Image64.gif
function calculateTemperatures() {
  TIME && console.time("calculateTemperatures");
  const cells = app.grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array

  const { temperatureEquator, temperatureNorthPole, temperatureSouthPole } = app.options;
  const tropics = [16, -20]; // tropics zone
  const tropicalGradient = 0.15;

  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = +heightExponentInput.value;

  for (let rowCellId = 0; rowCellId < cells.i.length; rowCellId += app.grid.cellsX) {
    const [, y] = app.grid.points[rowCellId];
    const rowLatitude = app.mapCoordinates.latN - (y / app.graphHeight) * app.mapCoordinates.latT; // [90; -90]
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);
    DEBUG.temperature && console.info(`${rn(rowLatitude)}° sea temperature: ${rn(tempSeaLevel)}°C`);

    for (let cellId = rowCellId; cellId < rowCellId + app.grid.cellsX; cellId++) {
      const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h[cellId]);
      cells.temp[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  function calculateSeaLevelTemp(latitude: number): number {
    const isTropical = latitude <= 16 && latitude >= -20;
    if (isTropical) return temperatureEquator - Math.abs(latitude) * tropicalGradient;

    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  // temperature drops by 6.5°C per 1km of altitude
  function getAltitudeTemperatureDrop(h: number): number {
    if (h < 20) return 0;
    const height = (h - 18) ** exponent;
    return rn((height / 1000) * 6.5);
  }

  TIME && console.timeEnd("calculateTemperatures");
}

// simplest precipitation model
function generatePrecipitation() {
  TIME && console.time("generatePrecipitation");
  const { cells, cellsX, cellsY } = app.grid;
  cells.prec = new Uint8Array(cells.i.length); // precipitation array

  const cellsNumberModifier = (Number(pointsInput.dataset.cells) / 10000) ** 0.25;
  const precInputModifier = app.options.prec / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  type WindBand = [firstCell: number, precipitationModifier: number, tier: number];
  const westerly: WindBand[] = [];
  const easterly: WindBand[] = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  // x4 = 0-5 latitude: wet through the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-85 latitude: dry all year (sinking zone)
  // x0.5 = 85-90 latitude: dry all year (sinking zone)
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  range(0, cells.i.length, cellsX).forEach((c, i) => {
    const lat = app.mapCoordinates.latN - (i / cellsY) * app.mapCoordinates.latT;
    const latBand = ((Math.abs(lat) - 1) / 5) | 0;
    const latMod = latitudeModifier[latBand] ?? 1;
    const windTier = (Math.abs(lat - 89) / 30) | 0; // 30d tiers from 0 to 5 from N to S
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = ((Math.abs(app.mapCoordinates.latN) - 1) / 5) | 0;
    const latModN = (app.mapCoordinates.latT > 60 ? mean(latitudeModifier) : latitudeModifier[bandN]) ?? 1;
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    passWind(range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = ((Math.abs(app.mapCoordinates.latS) - 1) / 5) | 0;
    const latModS = (app.mapCoordinates.latT > 60 ? mean(latitudeModifier) : latitudeModifier[bandS]) ?? 1;
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    passWind(range(cells.i.length - cellsX, cells.i.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier: number) {
    const angle = app.options.winds[tier] ?? 0;

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return { isWest, isEast, isNorth, isSouth };
  }

  function passWind(source: readonly (number | WindBand)[], maxPrec: number, next: number, steps: number): void {
    const maxPrecInit = maxPrec;

    for (const sourceEntry of source) {
      const first = typeof sourceEntry === "number" ? sourceEntry : sourceEntry[0];
      if (typeof sourceEntry !== "number") maxPrec = Math.min(maxPrecInit * sourceEntry[1], 255);

      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (cells.temp[current] < -5) continue; // no flux in permafrost

        if (cells.h[current] < 20) {
          // water cell
          if (cells.h[current + next] >= 20) {
            cells.prec[current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            cells.prec[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const isPassable = cells.h[current + next] <= MAX_PASSABLE_ELEVATION;
        const precipitation = isPassable ? getPrecipitation(humidity, current, next) : humidity;
        cells.prec[current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable ? minmax(humidity - precipitation + evaporation, 0, maxPrec) : 0;
      }
    }
  }

  function getPrecipitation(humidity: number, i: number, n: number): number {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i + n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  TIME && console.timeEnd("generatePrecipitation");
}

// recalculate Voronoi Graph to pack cells
function reGraph() {
  TIME && console.time("reGraph");
  const { cells: gridCells, points, features } = app.grid;
  const newCells: { p: [number, number][]; g: number[]; h: number[] } = { p: [], g: [], h: [] };
  const spacing2 = app.grid.spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h[i];
    const type = gridCells.t[i];

    if (height < 20 && type !== -1 && type !== -2) continue; // exclude all deep ocean points
    if (type === -2 && (i % 4 === 0 || features[gridCells.f[i]].type === "lake")) continue; // exclude non-coastal lake points

    const [x, y] = points[i];
    addNewPoint(i, x, y, height);

    // add additional points for cells along coast
    if (type === 1 || type === -1) {
      if (gridCells.b[i]) continue; // not for near-border cells
      gridCells.c[i].forEach(e => {
        if (i > e) return;
        if (gridCells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i: number, x: number, y: number, height: number): void {
    newCells.p.push([x, y]);
    newCells.g.push(i);
    newCells.h.push(height);
  }

  const { cells: packCells, vertices } = calculateVoronoi(newCells.p, app.grid.boundary);
  app.pack.vertices = vertices as unknown as PackedGraph["vertices"];
  app.pack.cells = packCells as unknown as PackedGraph["cells"];
  app.pack.cells.p = newCells.p;
  app.pack.cells.g = createTypedArray({
    maxValue: app.grid.points.length,
    length: newCells.g.length,
    from: newCells.g
  });
  app.pack.cells.h = createTypedArray({ maxValue: 100, length: newCells.h.length, from: newCells.h });
  app.pack.cells.area = createTypedArray({ maxValue: TYPED_ARRAY_MAX.UINT16, length: packCells.i.length }).map(
    (_, cellId) => {
      const area = Math.abs(polygonArea(getPackPolygon(cellId, app.pack)));
      return Math.min(area, TYPED_ARRAY_MAX.UINT16);
    }
  );

  TIME && console.timeEnd("reGraph");
}

// assess cells suitability to calculate population and rand cells for culture center and burgs placement
function rankCells() {
  TIME && console.time("rankCells");
  const { cells, features } = app.pack;
  cells.s = new Int16Array(cells.i.length); // cell suitability array
  cells.pop = new Float32Array(cells.i.length); // cell population array

  const meanFlux = median(cells.fl.filter(f => f)) || 0;
  const maxFlux = (max(cells.fl) ?? 0) + (max(cells.conf) ?? 0); // to normalize flux
  const meanArea = mean(cells.area) ?? 1; // to adjust population by cell area
  const getResValue = (i: number): number => (cells.good?.[i] ? (Goods.get(cells.good[i])?.value ?? 0) : 0);

  const scoreMap: Record<string, number> = {
    estuary: 15,
    ocean_coast: 5,
    save_harbor: 20,
    freshwater: 30,
    salt: 10,
    frozen: 1,
    dry: -5,
    sinkhole: -5,
    lava: -30
  };

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue; // no population in water
    let score = app.pack.biomes[cells.biome[i]].habitability; // base suitability derived from biome habitability
    if (!score) continue; // uninhabitable biomes has 0 suitability

    if (meanFlux) score += normalize(cells.fl[i] + cells.conf[i], meanFlux, maxFlux) * 250; // big rivers and confluences are valued
    score -= (cells.h[i] - 50) / 5; // low elevation is valued, high is not;

    if (cells.t[i] === 1) {
      if (cells.r[i]) score += scoreMap.estuary;
      const feature = features[cells.f[cells.haven[i]]];
      if (feature.type === "lake") {
        score += scoreMap[feature.group] ?? 0;
      } else {
        score += scoreMap.ocean_coast;
        if (cells.harbor[i] === 1) score += scoreMap.save_harbor;
      }
    }

    cells.s[i] = score / 5; // general population rate
    // add bonus for goods around
    if (cells.good && (cells.good[i] || cells.c[i].some(c => cells.good[c]))) {
      const cellRes = getResValue(i);
      const neibRes = mean(cells.c[i].map(c => getResValue(c))) ?? 0;
      const resBonus = (cellRes ? cellRes + 10 : 0) + neibRes;
      cells.s[i] += resBonus;
    }
    // cell rural population is suitability adjusted by cell area
    cells.pop[i] = cells.s[i] > 0 ? (cells.s[i] * cells.area[i]) / meanArea : 0;
  }

  TIME && console.timeEnd("rankCells");
}

// show map stats on generation complete
function showStatistics() {
  const heightmap = ensureEl<HTMLInputElement>("templateInput").value;
  const isTemplate = heightmap in heightmapTemplates;
  const heightmapType = isTemplate ? "template" : "precreated";
  const isRandomTemplate = isTemplate && !stored("template") ? "random " : "";

  const stats = `  Seed: ${app.seed}
    Canvas size: ${app.graphWidth}x${app.graphHeight} px
    Heightmap: ${heightmap}
    Template: ${isRandomTemplate}${heightmapType}
    Points: ${app.grid.points.length}
    Cells: ${app.pack.cells.i.length}
    Map size: ${app.options.mapSize}%
    States: ${app.pack.states.length - 1}
    Provinces: ${app.pack.provinces.length - 1}
    Burgs: ${app.pack.burgs.length - 1}
    Religions: ${app.pack.religions.length - 1}
    Culture set: ${culturesSet.value}
    Cultures: ${app.pack.cultures.length - 1}`;

  app.mapId = Date.now(); // unique map id is it's creation date number
  app.mapHistory.push({
    seed: app.seed,
    width: app.graphWidth,
    height: app.graphHeight,
    template: heightmap,
    created: app.mapId
  });
  INFO && console.info(stats);

  // Dispatch event for test automation and external integrations
  window.dispatchEvent(new CustomEvent("map:generated", { detail: { seed: app.seed, mapId: app.mapId } }));
}

const regenerateMap = debounce(async (config?: string | RegenerateOptions) => {
  WARN && console.warn("Generate new random map");

  const cellsDesired = Number(ensureEl<HTMLInputElement>("pointsInput").dataset.cells);
  const shouldShowLoading = cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator");
  app.customization = 0;
  resetZoom(1000);
  undraw();
  await generate(config);
  LayerControls.drawActiveLayers();
  if (findEl("worldConfigurator")?.offsetParent) window.Controllers.WorldConfigurator.open();

  OptionsController.fitMapToScreen();
  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

// clear the map
function undraw() {
  window.ViewportLayers?.clearAll();
  void window.MapRendererCommands.clear();
  getViewportSurface()
    .viewbox.selectAll("path, circle, polygon, line, text, use, #texture > image, #zones > g, #armies > g, #ruler > g")
    .remove();
  ensureEl("deftemp")
    .querySelectorAll("path, clipPath, svg")
    .forEach(el => {
      el.remove();
    });
  ensureEl("coas").innerHTML = ""; // remove auto-generated emblems
  app.notes = [];
  unfog();
}

bindApplicationController({
  focusOn,
  generateMapOnLoad,
  regenerateMap,
  undraw
});
bindWorldGenerationController({
  addLakesInDeepDepressions,
  calculateMapCoordinates,
  calculateTemperatures,
  generatePrecipitation,
  openNearSeaLakes,
  rankCells,
  reGraph,
  showStatistics
});
