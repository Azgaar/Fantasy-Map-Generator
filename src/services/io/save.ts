// Save the whole .map project to storage, machine or cloud

import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { GraphOverride } from "@/generators/graph-override";
import { Services } from "@/services";
import { getUsedFonts } from "@/services/fonts";
import { savedMessage } from "@/services/platform";
import { VERSION } from "@/services/versioning";
import { ensureEl, getFileName, link, parseError, rn } from "@/utils";

type SaveMethod = "storage" | "machine" | "dropbox";

async function saveMap(method: SaveMethod): Promise<void> {
  if (customization) return tip("Map cannot be saved in EDIT mode, please complete the edit and retry", false, "error");
  closeDialogs("#alert");

  try {
    const mapData = prepareMapData();
    const filename = `${getFileName()}.map`;

    if (method === "storage") await saveToStorage(mapData, true);
    if (method === "machine") saveToMachine(mapData, filename);
    if (method === "dropbox") await saveToDropbox(mapData, filename);
  } catch (error) {
    ERROR && console.error(error);
    alertMessage.innerHTML = /* html */ `An error occurred while saving the map. If the issue persists, please copy the message below and report it on ${link(
      "https://github.com/Azgaar/Fantasy-Map-Generator/issues",
      "GitHub"
    )}. <p id="errorBox">${parseError(error as Error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "Saving error",
      width: "28em",
      buttons: {
        Retry: function (this: HTMLElement) {
          $(this).dialog("close");
          saveMap(method);
        },
        Close: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      },
      position: { my: "center", at: "center", of: "svg" }
    });
  }
}

function prepareMapData(): string {
  const date = new Date();
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator";
  const params = [VERSION, license, dateString, seed, graphWidth, graphHeight, mapId].join("|");
  const settings = [
    distanceUnitInput.value,
    distanceScale,
    areaUnit.value,
    heightUnit.value,
    heightExponentInput.value,
    temperatureScale.value,
    "", // previously used for barSize.value
    "", // previously used for barLabel.value
    "", // previously used for barBackColor.value
    "", // previously used for barBackColor.value
    "", // previously used for barPosX.value
    "", // previously used for barPosY.value
    populationRate,
    urbanization,
    "", // previously used for mapSizeOutput.value, part of options now
    "", // previously used for latitudeOutput.value, part of options now
    "", // previously used for temperatureEquatorOutput.value
    "", // previously used for tempNorthOutput.value
    "", // previously used for precOutput.value, part of options now
    JSON.stringify(options),
    mapName.value,
    "", // previously used for hideLabels
    stylePreset.value,
    "", // previously used for rescaleLabels
    urbanDensity,
    "", // previously used for longitudeOutput.value, part of options now
    ensureEl<HTMLInputElement>("growthRate").value
  ].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const notesData = JSON.stringify(notes);
  const measurers = JSON.stringify(pack.measurers ?? []);
  const journeys = JSON.stringify(pack.journeys ?? []);
  const fonts = JSON.stringify(getUsedFonts(ensureEl("map") as Element as SVGSVGElement));
  const layers = JSON.stringify(Layers.state);
  const graphOverride = JSON.stringify(GraphOverride.state);

  // save svg
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;

  // reset transform values to default
  cloneEl.setAttribute("width", String(graphWidth));
  cloneEl.setAttribute("height", String(graphHeight));
  cloneEl.querySelector("#viewbox")?.removeAttribute("transform");

  // relief icons are stored in pack.relief, the layer holds only the currently visible ones
  const cloneTerrain = cloneEl.querySelector("#terrain");
  if (cloneTerrain) cloneTerrain.innerHTML = "";

  for (const group of Array.from(cloneEl.querySelectorAll("#emblems > g"))) group.innerHTML = "";

  const cloneRuler = cloneEl.querySelector("#ruler");
  if (cloneRuler) cloneRuler.innerHTML = ""; // always remove rulers
  const cloneTradeAnimation = cloneEl.querySelector("#tradeAnimation");
  if (cloneTradeAnimation) cloneTradeAnimation.innerHTML = ""; // always remove transient trade animations
  cloneEl.querySelector("#journeyOverlay")?.remove(); // transient journey path-editing handles
  cloneEl.querySelector("#journeyTravel")?.remove(); // transient journey travel animation

  const serializedSVG = new XMLSerializer().serializeToString(cloneEl);

  const { spacing, cellsX, cellsY, boundary, points, features, cellsDesired } = grid;
  const gridGeneral = JSON.stringify({ spacing, cellsX, cellsY, boundary, points, features, cellsDesired });
  const packFeatures = JSON.stringify(pack.features);
  const biomes = JSON.stringify(pack.biomes);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);
  const religions = JSON.stringify(pack.religions);
  const provinces = JSON.stringify(pack.provinces);
  const rivers = JSON.stringify(pack.rivers);
  const relief = JSON.stringify(pack.relief || []);
  const markers = JSON.stringify(pack.markers);
  const cellRoutes = JSON.stringify(pack.cells.routes);
  const routes = JSON.stringify(pack.routes);
  const zones = JSON.stringify(pack.zones);
  const ice = JSON.stringify(pack.ice);
  const goods = JSON.stringify(pack.goods);
  const markets = JSON.stringify(pack.markets || []);
  const deals = JSON.stringify(pack.deals || []);
  const labels = JSON.stringify(pack.addedLabels || []);
  const styleData = JSON.stringify(styles);

  // store custom good icons
  const goodIconsEl = ensureEl("good-icons");
  const customGoodIcons = Array.from(goodIconsEl.querySelectorAll('[id^="good-custom-"]') || [])
    .map(el => el.outerHTML)
    .join("")
    .replace(/[\r\n]+/g, " "); // map data is split by CRLF on load

  // store name array only if not the same as default
  const defaultNameBases = Names.getNameBases();
  const namesData = Names.nameBases
    .map((b, i) => {
      const names = defaultNameBases[i] && defaultNameBases[i].b === b.b ? "" : b.b;
      return `${b.name}|${b.min}|${b.max}|${b.d}|${b.m}|${names}`;
    })
    .join("/");

  // round population to save space
  const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));

  // data format as below
  const mapData = [
    params,
    settings,
    coords,
    biomes,
    notesData,
    serializedSVG,
    gridGeneral,
    grid.cells.h,
    grid.cells.prec,
    grid.cells.f,
    grid.cells.t,
    grid.cells.temp,
    packFeatures,
    cultures,
    states,
    burgs,
    pack.cells.biome,
    pack.cells.burg,
    pack.cells.conf,
    pack.cells.culture,
    pack.cells.fl,
    pop,
    pack.cells.r,
    [], // deprecated pack.cells.road
    pack.cells.s,
    pack.cells.state,
    pack.cells.religion,
    pack.cells.province,
    [], // deprecated pack.cells.crossroad
    religions,
    provinces,
    namesData,
    rivers,
    "", // rulers are deprecated, use pack.measurers instead
    fonts,
    markers,
    cellRoutes,
    routes,
    zones,
    ice,
    pack.cells.good,
    goods,
    markets,
    deals,
    pack.cells.market,
    customGoodIcons,
    measurers,
    labels,
    styleData,
    relief,
    layers,
    graphOverride,
    journeys
  ].join("\r\n");
  return mapData;
}

// save map file to indexedDB
async function saveToStorage(mapData: string, showTip = false): Promise<void> {
  const blob = new Blob([mapData], { type: "text/plain" });
  await ldb.set("lastMap", blob);
  showTip && tip("Map is saved to the browser storage", false, "success");
}

// download map file
function saveToMachine(mapData: string, filename: string): void {
  const blob = new Blob([mapData], { type: "text/plain" });
  const URL = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = filename;
  link.href = URL;
  link.click();

  tip(savedMessage("Map"), true, "success", 8000);
  setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
}

async function saveToDropbox(mapData: string, filename: string): Promise<void> {
  await Services.Cloud.save(filename, mapData);
  tip("Map is saved to your Dropbox", true, "success", 8000);
}

export const Save = { saveMap, prepareMapData, saveToStorage };
