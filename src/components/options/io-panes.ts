// The Save, Export and Load dialogs behind the sticked menu, plus the tile-export screen
import { select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Services } from "@/services";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

const closeButton = {
  Close: function (this: HTMLElement) {
    $(this).dialog("close");
  }
};

function showSavePane(): void {
  $("#saveMapData").dialog({
    title: "Save map",
    resizable: false,
    width: "25em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: closeButton
  });
}

function showExportPane(): void {
  ensureEl<HTMLInputElement>("showLabels").checked = options.labels.showAll;

  $("#exportMapData").dialog({
    title: "Export map data",
    resizable: false,
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    buttons: closeButton
  });
}

async function showLoadPane(): Promise<void> {
  $("#loadMapData").dialog({
    title: "Load map",
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
  fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Loading...</option>`;

  const files = await Services.Cloud.list();
  if (!files) {
    buttons.style.display = "none";
    fileSelect.innerHTML = /* html */ `<option value="" disabled selected>Save files to Dropbox first</option>`;
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
  navigator.clipboard.writeText(link).then(() => tip("Link is copied to the clipboard", true, "success", 8000));
}

const URL_PATTERN = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;

function loadURL(): void {
  ensureEl("alertMessage").innerHTML = /* html */ `Provide URL to map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map" />
    <br /><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to
    Dropbox and provide a direct link</i>`;

  $("#alert").dialog({
    resizable: false,
    title: "Load map from URL",
    width: "27em",
    buttons: {
      Load: function (this: HTMLElement) {
        const value = ensureEl<HTMLInputElement>("mapURL").value;
        if (!URL_PATTERN.test(value)) return tip("Please provide a valid URL", false, "error");
        void Services.Load.loadMapFromURL(value);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
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
    title: "Download tiles",
    width: "23em",
    buttons: {
      Download: () => Services.ExportMap.exportToPngTiles(),
      Cancel: function (this: HTMLElement) {
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
  updateTilesOptions();
}

const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const rowLabel = (row: number) =>
  (row >= ROW_LABELS.length ? ROW_LABELS[Math.floor(row / ROW_LABELS.length) - 1] : "") +
  ROW_LABELS[row % ROW_LABELS.length];

/** Report the total pixel size of the tile set and outline the tiles over the map */
function updateTilesOptions(): void {
  const columns = +ensureEl<HTMLOutputElement>("tileColsOutput").value || 2;
  const rows = +ensureEl<HTMLOutputElement>("tileRowsOutput").value || 2;
  const scale = +ensureEl<HTMLOutputElement>("tileScaleOutput").value || 1;

  const sizeX = graphWidth * scale * columns;
  const sizeY = graphHeight * scale * rows;
  const totalSize = sizeX * sizeY;

  const tileSize = ensureEl("tileSize");
  tileSize.innerHTML = `${sizeX} x ${sizeY} px`;
  tileSize.style.color = totalSize > 1e9 ? "#d00b0b" : totalSize > 1e8 ? "#9e6409" : "#1a941a";

  const tileWidth = (graphWidth / columns) | 0;
  const tileHeight = (graphHeight / rows) | 0;
  const rects: string[] = [];
  const labels: string[] = [];

  for (let y = 0, row = 0; y + tileHeight <= graphHeight; y += tileHeight, row++) {
    for (let x = 0, column = 1; x + tileWidth <= graphWidth; x += tileWidth, column++) {
      rects.push(`<rect x=${x} y=${y} width=${tileWidth} height=${tileHeight} />`);
      const label = `${rowLabel(row)}${column}`;
      labels.push(`<text x=${x + tileWidth / 2} y=${y + tileHeight / 2}>${label}</text>`);
    }
  }

  select("#debug").html(/* html */ `<g fill="none" stroke="#000">${rects.join("")}</g>
    <g fill="#000" stroke="none" text-anchor="middle" dominant-baseline="central" font-size="18px">${labels.join("")}</g>`);
}

function initialize(): void {
  ensureEl("showLabels").addEventListener("change", function (this: HTMLInputElement) {
    options.labels.showAll = this.checked;
    Layers.draw("labels");
  });

  ensureEl("mapToLoad").addEventListener("change", function (this: HTMLInputElement) {
    const file = this.files?.[0];
    this.value = "";
    closeDialogs();
    if (file) void Services.Load.uploadMap(file);
  });
}

initialize();

export { showExportPane, showLoadPane, showSavePane };

// Legacy seam: the save/load/export dialogs still live in index.html and wire these inline
declare global {
  interface Window {
    connectToDropbox: typeof connectToDropbox;
    copyLinkToClipboard: typeof copyLinkToClipboard;
    loadURL: typeof loadURL;
    openExportToPngTiles: typeof openExportToPngTiles;
    exportToJson: typeof import("@/services/io/export-json").ExportJson.exportToJson;
  }
}
window.connectToDropbox = connectToDropbox;
window.copyLinkToClipboard = copyLinkToClipboard;
window.loadURL = loadURL;
window.openExportToPngTiles = openExportToPngTiles;
window.exportToJson = type => Services.ExportJson.exportToJson(type);
