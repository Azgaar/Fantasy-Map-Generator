import { stored } from "@/utils/preferences";

const storedValue = (key: string, fallback: string) => stored(key) ?? fallback;

export function createSaveMapDialog(): HTMLDivElement {
  const content = createDialog("saveMapData");
  content.innerHTML = /* html */ `<div style="margin-top: 0.3em"><strong>Save map to</strong>
      <button data-save-method="machine" data-tip="Download map file to your local disk" data-shortcut="Ctrl + S" style="font-weight: 600">machine</button>
      <button data-save-method="dropbox" data-tip="Save map file to your Dropbox" data-shortcut="Ctrl + C">dropbox</button>
      <button data-save-method="storage" data-tip="Save the project to browser storage only" data-shortcut="F6">browser</button>
    </div>
    <p>Maps are saved in <i>.map</i> format and can be loaded back through the Load menu. Keep backups on your machine or cloud storage.</p>`;
  return content;
}

export function createExportMapDialog(): HTMLDivElement {
  const content = createDialog("exportMapData");
  content.innerHTML = /* html */ `<div style="margin-bottom: 0.3em; font-weight: bold">Download image</div>
    <div>
      <button data-export-map="png" data-tip="Download visible part of the map as .png">.png</button>
      <button data-export-map="jpeg" data-tip="Download visible part of the map as .jpeg">.jpeg</button>
      <button id="openExportToPngTiles" data-tip="Split map into PNG tiles and download a zip archive">tiles</button>
      <span data-tip="Check to not automatically hide labels"><input id="showLabels" class="checkbox" type="checkbox" /><label for="showLabels" class="checkbox-label">Show all labels</label></span>
    </div>
    <div data-tip="Scale of saved PNG/JPEG image" style="margin-bottom: 0.3em">PNG / JPEG scale:
      <input id="pngResolutionInput" data-stored="pngResolution" type="range" min="1" max="8" value="${storedValue("pngResolution", "1")}" style="width: 10em" />
      <input id="pngResolutionOutput" data-stored="pngResolution" type="number" min="1" max="8" value="${storedValue("pngResolution", "1")}" />
    </div>
    <p>Generator uses a pop-up window to download files. Ensure the browser does not block pop-ups.</p>
    <div style="margin: 1em 0 0.3em; font-weight: bold">Export to GeoJSON</div>
    <div><button data-export-geo="cells">cells</button><button data-export-geo="routes">routes</button><button data-export-geo="rivers">rivers</button><button data-export-geo="markers">markers</button><button data-export-geo="zones">zones</button></div>
    <div style="margin: 1em 0 0.3em; font-weight: bold">Export to JSON</div>
    <div><button data-export-json="Full">full</button><button data-export-json="Minimal">minimal</button><button data-export-json="PackCells">pack cells</button><button data-export-json="GridCells">grid cells</button></div>
    <p>Exported JSON can be used as an API replacement.</p>`;
  return content;
}

export function createLoadMapDialog(): HTMLDivElement {
  const content = createDialog("loadMapData");
  content.innerHTML = /* html */ `<div><strong>Load map from</strong>
      <button data-load-method="machine" data-tip="Load a .map or .gz file from local disk">machine</button>
      <button id="loadMapFromUrl" data-tip="Load a .map or .gz file from URL">URL</button>
      <button data-load-method="storage" data-tip="Load the last map from browser storage">storage</button>
    </div>
    <p>Click storage to open the last saved map.</p>
    <div id="loadFromDropbox"><p style="margin-bottom: 0.3em">Or load from your Dropbox account <button id="dropboxConnectButton">Connect</button></p>
      <select id="loadFromDropboxSelect" style="width: 22em"></select>
      <div id="loadFromDropboxButtons" style="margin-bottom: 0.6em"><button data-dropbox-action="load">Load</button><button data-dropbox-action="share">Share</button></div>
      <div id="sharableLinkContainer" style="display: none"><a id="sharableLink" target="_blank"></a><i id="copySharableLink" class="icon-clone pointer"></i></div>
    </div>`;
  return content;
}

export function createPngTilesDialog(): HTMLDivElement {
  const content = createDialog("exportToPngTilesScreen");
  content.innerHTML = /* html */ `<p>Map will be split into tiles and downloaded as a single zip file. Avoid saving too large images.</p>
    ${tileControl("Columns", "tileCols", 2, 26, storedValue("tileCols", "8"))}
    ${tileControl("Rows", "tileRows", 2, 26, storedValue("tileRows", "8"))}
    ${tileControl("Scale", "tileScale", 1, 4, storedValue("tileScale", "1"))}
    <div data-tip="Calculated combined image size" style="margin-bottom: 0.3em"><div class="label">Total size:</div><div id="tileSize" style="display: inline-block">1000 x 1000 px</div></div>
    <div id="tileStatus" style="font-style: italic"></div>`;
  return content;
}

function createDialog(id: string): HTMLDivElement {
  const content = document.createElement("div");
  content.id = id;
  return content;
}

function tileControl(label: string, id: string, min: number, max: number, value: string): string {
  return /* html */ `<div data-tip="${label}" style="margin-bottom: 0.3em"><div class="label">${label}:</div>
    <input id="${id}Input" data-stored="${id}" type="range" min="${min}" max="${max}" value="${value}" style="width: 10em" />
    <input id="${id}Output" data-stored="${id}" type="number" min="${min}" value="${value}" /></div>`;
}
