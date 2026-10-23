import { select } from "d3";
import { fitMapToScreen } from "@/components/canvas";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { registerMap } from "@/components/lifecycle";
import { pickMapFile } from "@/components/options/io-panes";
import { syncOptionInputs } from "@/components/options/tabs/options-tab";
import { applyPerformanceSettings } from "@/components/performance";
import { clearMainTip, tip } from "@/components/tooltips";
import { undraw } from "@/components/undraw";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { resetZoom } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { GraphOverride } from "@/generators/graph-override";
import { Styles } from "@/generators/styles";
import { onLegendClick } from "@/renderers/draw-legend";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import { zonesFilter } from "@/renderers/draw-zones";
import { Hatches } from "@/renderers/hatches";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { Services } from "@/services";
import { declareFont } from "@/services/fonts";
import { MapRepair } from "@/services/io/map-repair";
import { logStats } from "@/services/logging";
import { clearCache, compareVersions, isValidVersion, parseMapVersion, VERSION } from "@/services/versioning";
import { ensureEl, link, parseError, rn, safeParseJSON } from "@/utils";
import { sentences, t } from "@/utils/i18n";

async function quickLoad(): Promise<void> {
  const blob = await ldb.get("lastMap");
  if (blob) loadMapPrompt(blob);
  else {
    tip(t("No map stored. Save map to browser storage first"), true, "error", 2000);
    ERROR && console.error("No map stored");
  }
}

async function loadFromDropbox(): Promise<void> {
  const mapPath = ensureEl<HTMLInputElement>("loadFromDropboxSelect").value;

  console.info("Loading map from Dropbox:", mapPath);
  const blob = await Services.Cloud.load(mapPath);
  uploadMap(blob);
}

async function createSharableDropboxLink(): Promise<void> {
  const mapFile = (document.querySelector("#loadFromDropbox select") as HTMLSelectElement).value;
  const sharableLink = ensureEl("sharableLink");
  const sharableLinkContainer = ensureEl("sharableLinkContainer");

  try {
    const previewLink = await Services.Cloud.getLink(mapFile);
    const directLink = previewLink.replace("www.dropbox.com", "dl.dropboxusercontent.com"); // DL allows CORS
    const finalLink = `${location.origin}${location.pathname}?maplink=${directLink}`;

    sharableLink.textContent = `${finalLink.slice(0, 45)}...`;
    sharableLink.setAttribute("href", finalLink);
    sharableLinkContainer.style.display = "block";
  } catch (error) {
    ERROR && console.error(error);
    return tip(t("Dropbox API error. Can not create link."), true, "error", 2000);
  }
}

function loadMapPrompt(blob: Blob): void {
  const current = mapHistory.at(-1);
  const workingTime = current ? (Date.now() - current.registeredAt) / 60000 : 0; // minutes
  if (workingTime < 5) {
    loadLastSavedMap();
    return;
  }

  confirmationDialog({
    title: t("Load saved map"),
    message: `${t("Are you sure you want to load saved map?")}<br>${t("All unsaved changes made to the current map will be lost")}`,
    confirm: t("Load"),
    onConfirm: loadLastSavedMap
  });

  function loadLastSavedMap() {
    WARN && console.warn("Load last saved map");
    try {
      uploadMap(blob);
    } catch (error) {
      ERROR && console.error(error);
      tip(t("Cannot load last saved map"), true, "error", 2000);
    }
  }
}

async function loadMapFromURL(maplink: string, random?: boolean): Promise<void> {
  const controller = new AbortController();
  const TIMEOUT = 120000; // 120 seconds
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const url = decodeURIComponent(maplink);
    const response = await fetch(url, { method: "GET", mode: "cors", signal: controller.signal });
    if (!response.ok) throw new Error("Cannot load map from URL");

    const blob = await response.blob();
    uploadMap(blob);
  } catch (error) {
    const message =
      (error as Error)?.name === "AbortError"
        ? t("Cannot load map from URL: request timed out")
        : (error as Error).message;
    showUploadErrorMessage(message, maplink, random);
    if (random) generateMapOnLoad();
  } finally {
    clearTimeout(timeoutId);
  }
}

function showUploadErrorMessage(error: string, maplink: string, random?: boolean): void {
  ERROR && console.error(error);
  const source = link(maplink, t("link provided"));
  alertMessage.innerHTML = random
    ? sentences(
        t("Cannot load map from the {{- source}}", { source }),
        t("A new random map is generated"),
        t("Please ensure the linked file is reachable and CORS is allowed on server side")
      )
    : sentences(
        t("Cannot load map from the {{- source}}", { source }),
        t("Please ensure the linked file is reachable and CORS is allowed on server side")
      );
  $("#alert").dialog({
    title: t("Loading error"),
    width: "32em",
    buttons: {
      [t("Clear cache")]: () => clearCache(),
      [t("OK")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

let uploadTimeStart = 0;

function uploadMap(file: Blob, callback?: () => void): void {
  uploadTimeStart = performance.now();

  const fileReader = new FileReader();
  fileReader.onloadend = async fileLoadedEvent => {
    if (callback) callback();
    ensureEl("coas").innerHTML = ""; // remove auto-generated emblems

    const result = fileLoadedEvent.target!.result as ArrayBuffer;
    const { mapData, mapVersion } = await parseLoadedResult(result);

    const isInvalid = !mapData || !isValidVersion(mapVersion!) || mapData.length < 10 || !mapData[5];
    if (isInvalid) return showUploadMessage("invalid", mapData, mapVersion);

    const isUpdated = compareVersions(mapVersion!, VERSION).isEqual;
    if (isUpdated) return showUploadMessage("updated", mapData, mapVersion);

    const isAncient = compareVersions(mapVersion!, "0.70.0").isOlder;
    if (isAncient) return showUploadMessage("ancient", mapData, mapVersion);

    const isNewer = compareVersions(mapVersion!, VERSION).isNewer;
    if (isNewer) return showUploadMessage("newer", mapData, mapVersion);

    const isOutdated = compareVersions(mapVersion!, VERSION).isOlder;
    if (isOutdated) return showUploadMessage("outdated", mapData, mapVersion);
  };

  fileReader.readAsArrayBuffer(file);
}

async function uncompress(compressedData: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const uncompressedStream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream("gzip"));

    let uncompressedData: number[] = [];
    for await (const chunk of uncompressedStream) {
      uncompressedData = uncompressedData.concat(Array.from(chunk));
    }

    return new Uint8Array(uncompressedData);
  } catch (error) {
    ERROR && console.error(error);
    return null;
  }
}

async function parseLoadedResult(
  result: ArrayBuffer | Uint8Array
): Promise<{ mapData: string[] | null; mapVersion: string | null }> {
  try {
    const resultAsString = new TextDecoder().decode(result);

    // data can be in FMG internal format or base64 encoded
    const isDelimited = resultAsString.substring(0, 10).includes("|");
    let content = isDelimited ? resultAsString : decodeURIComponent(atob(resultAsString));

    // fix if svg part has CRLF line endings instead of LF
    const svgMatch = content.match(/<svg[^>]*id="map"[\s\S]*?<\/svg>/);
    const svgContent = svgMatch![0];
    const hasCrlfEndings = svgContent.includes("\r\n");
    if (hasCrlfEndings) {
      const correctedSvgContent = svgContent.replace(/\r\n/g, "\n");
      content = content.replace(svgContent, correctedSvgContent);
    }

    const mapData = content.split("\r\n"); // split by CRLF
    const mapVersion = parseMapVersion(mapData[0].split("|")[0] || mapData[0] || "");

    return { mapData, mapVersion };
  } catch (error) {
    const uncompressedData = await uncompress(result as ArrayBuffer); // file can be gzip compressed
    if (uncompressedData) return parseLoadedResult(uncompressedData);

    ERROR && console.error(error);
    return { mapData: null, mapVersion: null };
  }
}

function showUploadMessage(type: string, mapData: string[] | null, mapVersion: string | null): void {
  let message = "";
  let title = "";

  if (type === "invalid") {
    message = `${t("The file does not look like a valid save file.")}<br>${t("Please check the data format")}`;
    title = t("Invalid file format");
  } else if (type === "updated") {
    parseLoadedData(mapData!, mapVersion);
    return;
  } else if (type === "ancient") {
    const archive = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", t("archived version"));
    message = `${t("The map version you are trying to load ({{version}}) is too old and cannot be updated to the current version.", { version: mapVersion })}<br>${t("Please keep using an {{- archive}}", { archive })}`;
    title = t("Ancient file");
  } else if (type === "newer") {
    message = `${t("The map version you are trying to load ({{version}}) is newer than the current version.", { version: mapVersion })}<br>${t("Please load the file in the appropriate version")}`;
    title = t("Newer file");
  } else if (type === "outdated") {
    INFO && console.info(`Loading map. Auto-updating from ${mapVersion} to ${VERSION}`);
    parseLoadedData(mapData!, mapVersion);
    return;
  }

  alertMessage.innerHTML = message;
  $("#alert").dialog({
    title,
    buttons: {
      [t("Clear cache")]: () => clearCache(),
      [t("OK")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

async function parseLoadedData(data: string[], mapVersion: string | null): Promise<void> {
  let isLogGroupOpen = false;

  try {
    const { migrateLegacySettings, resolveVersionConflicts } = await import("./auto-update"); // TODO: don't load if not required

    closeDialogs();
    customization = 0;
    if (ensureEl("customizationMenu").offsetParent) ensureEl("styleTab").click();

    migrateLegacySettings(mapVersion!, data);
    const settings = data[1] ? safeParseJSON(data[1]) : null;
    if (!settings) throw new Error("Map settings are missing or malformed");
    Options.applyLoaded(settings);
    if (new URL(window.location.href).searchParams.get("view") === "1") options.map.viewOnly = true;
    syncOptionInputs();
    await Controllers.StylePresetsEditor.init(); // the preset row follows the loaded map

    INFO && console.group(options.map.seed ? `Loaded Map ${options.map.seed}` : "Loaded Map");
    isLogGroupOpen = true;

    if (data[34]) {
      const usedFonts = JSON.parse(data[34]);
      usedFonts.forEach((usedFont: (typeof fonts)[number]) => {
        const { family: usedFamily, unicodeRange: usedRange, variant: usedVariant } = usedFont;
        const defaultFont = fonts.find(
          ({ family, unicodeRange, variant }) =>
            family === usedFamily && unicodeRange === usedRange && variant === usedVariant
        );
        if (!defaultFont) fonts.push(usedFont);
        declareFont(usedFont);
      });
    }

    undraw(); // every layer releases its scene and content before the loaded map takes over
    select("#map").remove();
    document.body.insertAdjacentHTML("afterbegin", data[5]);
    ensureEl("map").dataset.layer = "map"; // pre-1.154 maps lack it, and styles address the root by it
    zonesFilter.type = "all"; // the dropped map's zone types say nothing about the loaded one

    // TODO: check if we need it or if LayersRegistry resolves it automatically?
    const viewbox = select("#viewbox");
    if (!select("#texture").size()) {
      viewbox.insert("g", "#landmass").attr("id", "texture").attr("data-href", "./images/textures/plaster.jpg");
    }
    if (!select("#emblems").size()) {
      viewbox.insert("g", "#labels").attr("id", "emblems").style("display", "none");
    }
    grid = JSON.parse(data[6]);
    Grid.rebuildGraph(grid);
    GraphOverride.clear(); // the loaded world replaces the previous one
    HeightmapGenerator.clearData(); // the generator must not pin the replaced grid
    grid.cells.h = Uint8Array.from(data[7].split(","), Number);
    grid.cells.prec = Uint8Array.from(data[8].split(","), Number);
    grid.cells.f = Uint16Array.from(data[9].split(","), Number);
    grid.cells.t = Int8Array.from(data[10].split(","), Number);
    grid.cells.temp = Int8Array.from(data[11].split(","), Number);
    Pack.generate();
    Features.markupPack();
    if (data[3]?.startsWith("[")) {
      type LoadedBiome = (typeof pack.biomes)[number] & {
        cells?: number;
        area?: number;
        rural?: number;
        urban?: number;
      };
      const loadedBiomes: LoadedBiome[] = JSON.parse(data[3]);
      for (const biome of loadedBiomes) {
        delete biome.cells;
        delete biome.area;
        delete biome.rural;
        delete biome.urban;
      }
      pack.biomes = loadedBiomes;
    } else {
      pack.biomes = [];
    }
    pack.features = JSON.parse(data[12]);
    pack.cultures = JSON.parse(data[13]);
    pack.states = JSON.parse(data[14]);
    pack.burgs = JSON.parse(data[15]);
    pack.religions = data[29] ? JSON.parse(data[29]) : ([{ i: 0, name: "No religion" }] as typeof pack.religions);
    pack.provinces = data[30] ? JSON.parse(data[30]) : ([0] as unknown as typeof pack.provinces);
    pack.rivers = data[32] ? JSON.parse(data[32]) : [];
    pack.markers = data[35] ? JSON.parse(data[35]) : [];
    pack.routes = data[37] ? JSON.parse(data[37]) : [];
    pack.zones = data[38] ? JSON.parse(data[38]) : [];
    pack.cells.biome = Uint8Array.from(data[16].split(","), Number);
    pack.cells.burg = Uint16Array.from(data[17].split(","), Number);
    pack.cells.conf = Uint8Array.from(data[18].split(","), Number);
    pack.cells.culture = Uint16Array.from(data[19].split(","), Number);
    pack.cells.fl = Uint16Array.from(data[20].split(","), Number);
    pack.cells.pop = Float32Array.from(data[21].split(","), Number);
    pack.cells.r = Uint16Array.from(data[22].split(","), Number);
    // data[23] had deprecated cells.road
    pack.cells.s = Uint16Array.from(data[24].split(","), Number);
    pack.cells.state = Uint16Array.from(data[25].split(","), Number);
    pack.cells.religion = data[26]
      ? Uint16Array.from(data[26].split(","), Number)
      : new Uint16Array(pack.cells.i.length);
    pack.cells.province = data[27]
      ? Uint16Array.from(data[27].split(","), Number)
      : new Uint16Array(pack.cells.i.length);
    // data[28] had deprecated cells.crossroad
    // data[33] had deprecated rulers, now replaced by pack.measurers
    pack.cells.routes = data[36] ? JSON.parse(data[36]) : {};
    pack.ice = data[39] ? JSON.parse(data[39]) : [];
    pack.cells.good = data[40] ? Uint16Array.from(data[40].split(","), Number) : new Uint16Array(pack.cells.i.length);
    pack.goods = data[41] ? JSON.parse(data[41]) : [];
    pack.markets = data[42] ? JSON.parse(data[42]) : [];
    pack.deals = data[43] ? JSON.parse(data[43]) : [];
    pack.cells.market = data[44] ? Uint16Array.from(data[44].split(","), Number) : new Uint16Array(pack.cells.i.length);
    pack.measurers = data[46] ? JSON.parse(data[46]) : [];
    pack.addedLabels = data[47] ? JSON.parse(data[47]) : [];
    pack.relief = data[49] ? JSON.parse(data[49]) : [];
    pack.journeys = data[52] ? JSON.parse(data[52]) : [];

    // save omits names that equal the default base at the same index
    const defaultNameBases = Names.getNameBases();
    Names.nameBases = data[31]
      ? data[31].split("/").map((d, i) => {
          const e = d.split("|");
          const b = e[5].split(",").length > 2 || !defaultNameBases[i] ? e[5] : defaultNameBases[i].b;
          return { name: e[0], i, min: +e[1], max: +e[2], d: e[3], m: +e[4], b };
        })
      : defaultNameBases;
    Names.clearChains();

    await resolveVersionConflicts(mapVersion!, data);

    // hidden layers save no paths, so colored hatchings are restored from data
    const { biomes, cultures, states, religions, provinces, zones, markets } = pack;
    const entities = [biomes, cultures, states, religions, provinces, zones, markets].flat();
    Hatches.ensureAll(entities.map(entity => entity?.color));

    const styleRecord = data[48] ? safeParseJSON(data[48]) : undefined; // data[48] should be already migrated by auto-update
    Styles.set(Styles.parse(styleRecord));
    await Controllers.StylePresetsEditor.ensureGroupStyles();

    Icons.syncCustom();

    if (data[50]) Layers.restore(JSON.parse(data[50]));
    if (data[51]) GraphOverride.restore(JSON.parse(data[51]));

    Goods.sync();
    Markets.sync();
    Routes.sync();
    TradeAnimation.sync();
    Journeys.sync();

    select("#scaleBar")
      .on("mousemove", () => tip(t("Units Editor")))
      .on("click", () => window.Controllers.UnitsEditor.open());
    select("#legend")
      .on("mousemove", () => tip(sentences(t("Drag to change the position"), t("Click to hide the legend box"))))
      .on("click", onLegendClick);

    // add custom heightmap color scheme if any
    for (const { scheme } of [
      styles.heightmap.groups.oceanHeights.options,
      styles.heightmap.groups.landHeights.options
    ]) {
      HeightmapColorSchemes.ensure(scheme);
    }

    const repairs = MapRepair.repair();

    Layers.drawAll();
    Styles.writeAll();
    applyVignetteOptions(); // the vignette mask is renderer-owned; its applier shapes it from the store
    applyPerformanceSettings(); // the file's SVG carries the attributes of the browser that saved it
    applyDefaultViewboxEvents();
    fitMapToScreen();
    resetZoom(0); // an opened map is shown fitted, whatever window size it was made on
    focusOn();
    invokeActiveZooming();

    WARN && console.warn(`TOTAL: ${rn((performance.now() - uploadTimeStart) / 1000, 2)}s`);

    Options.persist(); // the migrations run after the adoption, and they change the map too

    const mapCreatedAt = +data[0].split("|")[6] || Date.now();
    registerMap(mapCreatedAt);
    logStats();
    MapRepair.report(repairs);
    const loaded = t("Map is successfully loaded");
    tip(
      options.map.viewOnly ? sentences(loaded, t("It is view-only: editing is disabled")) : loaded,
      true,
      "success",
      7000
    );
  } catch (error) {
    ERROR && console.error(error);
    clearMainTip();

    alertMessage.innerHTML = /* html */ `${t("An error occurred while loading the map. Select a different file to load, generate a new random map or cancel the loading.")}<br>${t("Map version: {{map}}. Generator version: {{generator}}.", { map: mapVersion, generator: VERSION })}
      <p id="errorBox">${parseError(error as Error)}</p>`;

    $("#alert").dialog({
      resizable: false,
      title: t("Loading error"),
      maxWidth: "40em",
      buttons: {
        [t("Clear cache")]: () => clearCache(),
        [t("Select file")]: function (this: HTMLElement) {
          $(this).dialog("close");
          pickMapFile();
        },
        [t("New Map")]: function (this: HTMLElement) {
          $(this).dialog("close");
          regenerateMap("loading error");
        },
        [t("Cancel")]: function (this: HTMLElement) {
          $(this).dialog("close");
        }
      },
      position: { my: "center", at: "center", of: "svg" }
    });
  } finally {
    if (isLogGroupOpen) console.groupEnd();
  }
}

export const Load = {
  quickLoad,
  loadFromDropbox,
  createSharableDropboxLink,
  loadMapFromURL,
  showUploadErrorMessage,
  uploadMap
};
