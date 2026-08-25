import type { Selection } from "d3";
import { select } from "d3";
import { tip } from "@/components/tooltips";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import {
  getPixiRasterCapabilities,
  getPixiRendererCanvas,
  renderPixiRasterFrame
} from "@/renderers/pixi/pixi-renderer-controller";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { getUsedFonts, loadFontsAsDataURI } from "@/services/fonts";
import {
  connectVertices,
  downloadFile,
  ensureEl,
  getBase64,
  getCellPopulation,
  getCoordinates,
  getFileName,
  getFriendlyHeight,
  rn,
  unique
} from "@/utils";
import { createRasterExportPlan, getRasterExportHiddenLayers, throwIfRasterExportAborted } from "./raster-export";

type MapSelection = Selection<SVGSVGElement, unknown, null, undefined>;

// project canvas coordinates to geographic [lon, lat], rounded to 4 decimals
const toGeoCoordinates = (x: number, y: number) => getCoordinates(x, y, mapCoordinates, graphWidth, graphHeight, 4);

export interface GetMapURLOptions {
  debug?: boolean;
  noLabels?: boolean;
  noWater?: boolean;
  noScaleBar?: boolean;
  noIce?: boolean;
  noVignette?: boolean;
  fullMap?: boolean;
}

export interface FullMapRasterRequest {
  height?: number;
  width?: number;
}

function exportToSvg(): void {
  tip("SVG export is unavailable with the Pixi renderer. Use PNG or PNG tiles instead.", true, "error", 7000);
}

async function exportToPng(): Promise<void> {
  TIME && console.time("exportToPng");
  try {
    const resolution = ensureEl<HTMLInputElement>("pngResolutionInput").valueAsNumber;
    const link = document.createElement("a");
    const { blob, canvas } = await renderViewportRaster("image/png", resolution);

    link.download = `${getFileName()}.png`;
    link.href = window.URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => {
      canvas.remove();
      window.URL.revokeObjectURL(link.href);
    }, 1000);

    const message = `${link.download} is saved. Open 'Downloads' screen (CTRL + J) to check. You can set image scale in options`;
    tip(message, true, "success", 5000);
  } catch (error) {
    ERROR && console.error(error);
    tip(`PNG export failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 5000);
  } finally {
    TIME && console.timeEnd("exportToPng");
  }
}

async function exportToJpeg(): Promise<void> {
  TIME && console.time("exportToJpeg");
  try {
    const resolution = ensureEl<HTMLInputElement>("pngResolutionInput").valueAsNumber;
    const quality = Math.min(rn(1 - resolution / 20, 2), 0.92);
    const { blob, canvas } = await renderViewportRaster("image/jpeg", resolution, quality);

    const link = document.createElement("a");
    link.download = `${getFileName()}.jpeg`;
    link.href = window.URL.createObjectURL(blob);
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.setTimeout(() => {
      canvas.remove();
      window.URL.revokeObjectURL(link.href);
    }, 5000);
  } catch (error) {
    ERROR && console.error(error);
    tip(`JPEG export failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 5000);
  } finally {
    TIME && console.timeEnd("exportToJpeg");
  }
}

async function renderViewportRaster(
  mimeType: "image/jpeg" | "image/png",
  resolution: number,
  qualityArgument = 1
): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  const pixiCanvas = getPixiRendererCanvas();
  if (!pixiCanvas) throw new Error("Pixi renderer is not ready for raster export");

  // Pixi is the authoritative base renderer. The SVG image contains only layers
  // that have not migrated yet, so it is composited as a temporary overlay.
  const overlayUrl = await getMapURL("png");
  const overlay = await loadRasterImage(overlayUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Cannot initialize raster export canvas");

  canvas.width = svgWidth * resolution;
  canvas.height = svgHeight * resolution;
  context.drawImage(pixiCanvas, 0, 0, canvas.width, canvas.height);
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);

  return { blob: await canvasToBlob(canvas, mimeType, qualityArgument), canvas };
}

async function renderFullMapRaster(
  options: GetMapURLOptions = {},
  request: FullMapRasterRequest = {}
): Promise<HTMLCanvasElement> {
  if (graphWidth <= 0 || graphHeight <= 0) throw new Error("Map dimensions must be positive for raster export");

  const width = Math.max(1, Math.round(request.width ?? graphWidth));
  const height = Math.max(1, Math.round(request.height ?? graphHeight));
  const maxTextureSize = getPixiRasterCapabilities()?.maxTextureSize ?? 4096;
  const requestedResolution = Math.max(width / graphWidth, height / graphHeight);
  const resolution = Math.min(requestedResolution, maxTextureSize / graphWidth, maxTextureSize / graphHeight);
  const hiddenLayers = getRasterExportHiddenLayers(options);

  const base = renderPixiRasterFrame({
    frame: { height: graphHeight, width: graphWidth, x: 0, y: 0 },
    fullMap: { height: graphHeight, width: graphWidth },
    hiddenLayers,
    resolution,
    transparentBackground: options.noWater
  });

  try {
    const overlayUrl = await getMapURL("png", { ...options, fullMap: true });
    const overlay = await loadRasterImage(overlayUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot initialize full-map raster canvas");

    canvas.width = width;
    canvas.height = height;
    context.drawImage(base, 0, 0, width, height);
    context.drawImage(overlay, 0, 0, width, height);
    return canvas;
  } finally {
    base.remove();
  }
}

function loadRasterImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot load SVG overlay for raster export"));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, qualityArgument = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error(`Cannot render ${mimeType} image`));
      },
      mimeType,
      qualityArgument
    );
  });
}

let tileExportController: AbortController | null = null;

async function exportToPngTiles(): Promise<void> {
  tileExportController?.abort(new DOMException("Superseded by a new tile export", "AbortError"));
  const controller = new AbortController();
  tileExportController = controller;
  const { signal } = controller;
  const status = ensureEl("tileStatus");
  status.innerHTML = "Preparing files...";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const extractedCanvases = new Set<HTMLCanvasElement>();

  try {
    if (!context) throw new Error("Cannot initialize tile export canvas");
    await loadScript("libs/jszip.min.js");
    throwIfRasterExportAborted(signal);
    const zip = new window.JSZip();
    const maxTextureSize = getPixiRasterCapabilities()?.maxTextureSize ?? 4096;
    const requestedColumns = +ensureEl<HTMLInputElement>("tileColsOutput").value || 2;
    const requestedRows = +ensureEl<HTMLInputElement>("tileRowsOutput").value || 2;
    const resolution = +ensureEl<HTMLInputElement>("tileScaleOutput").value || 1;
    const plan = createRasterExportPlan({
      columns: requestedColumns,
      height: graphHeight,
      maxTextureSize,
      rows: requestedRows,
      scale: resolution,
      width: graphWidth
    });

    status.innerHTML = "Rendering schema...";
    const schemaResolution = Math.min(1, maxTextureSize / graphWidth, maxTextureSize / graphHeight);
    const schemaBase = renderPixiRasterFrame({
      frame: { height: graphHeight, width: graphWidth, x: 0, y: 0 },
      fullMap: { height: graphHeight, width: graphWidth },
      resolution: schemaResolution
    });
    extractedCanvases.add(schemaBase);
    const schemaOverlay = await loadRasterImage(await getMapURL("tiles", { debug: true, fullMap: true }));
    throwIfRasterExportAborted(signal);
    canvas.width = schemaBase.width;
    canvas.height = schemaBase.height;
    context.drawImage(schemaBase, 0, 0);
    context.drawImage(schemaOverlay, 0, 0, canvas.width, canvas.height);
    zip.file("schema.png", await canvasToBlob(canvas, "image/png"));
    schemaBase.remove();
    extractedCanvases.delete(schemaBase);

    const overlay = await loadRasterImage(await getMapURL("tiles", { fullMap: true }));
    throwIfRasterExportAborted(signal);
    for (const tile of plan.tiles) {
      throwIfRasterExportAborted(signal);
      const rowName = getTileRowLabel(tile.row);
      const tileName = `${rowName}${tile.column + 1}`;
      status.innerHTML = `Rendering tile ${tileName} (${tile.id} of ${plan.tiles.length})...`;
      const pixiFrame = renderPixiRasterFrame({
        frame: tile.frame,
        fullMap: { height: graphHeight, width: graphWidth },
        resolution
      });
      extractedCanvases.add(pixiFrame);
      canvas.width = tile.width;
      canvas.height = tile.height;
      context.drawImage(
        pixiFrame,
        tile.crop.x,
        tile.crop.y,
        tile.crop.width,
        tile.crop.height,
        0,
        0,
        tile.width,
        tile.height
      );
      pixiFrame.remove();
      extractedCanvases.delete(pixiFrame);
      context.drawImage(
        overlay,
        tile.content.x,
        tile.content.y,
        tile.content.width,
        tile.content.height,
        0,
        0,
        tile.width,
        tile.height
      );
      zip.file(`${tileName}.png`, await canvasToBlob(canvas, "image/png"));
    }

    status.innerHTML = "Zipping files...";
    const blob = await zip.generateAsync({ type: "blob" }, ({ percent }: { percent: number }) => {
      status.innerHTML = `Zipping files... ${Math.round(percent)}%`;
    });
    throwIfRasterExportAborted(signal);
    status.innerHTML = "Downloading the archive...";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${getFileName()}.zip`;
    link.click();
    link.remove();
    status.innerHTML = 'Done. Check .zip file in "Downloads" (CTRL + J)';
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      status.innerHTML = "Tile export canceled";
      return;
    }
    ERROR && console.error(error);
    status.innerHTML = "Tiles export failed";
    tip(`PNG tiles export failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 5000);
  } finally {
    for (const extractedCanvas of extractedCanvases) extractedCanvas.remove();
    canvas.remove();
    if (tileExportController === controller) tileExportController = null;
  }
}

function cancelPngTilesExport(): void {
  tileExportController?.abort(new DOMException("Export canceled", "AbortError"));
}

function getTileRowLabel(row: number): string {
  let value = row + 1;
  let label = "";
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

// parse map svg to object url
async function getMapURL(type: string, options: GetMapURLOptions = {}): Promise<string> {
  const {
    debug = false,
    noLabels = false,
    noWater = false,
    noScaleBar = false,
    noIce = false,
    noVignette = false,
    fullMap = false
  } = options;
  const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;
  cloneEl.id = "fantasyMap";
  document.body.appendChild(cloneEl);
  const clone: MapSelection = select(cloneEl);
  clone.select("#mapInteractionOverlay").remove();
  clone.select("#mapInteractionSurface").remove();
  if (!debug) clone.select("#debug").remove();

  const cloneDefs = cloneEl.getElementsByTagName("defs")[0];
  const svgDefs = ensureEl<SVGSVGElement>("defElements");

  if (fullMap) {
    // reset transform to show the whole map
    clone.attr("width", graphWidth).attr("height", graphHeight);
    clone.select("#viewbox").attr("transform", null);
    ViewportLayers.renderTo(cloneEl);

    if (!noScaleBar) {
      drawScaleBar(clone.select("#scaleBar") as unknown as Parameters<typeof drawScaleBar>[0], 1);
      fitScaleBar(clone.select("#scaleBar") as unknown as Parameters<typeof fitScaleBar>[0], graphWidth, graphHeight);
    }
  }
  if (noLabels) {
    clone.selectAll("#labels [data-label-type]").remove();
    clone.selectAll("#textPaths [data-label-type]").remove();
  }
  if (noWater) {
    clone.select("#oceanBase").attr("opacity", 0);
    clone.select("#oceanPattern").attr("opacity", 0);
  }
  if (noIce) clone.select("#ice").remove();
  if (noVignette) clone.select("#vignette").remove();
  if (noScaleBar) clone.select("#scaleBar").remove();

  if (type === "svg") removeUnusedElements(clone);
  inlineStyle(clone);

  // remove unused filters
  const filters = cloneEl.querySelectorAll("filter");
  for (let i = 0; i < filters.length; i++) {
    const id = filters[i].id;
    if (cloneEl.querySelector(`[filter='url(#${id})']`)) continue;
    if (cloneEl.getAttribute("filter") === `url(#${id})`) continue;
    filters[i].remove();
  }

  // remove unused patterns
  const patterns = cloneEl.querySelectorAll("pattern");
  for (let i = 0; i < patterns.length; i++) {
    const id = patterns[i].id;
    if (cloneEl.querySelector(`[fill='url(#${id})']`)) continue;
    patterns[i].remove();
  }

  // remove unused symbols
  const symbols = cloneEl.querySelectorAll("symbol");
  for (let i = 0; i < symbols.length; i++) {
    const id = symbols[i].id;
    if (cloneEl.querySelector(`use[*|href='#${id}']`)) continue;
    symbols[i].remove();
  }

  cloneDefs.querySelector("#defs-emblems")?.remove();

  {
    // replace ocean pattern href to base64
    const image = cloneEl.getElementById("oceanicPattern");
    const href = image?.getAttribute("href");
    if (image && href) {
      await new Promise<void>(resolve => {
        getBase64(href, base64 => {
          if (typeof base64 === "string") image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  {
    // replace texture href to base64
    const image = cloneEl.querySelector("#texture > image");
    const href = image?.getAttribute("href");
    if (image && href) {
      await new Promise<void>(resolve => {
        getBase64(href, base64 => {
          if (typeof base64 === "string") image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  // add relief icons
  if (cloneEl.getElementById("terrain")) {
    const uniqueElements = new Set<string | null>();
    const terrainNodes = cloneEl.getElementById("terrain")!.childNodes;
    for (let i = 0; i < terrainNodes.length; i++) {
      const node = terrainNodes[i] as Element;
      const href = node.getAttribute("href") || node.getAttribute("xlink:href");
      uniqueElements.add(href);
      node.removeAttribute("data-i"); // rendering index is not needed outside of the app
    }

    const defsRelief = svgDefs.getElementById("defs-relief");
    for (const terrain of [...uniqueElements]) {
      if (!terrain) continue;
      const element = defsRelief?.querySelector(terrain);
      if (element) cloneDefs.appendChild(element.cloneNode(true));
    }
  }

  if (!cloneEl.getElementById("fogging-cont")) cloneEl.getElementById("fog")?.remove(); // remove unused fog
  if (!cloneEl.getElementById("regions")) cloneEl.getElementById("statePaths")?.remove(); // removed unused statePaths
  if (!cloneEl.getElementById("labels")) cloneEl.getElementById("textPaths")?.remove(); // removed unused textPaths

  // add xlink: for href to support svg 1.1
  if (type === "svg") {
    cloneEl.querySelectorAll("[href]").forEach(el => {
      const href = el.getAttribute("href");
      el.removeAttribute("href");
      if (href) el.setAttribute("xlink:href", href);
    });
  }

  // add hatchings
  const hatchingUsers = cloneEl.querySelectorAll(`[fill^='url(#hatch']`);
  const hatchingFills = unique(Array.from(hatchingUsers).map(el => el.getAttribute("fill")));
  const hatchingIds = hatchingFills.map(fill => fill!.slice(5, -1));
  for (const hatchingId of hatchingIds) {
    const hatching = svgDefs.getElementById(hatchingId);
    if (hatching) cloneDefs.appendChild(hatching.cloneNode(true));
  }

  // load fonts
  const usedFonts = getUsedFonts(cloneEl);
  const fontsToLoad = usedFonts.filter(font => font.src);
  if (fontsToLoad.length) {
    const dataURLfonts = await loadFontsAsDataURI(fontsToLoad);

    const fontFaces = dataURLfonts
      .map(({ family, src, unicodeRange = "", variant = "normal" }) => {
        return `@font-face {font-family: "${family}"; src: ${src}; unicode-range: ${unicodeRange}; font-variant: ${variant};}`;
      })
      .join("\n");

    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = fontFaces;
    cloneEl.querySelector("defs")!.appendChild(style);
  }

  clone.remove();

  const serialized = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${new XMLSerializer().serializeToString(cloneEl)}`;
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  return url;
}

// remove hidden g elements and g elements without children to make downloaded svg smaller in size
function removeUnusedElements(clone: MapSelection): void {
  if (!pack.relief?.length) clone.select("#defs-relief").remove();

  for (let empty = 1; empty; ) {
    empty = 0;
    clone.selectAll<SVGGElement, unknown>("g").each(function () {
      if (!this.hasChildNodes() || this.style.display === "none" || this.classList.contains("hidden")) {
        empty++;
        this.remove();
      }
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
  }
}

// for each g element get inline style
function inlineStyle(clone: MapSelection): void {
  const emptyG = clone.append("g").node()!;
  const defaultStyles = window.getComputedStyle(emptyG);

  clone.selectAll<SVGElement, unknown>("g, #ruler *, #scaleBar > text").each(function () {
    const compStyle = window.getComputedStyle(this);
    let style = "";

    for (let i = 0; i < compStyle.length; i++) {
      const key = compStyle[i];
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += `${key}:${value};`;
    }

    for (const key in compStyle) {
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += `${key}:${value};`;
    }

    if (style !== "") this.setAttribute("style", style);
  });

  emptyG.remove();
}

function saveGeoJsonCells(): void {
  const { cells, vertices } = pack;
  const json: { type: string; features: unknown[] } = { type: "FeatureCollection", features: [] };

  const getPopulation = (i: number) => {
    const [r, u] = getCellPopulation(i, pack);
    return rn(r + u);
  };

  const getHeight = (i: number) => parseInt(getFriendlyHeight(cells.p[i], pack, grid), 10);

  function getCellCoordinates(cellVertices: number[]) {
    const coordinates = cellVertices.map(vertex => {
      const [x, y] = vertices.p[vertex];
      return toGeoCoordinates(x, y);
    });
    return [[...coordinates, coordinates[0]]];
  }

  cells.i.forEach(i => {
    const coordinates = getCellCoordinates(cells.v[i]);
    const height = getHeight(i);
    const biome = cells.biome[i];
    const type = pack.features[cells.f[i]].type;
    const population = getPopulation(i);
    const state = cells.state[i];
    const province = cells.province[i];
    const culture = cells.culture[i];
    const religion = cells.religion[i];
    const neighbors = cells.c[i];

    const properties = { id: i, height, biome, type, population, state, province, culture, religion, neighbors };
    const feature = { type: "Feature", geometry: { type: "Polygon", coordinates }, properties };
    json.features.push(feature);
  });

  const fileName = `${getFileName("Cells")}.geojson`;
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonRoutes(): void {
  const features = pack.routes.map(route => {
    const { i, points, group } = route;
    const name = (route as { name?: string }).name ?? null;
    const coordinates = points.map(([x, y]) => toGeoCoordinates(x, y));
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { id: i, group, name }
    };
  });
  const json = { type: "FeatureCollection", features };

  const fileName = `${getFileName("Routes")}.geojson`;
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonRivers(): void {
  const features = pack.rivers.map(
    ({ i, cells, points, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, name, type }) => {
      if (!cells || cells.length < 2) return null;
      const meanderedPoints = Rivers.addMeandering(cells, points);
      const coordinates = meanderedPoints.map(([x, y]) => toGeoCoordinates(x, y));
      return {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { id: i, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, name, type }
      };
    }
  );
  const json = { type: "FeatureCollection", features };

  const fileName = `${getFileName("Rivers")}.geojson`;
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonMarkers(): void {
  const features = pack.markers.map(marker => {
    const { i, type, icon, x, y, size, fill, stroke } = marker as typeof marker & {
      size?: number;
      fill?: string;
      stroke?: string;
    };
    const coordinates = toGeoCoordinates(x, y);
    const note = notes.find(note => note.id === `marker${i}`);
    const properties = { id: i, type, icon, x, y, ...note, size, fill, stroke };
    return { type: "Feature", geometry: { type: "Point", coordinates }, properties };
  });

  const json = { type: "FeatureCollection", features };

  const fileName = `${getFileName("Markers")}.geojson`;
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJsonZones(): void {
  const { zones, cells, vertices } = pack;
  const json: { type: string; features: unknown[] } = { type: "FeatureCollection", features: [] };

  // Helper function to convert zone cells to polygon coordinates
  // Handles multiple disconnected components and holes properly
  function getZonePolygonCoordinates(zoneCells: number[]) {
    const cellsInZone = new Set(zoneCells);
    const ofSameType = (cellId: number) => cellsInZone.has(cellId);
    const ofDifferentType = (cellId: number) => !cellsInZone.has(cellId);

    const checkedCells = new Set<number>();
    const rings: number[][][] = []; // Array of LinearRings (each ring is an array of coordinates)

    // Find all boundary components by tracing each connected region
    for (const cellId of zoneCells) {
      if (checkedCells.has(cellId)) continue;

      // Check if this cell is on the boundary (has a neighbor outside the zone)
      const neighbors = cells.c[cellId];
      const onBorder = neighbors.some(ofDifferentType);
      if (!onBorder) continue;

      // Check if this is an inner lake (hole) - skip if so
      const feature = pack.features[cells.f[cellId]];
      if (feature.type === "lake" && feature.shoreline) {
        if (feature.shoreline.every(ofSameType)) continue;
      }

      // Find a starting vertex that's on the boundary
      const cellVertices = cells.v[cellId];
      let startingVertex = null;

      for (const vertexId of cellVertices) {
        const vertexCells = vertices.c[vertexId];
        if (vertexCells.some(ofDifferentType)) {
          startingVertex = vertexId;
          break;
        }
      }

      if (startingVertex === null) continue;

      // Use connectVertices to trace the boundary (reusing existing logic)
      const vertexChain = connectVertices({
        vertices,
        startingVertex,
        ofSameType,
        addToChecked: (cellId: number) => checkedCells.add(cellId),
        closeRing: false // We'll close it manually after converting to coordinates
      });

      if (vertexChain.length < 3) continue;

      // Convert vertex chain to coordinates
      const coordinates: number[][] = [];
      for (const vertexId of vertexChain) {
        const [x, y] = vertices.p[vertexId];
        coordinates.push(toGeoCoordinates(x, y));
      }

      // Close the ring (first coordinate = last coordinate)
      if (coordinates.length > 0) {
        coordinates.push(coordinates[0]);
      }

      // Only add ring if it has at least 4 positions (minimum for valid LinearRing)
      if (coordinates.length >= 4) {
        rings.push(coordinates);
      }
    }

    return rings;
  }

  // Filter and process zones
  zones.forEach(zone => {
    // Exclude hidden zones and zones with no cells
    if ((zone as { hidden?: boolean }).hidden || !zone.cells || zone.cells.length === 0) return;

    const rings = getZonePolygonCoordinates(zone.cells);

    // Skip if no valid rings were generated
    if (rings.length === 0) return;

    const properties = {
      id: zone.i,
      name: zone.name,
      type: zone.type,
      color: zone.color,
      cells: zone.cells
    };

    // If there's only one ring, use Polygon geometry
    if (rings.length === 1) {
      const feature = {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: rings },
        properties
      };
      json.features.push(feature);
    } else {
      // Multiple disconnected components: use MultiPolygon
      // Each component is wrapped in its own array
      const multiPolygonCoordinates = rings.map(ring => [ring]);
      const feature = {
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: multiPolygonCoordinates },
        properties
      };
      json.features.push(feature);
    }
  });

  const fileName = `${getFileName("Zones")}.geojson`;
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

// load a classic library bundle that registers a runtime global (e.g. window.JSZip)
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Cannot load script ${src}`));
    document.head.append(script);
  });
}

// reached lazily via Services.ExportMap
declare global {
  interface Window {
    JSZip: any; // registered on demand by libs/jszip.min.js (see exportToPngTiles)
  }
}

export const ExportMap = {
  exportToSvg,
  exportToPng,
  exportToJpeg,
  exportToPngTiles,
  cancelPngTilesExport,
  renderFullMapRaster,
  saveGeoJsonCells,
  saveGeoJsonRoutes,
  saveGeoJsonRivers,
  saveGeoJsonMarkers,
  saveGeoJsonZones
};
