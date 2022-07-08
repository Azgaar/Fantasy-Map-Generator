import * as d3 from "d3";

import {ERROR, INFO, WARN} from "config/logging";
import {initLayers, renderLayer, restoreLayers} from "layers";
import {drawCoastline} from "modules/coastline";
import {calculateMapCoordinates, defineMapSize} from "modules/coordinates";
import {markFeatures, markupGridOcean} from "modules/markup";
import {drawScaleBar, Rulers} from "modules/measurers";
import {generatePrecipitation} from "modules/precipitation";
import {calculateTemperatures} from "modules/temperature";
import {applyMapSize, randomizeOptions} from "modules/ui/options";
import {applyStyleOnLoad} from "modules/ui/stylePresets";
import {addZones} from "modules/zones";
import {aleaPRNG} from "scripts/aleaPRNG";
import {hideLoading, showLoading} from "scripts/loading";
import {clearMainTip, tip} from "scripts/tooltips";
import {parseError} from "utils/errorUtils";
import {debounce} from "utils/functionUtils";
import {generateGrid, shouldRegenerateGrid} from "utils/graphUtils";
import {rn} from "utils/numberUtils";
import {generateSeed} from "utils/probabilityUtils";
import {byId} from "utils/shorthands";
import {showStatistics} from "./statistics";
import {reGraph} from "./reGraph";
import {rankCells} from "./rankCells";
import {closeDialogs} from "dialogs/utils";

export async function generate(options) {
  try {
    const timeStart = performance.now();
    const {seed: precreatedSeed, graph: precreatedGraph} = options || {};

    Zoom.invoke();
    setSeed(precreatedSeed);
    INFO && console.group("Generated Map " + seed);

    applyMapSize();
    randomizeOptions();

    if (shouldRegenerateGrid(grid)) grid = precreatedGraph || generateGrid();
    else delete grid.cells.h;
    grid.cells.h = await HeightmapGenerator.generate(grid);

    markFeatures();
    markupGridOcean();

    Lakes.addLakesInDeepDepressions();
    Lakes.openNearSeaLakes();

    OceanLayers();
    defineMapSize();
    window.mapCoordinates = calculateMapCoordinates();
    calculateTemperatures();
    generatePrecipitation();

    reGraph();
    drawCoastline();

    Rivers.generate();
    renderLayer("rivers");
    Lakes.defineGroup();
    Biomes.define();

    rankCells();
    Cultures.generate();
    Cultures.expand();
    BurgsAndStates.generate();
    Religions.generate();
    BurgsAndStates.defineStateForms();
    BurgsAndStates.generateProvinces();
    BurgsAndStates.defineBurgFeatures();

    renderLayer("states");
    renderLayer("borders");
    BurgsAndStates.drawStateLabels();

    Rivers.specify();
    Lakes.generateName();

    Military.generate();
    Markers.generate();
    addZones();

    drawScaleBar(scale);
    Names.getMapName();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    showStatistics();
    INFO && console.groupEnd("Generated Map " + seed);
  } catch (error) {
    ERROR && console.error(error);
    const parsedError = parseError(error);
    clearMainTip();

    alertMessage.innerHTML = /* html */ `An error has occurred on map generation. Please retry. <br />If error is critical, clear the stored data and try again.
      <p id="errorBox">${parsedError}</p>`;
    $("#alert").dialog({
      resizable: false,
      title: "Generation error",
      width: "32em",
      buttons: {
        "Clear data": function () {
          localStorage.clear();
          localStorage.setItem("version", version);
        },
        Regenerate: function () {
          regenerateMap("generation error");
          $(this).dialog("close");
        },
        Ignore: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });
  }
}

export async function generateMapOnLoad() {
  await applyStyleOnLoad(); // apply previously selected default or custom style
  await generate(); // generate map
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
  initLayers(); // apply saved layers data
}

// clear the map
export function undraw() {
  viewbox.selectAll("path, circle, polygon, line, text, use, #zones > g, #armies > g, #ruler > g").remove();
  document
    .getElementById("deftemp")
    .querySelectorAll("path, clipPath, svg")
    .forEach(el => el.remove());
  byId("coas").innerHTML = ""; // remove auto-generated emblems
  notes = [];
  rulers = new Rulers();
  unfog();
}

export const regenerateMap = debounce(async function (options) {
  WARN && console.warn("Generate new random map");

  const cellsDesired = +byId("pointsInput").dataset.cells;
  const shouldShowLoading = cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  Zoom.reset(1000);
  undraw();
  await generate(options);
  restoreLayers();
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) editWorld();

  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const fromMGCG = params.get("from") === "MFCG" && document.referrer;
  if (fromMGCG) {
    if (params.get("seed").length === 13) {
      // show back burg from MFCG
      const burgSeed = params.get("seed").slice(-4);
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
    const scale = +scaleParam || 8;

    if (cellParam) {
      const cell = +params.get("cell");
      const [x, y] = pack.cells.p[cell];
      Zoom.to(x, y, scale, 1600);
      return;
    }

    if (burgParam) {
      const burg = isNaN(+burgParam) ? pack.burgs.find(burg => burg.name === burgParam) : pack.burgs[+burgParam];
      if (!burg) return;

      const {x, y} = burg;
      Zoom.to(x, y, scale, 1600);
      return;
    }

    const x = +params.get("x") || graphWidth / 2;
    const y = +params.get("y") || graphHeight / 2;
    Zoom.to(x, y, scale, 1600);
  }
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params) {
  const {cells, burgs} = pack;

  if (pack.burgs.length < 2) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  // used for selection
  const size = +params.get("size");
  const coast = +params.get("coast");
  const port = +params.get("port");
  const river = +params.get("river");

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, 0, !river);
  if (!selection.length) selection = [burgs[1]]; // select first if nothing is found

  function defineSelection(coast, port, river) {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  }

  // select a burg with closest population from selection
  const selected = d3.scan(selection, (a, b) => Math.abs(a.population - size) - Math.abs(b.population - size));
  const burgId = selection[selected].i;
  if (!burgId) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  const b = burgs[burgId];
  const referrer = new URL(document.referrer);
  for (let p of referrer.searchParams) {
    if (p[0] === "name") b.name = p[1];
    else if (p[0] === "size") b.population = +p[1];
    else if (p[0] === "seed") b.MFCG = +p[1];
    else if (p[0] === "shantytown") b.shanty = +p[1];
    else b[p[0]] = +p[1]; // other parameters
  }
  if (params.get("name") && params.get("name") != "null") b.name = params.get("name");

  const label = burgLabels.select("[data-id='" + burgId + "']");
  if (label.size()) {
    label
      .text(b.name)
      .classed("drag", true)
      .on("mouseover", function () {
        d3.select(this).classed("drag", false);
        label.on("mouseover", null);
      });
  }

  Zoom.to(b.x, b.y, 8, 1600);
  Zoom.invoke();
  tip("Here stands the glorious city of " + b.name, true, "success", 15000);
}

// set map seed (string!)
function setSeed(precreatedSeed) {
  if (!precreatedSeed) {
    const first = !mapHistory[0];
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const urlSeed = url.searchParams.get("seed");
    if (first && params.get("from") === "MFCG" && urlSeed.length === 13) seed = urlSeed.slice(0, -4);
    else if (first && urlSeed) seed = urlSeed;
    else if (optionsSeed.value && optionsSeed.value != seed) seed = optionsSeed.value;
    else seed = generateSeed();
  } else {
    seed = precreatedSeed;
  }

  byId("optionsSeed").value = seed;
  Math.random = aleaPRNG(seed);
}
