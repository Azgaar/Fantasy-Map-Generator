// The Save, Export and Load dialogs behind the sticked menu, plus the tile-export screen; this module owns their markup
import { select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Services } from "@/services";
import { link } from "@/utils/commonUtils";
import { createFileInput } from "@/utils/fileUtils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

const TEMPLATE = /* html */ `
  <div id="exportMapData" style="display: none" class="dialog">
    <div style="margin-bottom: 0.3em; font-weight: bold">${t("Download image")}</div>
    <div>
      <button data-action="svg" data-tip="${t("Download the map as vector image (open directly in browser or Inkscape)")}">.svg</button>
      <button data-action="png" data-tip="${t("Download visible part of the map as .png (lossless compressed)")}">.png</button>
      <button data-action="jpeg" data-tip="${t("Download visible part of the map as .jpeg (lossy compressed) image")}">.jpeg</button>
      <button data-action="tiles" data-tip="${t("Split map into smaller png tiles and download as zip archive")}">${t("tiles")}</button>
      <span data-tip="${t("Check to not allow system to automatically hide labels")}">
        <input id="showLabels" class="checkbox" type="checkbox" />
        <label for="showLabels" class="checkbox-label">${t("Show all labels")}</label>
      </span>
    </div>
    <div
      data-tip="${t("Define scale of a saved png/jpeg image (e.g. 5x). Saving big images is slow and may cause a browser crash!")}"
      style="margin-bottom: 0.3em"
    >
      ${t("PNG / JPEG scale")}:
      <input id="pngResolutionInput" data-stored="pngResolution" type="range" min="1" max="8" value="1" style="width: 10em" />
      <input id="pngResolutionOutput" data-stored="pngResolution" type="number" min="1" max="8" value="1" />
    </div>
    <p>${t("Generator uses pop-up window to download files. Please ensure your browser does not block popups.")}</p>
    <div style="margin: 1em 0 0.3em; font-weight: bold">${t("Export to GeoJSON")}</div>
    <div>
      <button data-action="geojsonCells" data-tip="${t("Export to GeoJSON")}">${t("Cells")}</button>
      <button data-action="geojsonRoutes" data-tip="${t("Export to GeoJSON")}">${t("Routes")}</button>
      <button data-action="geojsonRivers" data-tip="${t("Export to GeoJSON")}">${t("Rivers")}</button>
      <button data-action="geojsonMarkers" data-tip="${t("Export to GeoJSON")}">${t("Markers")}</button>
      <button data-action="geojsonZones" data-tip="${t("Export to GeoJSON")}">${t("Zones")}</button>
    </div>
    <p>
      ${sentences(
        t("GeoJSON format is used in GIS tools such as QGIS."),
        t("Check out {{- wiki}} for guidance.", {
          wiki: link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export", t("wiki"))
        })
      )}
    </p>
    <div style="margin: 1em 0 0.3em; font-weight: bold">${t("Export to JSON")}</div>
    <div>
      <button data-action="jsonFull" data-tip="${t("Download full data in JSON")}">${t("Full")}</button>
      <button data-action="jsonMinimal" data-tip="${t("Download minimal data in JSON")}">${t("Minimal")}</button>
      <button data-action="jsonPackCells" data-tip="${t("Download map metadata and pack cells data in JSON")}">${t("Pack cells")}</button>
      <button data-action="jsonGridCells" data-tip="${t("Download map metadata and grid cells data in JSON")}">${t("Grid cells")}</button>
    </div>
    <p>${t("Export in JSON format can be used as an API replacement.")}</p>
  </div>

  <div id="saveMapData" style="display: none" class="dialog">
    <div style="margin-top: 0.3em">
      <strong>${t("Save map to")}</strong>
      <button
        data-action="saveToMachine"
        data-tip="${t("Save to the chosen file; Shift-click to choose another filename or location")}"
        data-shortcut="Ctrl + S"
        style="font-weight: 600"
      >
        ${t("machine")}
      </button>
      <button id="saveToDropboxButton" data-action="saveToDropbox" data-tip="${t("Save Map to Dropbox")}" data-shortcut="Ctrl + C">
        dropbox
      </button>
      <button data-action="saveToStorage" data-tip="${t("Save the project to browser storage only")}" data-shortcut="F6">${t("browser")}</button>
    </div>
    <p>
      ${t("When supported by your browser, Save updates the chosen file. Shift-click machine or press Ctrl + Shift + S to save a separate copy.")}
    </p>
    <p>
      ${t("Maps are saved in .map format, that can be loaded back via the Load in menu. There is no way to restore the progress if file is lost. Please keep old save files on your machine or cloud storage as backups.")}
    </p>
  </div>

  <div id="loadMapData" style="display: none" class="dialog">
    <div>
      <strong>${t("Load map from")}</strong>
      <button id="loadMapFromMachine" data-tip="${t("Load map file (.map or .gz) from your local disk")}">${t("machine")}</button>
      <button data-action="loadFromURL" data-tip="${t("Load map file (.map or .gz) file from URL. Note that the server should allow CORS")}">
        URL
      </button>
      <button data-action="loadFromStorage" data-tip="${t("Load map from browser storage (if saved before)")}">${t("storage")}</button>
    </div>
    <p>${t("Click on storage to open the last saved map.")}</p>
    <div id="loadFromDropbox">
      <p style="margin-bottom: 0.3em">
        ${t("Or load from your Dropbox account")}
        <button id="dropboxConnectButton" data-action="connectDropbox" data-tip="${t("Connect your Dropbox account to be able to load maps from it")}">
          ${t("Connect")}
        </button>
      </p>
      <select id="loadFromDropboxSelect" style="width: 22em"></select>
      <div id="loadFromDropboxButtons" style="margin-bottom: 0.6em">
        <button data-action="loadFromDropbox" data-tip="${t("Load map file (.map or .gz) from your Dropbox")}">${t("Load")}</button>
        <button data-action="shareDropboxLink" data-tip="${t("Select file and create a link to share with your friends")}">${t("Share")}</button>
      </div>
      <div style="margin-top: 0.3em">
        <div id="sharableLinkContainer" style="display: none">
          <a id="sharableLink" target="_blank"></a>
          <i data-action="copyLink" data-tip="${t("Copy link to the clipboard")}" class="icon-clone pointer"></i>
        </div>
      </div>
    </div>
  </div>

  <div id="exportToPngTilesScreen" style="display: none" class="dialog">
    <p>${t("Map will be split into tiles and downloaded as a single zip file. Avoid saving too large images")}</p>
    <div data-tip="${t("Number of columns")}" style="margin-bottom: 0.3em">
      <div class="label">${t("Columns")}:</div>
      <input id="tileColsInput" data-stored="tileCols" type="range" min="2" max="26" value="8" style="width: 10em" />
      <input id="tileColsOutput" data-stored="tileCols" type="number" min="2" value="8" />
    </div>
    <div data-tip="${t("Number of rows")}" style="margin-bottom: 0.3em">
      <div class="label">${t("Rows")}:</div>
      <input id="tileRowsInput" data-stored="tileRows" type="range" min="2" max="26" value="8" style="width: 10em" />
      <input id="tileRowsOutput" data-stored="tileRows" type="number" min="2" value="8" />
    </div>
    <div data-tip="${t("Image scale relative to image size (e.g. 5x)")}" style="margin-bottom: 0.3em">
      <div class="label">${t("Scale")}:</div>
      <input id="tileScaleInput" data-stored="tileScale" type="range" min="1" max="4" value="1" style="width: 10em" />
      <input id="tileScaleOutput" data-stored="tileScale" type="number" min="1" value="1" />
    </div>
    <div data-tip="${t("Calculated size of image if combined")}" style="margin-bottom: 0.3em">
      <div class="label">${t("Total size")}:</div>
      <div id="tileSize" style="display: inline-block">1000 x 1000 px</div>
    </div>
    <div id="tileStatus" style="font-style: italic"></div>
  </div>
`;

const ACTIONS: Record<string, (event: MouseEvent) => void> = {
  svg: () => Services.ExportMap.exportToSvg(),
  png: () => Services.ExportMap.exportToPng(),
  jpeg: () => Services.ExportMap.exportToJpeg(),
  tiles: () => openExportToPngTiles(),
  geojsonCells: () => Services.ExportMap.saveGeoJsonCells(),
  geojsonRoutes: () => Services.ExportMap.saveGeoJsonRoutes(),
  geojsonRivers: () => Services.ExportMap.saveGeoJsonRivers(),
  geojsonMarkers: () => Services.ExportMap.saveGeoJsonMarkers(),
  geojsonZones: () => Services.ExportMap.saveGeoJsonZones(),
  jsonFull: () => Services.ExportJson.exportToJson("Full"),
  jsonMinimal: () => Services.ExportJson.exportToJson("Minimal"),
  jsonPackCells: () => Services.ExportJson.exportToJson("PackCells"),
  jsonGridCells: () => Services.ExportJson.exportToJson("GridCells"),
  saveToMachine: event => Services.Save.toMachine(event.shiftKey),
  saveToDropbox: () => Services.Save.toDropbox(),
  saveToStorage: () => Services.Save.toStorage(),
  loadFromURL: () => loadURL(),
  loadFromStorage: () => Services.Load.quickLoad(),
  connectDropbox: () => connectToDropbox(),
  loadFromDropbox: () => Services.Load.loadFromDropbox(),
  shareDropboxLink: () => Services.Load.createSharableDropboxLink(),
  copyLink: () => copyLinkToClipboard()
};

const closeButton = {
  [t("Close")]: function (this: HTMLElement) {
    $(this).dialog("close");
  }
};

function showSavePane(): void {
  $("#saveMapData").dialog({
    title: t("Save map"),
    resizable: false,
    width: "25em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: closeButton
  });
}

function showExportPane(): void {
  ensureEl<HTMLInputElement>("showLabels").checked = options.app.labels.showAll;

  $("#exportMapData").dialog({
    title: t("Export map data"),
    resizable: false,
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: closeButton
  });
}

async function showLoadPane(): Promise<void> {
  $("#loadMapData").dialog({
    title: t("Load Map"),
    resizable: false,
    width: "auto",
    position: { my: "center", at: "center", of: "svg" },
    buttons: closeButton
  });

  // Electron has no Dropbox integration, the whole block is removed from the DOM there
  if (!findEl("loadFromDropbox")) return;

  // the sharable link belongs to this dialog, drop the one made for a previously selected file
  ensureEl("sharableLinkContainer").style.display = "none";

  const connectButton = ensureEl("dropboxConnectButton");
  const buttons = ensureEl("loadFromDropboxButtons");
  const fileSelect = ensureEl<HTMLSelectElement>("loadFromDropboxSelect");

  if (!(await Services.Cloud.isConnected())) {
    connectButton.style.display = "inline-block";
    buttons.style.display = "none";
    fileSelect.style.display = "none";
    return;
  }

  connectButton.style.display = "none";
  fileSelect.style.display = "block";
  fileSelect.innerHTML = /* html */ `<option value="" disabled selected>${t("Loading")}…</option>`;

  const files = await Services.Cloud.list();
  if (!files) {
    buttons.style.display = "none";
    fileSelect.innerHTML = /* html */ `<option value="" disabled selected>${t("Save files to Dropbox first")}</option>`;
    return;
  }

  buttons.style.display = "block";
  fileSelect.innerHTML = "";
  for (const { name, updated, size, path } of files) {
    const label = `${new Date(updated).toLocaleDateString()}: ${name} [${rn(size / 1024 / 1024, 2)} MB]`;
    fileSelect.options.add(new Option(label, path));
  }
}

async function connectToDropbox(): Promise<void> {
  await Services.Cloud.connect();
  if (await Services.Cloud.isConnected()) void showLoadPane();
}

function copyLinkToClipboard(): void {
  const link = ensureEl("sharableLink").getAttribute("href") ?? "";
  navigator.clipboard.writeText(link).then(() => tip(t("Link is copied to the clipboard"), true, "success", 8000));
}

const URL_PATTERN = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;

function loadURL(): void {
  ensureEl("alertMessage").innerHTML = /* html */ `${t("Provide URL to map file")}:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map" />
    <br /><i>${t("Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link")}</i>`;

  $("#alert").dialog({
    resizable: false,
    title: t("Load Map from URL"),
    width: "27em",
    buttons: {
      [t("Load")]: function (this: HTMLElement) {
        const value = ensureEl<HTMLInputElement>("mapURL").value;
        if (!URL_PATTERN.test(value)) return tip(t("Please provide a valid URL"), false, "error");
        void Services.Load.loadMapFromURL(value);
        $(this).dialog("close");
      },
      [t("Cancel")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function openExportToPngTiles(): void {
  ensureEl("tileStatus").innerHTML = "";
  closeDialogs();
  updateTilesOptions();

  const inputs = Array.from(ensureEl("exportToPngTilesScreen").querySelectorAll("input"));
  for (const input of inputs) input.addEventListener("input", onTileInput);

  $("#exportToPngTilesScreen").dialog({
    resizable: false,
    title: t("Download tiles"),
    width: "23em",
    buttons: {
      [t("Download")]: () => Services.ExportMap.exportToPngTiles(),
      [t("Cancel")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    close: () => {
      for (const input of inputs) input.removeEventListener("input", onTileInput);
      select("#debug").selectAll("*").remove();
    }
  });
}

/** paired range/number inputs mirror each other, then the preview is redrawn */
function onTileInput(this: HTMLInputElement): void {
  const { nextElementSibling: next, previousElementSibling: previous } = this;
  if (next instanceof HTMLInputElement) next.value = this.value;
  if (previous instanceof HTMLInputElement) previous.value = this.value;
  storeExportPreference(this);
  updateTilesOptions();
}

/**
 * These dialogs own their controls, so they write what the exporters read - never the other way
 * round. See docs/architecture/configuration.md
 */
function storeExportPreference(input: HTMLInputElement): void {
  const value = +input.value;
  if (!(value > 0)) return;

  Options.set(o => {
    const { tiles } = o.app.export;
    if (input.dataset.stored === "pngResolution") o.app.export.pngResolution = value;
    else if (input.dataset.stored === "tileCols") tiles.cols = value;
    else if (input.dataset.stored === "tileRows") tiles.rows = value;
    else if (input.dataset.stored === "tileScale") tiles.scale = value;
  });
}

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const rowLabel = (row: number) =>
  (row >= ROW_LABELS.length ? ROW_LABELS[Math.floor(row / ROW_LABELS.length) - 1] : "") +
  ROW_LABELS[row % ROW_LABELS.length];

/** Report the total pixel size of the tile set and outline the tiles over the map */
function updateTilesOptions(): void {
  const { cols: columns, rows, scale } = options.app.export.tiles;

  const sizeX = options.map.graph.width * scale * columns;
  const sizeY = options.map.graph.height * scale * rows;
  const totalSize = sizeX * sizeY;

  const tileSize = ensureEl("tileSize");
  tileSize.innerHTML = `${sizeX} x ${sizeY} px`;
  tileSize.style.color = totalSize > 1e9 ? "#d00b0b" : totalSize > 1e8 ? "#9e6409" : "#1a941a";

  const tileWidth = (options.map.graph.width / columns) | 0;
  const tileHeight = (options.map.graph.height / rows) | 0;
  const rects: string[] = [];
  const labels: string[] = [];

  for (let y = 0, row = 0; y + tileHeight <= options.map.graph.height; y += tileHeight, row++) {
    for (let x = 0, column = 1; x + tileWidth <= options.map.graph.width; x += tileWidth, column++) {
      rects.push(`<rect x=${x} y=${y} width=${tileWidth} height=${tileHeight} />`);
      const label = `${rowLabel(row)}${column}`;
      labels.push(`<text x=${x + tileWidth / 2} y=${y + tileHeight / 2}>${label}</text>`);
    }
  }

  select("#debug").html(/* html */ `<g fill="none" stroke="#000">${rects.join("")}</g>
    <g fill="#000" stroke="none" text-anchor="middle" dominant-baseline="central" font-size="18px">${labels.join("")}</g>`);
}

// the map-file input is owned here, but keeps its id: automation and external tools drive it directly
const mapInput = createFileInput(".map,.gz");
mapInput.id = "mapToLoad";
mapInput.onchange = () => {
  const file = mapInput.files?.[0];
  mapInput.value = "";
  closeDialogs();
  if (file) void Services.Load.uploadMap(file);
};

/** Ask for a map file; the input and its single listener live for the page */
export function pickMapFile(): void {
  mapInput.click();
}

function initialize(): void {
  ensureEl("dialogs").insertAdjacentHTML("afterbegin", TEMPLATE);
  for (const id of ["exportMapData", "saveMapData", "loadMapData"]) {
    ensureEl(id).addEventListener("click", event => {
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action) ACTIONS[action]?.(event);
    });
  }

  // the image scale lives in the export dialog, and the tile controls wire themselves when it opens
  for (const input of document.querySelectorAll<HTMLInputElement>('[data-stored="pngResolution"]')) {
    input.addEventListener("input", () => {
      for (const paired of document.querySelectorAll<HTMLInputElement>('[data-stored="pngResolution"]')) {
        paired.value = input.value;
      }
      storeExportPreference(input);
    });
  }

  ensureEl("showLabels").addEventListener("change", function (this: HTMLInputElement) {
    Options.set(o => (o.app.labels.showAll = this.checked));
    Layers.draw("labels");
  });

  ensureEl("loadMapFromMachine").addEventListener("click", pickMapFile);
}

initialize();

export { loadURL, openExportToPngTiles, showExportPane, showLoadPane, showSavePane };
