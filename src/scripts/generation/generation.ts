import * as d3 from "d3";

import {ERROR, INFO, WARN} from "config/logging";
import {closeDialogs} from "dialogs/utils";
import {openDialog} from "dialogs";
import {initLayers, renderLayer, restoreLayers} from "layers";
// @ts-expect-error js module
import {drawScaleBar, Rulers} from "modules/measurers";
// @ts-expect-error js module
import {unfog} from "modules/ui/editors";
// @ts-expect-error js module
import {applyMapSize, randomizeOptions} from "modules/ui/options";
// @ts-expect-error js module
import {applyStyleOnLoad} from "modules/ui/stylePresets";
// @ts-expect-error js module
import {addZones} from "modules/zones";
import {aleaPRNG} from "scripts/aleaPRNG";
import {hideLoading, showLoading} from "scripts/loading";
import {clearMainTip, tip} from "scripts/tooltips";
import {parseError} from "utils/errorUtils";
import {debounce} from "utils/functionUtils";
import {rn} from "utils/numberUtils";
import {generateSeed} from "utils/probabilityUtils";
import {byId} from "utils/shorthands";
import {createGrid} from "./grid";
import {createPack} from "./pack/pack";
import {getInputValue, setInputValue} from "utils/nodeUtils";
// import {Ruler} from "modules/measurers";

const {Zoom, ThreeD} = window;

interface IGenerationOptions {
  seed: string;
  graph: IGrid;
}

async function generate(options?: IGenerationOptions) {
  try {
    const timeStart = performance.now();
    const {seed: precreatedSeed, graph: precreatedGraph} = options || {};

    // temp for testing:
    hideLoading();

    Zoom?.invoke();
    setSeed(precreatedSeed);

    INFO && console.group("Generated Map " + seed);

    applyMapSize();
    randomizeOptions();

    const newGrid = await createGrid(grid, precreatedGraph);
    const newPack = createPack(newGrid);

    // TODO: draw default ruler

    // redefine global grid and pack
    grid = newGrid;
    pack = newPack;

    // temp rendering for debug
    renderLayer("cells");
    renderLayer("features");
    renderLayer("heightmap");
    renderLayer("rivers", pack);

    WARN && console.warn(`TOTAL: ${rn((performance.now() - timeStart) / 1000, 2)}s`);
    // showStatistics();
    INFO && console.groupEnd();
  } catch (error) {
    showGenerationError(error as Error);
  }
}

function showGenerationError(error: Error) {
  clearMainTip();
  ERROR && console.error(error);
  const message = `An error has occurred on map generation. Please retry. <br />If error is critical, clear the stored data and try again.
  <p id="errorBox">${parseError(error)}</p>`;
  byId("alertMessage")!.innerHTML = message;

  $("#alert").dialog({
    resizable: false,
    title: "Generation error",
    width: "32em",
    buttons: {
      "Clear data": function () {
        localStorage.clear();
        localStorage.setItem("version", APP_VERSION);
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

export async function generateMapOnLoad() {
  await applyStyleOnLoad(); // apply previously selected default or custom style
  await generate(); // generate map
  focusOn(); // based on searchParams focus on point, cell or burg from MFCG
  initLayers(); // apply saved layers data
}

// clear the map
export function undraw() {
  viewbox.selectAll("path, circle, polygon, line, text, use, #zones > g, #armies > g, #ruler > g").remove();

  byId("deftemp")
    ?.querySelectorAll("path, clipPath, svg")
    .forEach(el => el.remove());

  // remove auto-generated emblems
  if (byId("coas")) byId("coas")!.innerHTML = "";

  notes = [];
  rulers = new Rulers();

  unfog();
}

export const regenerateMap = debounce(async function (options: IGenerationOptions) {
  WARN && console.warn("Generate new random map");

  const cellsDesired = Number(byId("pointsInput")?.dataset.cells);
  const shouldShowLoading = cellsDesired > 10000;
  shouldShowLoading && showLoading();

  closeDialogs("#worldConfigurator, #options3d");
  customization = 0;
  Zoom.reset(1000);
  undraw();
  await generate(options);
  restoreLayers();
  if (ThreeD.options.isOn) ThreeD.redraw();
  if ($("#worldConfigurator").is(":visible")) openDialog("worldConfigurator");

  shouldShowLoading && hideLoading();
  clearMainTip();
}, 250);

// focus on coordinates, cell or burg provided in searchParams
function focusOn() {
  const params = new URL(window.location.href).searchParams;

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
    const scale = scaleParam ? Number(scaleParam) : 8;

    if (cellParam) {
      const cell = Number(scaleParam);
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

    const x = params.get("x") ? Number(params.get("x")) : graphWidth / 2;
    const y = params.get("y") ? Number(params.get("y")) : graphHeight / 2;
    Zoom.to(x, y, scale, 1600);
  }
}

// find burg for MFCG and focus on it
function findBurgForMFCG(params: URLSearchParams) {
  const {cells, burgs} = pack;

  if (pack.burgs.length < 2) {
    ERROR && console.error("Cannot select a burg for MFCG");
    return;
  }

  // used for selection
  const size = params.get("size") ? Number(params.get("size")) : 10;
  const coast = Boolean(params.get("coast"));
  const port = Boolean(params.get("port"));
  const river = Boolean(params.get("river"));

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, false, !river);
  if (!selection.length) selection = [burgs[1]]; // select first if nothing is found

  function defineSelection(coast: boolean, port: boolean, river: boolean) {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  }

  // select a burg with closest population from selection
  const selected = d3.scan(selection, (a, b) => Math.abs(a.population - size) - Math.abs(b.population - size));
  const burgId = selected && selection[selected].i;
  if (!burgId) return ERROR && console.error("Cannot select a burg for MFCG");

  const b = burgs[burgId];
  const searchParams = new URL(document.referrer).searchParams;
  for (let [param, value] of searchParams) {
    if (param === "name") b.name = value;
    else if (param === "size") b.population = +value;
    else if (param === "seed") b.MFCG = +value;
    else if (param === "shantytown") b.shanty = +value;
  }

  const nameParam = params.get("name");
  if (nameParam && nameParam !== "null") b.name = nameParam;

  const label = burgLabels.select("[data-id='" + burgId + "']");
  if (label.size()) {
    label
      .text(b.name)
      .classed("drag", true)
      .on("mouseover", function (this: Element) {
        d3.select(this).classed("drag", false);
        label.on("mouseover", null);
      });
  }

  Zoom.to(b.x, b.y, 8, 1600);
  Zoom.invoke();

  tip("Here stands the glorious city of " + b.name, true, "success", 15000);
}

// set map seed (string!)
function setSeed(precreatedSeed?: string) {
  if (!precreatedSeed) {
    const first = !mapHistory[0];

    const params = new URL(window.location.href).searchParams;
    const urlSeed = params.get("seed");
    const optionsSeed = getInputValue("optionsSeed");

    if (first && params.get("from") === "MFCG" && urlSeed?.length === 13) seed = urlSeed.slice(0, -4);
    else if (first && urlSeed) seed = urlSeed;
    else if (optionsSeed && optionsSeed !== seed) seed = optionsSeed;
    else seed = generateSeed();
  } else {
    seed = precreatedSeed;
  }

  setInputValue("optionsSeed", seed);
  Math.random = aleaPRNG(seed);
}
