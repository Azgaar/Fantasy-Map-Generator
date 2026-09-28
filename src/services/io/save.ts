// Save the whole .map project to storage, machine or cloud
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Notes } from "@/components/notes";
import { tip } from "@/components/tooltips";
import { GraphOverride } from "@/generators/graph-override";
import { Services } from "@/services";
import { getUsedFonts } from "@/services/fonts";
import { isElectron, savedMessage } from "@/services/platform";
import { VERSION } from "@/services/versioning";
import { ensureEl, escapeHtml, getFileName, link, parseError, rn } from "@/utils";
import { type SaveOutcome, saveToFileSystem } from "./save-to-file";

type Writer = () => Promise<void>;

const toStorage = (): Promise<void> => save(() => writeToStorage(prepareMapData(), true));
const toMachine = (saveAs = false): Promise<void> => save(() => writeToMachine(saveAs));
const toDropbox = (): Promise<void> => save(() => writeToDropbox(prepareMapData(), `${getFileName()}.map`));

async function save(write: Writer): Promise<void> {
  if (customization) return tip("Map cannot be saved in EDIT mode, please complete the edit and retry", false, "error");
  closeDialogs("#alert");

  try {
    await write();
  } catch (error) {
    ERROR && console.error(error);
    const saveError = error instanceof Error ? error : new Error(String(error));
    alertMessage.innerHTML = /* html */ `An error occurred while saving the map. If the issue persists, please copy the message below and report it on ${link(
      "https://github.com/Azgaar/Fantasy-Map-Generator/issues",
      "GitHub"
    )}. <p id="errorBox">${parseError(saveError)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: "Saving error",
      width: "28em",
      buttons: {
        Retry: function (this: HTMLElement) {
          $(this).dialog("close");
          save(write);
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
  const params = [
    VERSION,
    license,
    dateString,
    options.map.seed,
    options.map.graph.width,
    options.map.graph.height,
    mapHistory.at(-1)?.created ?? Date.now() // the map id: when the map on screen was created
  ].join("|");

  const settings = JSON.stringify(options.map); // what the map is; the requests and preferences stay out
  const measurers = JSON.stringify(pack.measurers ?? []);
  const journeys = JSON.stringify(pack.journeys ?? []);
  const fonts = JSON.stringify(
    getUsedFonts(
      ensureEl("map") as Element as SVGSVGElement,
      Notes.list().map(entry => entry.note)
    )
  );
  const layers = JSON.stringify(Layers.state);
  const graphOverride = JSON.stringify(GraphOverride.state);

  // save svg
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;

  // reset transform values to default
  cloneEl.setAttribute("width", String(options.map.graph.width));
  cloneEl.setAttribute("height", String(options.map.graph.height));
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

  const { spacing, cellsX, cellsY, boundary, points, features } = grid;
  const gridGeneral = JSON.stringify({ spacing, cellsX, cellsY, boundary, points, features });
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
    "", // deprecated separate mapCoordinates, now options.map.geography.coordinates
    biomes,
    "", // deprecated notes array, now a note field on the entity it describes
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
    "", // deprecated custom good icons, now options.map.customIcons
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
async function writeToStorage(mapData: string, showTip = false): Promise<void> {
  const blob = new Blob([mapData], { type: "text/plain" });
  await ldb.set("lastMap", blob);
  showTip && tip("Map is saved to the browser storage", false, "success");
}

async function writeToMachine(saveAs: boolean): Promise<void> {
  notifySaveOutcome(await saveToFileSystem(prepareMapData, `${getFileName()}.map`, saveAs));
}

export function notifySaveOutcome(outcome: SaveOutcome): void {
  if (outcome.type === "cancelled") return;
  if (outcome.type === "saved") {
    tip(`Map is saved to "${escapeHtml(outcome.filename)}"`, true, "success", 8000);
    return;
  }

  let message = savedMessage("Map");
  if (!isElectron()) {
    const noticeKey = "savePickerFallbackNoticeShown";
    try {
      if (!localStorage.getItem(noticeKey)) {
        message +=
          ". A save-location picker is unavailable here; your browser's download settings control the location.";
        localStorage.setItem(noticeKey, "true");
      }
    } catch {
      // Storage preferences must never prevent a download.
    }
  }
  tip(message, true, "success", 12000);
}

async function writeToDropbox(mapData: string, filename: string): Promise<void> {
  await Services.Cloud.save(filename, mapData);
  tip("Map is saved to your Dropbox", true, "success", 8000);
}

export const Save = { toStorage, toMachine, toDropbox, prepareMapData, writeToStorage };
