import type { Selection } from "d3";
import { select } from "d3";
import { connectVertices, ensureEl, getBase64, getCoordinates, getGridPolygon, rn, unique } from "@/utils";

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
  noViewbox?: boolean; // accepted by some callers (view-3d); currently unused here
}

async function exportToSvg(): Promise<void> {
  TIME && console.time("exportToSvg");
  try {
    const url = await getMapURL("svg", { fullMap: true });
    const link = document.createElement("a");
    link.download = `${getFileName()}.svg`;
    link.href = url;
    link.click();

    const message = `${link.download} is saved. Open 'Downloads' screen (CTRL + J) to check`;
    tip(message, true, "success", 5000);
  } catch (error) {
    ERROR && console.error(error);
    tip(`SVG export failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 5000);
  } finally {
    TIME && console.timeEnd("exportToSvg");
  }
}

async function exportToPng(): Promise<void> {
  TIME && console.time("exportToPng");
  try {
    const url = await getMapURL("png");
    const resolution = ensureEl<HTMLInputElement>("pngResolutionInput").valueAsNumber;
    const link = document.createElement("a");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = svgWidth * resolution;
    canvas.height = svgHeight * resolution;

    const blob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error("Cannot render PNG image"));
          resolve(blob);
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Cannot load map image for PNG export"));
      img.src = url;
    });

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
    const url = await getMapURL("png");
    const resolution = ensureEl<HTMLInputElement>("pngResolutionInput").valueAsNumber;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = svgWidth * resolution;
    canvas.height = svgHeight * resolution;

    const quality = Math.min(rn(1 - resolution / 20, 2), 0.92);
    const blob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error("Cannot render JPEG image"));
            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Cannot load map image for JPEG export"));
      img.src = url;
    });

    const link = document.createElement("a");
    link.download = `${getFileName()}.jpeg`;
    link.href = window.URL.createObjectURL(blob);
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.setTimeout(() => window.URL.revokeObjectURL(link.href), 5000);
  } catch (error) {
    ERROR && console.error(error);
    tip(`JPEG export failed: ${(error as Error)?.message || "Unknown error"}`, true, "error", 5000);
  } finally {
    TIME && console.timeEnd("exportToJpeg");
  }
}

async function exportToPngTiles(): Promise<void> {
  const status = ensureEl("tileStatus");
  status.innerHTML = "Preparing files...";

  const urlSchema = await getMapURL("tiles", { debug: true, fullMap: true });
  await loadScript("libs/jszip.min.js");
  const zip = new window.JSZip();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = graphWidth;
  canvas.height = graphHeight;

  const imgSchema = new Image();
  imgSchema.src = urlSchema;
  await loadImage(imgSchema);

  status.innerHTML = "Rendering schema...";
  ctx.drawImage(imgSchema, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/png");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  zip.file("schema.png", blob);

  // download tiles
  const url = await getMapURL("tiles", { fullMap: true });
  const tilesX = +ensureEl<HTMLInputElement>("tileColsOutput").value || 2;
  const tilesY = +ensureEl<HTMLInputElement>("tileRowsOutput").value || 2;
  const scale = +ensureEl<HTMLInputElement>("tileScaleOutput").value || 1;
  const tolesTotal = tilesX * tilesY;

  const tileW = (graphWidth / tilesX) | 0;
  const tileH = (graphHeight / tilesY) | 0;

  const width = graphWidth * scale;
  const height = width * (tileH / tileW);
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  img.src = url;
  await loadImage(img);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function getRowLabel(row: number) {
    const first = row >= alphabet.length ? alphabet[Math.floor(row / alphabet.length) - 1] : "";
    const last = alphabet[row % alphabet.length];
    return first + last;
  }

  for (let y = 0, row = 0, id = 1; y + tileH <= graphHeight; y += tileH, row++) {
    const rowName = getRowLabel(row);

    for (let x = 0, cell = 1; x + tileW <= graphWidth; x += tileW, cell++, id++) {
      status.innerHTML = `Rendering tile ${rowName}${cell} (${id} of ${tolesTotal})...`;
      ctx.drawImage(img, x, y, tileW, tileH, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, "image/png");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      zip.file(`${rowName}${cell}.png`, blob);
    }
  }

  status.innerHTML = "Zipping files...";
  zip
    .generateAsync({ type: "blob" })
    .then((blob: Blob) => {
      status.innerHTML = "Downloading the archive...";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${getFileName()}.zip`;
      link.click();
      link.remove();

      status.innerHTML = 'Done. Check .zip file in "Downloads" (CTRL + J)';
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    })
    .catch((error: Error) => {
      ERROR && console.error(error);
      status.innerHTML = "Tiles export failed";
      tip(`PNG tiles export failed: ${error?.message || "Unknown error"}`, true, "error", 5000);
    });

  // promisified img.onload
  function loadImage(img: HTMLImageElement) {
    return new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = err => reject(err);
    });
  }

  // promisified canvas.toBlob
  function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, qualityArgument = 1) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob() error"));
        },
        mimeType,
        qualityArgument
      );
    });
  }
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

  const cloneEl = (document.getElementById("map") as unknown as SVGSVGElement).cloneNode(true) as SVGSVGElement; // clone svg
  cloneEl.id = "fantasyMap";
  document.body.appendChild(cloneEl);
  const clone: MapSelection = select(cloneEl);
  if (!debug) clone.select("#debug").remove();

  const cloneDefs = cloneEl.getElementsByTagName("defs")[0];
  const svgDefs = document.getElementById("defElements") as unknown as SVGSVGElement;

  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  if (isFirefox && type === "mesh") clone.select("#oceanPattern").remove();
  if (noLabels) {
    clone.select("#labels #states").remove();
    clone.select("#labels #burgLabels").remove();
    clone.select("#icons #burgIcons").remove();
  }
  if (noWater) {
    clone.select("#oceanBase").attr("opacity", 0);
    clone.select("#oceanPattern").attr("opacity", 0);
  }
  if (noIce) clone.select("#ice").remove();
  if (noVignette) clone.select("#vignette").remove();
  if (fullMap) {
    // reset transform to show the whole map
    clone.attr("width", graphWidth).attr("height", graphHeight);
    clone.select("#viewbox").attr("transform", null);

    if (!noScaleBar) {
      drawScaleBar(clone.select("#scaleBar") as unknown as Parameters<typeof drawScaleBar>[0], 1);
      fitScaleBar(clone.select("#scaleBar") as unknown as Parameters<typeof fitScaleBar>[0], graphWidth, graphHeight);
    }
  }
  if (noScaleBar) clone.select("#scaleBar").remove();

  if (type === "svg") removeUnusedElements(clone);
  if (customization && type === "mesh") updateMeshCells(clone);
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

  // add displayed emblems
  if (layerIsOn("toggleEmblems") && emblems.selectAll("use").size()) {
    cloneEl
      .getElementById("emblems")
      ?.querySelectorAll("use")
      .forEach(el => {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href");
        if (!href) return;
        const emblem = document.getElementById(href.slice(1));
        if (emblem) cloneDefs.append(emblem.cloneNode(true));
      });
  } else {
    cloneDefs.querySelector("#defs-emblems")?.remove();
  }

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
    }

    const defsRelief = svgDefs.getElementById("defs-relief");
    for (const terrain of [...uniqueElements]) {
      if (!terrain) continue;
      const element = defsRelief?.querySelector(terrain);
      if (element) cloneDefs.appendChild(element.cloneNode(true));
    }
  }

  // add wind rose
  if (cloneEl.getElementById("compass")) {
    const rose = svgDefs.getElementById("defs-compass-rose");
    if (rose) cloneDefs.appendChild(rose.cloneNode(true));
  }

  // add burs icons
  if (cloneEl.getElementById("burgIcons")) {
    const groups = cloneEl.getElementById("burgIcons")!.querySelectorAll("g");
    for (const group of Array.from(groups)) {
      const icon = group.dataset.icon && svgDefs.querySelector(group.dataset.icon);
      if (icon) cloneDefs.appendChild(icon.cloneNode(true));
    }
  }

  // add goods icons
  if (cloneEl.getElementById("goodsIcons") || cloneEl.getElementById("goodsBurgs")) {
    const uniqueIcons = new Set<string>();
    const goodsUseElements = cloneEl.querySelectorAll("#goodsIcons use, #goodsBurgs use");
    for (const el of goodsUseElements) {
      const href = el.getAttribute("href") || el.getAttribute("xlink:href");
      if (href) uniqueIcons.add(href);
    }
    const goodsIconsDefs = svgDefs.getElementById("good-icons");
    for (const href of uniqueIcons) {
      const element = goodsIconsDefs?.querySelector(href);
      if (element) cloneDefs.appendChild(element.cloneNode(true));
    }
  }

  // add port icon
  if (cloneEl.getElementById("anchors")) {
    const anchor = svgDefs.getElementById("icon-anchor");
    if (anchor) cloneDefs.appendChild(anchor.cloneNode(true));
  }

  // add grid pattern
  if (cloneEl.getElementById("gridOverlay")?.hasChildNodes()) {
    const type = cloneEl.getElementById("gridOverlay")!.getAttribute("type");
    const pattern = svgDefs.getElementById(`pattern_${type}`);
    if (pattern) cloneDefs.appendChild(pattern.cloneNode(true));
  }

  {
    // replace external marker icons
    const externalMarkerImages = cloneEl.querySelectorAll<SVGImageElement>('#markers image[href]:not([href=""])');
    const imageHrefs = Array.from(externalMarkerImages).map(img => img.getAttribute("href"));

    for (const url of imageHrefs) {
      if (!url) continue;
      await new Promise<void>(resolve => {
        getBase64(url, base64 => {
          externalMarkerImages.forEach(img => {
            if (typeof base64 === "string" && img.getAttribute("href") === url) img.setAttribute("href", base64);
          });
          resolve();
        });
      });
    }
  }

  {
    // replace external regiment icons
    const externalRegimentImages = cloneEl.querySelectorAll<SVGImageElement>('#armies image[href]:not([href=""])');
    const imageHrefs = Array.from(externalRegimentImages).map(img => img.getAttribute("href"));

    for (const url of imageHrefs) {
      if (!url) continue;
      await new Promise<void>(resolve => {
        getBase64(url, base64 => {
          externalRegimentImages.forEach(img => {
            if (typeof base64 === "string" && img.getAttribute("href") === url) img.setAttribute("href", base64);
          });
          resolve();
        });
      });
    }
  }

  if (!cloneEl.getElementById("fogging-cont")) cloneEl.getElementById("fog")?.remove(); // remove unused fog
  if (!cloneEl.getElementById("regions")) cloneEl.getElementById("statePaths")?.remove(); // removed unused statePaths
  if (!cloneEl.getElementById("labels")) cloneEl.getElementById("textPaths")?.remove(); // removed unused textPaths

  // add armies style
  if (cloneEl.getElementById("armies")) {
    cloneEl.insertAdjacentHTML(
      "afterbegin",
      "<style>#armies text {stroke: none; fill: #fff; text-shadow: 0 0 4px #000; dominant-baseline: central; text-anchor: middle; font-family: Helvetica; fill-opacity: 1;}#armies text.regimentIcon {font-size: .8em;}</style>"
    );
  }

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
  if (!terrain.selectAll("use").size()) clone.select("#defs-relief").remove();

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

function updateMeshCells(clone: MapSelection): void {
  const renderOcean = ensureEl<HTMLInputElement>("renderOcean").checked;
  const data = renderOcean ? grid.cells.i : grid.cells.i.filter((i: number) => grid.cells.h[i] >= 20);
  const scheme = getColorScheme(terrs.select("#landHeights").attr("scheme"));
  clone.select("#heights").attr("filter", "url(#blur1)");
  clone
    .select("#heights")
    .selectAll("polygon")
    .data(data as number[])
    .join("polygon")
    .attr("points", (d: number) => getGridPolygon(d, grid))
    .attr("id", (d: number) => `cell${d}`)
    .attr("stroke", (d: number) => getColor(grid.cells.h[d], scheme));
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
    const [r, u] = getCellPopulation(i);
    return rn(r + u);
  };

  const getHeight = (i: number) => parseInt(getFriendlyHeight(cells.p[i]), 10);

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
  getMapURL,
  saveGeoJsonCells,
  saveGeoJsonRoutes,
  saveGeoJsonRivers,
  saveGeoJsonMarkers,
  saveGeoJsonZones
};
