// Save the whole .map project to storage, machine or cloud

import { GraphOverride } from "@/model/graph/graph-override";
import { mapHistory } from "@/model/map-history";
import { Names } from "@/model/society/names-generator";
import { Notes } from "@/model/story/notes";
import { Layers } from "@/renderers/layers";
import { restoreOceanVectors } from "@/renderers/ocean-cache";
import { Services } from "@/services";
import { getUsedFonts } from "@/services/fonts";
import { getFileName } from "@/services/io/file-name";
import { LocalDB } from "@/services/local-db";
import { savedMessage } from "@/services/platform";
import { VERSION } from "@/services/versioning";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { link, parseError } from "@/utils/common-utils";
import { isElectron } from "@/utils/environment";
import { sentences, t } from "@/utils/i18n";
import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { serializeHistory } from "./epochs-format";
import { serializeNameBases } from "./name-bases-format";
import { type SaveOutcome, saveToFileSystem } from "./save-to-file";

type Writer = () => Promise<void>;

const toStorage = (): Promise<void> => save(() => writeToStorage(prepareMapData(), true));
const toMachine = (overwrite = false, viewOnly = false): Promise<void> =>
  save(() => writeToMachine(overwrite, viewOnly));
const toDropbox = (viewOnly = false): Promise<void> =>
  save(() => writeToDropbox(prepareMapData(viewOnly), mapFileName(viewOnly)));

// a view-only copy never takes the editable file's name
const mapFileName = (viewOnly: boolean): string => `${getFileName()}${viewOnly ? " view" : ""}.map`;

async function save(write: Writer): Promise<void> {
  if (options.app.mode)
    return tip(t("Map cannot be saved in EDIT mode, please complete the edit and retry"), false, "error");
  if (options.map.viewOnly) return tip(t("The map is in view-only mode and cannot be saved"), false, "warn");
  Dialog.closeAll(undefined, { keepMessages: true }); // save may be asked from a message

  try {
    await write();
  } catch (error) {
    log.error(error);
    const saveError = error instanceof Error ? error : new Error(String(error));
    Dialog.message({
      message: /* html */ `${t(
        "An error occurred while saving the map. If the issue persists, please copy the message below and report it on {{- github}}.",
        { github: link("https://github.com/Azgaar/Fantasy-Map-Generator/issues", "GitHub") }
      )} <p id="errorBox">${parseError(saveError)}</p>`,
      title: t("Saving error"),
      width: "28em",
      buttons: [
        {
          label: t("Retry"),
          onClick: () => {
            save(write);
          }
        },
        { label: t("Close") }
      ]
    });
  }
}

/** `viewOnly` saves a copy that opens for browsing only */
function prepareMapData(viewOnly = false): string {
  const date = new Date();
  const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const license = "File can be loaded in azgaar.github.io/Fantasy-Map-Generator"; // file format text: never translated
  const params = [
    VERSION,
    license,
    dateString,
    options.map.seed,
    options.map.graph.width,
    options.map.graph.height,
    mapHistory.at(-1)?.created ?? Date.now() // the map id: when the map on screen was created
  ].join("|");

  const settings = JSON.stringify(viewOnly ? { ...options.map, viewOnly } : options.map); // the requests and preferences stay out
  const measurers = JSON.stringify(pack.measurers ?? []);
  const journeys = JSON.stringify(pack.journeys ?? []);
const { json: history, snapshotRecords } = serializeHistory(pack.history, pack.cells.i.length);
  const legends = JSON.stringify(pack.legends);
  const fonts = JSON.stringify(
    getUsedFonts(
      styles,
      Notes.list().map(entry => entry.note)
    )
  );
  const layers = JSON.stringify(Layers.state);
  const graphOverride = JSON.stringify(GraphOverride.state);

  // TEMPORARY SAFETY MEASURE for the next few versions: record 5 keeps the svg no current map reads; drop this block then
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;

  restoreOceanVectors(cloneEl);

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

  // store names only when they differ from the shipped base with the same id
  const namesData = serializeNameBases(Names.nameBases);

  // round population to save space
  const pop = Array.from(pack.cells.pop).map(p => rn(p, 4));

  // data format as below
  const mapData = [
    params,
    settings,
    "", // deprecated separate mapCoordinates, now options.map.geography.coordinates
    biomes,
    "", // deprecated notes array, now a note field on the entity it describes
    serializedSVG, // temporary, see above
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
    journeys,
legends,
    history,
    ...snapshotRecords // records 55 and up: one border snapshot per epoch
  ].join("\r\n");
  return mapData;
}

// save map file to indexedDB
async function writeToStorage(mapData: string, showTip = false): Promise<void> {
  const blob = new Blob([mapData], { type: "text/plain" });
  await LocalDB.set("lastMap", blob);
  showTip && tip(t("Map is saved to the browser storage"), false, "success");
}

// a view-only copy never becomes the file an overwrite updates: that is the author's editable map
async function writeToMachine(overwrite: boolean, viewOnly: boolean): Promise<void> {
  notifySaveOutcome(await saveToFileSystem(() => prepareMapData(viewOnly), mapFileName(viewOnly), overwrite, viewOnly));
}

export function notifySaveOutcome(outcome: SaveOutcome): void {
  if (outcome.type === "cancelled") return;
  if (outcome.type === "saved") {
    tip(t("Map is saved to “{{file}}”", { file: outcome.filename }), true, "success", 8000);
    return;
  }

  let message = savedMessage(t("Map"));
  if (!isElectron()) {
    const noticeKey = "savePickerFallbackNoticeShown";
    try {
      if (!localStorage.getItem(noticeKey)) {
        message = sentences(
          message,
          t("A save-location picker is unavailable here; your browser's download settings control the location.")
        );
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
  tip(t("Map is saved to your Dropbox"), true, "success", 8000);
}

export const Save = { toStorage, toMachine, toDropbox, prepareMapData, writeToStorage };
