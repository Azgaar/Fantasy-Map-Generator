// Save the whole .map project to storage, machine or cloud
import { lazy } from "@/lazy-loaders";
import { ensureEl, link, parseError, rn } from "@/utils";
import { type SaveOutcome, saveToFileSystem } from "./save-to-file";

type SaveMethod = "storage" | "machine" | "dropbox";

export async function saveMap(method: SaveMethod): Promise<void> {
  if (customization) return tip("Map cannot be saved in EDIT mode, please complete the edit and retry", false, "error");
  closeDialogs("#alert");

  try {
    const mapData = prepareMapData();
    const filename = `${getFileName()}.map`;

    if (method === "storage") await saveToStorage(mapData, true);
    if (method === "machine") await saveToMachine(mapData, filename);
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

export function prepareMapData(): string {
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
    mapSizeOutput.value,
    latitudeOutput.value,
    "", // previously used for temperatureEquatorOutput.value
    "", // previously used for tempNorthOutput.value
    precOutput.value,
    JSON.stringify(options),
    mapName.value,
    +hideLabels.checked,
    stylePreset.value,
    +rescaleLabels.checked,
    urbanDensity,
    longitudeOutput.value,
    ensureEl<HTMLInputElement>("growthRate").value
  ].join("|");
  const coords = JSON.stringify(mapCoordinates);
  const biomes = [biomesData.color, biomesData.habitability, biomesData.name].join("|");
  const notesData = JSON.stringify(notes);
  const rulersString = rulers.toString();
  const fonts = JSON.stringify(getUsedFonts(svg.node()!));

  // save svg
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;

  // reset transform values to default
  cloneEl.setAttribute("width", String(graphWidth));
  cloneEl.setAttribute("height", String(graphHeight));
  cloneEl.querySelector("#viewbox")?.removeAttribute("transform");

  const cloneRuler = cloneEl.querySelector("#ruler");
  if (cloneRuler) cloneRuler.innerHTML = ""; // always remove rulers
  const cloneTradeAnimation = cloneEl.querySelector("#tradeAnimation");
  if (cloneTradeAnimation) cloneTradeAnimation.innerHTML = ""; // always remove transient trade animations

  const serializedSVG = new XMLSerializer().serializeToString(cloneEl);

  const { spacing, cellsX, cellsY, boundary, points, features, cellsDesired } = grid;
  const gridGeneral = JSON.stringify({ spacing, cellsX, cellsY, boundary, points, features, cellsDesired });
  const packFeatures = JSON.stringify(pack.features);
  const cultures = JSON.stringify(pack.cultures);
  const states = JSON.stringify(pack.states);
  const burgs = JSON.stringify(pack.burgs);
  const religions = JSON.stringify(pack.religions);
  const provinces = JSON.stringify(pack.provinces);
  const rivers = JSON.stringify(pack.rivers);
  const markers = JSON.stringify(pack.markers);
  const cellRoutes = JSON.stringify(pack.cells.routes);
  const routes = JSON.stringify(pack.routes);
  const zones = JSON.stringify(pack.zones);
  const ice = JSON.stringify(pack.ice);
  const goods = JSON.stringify(pack.goods);
  const markets = JSON.stringify(pack.markets || []);
  const deals = JSON.stringify(pack.deals || []);

  // store custom good icons
  const goodIconsEl = ensureEl("good-icons");
  const customGoodIcons = Array.from(goodIconsEl.querySelectorAll('[id^="good-custom-"]') || [])
    .map(el => el.outerHTML)
    .join("")
    .replace(/[\r\n]+/g, " "); // map data is split by CRLF on load

  // store name array only if not the same as default
  const defaultNB = Names.getNameBases();
  const namesData = nameBases
    .map((b, i) => {
      const names = defaultNB[i] && defaultNB[i].b === b.b ? "" : b.b;
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
    rulersString,
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
    customGoodIcons
  ].join("\r\n");
  return mapData;
}

// save map file to indexedDB
export async function saveToStorage(mapData: string, showTip = false): Promise<void> {
  const blob = new Blob([mapData], { type: "text/plain" });
  await ldb.set("lastMap", blob);
  showTip && tip("Map is saved to the browser storage", false, "success");
}

const DOWNLOADS_FALLBACK_NOTICE_KEY = "savePickerFallbackNoticeShown";

// Whether the one-time fallback explanation has already been shown on this
// browser. Guarded because localStorage can throw (e.g. Safari private mode);
// a save must never fail just because we couldn't read/write this flag.
function fallbackNoticeAlreadyShown(): boolean {
  try {
    return localStorage.getItem(DOWNLOADS_FALLBACK_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}

function rememberFallbackNoticeShown(): void {
  try {
    localStorage.setItem(DOWNLOADS_FALLBACK_NOTICE_KEY, "true");
  } catch {
    // Storage unavailable — the note may show again next time; harmless.
  }
}

// A single tip per fallback save: the first time also explains why no picker was
// offered. (One tip, not two — a second tip() would overwrite the first, since
// tip() replaces the tooltip's contents.)
function notifyDownloadsFallback(): void {
  if (fallbackNoticeAlreadyShown()) {
    tip('Map is saved to the "Downloads" folder (CTRL + J to open)', true, "success", 8000);
    return;
  }

  tip(
    'Map is saved to the "Downloads" folder (CTRL + J). Your browser can\'t offer a save-location picker — use a Chromium browser (Chrome, Edge) to choose where maps are saved.',
    true,
    "success",
    12000
  );
  rememberFallbackNoticeShown();
}

// Map a save outcome to user feedback. A cancelled picker is a silent no-op.
export function notifySaveOutcome(outcome: SaveOutcome): void {
  if (outcome.type === "cancelled") return;

  if (outcome.type === "downloaded-fallback") {
    notifyDownloadsFallback();
    return;
  }

  // saved — written to the file the user chose in the picker.
  tip(`Map is saved to "${outcome.filename}"`, true, "success", 8000);
}

// Save the .map file to the user's machine via the save-location picker (or the
// Downloads fallback where unsupported), then report the outcome.
async function saveToMachine(mapData: string, filename: string): Promise<void> {
  const outcome = await saveToFileSystem(mapData, filename);
  notifySaveOutcome(outcome);
}

async function saveToDropbox(mapData: string, filename: string): Promise<void> {
  const { Cloud } = await lazy.cloud();
  await Cloud.providers.dropbox.save(filename, mapData);
  tip("Map is saved to your Dropbox", true, "success", 8000);
}
