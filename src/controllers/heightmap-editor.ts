import { drag, easeSinInOut, hsl, interpolateRound, lab, leastIndex, max, mean, pointer, range, select } from "d3";
import { Controllers } from "@/controllers";
import { Labels } from "@/generators/labels";
import {
  destroyDialogIfExists,
  ensureEl,
  findEl,
  findGridAll,
  findGridCell,
  generateSeed,
  getGridPolygon,
  last,
  lim,
  link,
  minmax,
  rn,
  unique
} from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

// Legacy app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor). TODO: replace with dialog
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;
let defaultCellTypeFilter: "all" | "land" | "water" = "all";

function open(options?: { mode?: string; tool?: string }): void {
  const { mode, tool } = options || {};
  restartHistory();
  select<SVGElement, unknown>("#viewbox").selectAll("#heights").remove();
  select<SVGElement, unknown>("#viewbox").insert("g", "#terrs").attr("id", "heights");

  if (!mode) showModeDialog(tool);
  else enterHeightmapEditMode(mode, tool);
}

addToolbarListeners();

function renderTemplateEditor(): void {
  destroyDialogIfExists("templateEditor");
  const html = /* html */ `<div id="templateEditor" class="dialog stable">
      <div id="templateTop">
        <i>Select template: </i>
        <select id="templateSelect" style="width: 16em" data-prev="templateCustom" data-tip="Select base template">
          <option value="custom" selected>Custom</option>
          <option value="volcano">Volcano</option>
          <option value="highIsland">High Island</option>
          <option value="lowIsland">Low Island</option>
          <option value="continents">Continents</option>
          <option value="archipelago">Archipelago</option>
          <option value="atoll">Atoll</option>
          <option value="mediterranean">Mediterranean</option>
          <option value="peninsula">Peninsula</option>
          <option value="pangea">Pangea</option>
          <option value="isthmus">Isthmus</option>
          <option value="shattered">Shattered</option>
          <option value="taklamakan">Taklamakan</option>
          <option value="oldWorld">Old World</option>
          <option value="fractious">Fractious</option>
        </select>
      </div>
      <div id="templateTools">
        <button data-type="Hill" data-tip="Hill: small blob">H</button>
        <button data-type="Pit" data-tip="Pit: round depression">P</button>
        <button data-type="Range" data-tip="Range: elongated elevation">R</button>
        <button data-type="Trough" data-tip="Trough: elongated depression">T</button>
        <button data-type="Strait" data-tip="Strait: centered vertical or horizontal depression">S</button>
        <button data-type="Mask" data-tip="Mask: lower cells near edges or in map center">M</button>
        <button data-type="Invert" data-tip="Invert heightmap along the axes">I</button>
        <button data-type="Add" data-tip="Add or subtract value from all heights in range">+</button>
        <button data-type="Multiply" data-tip="Multiply all heights in range by factor">*</button>
        <button
          data-type="Smooth"
          data-tip="Smooth the map replacing cell heights by an average values of its neighbors"
        >
          ~
        </button>
      </div>
      <div id="templateBody" data-changed="0" class="table" style="padding: 2px 0">
        <div data-type="Hill">
          <div class="icon-check" data-tip="Click to skip the step"></div>
          <div style="width: 4em">Hill</div>
          <i class="icon-trash-empty pointer" data-tip="Remove the step"></i>
          <i class="icon-resize-vertical" data-tip="Drag to reorder"></i>
          <span
            >y:<input class="templateY" data-tip="Y axis position in percentage (minY-maxY or Y)" value="47-53"
          /></span>
          <span
            >x:<input class="templateX" data-tip="X axis position in percentage (minX-maxX or X)" value="65-75"
          /></span>
          <span
            >h:<input
              class="templateHeight"
              data-tip="Blob maximum height, use hyphen to get a random number in range"
              value="90-100"
          /></span>
          <span
            >n:<input
              class="templateCount"
              data-tip="Blobs to add, use hyphen to get a random number in range"
              value="1"
          /></span>
        </div>
      </div>
      <div id="templateBottom">
        <button id="templateRun" data-tip="Execute the template" class="icon-play-circled2"></button>
        <button id="templateUndo" data-tip="Undo the latest action" class="icon-ccw" disabled></button>
        <button id="templateRedo" data-tip="Redo the action" class="icon-cw" disabled></button>
        <button id="templateSave" data-tip="Download the template as a text file" class="icon-download"></button>
        <button id="templateLoad" data-tip="Open previously downloaded template" class="icon-upload"></button>
        <button
          id="templateCA"
          data-tip="Find or share custom template on Cartography Assets portal"
          class="icon-drafting-compass"
          onclick="
            openURL('https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/templates')
          "
        ></button>
        <button
          id="templateTutorial"
          data-tip="Open Template Editor Tutorial"
          class="icon-info"
          onclick="wiki('Heightmap-template-editor')"
        ></button>
        <label
          data-tip="Enter seed for template to generate the same heightmap each time"
        >
          Seed: <input id="templateSeed" value="" type="number" min="1" max="999999999" step="1" style="width: 8em" />
        </label>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  const $body = ensureEl("templateBody");

  $("#templateBody").sortable({
    items: "> div",
    handle: ".icon-resize-vertical",
    containment: "#templateBody",
    axis: "y"
  });

  $body.on("click", (ev: Event) => {
    const el = ev.target as HTMLElement;
    if (el.classList.contains("icon-check")) {
      el.classList.remove("icon-check");
      el.classList.add("icon-check-empty");
      (el.parentElement as HTMLElement).style.opacity = "0.5";
      $body.dataset.changed = "1";
      return;
    }
    if (el.classList.contains("icon-check-empty")) {
      el.classList.add("icon-check");
      el.classList.remove("icon-check-empty");
      (el.parentElement as HTMLElement).style.opacity = "1";
      return;
    }
    if (el.classList.contains("icon-trash-empty")) {
      (el.parentElement as HTMLElement).remove();
    }
  });

  ensureEl("templateEditor").on("keypress", (event: Event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      executeTemplate();
    }
  });

  ensureEl("templateTools").on("click", addStepOnClick);
  ensureEl("templateSelect").on("change", selectTemplate);
  ensureEl("templateRun").on("click", executeTemplate);
  ensureEl("templateUndo").on("click", () => restoreHistory(edits.n - 1));
  ensureEl("templateRedo").on("click", () => restoreHistory(edits.n + 1));
  ensureEl("templateSave").on("click", downloadTemplate);
  ensureEl("templateLoad").on("click", () => ensureEl("templateToLoad").click());

  ensureEl<HTMLInputElement>("templateToLoad").onchange = () => {
    uploadFile(ensureEl<HTMLInputElement>("templateToLoad"), uploadTemplate);
  };
}

function renderImageConverter(): void {
  destroyDialogIfExists("imageConverter");
  const editorHtml = /* html */ `<div id="imageConverter" class="dialog stable">
      <div id="convertImageButtons">
        <button id="convertImageLoad" data-tip="Load image to convert" class="icon-upload"></button>
        <button
          id="convertAutoLum"
          data-tip="Auto-assign colors based on liminosity (good for monochrome images)"
          class="icon-adjust"
        ></button>
        <button
          id="convertAutoHue"
          data-tip="Auto-assign colors based on hue (good for colored images)"
          class="icon-paint-roller"
        ></button>
        <button
          id="convertAutoFMG"
          data-tip="Auto-assign colors using generator scheme (for exported colored heightmaps)"
          class="icon-layer-group"
        ></button>
        <button id="convertColorsButton" data-tip="Set maximum number of colors" class="icon-signal"></button>
        <input id="convertColors" value="100" style="display: none" />
        <button
          id="convertCancel"
          data-tip="Cancel the conversion. Previous heightmap will be restored"
          class="icon-cancel"
        ></button>
      </div>
      <div data-tip="Set opacity of the loaded image" style="padding-top: 0.4em">
        <i>Overlay opacity:</i><br />
        <input id="convertOverlay" type="range" min="0" max="1" step=".01" value="0" style="width: 12.6em" />
        <input id="convertOverlayNumber" type="number" min="0" max="1" step=".01" value="0" style="width: 4.2em" />
      </div>
      <div data-tip="Select a color below and assign a height value for it" id="colorsSelect" style="display: none">
        <i>Set height: </i>
        <span id="colorsSelectValue"></span>
        <span>(<span id="colorsSelectFriendly">0</span>)</span><br />
        <div id="imageConverterPalette"></div>
      </div>
      <div data-tip="Select a color to re-assign the height value" id="colorsAssigned" style="display: none">
        <i>Assigned colors (<span id="colorsAssignedNumber"></span>):</i>
        <div id="colorsAssignedContainer" class="colorsContainer"></div>
      </div>
      <div data-tip="Select a color to assign a height value" id="colorsUnassigned" style="display: none">
        <i>Unassigned colors (<span id="colorsUnassignedNumber"></span>):</i>
        <div id="colorsUnassignedContainer" class="colorsContainer"></div>
      </div>
      <button
        id="convertComplete"
        data-tip="Complete the conversion. All unassigned colors will be considered as ocean"
        style="margin: 0.4em 0"
        class="glow"
      >
        Complete the conversion
      </button>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  // add color pallete
  select("#imageConverterPalette")
    .selectAll("div")
    .data(range(101))
    .enter()
    .append("div")
    .attr("data-color", (i: number) => i)
    .style("background-color", (i: number) => color(1 - (i < 20 ? i - 5 : i) / 100))
    .style("width", (i: number) => (i < 40 || i > 68 ? ".2em" : ".1em"))
    .on("touchmove mousemove", showPalleteHeight)
    .on("click", assignHeight);

  ensureEl("convertImageLoad").on("click", () => ensureEl("imageToLoad").click());
  // imageToLoad is a static file input outside the dialog; use property assignment
  // (idempotent, replaces rather than accumulates) so re-rendering doesn't stack listeners.
  ensureEl<HTMLInputElement>("imageToLoad").onchange = () => loadImage.call(ensureEl<HTMLInputElement>("imageToLoad"));
  ensureEl("convertAutoLum").on("click", () => autoAssing("lum"));
  ensureEl("convertAutoHue").on("click", () => autoAssing("hue"));
  ensureEl("convertAutoFMG").on("click", () => autoAssing("scheme"));
  ensureEl("convertColorsButton").on("click", setConvertColorsNumber);
  ensureEl("convertComplete").on("click", applyConversion);
  ensureEl("convertCancel").on("click", cancelConversion);
  ensureEl<HTMLInputElement>("convertOverlay").on("input", function (this: HTMLInputElement) {
    setOverlayOpacity(+this.value);
  });
  ensureEl<HTMLInputElement>("convertOverlayNumber").on("input", function (this: HTMLInputElement) {
    setOverlayOpacity(+this.value);
  });
}

// The toolbar and brushes panel are static in index.html; they're part of the one long-lived
// heightmap-editing session, so listeners are wired once at load rather than per open/close.
let storedLayers: string[] = [];

function addToolbarListeners(): void {
  ensureEl("paintBrushes").on("click", openBrushesPanel);
  ensureEl("applyTemplate").on("click", openTemplateEditor);
  ensureEl("convertImage").on("click", openImageConverter);
  ensureEl("heightmapPreview").on("click", toggleHeightmapPreview);
  ensureEl("heightmap3DView").on("click", changeViewMode);
  ensureEl("finalizeHeightmap").on("click", finalizeHeightmap);
  ensureEl("renderOcean").on("click", mockHeightmap);
}

function showModeDialog(tool?: string): void {
  alertMessage.innerHTML = /* html */ `Heightmap is a core element on which all other data (rivers, burgs, states etc) is based. So the best edit approach is to
    <i>erase</i> the secondary data and let the system automatically regenerate it on edit completion.
    <p><i>Erase</i> mode also allows you Convert an Image into a heightmap or use Template Editor.</p>
    <p>You can <i>keep</i> the data, but you won't be able to change the coastline.</p>
    <p>Try <i>risk</i> mode to change the coastline and keep the data. The data will be restored as much as possible, but it can cause unpredictable errors.</p>
    <p>Please <span class="pseudoLink" onclick="window.Services.Save.saveMap('machine')">save the map</span> before editing the heightmap!</p>
    <p style="margin-bottom: 0">Check out ${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization", "wiki")} for guidance.</p>`;

  $("#alert").dialog({
    resizable: false,
    title: "Edit Heightmap",
    width: "28em",
    buttons: {
      Erase: () => enterHeightmapEditMode("erase", tool),
      Keep: () => enterHeightmapEditMode("keep", tool),
      Risk: () => enterHeightmapEditMode("risk", tool),
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function enterHeightmapEditMode(mode: string, tool?: string): void {
  storedLayers = Array.from(ensureEl("mapLayers").querySelectorAll<HTMLElement>("li:not(.buttonoff)")).map(
    node => node.id
  ); // store layers preset
  storedLayers.forEach(l => {
    ensureEl(l).click(); // turn off all layers
  });

  customization = 1;
  closeDialogs();
  tip('Heightmap edit mode is active. Click on "Exit Customization" to finalize the heightmap', true);

  ensureEl("options")
    .querySelectorAll<HTMLElement>(".tabcontent")
    .forEach(tabcontent => {
      tabcontent.style.display = "none";
    });
  ensureEl("options").querySelector(".tab > .active")!.classList.remove("active");
  ensureEl("customizationMenu").style.display = "block";
  ensureEl("toolsTab").classList.add("active");
  ensureEl("heightmapEditMode").innerHTML = mode;

  if (mode === "erase") {
    undraw();
    defaultCellTypeFilter = "all";
  } else if (mode === "keep") {
    select<SVGElement, unknown>("#viewbox").selectAll("#landmass, #lakes").style("display", "none");
    defaultCellTypeFilter = "land";
  } else if (mode === "risk") {
    select<SVGElement, unknown>("#deftemp").selectAll("#land, #water").selectAll("path").remove();
    select<SVGElement, unknown>("#deftemp").select("#featurePaths").selectAll("path").remove();
    select<SVGElement, unknown>("#viewbox").selectAll("#coastline use, #lakes path, #oceanLayers path").remove();
    defaultCellTypeFilter = "all";
  }
  const cellTypeFilterEl = findEl<HTMLSelectElement>("cellTypeFilter");
  if (cellTypeFilterEl) cellTypeFilterEl.value = defaultCellTypeFilter;

  // show convert and template buttons for Erase mode only
  ensureEl("applyTemplate").style.display = mode === "erase" ? "inline-block" : "none";
  ensureEl("convertImage").style.display = mode === "erase" ? "inline-block" : "none";

  // hide erosion checkbox if mode is Keep
  ensureEl("allowErosionBox").style.display = mode === "keep" ? "none" : "inline-block";

  // show finalize button
  const exitCustomization = ensureEl("exitCustomization");
  if (!sessionStorage.getItem("noExitButtonAnimation")) {
    sessionStorage.setItem("noExitButtonAnimation", "true");
    exitCustomization.style.opacity = "0";
    const width = 12 * +ensureEl<HTMLInputElement>("uiSize").value * 11;
    exitCustomization.style.right = `${(svgWidth - width) / 2}px`;
    exitCustomization.style.bottom = `${svgHeight / 2}px`;
    exitCustomization.style.transform = "scale(2)";
    exitCustomization.style.display = "block";
    select("#exitCustomization")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .transition()
      .duration(2000)
      .ease(easeSinInOut)
      .style("right", "10px")
      .style("bottom", "10px")
      .style("transform", "scale(1)");
  } else exitCustomization.style.display = "block";

  turnButtonOn("toggleHeight");
  const layersPreset = ensureEl<HTMLSelectElement>("layersPreset");
  layersPreset.value = "heightmap";
  layersPreset.disabled = true;
  mockHeightmap();

  select<SVGElement, unknown>("#viewbox").on("touchmove mousemove", moveCursor);
  select<SVGSVGElement, unknown>("#map").on("dblclick.zoom", null);

  if (tool === "templateEditor") openTemplateEditor();
  else if (tool === "imageConverter") openImageConverter();
  else openBrushesPanel();
}

function moveCursor(this: SVGElement, event: any): void {
  const [x, y] = pointer(event, this);
  const cell = findGridCell(x, y, grid);
  ensureEl("heightmapInfoX").innerHTML = String(rn(x));
  ensureEl("heightmapInfoY").innerHTML = String(rn(y));
  ensureEl("heightmapInfoCell").innerHTML = String(cell);
  ensureEl("heightmapInfoHeight").innerHTML = `${grid.cells.h[cell]} (${getFriendlyHeight(grid.cells.h[cell])})`;
  if (ensureEl("tooltip").dataset.main) showMainTip();

  // move radius circle if drag mode is active (brushes panel may not be the open tool)
  const pressed = findEl("brushesButtons")?.querySelector<HTMLElement>("button.pressed");
  if (!pressed) return;

  if (pressed.id === "brushLine") {
    debug.select("line").attr("x2", x).attr("y2", y);
    return;
  }

  if (pressed.id === "brushFill") {
    removeCircle();
    return;
  }

  moveCircle(x, y, ensureEl<HTMLInputElement>("heightmapBrushRadius").valueAsNumber);
}

// get user-friendly (real-world) height value from map data
function getFriendlyHeight(h: number): string {
  const unit = heightUnit.value;
  let unitRatio = 3.281; // default calculations are in feet
  if (unit === "m") unitRatio = 1;
  // if meter
  else if (unit === "f") unitRatio = 0.5468; // if fathom

  let height = -990;
  if (h >= 20) height = (h - 18) ** +heightExponentInput.value;
  else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

  return `${rn(height * unitRatio)} ${unit}`;
}

// Exit customization mode
function finalizeHeightmap(): void {
  if (select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("*").size() < 200) {
    tip("Insufficient land area. There should be at least 200 land cells!", false, "error");
    return;
  }
  if (findEl("imageConverter")) {
    tip("Please exit the Image Conversion mode first", false, "error");
    return;
  }

  window.edits = undefined; // remove global variable
  setHistoryButtonsDisabled(true, true);

  customization = 0;
  ensureEl("customizationMenu").style.display = "none";
  if (ensureEl("options").querySelector<HTMLElement>(".tab > button.active")!.id === "toolsTab")
    ensureEl("toolsContent").style.display = "block";
  ensureEl<HTMLSelectElement>("layersPreset").disabled = false;
  ensureEl("exitCustomization").style.display = "none"; // hide finalize button

  restoreDefaultEvents();
  clearMainTip();
  closeDialogs();
  resetZoom();

  document.getElementById("preview")?.remove();
  if (document.getElementById("canvas3d")) void Controllers.View3d.enterStandard();

  const mode = ensureEl("heightmapEditMode").innerHTML;
  if (mode === "erase") regenerateErasedData();
  else if (mode === "keep") restoreKeptData();
  else if (mode === "risk") restoreRiskedData();

  // restore initial layers
  drawFeatures();
  select<SVGElement, unknown>("#viewbox").selectAll("#heights").remove();

  turnButtonOff("toggleHeight");
  ensureEl("mapLayers")
    .querySelectorAll<HTMLElement>("li")
    .forEach(e => {
      const wasOn = storedLayers.includes(e.id);
      if ((wasOn && !layerIsOn(e.id)) || (!wasOn && layerIsOn(e.id))) e.click();
    });
  if (!layerIsOn("toggleBorders")) borders.selectAll("path").remove();
  if (!layerIsOn("toggleStates")) regions.selectAll("path").remove();
  if (!layerIsOn("toggleRivers")) rivers.selectAll("*").remove();

  getCurrentPreset();
}

function regenerateErasedData(): void {
  INFO && console.group("Edit Heightmap");
  TIME && console.time("regenerateErasedData");

  // remove data
  pack.cultures = [];
  pack.burgs = [];
  pack.states = [];
  pack.provinces = [];
  pack.religions = [];

  const erosionAllowed = ensureEl<HTMLInputElement>("allowErosion").checked;
  Features.markupGrid();
  if (erosionAllowed) {
    addLakesInDeepDepressions();
    openNearSeaLakes();
  }
  OceanLayers();
  calculateTemperatures();
  generatePrecipitation();
  reGraph();
  Features.markupPack();

  Rivers.generate(erosionAllowed);

  if (!erosionAllowed) {
    for (const i of pack.cells.i) {
      const g = pack.cells.g[i];
      if (pack.cells.h[i] !== grid.cells.h[g] && pack.cells.h[i] >= 20 === grid.cells.h[g] >= 20)
        pack.cells.h[i] = grid.cells.h[g];
    }
  }

  Biomes.define();
  Features.defineGroups();

  Goods.generate();

  rankCells();
  Cultures.generate();
  Cultures.expand();

  Burgs.generate();
  States.generate();
  Routes.generate();
  Religions.generate();

  Burgs.specify();
  States.collectStatistics();
  States.defineStateForms();

  Provinces.generate();
  Provinces.getPoles();

  Labels.generate();
  Rivers.specify();
  Lakes.defineNames();

  Markets.generate();
  Production.produce();
  States.collectTaxes();

  Ice.generate();

  Military.generate();
  Markers.generate();
  Zones.generate();
  TIME && console.timeEnd("regenerateErasedData");
  INFO && console.groupEnd();
}

function restoreKeptData(): void {
  select<SVGElement, unknown>("#viewbox").selectAll("#landmass, #lakes").style("display", null);
  for (const i of pack.cells.i) {
    pack.cells.h[i] = grid.cells.h[pack.cells.g[i]];
  }
}

function restoreRiskedData(): void {
  INFO && console.group("Edit Heightmap");
  TIME && console.time("restoreRiskedData");
  const erosionAllowed = ensureEl<HTMLInputElement>("allowErosion").checked;

  // assign pack data to grid cells
  const l = grid.cells.i.length;
  const biome = new Uint8Array(l);
  const pop = new Uint16Array(l);
  const routes: Record<number, any> = {};
  const s = new Uint16Array(l);
  const burg = new Uint16Array(l);
  const state = new Uint16Array(l);
  const province = new Uint16Array(l);
  const culture = new Uint16Array(l);
  const religion = new Uint16Array(l);
  const good = new Uint16Array(l);

  // rivers data, stored only if allowErosion is unchecked
  const fl = new Uint16Array(l);
  const r = new Uint16Array(l);
  const conf = new Uint8Array(l);

  for (const i of pack.cells.i) {
    const g = pack.cells.g[i];
    biome[g] = pack.cells.biome[i];
    culture[g] = pack.cells.culture[i];
    pop[g] = pack.cells.pop[i];
    routes[g] = pack.cells.routes[i];
    s[g] = pack.cells.s[i];
    state[g] = pack.cells.state[i];
    province[g] = pack.cells.province[i];
    burg[g] = pack.cells.burg[i];
    religion[g] = pack.cells.religion[i];
    good[g] = pack.cells.good?.[i] || 0;

    if (!erosionAllowed) {
      fl[g] = pack.cells.fl[i];
      r[g] = pack.cells.r[i];
      conf[g] = pack.cells.conf[i];
    }
  }

  // do not allow to remove land with burgs
  for (const i of grid.cells.i) {
    if (!burg[i]) continue;
    if (grid.cells.h[i] < 20) grid.cells.h[i] = 20;
  }

  // save culture centers x and y to restore center cell id after re-graph
  for (const c of pack.cultures) {
    if (!c.i || c.removed) continue;
    const p = pack.cells.p[c.center!];
    c.x = p[0];
    c.y = p[1];
  }

  // save zone grid cells to restore them later
  const zoneGridCellsMap = new Map<number, number[]>();
  for (const zone of pack.zones) {
    if (!zone.cells?.length) continue;
    const zoneGridCells = zone.cells.map(i => pack.cells.g[i]);
    zoneGridCellsMap.set(zone.i, unique(zoneGridCells));
  }

  Features.markupGrid();
  if (erosionAllowed) addLakesInDeepDepressions();
  OceanLayers();
  calculateTemperatures();
  generatePrecipitation();
  reGraph();
  Features.markupPack();

  if (erosionAllowed) {
    Rivers.generate(true);
    Features.defineGroups();
  }

  // assign saved pack data from grid back to pack
  const n = pack.cells.i.length;
  pack.cells.pop = new Float32Array(n);
  pack.cells.routes = {};
  pack.cells.s = new Uint16Array(n);
  pack.cells.burg = new Uint16Array(n);
  pack.cells.state = new Uint16Array(n);
  pack.cells.province = new Uint16Array(n);
  pack.cells.culture = new Uint16Array(n);
  pack.cells.religion = new Uint16Array(n);
  pack.cells.biome = new Uint8Array(n);
  pack.cells.good = new Uint16Array(n);

  if (!erosionAllowed) {
    pack.cells.r = new Uint16Array(n);
    pack.cells.conf = new Uint8Array(n);
    pack.cells.fl = new Uint16Array(n);
  }

  for (const i of pack.cells.i) {
    const g = pack.cells.g[i];
    const isLandCell = pack.cells.h[i] >= 20;

    // rivers data
    if (!erosionAllowed) {
      pack.cells.r[i] = r[g];
      pack.cells.conf[i] = conf[g];
      pack.cells.fl[i] = fl[g];
    }

    // check biome
    pack.cells.biome[i] =
      isLandCell && biome[g]
        ? biome[g]
        : Biomes.getId(grid.cells.prec[g], grid.cells.temp[g], pack.cells.h[i], Boolean(pack.cells.r[i]));

    pack.cells.good[i] = good[g]; // goods can sit on water cells (e.g. fish), so restore before the land check

    if (!isLandCell) continue;
    pack.cells.culture[i] = culture[g];
    pack.cells.pop[i] = pop[g];
    pack.cells.routes[i] = routes[g];
    pack.cells.s[i] = s[g];
    pack.cells.state[i] = state[g];
    pack.cells.province[i] = province[g];
    pack.cells.religion[i] = religion[g];
  }

  // find closest land cell to burg
  const findBurgCell = (x: number, y: number): number => {
    const i = findCell(x, y)!;
    if (pack.cells.h[i] >= 20) return i;
    const dist = pack.cells.c[i].map(c =>
      pack.cells.h[c] < 20 ? Infinity : (pack.cells.p[c][0] - x) ** 2 + (pack.cells.p[c][1] - y) ** 2
    );
    return pack.cells.c[i][leastIndex(dist)!];
  };

  // find best cell for burgs
  for (const b of pack.burgs) {
    if (!b.i || b.removed) continue;
    b.cell = findBurgCell(b.x, b.y);
    b.feature = pack.cells.f[b.cell];

    pack.cells.burg[b.cell] = b.i;
    if (!b.capital && pack.cells.h[b.cell] < 20) Burgs.remove(b.i);
    if (b.capital) pack.states[b.state!].center = b.cell;
  }

  for (const p of pack.provinces) {
    if (!p.i || p.removed) continue;
    const provCells = pack.cells.i.filter(i => pack.cells.province[i] === p.i);
    if (!provCells.length) {
      const state = p.state;
      const stateProvs = pack.states[state].provinces!;
      if (stateProvs.includes(p.i)) pack.states[state].provinces!.splice(stateProvs.indexOf(p.i), 1);

      p.removed = true;
      continue;
    }

    if (p.burg && !pack.burgs[p.burg].removed) p.center = pack.burgs[p.burg].cell;
    else {
      p.center = provCells[0];
      p.burg = pack.cells.burg[p.center];
    }
  }

  for (const c of pack.cultures) {
    if (!c.i || c.removed) continue;
    c.center = findCell(c.x!, c.y!)!;
  }

  if (erosionAllowed) {
    Rivers.specify();
    Lakes.defineNames();
  }

  const gridToPackMap = new Map<number, number[]>();
  for (const i of pack.cells.i) {
    const g = pack.cells.g[i];
    if (!gridToPackMap.has(g)) gridToPackMap.set(g, []);
    gridToPackMap.get(g)!.push(i);
  }

  // restore zone cells
  for (const zone of pack.zones) {
    const gridCells = zoneGridCellsMap.get(zone.i);
    if (gridCells?.length) {
      const packCells = gridCells.flatMap(g => gridToPackMap.get(g) || []);
      zone.cells = unique(packCells);
    } else {
      zone.cells = [];
    }
  }

  // restore economy: keep the existing goods and markets, then recompute
  if (pack.goods?.length) {
    pack.markets = (pack.markets || []).filter(market => {
      const centerBurg = pack.burgs[market.centerBurgId];
      return Boolean(centerBurg && !centerBurg.removed);
    });
    regenerateEconomy();
  } else {
    Goods.generate();
    Markets.generate();
    Production.produce();
    States.collectTaxes();
  }

  // recalculate ice
  Ice.generate();
  ice.selectAll("*").remove();

  TIME && console.timeEnd("restoreRiskedData");
  INFO && console.groupEnd();
}

// trigger heightmap redraw and history update if at least 1 cell is changed
function updateHeightmap(): void {
  const prev = last(edits) as number[];
  const changed = grid.cells.h.reduce((s: number, h: number, i: number) => (h !== prev[i] ? s + 1 : s), 0);
  tip(`Cells changed: ${changed}`);
  if (!changed) return;

  const cellTypeFilter = findEl<HTMLSelectElement>("cellTypeFilter")?.value ?? defaultCellTypeFilter;
  // check ocean cells are not changed if only land edit is allowed
  if (cellTypeFilter === "land") {
    for (const i of grid.cells.i) {
      if (prev[i] < 20 || grid.cells.h[i] < 20) grid.cells.h[i] = prev[i];
    }
  }

  // check land cells are not changed if only water edit is allowed
  if (cellTypeFilter === "water") {
    for (const i of grid.cells.i) {
      if (prev[i] >= 20 || grid.cells.h[i] >= 20) grid.cells.h[i] = prev[i];
    }
  }

  mockHeightmap();
  updateHistory();
}

function getColor(value: number, scheme = getColorScheme("bright")): string {
  return scheme(1 - (value < 20 ? value - 5 : value) / 100);
}

// draw or update heightmap
function mockHeightmap(): void {
  const data: number[] = ensureEl<HTMLInputElement>("renderOcean").checked
    ? grid.cells.i
    : grid.cells.i.filter((i: number) => grid.cells.h[i] >= 20);

  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll<SVGPolygonElement, number>("polygon")
    .data<number>(data)
    .join("polygon")
    .attr("points", (d: number) => getGridPolygon(d, grid))
    .attr("id", (d: number) => `cell${d}`)
    .attr("fill", (d: number) => getColor(grid.cells.h[d]));
}

// draw or update heightmap for a selection of cells
function mockHeightmapSelection(selection: number[]): void {
  const ocean = ensureEl<HTMLInputElement>("renderOcean").checked;

  selection.forEach(i => {
    let cell: any = select<SVGElement, unknown>("#viewbox").select("#heights").select(`#cell${i}`);
    if (!ocean && grid.cells.h[i] < 20) {
      cell.remove();
      return;
    }

    if (!cell.size())
      cell = select<SVGElement, unknown>("#viewbox")
        .select("#heights")
        .append("polygon")
        .attr("points", getGridPolygon(i, grid))
        .attr("id", `cell${i}`);
    cell.attr("fill", getColor(grid.cells.h[i]));
  });
}

function updateStatistics(): void {
  const landCells = grid.cells.h.reduce((s: number, h: number) => (h >= 20 ? s + 1 : s), 0);
  ensureEl("landmassCounter").innerText = `${landCells} (${rn((landCells / grid.cells.i.length) * 100)}%)`;
  ensureEl("landmassAverage").innerText = String(rn(mean(grid.cells.h) ?? 0));
}

// the brushes panel's and template editor's undo/redo buttons only exist once rendered,
// which happens after a heightmap edit mode is chosen — so they must be looked up defensively
function setHistoryButtonsDisabled(undo: boolean, redo: boolean): void {
  const setPair = (undoId: string, redoId: string) => {
    const undoEl = findEl<HTMLButtonElement>(undoId);
    if (undoEl) undoEl.disabled = undo;
    const redoEl = findEl<HTMLButtonElement>(redoId);
    if (redoEl) redoEl.disabled = redo;
  };
  setPair("undo", "redo");
  setPair("templateUndo", "templateRedo");
}

function updateHistory(noStat?: string): void {
  const step = edits.n;
  edits = edits.slice(0, step);
  edits[step] = grid.cells.h.slice();
  edits.n = step + 1;

  setHistoryButtonsDisabled(edits.n <= 1, true);
  if (!noStat) {
    updateStatistics();
    if (document.getElementById("preview")) drawHeightmapPreview();
    if (document.getElementById("canvas3d")) Controllers.View3d.redraw();
  }
}

// restoreHistory
function restoreHistory(step: number): void {
  edits.n = step;
  setHistoryButtonsDisabled(edits.n <= 1, edits.n >= edits.length);
  if (edits[edits.n - 1] === undefined) return;
  grid.cells.h = edits[edits.n - 1].slice();
  mockHeightmap();
  updateStatistics();

  if (document.getElementById("preview")) drawHeightmapPreview();
  if (document.getElementById("canvas3d")) Controllers.View3d.redraw();
}

// restart edits from 1st step
function restartHistory(): void {
  window.edits = []; // declare temp global variable
  edits.n = 0;
  setHistoryButtonsDisabled(true, true);
  updateHistory();
}

function openBrushesPanel(): void {
  if (document.getElementById("brushesPanel")) return;
  renderBrushesPanel();

  $("#brushesPanel").dialog({
    title: "Paint Brushes",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: closeBrushesPanel
  });
}

function renderBrushesPanel(): void {
  destroyDialogIfExists("brushesPanel");

  const html = /* html */ `<div id="brushesPanel" class="dialog stable">
    <div id="brushesButtons" style="display: inline-block">
      <button id="brushRaise" data-tip="Raise brush: increase height of cells in radius by Power value">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="m20,39 h60 M50,85 v-35 l-12,8 m12,-8 l12,8" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushElevate" data-tip="Elevate brush: drag to gradually increase height of cells in radius by Power value">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="m20,50 q30,-35 60,0 M50,85 v-35 l-12,8 m12,-8 l12,8" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushLower" data-tip="Lower brush: drag to decrease height of cells in radius by Power value">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="M50,30 v35 l-12,-8 m12,8 l12,-8 M20,78 h60" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushDepress" data-tip="Depress brush: drag to gradually decrease height of cells in radius by Power value">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="M50,30 v35 l-12,-8 m12,8 l12,-8 M20,63 q30,35 60,0" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushAlign" data-tip="Align brush: drag to set height of cells in radius to height of the cell at mousepoint">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="m20,50 h56 m0,20 h-56" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushSmooth" data-tip="Smooth brush: drag to level height of cells in radius to height of adjacent cells">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="m15,60 q15,-15 30,0 q15,15 35,0" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushDisrupt" data-tip="Disrupt brush: drag to randomize height of cells in radius based on Power value">
        <svg viewBox="15 15 70 70" height="1em" width="1.6em">
          <path d="m15,63 l15,-13 15,20 15,-20 15,19 15,-14" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushFill" data-tip="Fill: click enclosed water or same-height land area to create a cone blob">
        <svg viewBox="20 10 60 60" height="1em" width="1.6em">
          <path d="M30,70 h40 M30,70 q0,-20 20,-20 q20,0 20,20" fill="none" stroke="#000" stroke-width="5" />
          <path d="M50,20 v25 M50,20 l-10,8 M50,20 l10,8" fill="none" stroke="#000" stroke-width="5" />
        </svg>
      </button>
      <button id="brushLine" data-tip="Line: select two points to change heights along the line">
        <svg viewBox="0 -5 100 100" height="1em" width="1.6em">
          <path d="M0 90 L100 10" fill="none" stroke="#000" stroke-width="7"></path>
        </svg>
      </button>
    </div>
    <div id="brushesSliders" style="display: none">
      <div data-tip="Change brush size. Shortcut: + to increase; – to decrease">
        <slider-input id="heightmapBrushRadius" min="1" max="100" value="25">
          <div style="width: 3.5em">Radius:</div>
        </slider-input>
      </div>
      <div data-tip="Change brush power">
        <slider-input id="heightmapBrushPower" min="1" max="10" value="5">
          <div style="width: 3.5em">Power:</div>
        </slider-input>
      </div>
    </div>
    <div id="lineSlider" style="display: none">
      <div data-tip="Change tool power. Shortcut: + to increase; – to decrease">
        <slider-input id="heightmapLinePower" min="-100" max="100" value="30">
          <div style="width: 5.5em">Power:</div>
        </slider-input>
      </div>
      <div data-tip="Change line randomness. Zero makes the line as straight as possible">
        <slider-input id="heightmapLineRandomness" min="0" max="100" value="30">
          <div style="width: 5.5em">Randomness:</div>
        </slider-input>
      </div>
    </div>
    <div data-tip="Restrict brush to specific cell types" style="margin-bottom: 0.6em">
      <label for="cellTypeFilter"><i>Cells to change:</i></label>
      <select id="cellTypeFilter">
        <option value="all" ${defaultCellTypeFilter === "all" ? "selected" : ""}>all cells</option>
        <option value="land" ${defaultCellTypeFilter === "land" ? "selected" : ""}>only land cells</option>
        <option value="water" ${defaultCellTypeFilter === "water" ? "selected" : ""}>only water cells</option>
      </select>
    </div>
    <div id="modifyButtons">
      <button id="undo" data-tip="Undo the latest action (Ctrl + Z)" class="icon-ccw" disabled></button>
      <button id="redo" data-tip="Redo the action (Ctrl + Y)" class="icon-cw" disabled></button>
      <button id="rescaleShow" data-tip="Show rescaler slider" class="icon-exchange"></button>
      <button id="rescaleCondShow" data-tip="Rescaler: change height if condition is fulfilled" class="icon-if"></button>
      <button id="smoothHeights" data-tip="Smooth all heights a bit" class="icon-smooth"></button>
      <button id="disruptHeights" data-tip="Disrupt (randomize) heights a bit" class="icon-disrupt"></button>
      <button id="brushClear" data-tip="Set height for all cells to 0 (erase the map)" class="icon-eraser"></button>
    </div>
    <div id="rescaleSection" style="display: none">
      <button id="rescaleHide" data-tip="Hide rescaler slider" class="icon-exchange"></button>
      <input id="rescaler" data-tip="Change height for all cells" type="range" min="-10" max="10" step="1" value="0" />
    </div>
    <div
      id="rescaleCondSection"
      data-tip="If height is greater or equal to X and less or equal to Y, then perform an operation Z with operand V"
      style="display: none"
    >
      <button id="rescaleCondHide" data-tip="Hide rescaler" class="icon-if"></button>
      <label>h ≥</label>
      <input id="rescaleLower" value="20" type="number" min="0" max="100" />
      <label>≤</label>
      <input id="rescaleHigher" value="100" type="number" min="1" max="100" />
      <label>⇒</label>
      <select id="conditionSign">
        <option value="multiply" selected>×</option>
        <option value="divide">÷</option>
        <option value="add">+</option>
        <option value="subtract">-</option>
        <option value="exponent">^</option>
      </select>
      <input id="rescaleModifier" type="number" value="0.9" min="0" max="1.5" step="0.01" />
      <button id="rescaleExecute" data-tip="Click to perform an operation" class="icon-play-circled2"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  addBrushesListeners();
}

function closeBrushesPanel(): void {
  exitBrushMode();
  destroyDialogIfExists("brushesPanel");
}

function addBrushesListeners(): void {
  ensureEl("brushesButtons").on("click", toggleBrushMode);
  ensureEl("cellTypeFilter").on("change", cellTypeFilterChange);
  ensureEl("undo").on("click", () => restoreHistory(edits.n - 1));
  ensureEl("redo").on("click", () => restoreHistory(edits.n + 1));
  ensureEl("rescaleShow").on("click", () => {
    ensureEl("modifyButtons").style.display = "none";
    ensureEl("rescaleSection").style.display = "block";
  });
  ensureEl("rescaleHide").on("click", () => {
    ensureEl("modifyButtons").style.display = "block";
    ensureEl("rescaleSection").style.display = "none";
  });
  ensureEl("rescaler").on("change", (e: Event) => rescale((e.target as HTMLInputElement).valueAsNumber));
  ensureEl("rescaleCondShow").on("click", () => {
    ensureEl("modifyButtons").style.display = "none";
    ensureEl("rescaleCondSection").style.display = "block";
  });
  ensureEl("rescaleCondHide").on("click", () => {
    ensureEl("modifyButtons").style.display = "block";
    ensureEl("rescaleCondSection").style.display = "none";
  });
  ensureEl("rescaleExecute").on("click", rescaleWithCondition);
  ensureEl("smoothHeights").on("click", smoothAllHeights);
  ensureEl("disruptHeights").on("click", disruptAllHeights);
  ensureEl("brushClear").on("click", startFromScratch);
}

function exitBrushMode(): void {
  const pressed = document.querySelector("#brushesButtons > button.pressed");
  if (pressed) pressed.classList.remove("pressed");

  // use the legacy v5 viewbox selection: clicked relies on d3.event, which d3 v7 never sets
  viewbox.style("cursor", "default").on(".drag", null).on("click", clicked);
  debug.selectAll(".lineCircle").remove();
  removeCircle();

  ensureEl("brushesSliders").style.display = "none";
  ensureEl("lineSlider").style.display = "none";
}

function toggleBrushMode(event: Event): void {
  const button = (event.target as HTMLElement).closest<HTMLElement>("#brushesButtons > button");
  if (!button) return;

  if (button.classList.contains("pressed")) {
    exitBrushMode();
    return;
  }

  exitBrushMode();
  button.classList.add("pressed");
  const radiusRow = ensureEl("heightmapBrushRadius").parentElement;
  if (radiusRow) radiusRow.style.display = button.id === "brushFill" ? "none" : "";

  if (button.id === "brushLine") {
    ensureEl("lineSlider").style.display = "block";
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", placeLinearFeature);
  } else if (button.id === "brushFill") {
    ensureEl("brushesSliders").style.display = "block";
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", applyFillBrush);
  } else {
    ensureEl("brushesSliders").style.display = "block";
    select<SVGElement, unknown>("#viewbox")
      .style("cursor", "crosshair")
      .call(drag<SVGElement, unknown>().on("start", dragBrush));
  }
}

function placeLinearFeature(this: SVGElement, event: any): void {
  const [x, y] = pointer(event, this);
  const toCell = findGridCell(x, y, grid);

  const lineCircle = debug.selectAll(".lineCircle");
  if (!lineCircle.size()) {
    // first click: add 1st control point
    debug.append("line").attr("id", "brushCircle").attr("x1", x).attr("y1", y).attr("x2", x).attr("y2", y);

    debug
      .append("circle")
      .attr("data-cell", toCell)
      .attr("class", "lineCircle")
      .attr("r", 6)
      .attr("cx", x)
      .attr("cy", y)
      .attr("fill", "yellow")
      .attr("stroke", "#333")
      .attr("stroke-width", 2);
    return;
  }

  // second click: execute operation and remove control points
  const fromCell = +lineCircle.attr("data-cell");
  debug.selectAll("*").remove();

  const power = ensureEl<HTMLInputElement>("heightmapLinePower").valueAsNumber;
  if (power === 0) {
    tip("Power should not be zero", false, "error");
    return;
  }

  // map slider 0-100 to halving probability 0-0.5: past 0.5 the ordering stabilizes again, so 0.5 is max meander
  const randomness = ensureEl<HTMLInputElement>("heightmapLineRandomness").valueAsNumber / 200;

  const heights = grid.cells.h;
  const operation =
    power > 0
      ? HeightmapGenerator.addRange.bind(HeightmapGenerator)
      : HeightmapGenerator.addTrough.bind(HeightmapGenerator);
  HeightmapGenerator.setGraph(grid);
  operation("1", String(Math.abs(power)), "", "", fromCell, toCell, randomness);
  const changedHeights = HeightmapGenerator.getHeights()!;

  const cellTypeFilter = ensureEl<HTMLSelectElement>("cellTypeFilter").value;
  const selection: number[] = [];
  for (let i = 0; i < heights.length; i++) {
    if (changedHeights[i] === heights[i]) continue;
    if (cellTypeFilter === "land" && heights[i] < 20) continue;
    if (cellTypeFilter === "water" && heights[i] >= 20) continue;
    heights[i] = changedHeights[i];
    selection.push(i);
  }

  mockHeightmapSelection(selection);
  updateHistory();
}

function applyFillBrush(this: SVGElement, event: any): void {
  const [x, y] = pointer(event, this);
  const start = findGridCell(x, y, grid);
  const startHeight = grid.cells.h[start];
  const isWaterFill = startHeight < 20;
  const MIN_FILL_CELLS = 3;

  const cellTypeFilter = ensureEl<HTMLSelectElement>("cellTypeFilter").value;
  if (cellTypeFilter === "water") {
    tip("Fill brush is not available with 'only water cells' filter", false, "error");
    return;
  }
  if (cellTypeFilter === "land" && isWaterFill) {
    tip("Land filter is active, water areas cannot be filled", false, "error");
    return;
  }

  const { selection, reachedBorder } = collectFillSelection(start, isWaterFill, startHeight);
  if (selection.length < MIN_FILL_CELLS) {
    tip("No enclosed area found to fill", false, "error");
    return;
  }
  if (isWaterFill && reachedBorder) {
    tip("Selected water area is open to map border and is not enclosed", false, "error");
    return;
  }

  const changed = applyConeToSelection(selection, isWaterFill, startHeight);
  if (!changed.length) return;

  mockHeightmapSelection(changed);
  updateHeightmap();
}

function collectFillSelection(
  start: number,
  isWaterFill: boolean,
  targetHeight: number
): { selection: number[]; reachedBorder: boolean } {
  const { h: heights, c: neighbors, i: cells } = grid.cells;
  const visited = new Uint8Array(cells.length);
  const stack = [start];
  const selection: number[] = [];
  let reachedBorder = false;

  while (stack.length) {
    const cell = stack.pop()!;
    if (visited[cell]) continue;
    visited[cell] = 1;

    const matches = isWaterFill ? heights[cell] < 20 : heights[cell] === targetHeight;
    if (!matches) continue;

    selection.push(cell);
    if (grid.cells.b[cell]) reachedBorder = true;
    neighbors[cell].forEach((next: number) => {
      if (!visited[next]) stack.push(next);
    });
  }

  return { selection, reachedBorder };
}

function applyConeToSelection(selection: number[], isWaterFill: boolean, targetHeight: number): number[] {
  const power = ensureEl<HTMLInputElement>("heightmapBrushPower").valueAsNumber * 10;
  const { h: heights, c: neighbors, i: cells } = grid.cells;
  const inSelection = new Uint8Array(cells.length);
  const edgeDistance = new Uint16Array(cells.length);
  const changed: number[] = [];

  selection.forEach(cell => {
    inSelection[cell] = 1;
  });

  // Multi-source BFS from area edge gives each cell distance from edge.
  const queue: number[] = [];
  let head = 0;
  selection.forEach(cell => {
    const isEdgeCell = neighbors[cell].some((next: number) => !inSelection[next]);
    if (!isEdgeCell) return;
    inSelection[cell] = 2;
    queue.push(cell);
  });

  while (head < queue.length) {
    const cell = queue[head++];
    const nextDistance = edgeDistance[cell] + 1;
    neighbors[cell].forEach((next: number) => {
      if (inSelection[next] !== 1) return;
      inSelection[next] = 2;
      edgeDistance[next] = nextDistance;
      queue.push(next);
    });
  }

  const maxDistance = max(selection, cell => edgeDistance[cell]) || 0;
  const baseHeight = isWaterFill ? 20 : targetHeight;

  selection.forEach(cell => {
    const ratio = maxDistance ? edgeDistance[cell] / maxDistance : 1;
    const rise = Math.max(1, Math.round(power * ratio));
    const nextHeight = minmax(baseHeight + rise, 0, 100);
    if (nextHeight === heights[cell]) return;

    heights[cell] = nextHeight;
    changed.push(cell);
  });

  return changed;
}

function dragBrush(this: SVGElement, event: any): void {
  const r = ensureEl<HTMLInputElement>("heightmapBrushRadius").valueAsNumber;

  const applyBrush = (pointerEvent: any) => {
    const p = pointer(pointerEvent, this);
    moveCircle(p[0], p[1], r);

    const inRadius = findGridAll(p[0], p[1], r, grid);
    let selection = inRadius;
    const cellTypeFilter = ensureEl<HTMLSelectElement>("cellTypeFilter").value;
    if (cellTypeFilter === "land") selection = inRadius.filter((i: number) => grid.cells.h[i] >= 20);
    else if (cellTypeFilter === "water") selection = inRadius.filter((i: number) => grid.cells.h[i] < 20);
    if (selection?.length) changeHeightForSelection(selection, findGridCell(p[0], p[1], grid));
  };

  applyBrush(event); // apply once on start so a plain click changes height
  event.on("drag", applyBrush);
  event.on("end", updateHeightmap);
}

function changeHeightForSelection(selection: number[], start: number): void {
  const power = ensureEl<HTMLInputElement>("heightmapBrushPower").valueAsNumber;

  const interpolate = interpolateRound(power, 1);
  const land = ensureEl<HTMLSelectElement>("cellTypeFilter").value === "land";
  const ocean = ensureEl<HTMLSelectElement>("cellTypeFilter").value === "water";
  const limit = (v: number): number => minmax(v, land ? 20 : 0, ocean ? 19 : 100);
  const heights = grid.cells.h;

  const brush = document.querySelector<HTMLElement>("#brushesButtons > button.pressed")!.id;
  if (brush === "brushRaise")
    selection.forEach(i => {
      heights[i] = !ocean && heights[i] < 20 ? 20 : limit(heights[i] + power);
    });
  else if (brush === "brushElevate")
    selection.forEach((i, d) => {
      heights[i] = limit(heights[i] + interpolate(d / Math.max(selection.length - 1, 1)));
    });
  else if (brush === "brushLower")
    selection.forEach(i => {
      heights[i] = limit(heights[i] - power);
    });
  else if (brush === "brushDepress")
    selection.forEach((i, d) => {
      heights[i] = limit(heights[i] - interpolate(d / Math.max(selection.length - 1, 1)));
    });
  else if (brush === "brushAlign")
    selection.forEach(i => {
      heights[i] = limit(heights[start]);
    });
  else if (brush === "brushSmooth")
    selection.forEach(i => {
      heights[i] = rn(
        ((mean(
          grid.cells.c[i]
            .filter((c: number) => (land ? heights[c] >= 20 : ocean ? heights[c] < 20 : true))
            .map((c: number) => heights[c])
        ) ?? 0) +
          heights[i] * (10 - power) +
          0.6) /
          (11 - power),
        1
      );
    });
  else if (brush === "brushDisrupt")
    selection.forEach(i => {
      heights[i] = heights[i] < 15 ? heights[i] : limit(heights[i] + power / 1.6 - Math.random() * power);
    });

  mockHeightmapSelection(selection);
}

function cellTypeFilterChange(): void {
  const cellTypeFilter = ensureEl<HTMLSelectElement>("cellTypeFilter");
  if (cellTypeFilter.value === "land" && ensureEl("heightmapEditMode").innerHTML === "keep") {
    tip("You cannot change the coastline in 'Keep' edit mode", false, "error");
    cellTypeFilter.value = "all";
  }
}

function rescale(v: number): void {
  const land = ensureEl<HTMLSelectElement>("cellTypeFilter").value === "land";
  const ocean = ensureEl<HTMLSelectElement>("cellTypeFilter").value === "water";
  grid.cells.h = grid.cells.h.map((h: number) => {
    if (land && (h < 20 || h + v < 20)) return h;
    if (ocean && h >= 20) return h;
    const newH = lim(h + v);
    return ocean ? Math.min(newH, 19) : newH;
  });
  updateHeightmap();
  ensureEl<HTMLInputElement>("rescaler").value = "0";
}

function rescaleWithCondition(): void {
  const range = `${ensureEl<HTMLInputElement>("rescaleLower").value}-${ensureEl<HTMLInputElement>("rescaleHigher").value}`;
  const operator = ensureEl<HTMLSelectElement>("conditionSign").value;
  const operand = ensureEl<HTMLInputElement>("rescaleModifier").valueAsNumber;
  if (Number.isNaN(operand)) {
    tip("Operand should be a number", false, "error");
    return;
  }
  if ((operator === "add" || operator === "subtract") && !Number.isInteger(operand)) {
    tip("Operand should be an integer", false, "error");
    return;
  }

  HeightmapGenerator.setGraph(grid);

  if (operator === "multiply") HeightmapGenerator.modify(range, 0, operand, 0);
  else if (operator === "divide") HeightmapGenerator.modify(range, 0, 1 / operand, 0);
  else if (operator === "add") HeightmapGenerator.modify(range, operand, 1, 0);
  else if (operator === "subtract") HeightmapGenerator.modify(range, -1 * operand, 1, 0);
  else if (operator === "exponent") HeightmapGenerator.modify(range, 0, 1, operand);

  grid.cells.h = HeightmapGenerator.getHeights();
  updateHeightmap();
}

function smoothAllHeights(): void {
  HeightmapGenerator.setGraph(grid);
  HeightmapGenerator.smooth(4, 1.5);
  grid.cells.h = HeightmapGenerator.getHeights();
  updateHeightmap();
}

function disruptAllHeights(): void {
  grid.cells.h = grid.cells.h.map((h: number) => (h < 15 ? h : lim(h + 2.5 - Math.random() * 4)));
  updateHeightmap();
}

function startFromScratch(): void {
  const cellTypeFilter = ensureEl<HTMLSelectElement>("cellTypeFilter").value;
  if (cellTypeFilter === "land") {
    tip("Not allowed when 'only land cells' filter is set", false, "error");
    return;
  }
  if (cellTypeFilter === "water") {
    tip("Not allowed when 'only water cells' filter is set", false, "error");
    return;
  }
  const someHeights = grid.cells.h.some((h: number) => h);
  if (!someHeights) {
    tip("Heightmap is already cleared, please do not click twice if not required", false, "error");
    return;
  }

  grid.cells.h = new Uint8Array(grid.cells.i.length);
  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("*").remove();
  updateHistory();
}

function openTemplateEditor(): void {
  if (document.getElementById("templateEditor")) return;
  renderTemplateEditor();

  $("#templateEditor").dialog({
    title: "Template Editor",
    minHeight: "auto",
    width: "fit-content",
    resizable: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: closeTemplateEditor
  });
}

function closeTemplateEditor(): void {
  $("#templateEditor").dialog("destroy");
  ensureEl("templateEditor").remove();
}

function addStepOnClick(e: Event): void {
  const target = e.target as HTMLElement;
  if (target.tagName !== "BUTTON") return;
  const type = target.dataset.type!;
  ensureEl("templateBody").dataset.changed = "1";
  addStep(type);
}

function addStep(type: string, count?: string, dist?: string, arg4?: string, arg5?: string): void {
  const $body = ensureEl("templateBody");
  $body.insertAdjacentHTML("beforeend", getStepHTML(type, count, dist, arg4, arg5));

  const $elDist = $body.querySelector<HTMLSelectElement>("div:last-child > span > .templateDist");
  if ($elDist) $elDist.on("change", setRange);

  if (dist && $elDist && $elDist.tagName === "SELECT") {
    for (const option of Array.from($elDist.options)) {
      if (option.value === dist) $elDist.value = dist;
    }
    if ($elDist.value !== dist) {
      const opt = document.createElement("option");
      opt.value = opt.innerHTML = dist;
      $elDist.add(opt);
      $elDist.value = dist;
    }
  }
}

function getStepHTML(type: string, count?: string, arg3?: string, arg4?: string, arg5?: string): string {
  const Trash = /* html */ `<i class="icon-trash-empty pointer" data-tip="Click to remove the step"></i>`;
  const Hide = /* html */ `<div class="icon-check" data-tip="Click to skip the step"></div>`;
  const Reorder = /* html */ `<i class="icon-resize-vertical" data-tip="Drag to reorder"></i>`;
  const common = /* html */ `<div data-type="${type}">${Hide}<div style="width:4em">${type}</div>${Trash}${Reorder}`;

  const TempY = /* html */ `<span>y:
      <input class="templateY" data-tip="Placement range percentage along Y axis (minY-maxY)" value=${arg5 || "20-80"} />
    </span>`;

  const TempX = /* html */ `<span>x:
      <input class="templateX" data-tip="Placement range percentage along X axis (minX-maxX)" value=${arg4 || "15-85"} />
    </span>`;

  const Height = /* html */ `<span>h:
      <input class="templateHeight" data-tip="Blob maximum height, use hyphen to get a random number in range" value=${arg3 || "40-50"} />
    </span>`;

  const Count = /* html */ `<span>n:
      <input class="templateCount" data-tip="Blobs to add, use hyphen to get a random number in range" value=${count || "1-2"} />
    </span>`;

  if (type === "Hill" || type === "Pit" || type === "Range" || type === "Trough")
    return /* html */ `${common}${TempY}${TempX}${Height}${Count}</div>`;

  if (type === "Strait")
    return /* html */ `${common}
      <span>d:
        <select class="templateDist" data-tip="Strait direction">
          <option value="vertical" selected>vertical</option>
          <option value="horizontal">horizontal</option>
        </select>
      </span>
      <span>w:
        <input class="templateCount" data-tip="Strait width, use hyphen to get a random number in range" value=${count || "2-7"} />
      </span>
    </div>`;

  if (type === "Invert")
    return /* html */ `${common}
      <span>by:
        <select class="templateDist" data-tip="Mirror heightmap along axis" style="width: 7.8em">
          <option value="x" selected>x</option>
          <option value="y">y</option>
          <option value="xy">both</option>
        </select>
      </span>
      <span>n:
        <input class="templateCount" data-tip="Probability of inversion, range 0-1" value=${count || "0.5"} />
      </span>
    </div>`;

  if (type === "Mask")
    return /* html */ `${common}
      <span>f:
        <input class="templateCount"
          data-tip="Set masking fraction. 1 - full insulation (prevent land on map edges), 2 - half-insulation, etc. Negative number to inverse the effect"
          type="number" min=-10 max=10 value=${count || 1} />
      </span>
    </div>`;

  if (type === "Add")
    return /* html */ `${common}
      <span>to:
        <select class="templateDist" data-tip="Change only land or all cells">
          <option value="all" selected>all cells</option>
          <option value="land">land only</option>
          <option value="interval">interval</option>
        </select>
      </span>
      <span>v:
        <input class="templateCount" data-tip="Add value to height of all cells (negative values are allowed)"
        type="number" value=${count || -10} min=-100 max=100 step=1 />
      </span>
    </div>`;

  if (type === "Multiply")
    return /* html */ `${common}
      <span>to:
        <select class="templateDist" data-tip="Change only land or all cells">
          <option value="all" selected>all cells</option>
          <option value="land">land only</option>
          <option value="interval">interval</option>
        </select>
      </span>
      <span>v:
        <input class="templateCount" data-tip="Multiply all cells Height by the value" type="number"
          value=${count || 1.1} min=0 max=10 step=.1 />
      </span>
    </div>`;

  if (type === "Smooth")
    return /* html */ `${common}
      <span>f:
        <input class="templateCount" data-tip="Set smooth fraction. 1 - full smooth, 2 - half-smooth, etc."
          type="number" min=1 max=10 step=1 value=${count || 2} />
      </span>
    </div>`;

  return "";
}

function setRange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  if (target.value !== "interval") return;

  prompt("Set a height interval. Avoid space, use hyphen as a separator", { default: "17-20" }, v => {
    const opt = document.createElement("option");
    opt.value = opt.innerHTML = String(v);
    target.add(opt);
    target.value = String(v);
  });
}

function selectTemplate(e: Event): void {
  const body = ensureEl("templateBody");
  const steps = body.querySelectorAll("div").length;
  const changed = +body.getAttribute("data-changed")!;
  const template = (e.target as HTMLSelectElement).value;
  if (!steps || !changed) {
    changeTemplate(template);
    return;
  }

  alertMessage.innerHTML = "Are you sure you want to select a different template? All changes will be lost.";
  $("#alert").dialog({
    resizable: false,
    title: "Change Template",
    buttons: {
      Change: function (this: HTMLElement) {
        changeTemplate(template);
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function changeTemplate(template: string): void {
  const body = ensureEl("templateBody");
  body.setAttribute("data-changed", "0");
  body.innerHTML = "";

  const templateString = heightmapTemplates[template]?.template;
  if (!templateString) return;

  const steps = templateString.split("\n");
  if (!steps.length) {
    tip(`Heightmap template: no steps defined`, false, "error");
    return;
  }

  for (const step of steps) {
    const elements = step.trim().split(" ");
    addStep(elements[0], elements[1], elements[2], elements[3], elements[4]);
  }
}

function executeTemplate(): void {
  const steps = ensureEl("templateBody").querySelectorAll<HTMLElement>("#templateBody > div");
  if (!steps.length) return;

  const currentSeed = ensureEl<HTMLInputElement>("templateSeed").value;
  Math.random = aleaPRNG(currentSeed || generateSeed());

  grid.cells.h = new Uint8Array(grid.points.length);
  HeightmapGenerator.setGraph(grid);
  restartHistory();

  for (const step of steps) {
    if (step.style.opacity === "0.5") continue;

    const count = step.querySelector<HTMLInputElement>(".templateCount")?.value || "";
    const height = step.querySelector<HTMLInputElement>(".templateHeight")?.value || "";
    const dist = step.querySelector<HTMLSelectElement>(".templateDist")?.value || "";
    const x = step.querySelector<HTMLInputElement>(".templateX")?.value || "";
    const y = step.querySelector<HTMLInputElement>(".templateY")?.value || "";
    const type = step.dataset.type;

    if (type === "Hill") HeightmapGenerator.addHill(count, height, x, y);
    else if (type === "Pit") HeightmapGenerator.addPit(count, height, x, y);
    else if (type === "Range") HeightmapGenerator.addRange(count, height, x, y);
    else if (type === "Trough") HeightmapGenerator.addTrough(count, height, x, y);
    else if (type === "Strait") HeightmapGenerator.addStrait(count, dist);
    else if (type === "Mask") HeightmapGenerator.mask(+count);
    else if (type === "Invert") HeightmapGenerator.invert(+count, dist);
    else if (type === "Add") HeightmapGenerator.modify(dist, +count, 1);
    else if (type === "Multiply") HeightmapGenerator.modify(dist, 0, +count);
    else if (type === "Smooth") HeightmapGenerator.smooth(+count);

    grid.cells.h = HeightmapGenerator.getHeights();
    updateHistory("noStat"); // update history on every step
  }

  grid.cells.h = HeightmapGenerator.getHeights();
  updateStatistics();
  mockHeightmap();
  if (document.getElementById("preview")) drawHeightmapPreview();
  if (document.getElementById("canvas3d")) Controllers.View3d.redraw();
}

function downloadTemplate(): void {
  const body = ensureEl("templateBody");
  body.dataset.changed = "0";
  const steps = body.querySelectorAll<HTMLElement>("#templateBody > div");
  if (!steps.length) return;

  let data = "";
  for (const s of Array.from(steps)) {
    if (s.style.opacity === "0.5") continue;

    const type = s.getAttribute("data-type");
    const count = s.querySelector<HTMLInputElement>(".templateCount")?.value || "0";
    const arg3 =
      s.querySelector<HTMLInputElement>(".templateHeight")?.value ||
      s.querySelector<HTMLSelectElement>(".templateDist")?.value ||
      "0";
    const x = s.querySelector<HTMLInputElement>(".templateX")?.value || "0";
    const y = s.querySelector<HTMLInputElement>(".templateY")?.value || "0";
    data += `${type} ${count} ${arg3} ${x} ${y}\r\n`;
  }

  const name = `template_${Date.now()}.txt`;
  downloadFile(data, name);
}

function uploadTemplate(dataLoaded: string): void {
  const steps = dataLoaded.split("\r\n");
  if (!steps.length) {
    tip("Cannot parse the template, please check the file", false, "error");
    return;
  }
  ensureEl("templateBody").innerHTML = "";

  for (const s of steps) {
    const step = s.split(" ");
    if (step.length !== 5) {
      ERROR && console.error("Cannot parse step, wrong arguments count", s);
      continue;
    }
    addStep(step[0], step[1], step[2], step[3], step[4]);
  }
}

function openImageConverter(): void {
  if (document.getElementById("imageConverter")) return;
  ensureEl("imageToLoad").click();
  closeDialogs("#imageConverter");

  renderImageConverter();

  $("#imageConverter").dialog({
    title: "Image Converter",
    maxHeight: svgHeight * 0.8,
    minHeight: "auto",
    width: "20em",
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    beforeClose: closeImageConverter
  });

  // create canvas for image
  const canvas = document.createElement("canvas");
  canvas.id = "canvas";
  canvas.width = graphWidth;
  canvas.height = graphHeight;
  document.body.insertBefore(canvas, ensureEl("optionsContainer"));

  setOverlayOpacity(0);
  clearMainTip();
  tip("Image Converter is opened. Upload image and assign height value for each color", false, "warn"); // main tip

  // remove all heights
  grid.cells.h = new Uint8Array(grid.cells.i.length);
  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("*").remove();
  updateHistory();
}

function showPalleteHeight(this: HTMLElement): void {
  const height = +this.getAttribute("data-color")!;
  ensureEl("colorsSelectValue").innerHTML = String(height);
  ensureEl("colorsSelectFriendly").innerHTML = getFriendlyHeight(height);
  const former = ensureEl("imageConverterPalette").querySelector<HTMLElement>(".hoveredColor");
  if (former) former.className = "";
  this.className = "hoveredColor";
}

function loadImage(this: HTMLInputElement): void {
  const file = this.files![0];
  this.value = ""; // reset input value to get triggered if the file is re-uploaded
  const reader = new FileReader();

  const img = new Image();
  img.id = "imageToConvert";
  img.style.display = "none";
  document.body.appendChild(img);

  img.onload = () => {
    const ctx = ensureEl<HTMLCanvasElement>("canvas").getContext("2d")!;
    ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
    heightsFromImage(+ensureEl<HTMLInputElement>("convertColors").value);
    resetZoom();
  };

  reader.onloadend = () => {
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function heightsFromImage(count: number): void {
  const sourceImage = ensureEl<HTMLCanvasElement>("canvas");
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = grid.cellsX;
  sampleCanvas.height = grid.cellsY;
  sampleCanvas.getContext("2d")!.drawImage(sourceImage, 0, 0, grid.cellsX, grid.cellsY);

  const q = new RgbQuant({ colors: count });
  q.sample(sampleCanvas);
  const data = q.reduce(sampleCanvas);
  const pallete = q.palette(true);

  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("*").remove();
  select("#imageConverter").selectAll("div.color-div").remove();
  ensureEl("colorsSelect").style.display = "block";
  ensureEl("colorsUnassigned").style.display = "block";
  ensureEl("colorsAssigned").style.display = "none";
  sampleCanvas.remove(); // no need to keep

  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll<SVGPolygonElement, number>("polygon")
    .data<number>(grid.cells.i as number[])
    .join("polygon")
    .attr("points", (d: number) => getGridPolygon(d, grid))
    .attr("id", (d: number) => `cell${d}`)
    .attr("fill", (d: number) => `rgb(${data[d * 4]}, ${data[d * 4 + 1]}, ${data[d * 4 + 2]})`)
    .on("click", mapClicked);

  const colors: string[] = pallete.map((p: number[]) => `rgb(${p[0]}, ${p[1]}, ${p[2]})`);
  select("#colorsUnassignedContainer")
    .selectAll<HTMLDivElement, string>("div")
    .data(colors)
    .enter()
    .append("div")
    .attr("data-color", (i: string) => i)
    .style("background-color", (i: string) => i)
    .attr("class", "color-div")
    .on("click", colorClicked);

  ensureEl("colorsUnassignedNumber").innerHTML = String(colors.length);
}

function mapClicked(this: SVGElement): void {
  const fill = this.getAttribute("fill");
  const palleteColor = ensureEl("imageConverter").querySelector<HTMLElement>(`div[data-color="${fill}"]`);
  palleteColor?.click();
}

function colorClicked(this: HTMLElement): void {
  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll(".selectedCell").attr("class", null);
  const unselect = this.classList.contains("selectedColor");

  const selectedColor = ensureEl("imageConverter").querySelector("div.selectedColor");
  if (selectedColor) selectedColor.classList.remove("selectedColor");
  const hoveredColor = ensureEl("imageConverterPalette").querySelector("div.hoveredColor");
  if (hoveredColor) hoveredColor.classList.remove("hoveredColor");
  ensureEl("colorsSelectValue").innerHTML = ensureEl("colorsSelectFriendly").innerHTML = "0";

  if (unselect) return;
  this.classList.add("selectedColor");

  if (this.dataset.height) {
    const height = +this.dataset.height;
    ensureEl("imageConverterPalette").querySelector(`div[data-color="${height}"]`)?.classList.add("hoveredColor");
    ensureEl("colorsSelectValue").innerHTML = String(height);
    ensureEl("colorsSelectFriendly").innerHTML = getFriendlyHeight(height);
  }

  const clr = this.getAttribute("data-color");
  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll("polygon.selectedCell")
    .classed("selectedCell", false);
  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll(`polygon[fill='${clr}']`)
    .classed("selectedCell", true);
}

function assignHeight(this: HTMLElement): void {
  const height = +this.dataset.color!;
  const rgb = color(1 - (height < 20 ? height - 5 : height) / 100);
  const selectedColor = ensureEl("imageConverter").querySelector<HTMLElement>("div.selectedColor")!;
  selectedColor.style.backgroundColor = rgb;
  selectedColor.setAttribute("data-color", rgb);
  selectedColor.setAttribute("data-height", String(height));

  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll<SVGElement, unknown>(".selectedCell")
    .each(function () {
      this.setAttribute("fill", rgb);
      this.setAttribute("data-height", String(height));
    });

  if ((selectedColor.parentNode as HTMLElement).id === "colorsUnassignedContainer") {
    ensureEl("colorsAssignedContainer").appendChild(selectedColor);
    ensureEl("colorsAssigned").style.display = "block";

    ensureEl("colorsUnassignedNumber").innerHTML = String(ensureEl("colorsUnassignedContainer").childElementCount - 2);
    ensureEl("colorsAssignedNumber").innerHTML = String(ensureEl("colorsAssignedContainer").childElementCount - 2);
  }
}

// auto assign color based on luminosity or hue
function autoAssing(type: string): void {
  const colorsUnassignedContainer = ensureEl("colorsUnassignedContainer");
  let unassigned = colorsUnassignedContainer.querySelectorAll<HTMLElement>("div");
  if (!unassigned.length) {
    heightsFromImage(+ensureEl<HTMLInputElement>("convertColors").value);
    unassigned = colorsUnassignedContainer.querySelectorAll<HTMLElement>("div");
    if (!unassigned.length) {
      tip("No unassigned colors. Please load an image and click the button again", false, "error");
      return;
    }
  }

  const getHeightByHue = (clr: string): number => {
    let hue = hsl(clr).h;
    if (hue > 300) hue -= 360;
    if (hue > 170) return (Math.abs(hue - 250) / 3) | 0; // water
    return (Math.abs(hue - 250 + 20) / 3) | 0; // land
  };

  const getHeightByLum = (clr: string): number => {
    const lum = lab(clr).l;
    if (lum < 13) return ((lum / 13) * 20) | 0; // water
    return lum | 0; // land
  };

  const scheme = range(101).map(i => getColor(i));
  const hues = scheme.map(rgb => hsl(rgb).h | 0);
  const getHeightByScheme = (clr: string): number => {
    const height = scheme.indexOf(clr);
    if (height !== -1) return height; // exact match
    const hue = hsl(clr).h;
    const closest = hues.reduce((prev, curr) => (Math.abs(curr - hue) < Math.abs(prev - hue) ? curr : prev));
    return hues.indexOf(closest);
  };

  const assinged: boolean[] = []; // store assigned heights
  const colorsAssignedContainer = ensureEl("colorsAssignedContainer");
  unassigned.forEach(el => {
    const clr = el.dataset.color!;
    const height = type === "hue" ? getHeightByHue(clr) : type === "lum" ? getHeightByLum(clr) : getHeightByScheme(clr);
    const colorTo = color(1 - (height < 20 ? (height - 5) / 100 : height / 100));
    select<SVGElement, unknown>("#viewbox")
      .select("#heights")
      .selectAll(`polygon[fill='${clr}']`)
      .attr("fill", colorTo)
      .attr("data-height", height);

    if (assinged[height]) {
      el.remove();
      return;
    } // if color is already added, remove it
    el.style.backgroundColor = el.dataset.color = colorTo;
    el.dataset.height = String(height);
    colorsAssignedContainer.appendChild(el);
    assinged[height] = true;
  });

  // sort assigned colors by height
  Array.from(colorsAssignedContainer.children)
    .sort((a, b) => +(a as HTMLElement).dataset.height! - +(b as HTMLElement).dataset.height!)
    .forEach(line => {
      colorsAssignedContainer.appendChild(line);
    });

  ensureEl("colorsAssigned").style.display = "block";
  ensureEl("colorsUnassigned").style.display = "none";
  ensureEl("colorsAssignedNumber").innerHTML = String(colorsAssignedContainer.childElementCount - 2);
}

function setConvertColorsNumber(): void {
  prompt(
    `Please set maximum number of colors. <br>An actual number is usually lower and depends on color scheme`,
    { default: +ensureEl<HTMLInputElement>("convertColors").value, step: 1, min: 3, max: 255 },
    number => {
      ensureEl<HTMLInputElement>("convertColors").value = String(number);
      heightsFromImage(+number);
    }
  );
}

function setOverlayOpacity(v: number): void {
  ensureEl<HTMLInputElement>("convertOverlay").value = ensureEl<HTMLInputElement>("convertOverlayNumber").value =
    String(v);
  ensureEl("canvas").style.opacity = String(v);
}

function applyConversion(): void {
  if (ensureEl("colorsAssignedContainer").childElementCount < 3) {
    tip("Please assign colors to heights first", false, "error");
    return;
  }

  select<SVGElement, unknown>("#viewbox")
    .select("#heights")
    .selectAll<SVGElement, unknown>("polygon")
    .each(function () {
      const height = +(this.dataset.height ?? "0") || 0;
      const i = +this.id.slice(4);
      grid.cells.h[i] = height;
    });

  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("polygon").remove();
  updateHeightmap();
  restoreImageConverterState();
}

function cancelConversion(): void {
  restoreImageConverterState();
  select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("polygon").remove();
  restoreHistory(edits.n - 1);
}

function restoreImageConverterState(): void {
  document.getElementById("canvas")?.remove();
  document.getElementById("imageToConvert")?.remove();

  select("#imageConverter").selectAll("div.color-div").remove();
  ensureEl("colorsAssigned").style.display = "none";
  ensureEl("colorsUnassigned").style.display = "none";
  ensureEl("colorsSelectValue").innerHTML = ensureEl("colorsSelectFriendly").innerHTML = "0";
  select<SVGElement, unknown>("#viewbox").style("cursor", "default").on(".drag", null);
  tip('Heightmap edit mode is active. Click on "Exit Customization" to finalize the heightmap', true);
  $("#imageConverter").dialog("destroy");
  ensureEl("imageConverter").remove();
  openBrushesPanel();
}

function closeImageConverter(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  alertMessage.innerHTML = /* html */ `Are you sure you want to close the Image Converter? Click "Cancel" to keep editing. Click "Complete" to apply
  the conversion and close the tool. Click "Close" to discard the conversion and restore the previous heightmap.`;

  $("#alert").dialog({
    resizable: false,
    title: "Close Image Converter",
    buttons: {
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      },
      Complete: function (this: HTMLElement) {
        $(this).dialog("close");
        applyConversion();
      },
      Close: function (this: HTMLElement) {
        $(this).dialog("close");
        restoreImageConverterState();
        select<SVGElement, unknown>("#viewbox").select("#heights").selectAll("polygon").remove();
        restoreHistory(edits.n - 1);
      }
    }
  });
}

function toggleHeightmapPreview(): void {
  const existing = document.getElementById("preview");
  if (existing) {
    existing.remove();
    return;
  }
  const preview = document.createElement("canvas");
  preview.id = "preview";
  preview.width = grid.cellsX;
  preview.height = grid.cellsY;
  document.body.insertBefore(preview, ensureEl("optionsContainer"));
  preview.on("mouseover", () => tip("Heightmap preview. Click to download a screen-sized image"));
  preview.on("click", downloadPreview);
  drawHeightmapPreview();
}

function drawHeightmapPreview(): void {
  const ctx = (document.getElementById("preview") as HTMLCanvasElement).getContext("2d")!;
  const imageData = ctx.createImageData(grid.cellsX, grid.cellsY);

  grid.cells.h.forEach((height: number, i: number) => {
    const h = height < 20 ? Math.max(height / 1.5, 0) : height;
    const v = (h / 100) * 255;

    const n = i * 4;
    imageData.data[n] = v;
    imageData.data[n + 1] = v;
    imageData.data[n + 2] = v;
    imageData.data[n + 3] = 255;
  });

  ctx.putImageData(imageData, 0, 0);
}

function downloadPreview(): void {
  const preview = document.getElementById("preview") as HTMLCanvasElement;
  const dataURL = preview.toDataURL("image/png");

  const img = new Image();
  img.src = dataURL;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = graphWidth;
    canvas.height = graphHeight;
    document.body.insertBefore(canvas, ensureEl("optionsContainer"));
    ctx.drawImage(img, 0, 0, graphWidth, graphHeight);
    const imgBig = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${getFileName("Heightmap")}.png`;
    link.href = imgBig;
    link.click();
    canvas.remove();
  };
}

export const HeightmapEditor = { open };
