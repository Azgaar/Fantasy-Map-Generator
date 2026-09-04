// Everything the app reads from, or writes to, its own URL: what to load on start-up, where to focus,
// and the shareable link. Deep links come from the wiki, from shared maps and from MFCG
import { leastIndex, select } from "d3";
import { fitMapToScreen } from "@/components/canvas";
import { Layers } from "@/components/layers";
import { applyLayersPreset, applyURLLayers } from "@/components/layers-presets";
import { type GenerationConfig, generate } from "@/components/lifecycle";
import { tip } from "@/components/tooltips";
import { zoomTo } from "@/components/zoom";
import type { Burg } from "@/generators/burgs-generator";
import { Services } from "@/services";
import { toggleAssistant } from "@/services/assistant";
import { ensureEl } from "@/utils/nodeUtils";

const MAP_LINK_PATTERN = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;

const searchParams = () => new URL(window.location.href).searchParams;

/** Decide what to put on screen on start-up: a linked map, a stored map, or a fresh one */
export async function checkLoadParameters(): Promise<void> {
  const params = searchParams();

  // a linked map is generated at the size the link asks for, whatever the window measures
  const size = { width: +(params.get("width") ?? 0), height: +(params.get("height") ?? 0) };

  const maplink = params.get("maplink");
  if (maplink) {
    WARN && console.warn("Load map from URL");
    if (MAP_LINK_PATTERN.test(maplink)) {
      setTimeout(() => Services.Load.loadMapFromURL(maplink, true), 1000);
      return;
    }
    Services.Load.showUploadErrorMessage("Map link is not a valid URL", maplink);
  }

  // a seed provided by the user or by MFCG: generate the map it describes
  if (params.get("seed")) {
    WARN && console.warn("Generate map for seed", params.get("seed"));
    await generateMapOnLoad(size);
    return;
  }

  if (options.app.onLoad === "lastSaved") {
    try {
      const blob = await ldb.get("lastMap");
      if (blob) {
        WARN && console.warn("Loading last stored map");
        Services.Load.uploadMap(blob);
        return;
      }
    } catch (error) {
      ERROR && console.error(error);
    }
  }

  WARN && console.warn("Generate random map");
  generateMapOnLoad(size);
}

/** The start-up path: style, world, layers, then wherever the URL says to look */
export async function generateMapOnLoad(config?: GenerationConfig): Promise<void> {
  await applyStyleOnLoad(); // the previously selected default or custom style
  await generate(config);
  applyLayersPreset();
  Layers.drawAll();
  fitMapToScreen();
  focusOn();
  toggleAssistant();
}

/** Apply the layer and viewport parameters once the map exists */
export function focusOn(): void {
  const params = searchParams();
  applyURLLayers(params);

  if (params.get("from") === "MFCG" && document.referrer) {
    const mfcgSeed = params.get("seed") ?? "";
    // a 13-char MFCG seed carries the burg id in its last 4 digits: show that burg back
    if (mfcgSeed.length === 13) params.set("burg", mfcgSeed.slice(-4));
    else {
      findBurgForMFCG(params); // otherwise pick a burg matching what MFCG generated
      return;
    }
  }

  const scaleParam = params.get("scale");
  const cellParam = params.get("cell");
  const burgParam = params.get("burg");
  if (!scaleParam && !cellParam && !burgParam) return;

  const zoom = +(scaleParam ?? 0) || 8;

  if (cellParam) {
    const [x, y] = pack.cells.p[+cellParam];
    zoomTo(x, y, zoom, 1600);
    return;
  }

  if (burgParam) {
    const burg = Number.isNaN(+burgParam) ? pack.burgs.find(b => b.name === burgParam) : pack.burgs[+burgParam];
    if (burg) zoomTo(burg.x, burg.y, zoom, 1600);
    return;
  }

  zoomTo(
    +(params.get("x") ?? 0) || facts.graph.width / 2,
    +(params.get("y") ?? 0) || facts.graph.height / 2,
    zoom,
    1600
  );
}

/** Pick the burg that best matches the settlement MFCG generated, adopt its data and focus on it */
function findBurgForMFCG(params: URLSearchParams): void {
  const { cells } = pack;
  const burgs = pack.burgs;
  if (burgs.length < 2) return void (ERROR && console.error("Cannot select a burg for MFCG"));

  const size = +(params.get("size") ?? 0);
  const coast = +(params.get("coast") ?? 0);
  const port = +(params.get("port") ?? 0);
  const river = +(params.get("river") ?? 0);

  const defineSelection = (coast: number | boolean, port: number | boolean, river: number | boolean) => {
    if (port && river) return burgs.filter(b => b.port && cells.r[b.cell]);
    if (!port && coast && river) return burgs.filter(b => !b.port && cells.t[b.cell] === 1 && cells.r[b.cell]);
    if (!coast && !river) return burgs.filter(b => cells.t[b.cell] !== 1 && !cells.r[b.cell]);
    if (!coast && river) return burgs.filter(b => cells.t[b.cell] !== 1 && cells.r[b.cell]);
    if (coast && river) return burgs.filter(b => cells.t[b.cell] === 1 && cells.r[b.cell]);
    return [];
  };

  let selection = defineSelection(coast, port, river);
  if (!selection.length) selection = defineSelection(coast, !port, !river);
  if (!selection.length) selection = defineSelection(!coast, 0, !river);
  if (!selection.length) selection = [burgs[1]]; // nothing matches: take the first burg

  // of the candidates, the one whose population is closest to what MFCG drew
  const distance = (burg: Burg) => Math.abs((burg.population ?? 0) - size);
  const closest = leastIndex(selection, (a, b) => distance(a) - distance(b));
  const burgId = closest === undefined ? 0 : selection[closest].i;
  if (!burgId) return void (ERROR && console.error("Cannot select a burg for MFCG"));

  const burg = burgs[burgId];
  for (const [key, value] of new URL(document.referrer).searchParams) {
    if (key === "name") burg.name = value;
    else if (key === "size") burg.population = +value;
    else if (key === "seed") burg.MFCG = value;
    else if (key === "shantytown") burg.shanty = +value;
    else (burg as unknown as Record<string, unknown>)[key] = +value;
  }
  const name = params.get("name");
  if (name && name !== "null") burg.name = name;

  // highlight the renamed label until the user notices it
  const label = select<SVGTextElement, unknown>(`#labels [data-label-type='burg'][data-id='${burgId}']`);
  if (!label.empty()) {
    label
      .text(burg.name ?? "")
      .classed("drag", true)
      .on("mouseover", function () {
        select(this).classed("drag", false);
        label.on("mouseover", null);
      });
  }

  zoomTo(burg.x, burg.y, 8, 1600);
  tip(`Here stands the glorious city of ${burg.name}`, true, "success", 15000);
}

/** Copy a link that reproduces the current map: the seed, the canvas size and whether options are pinned */
export function copyMapURL(): void {
  const isRandomized = !document.querySelectorAll("i.icon-lock").length;
  const seedValue = ensureEl<HTMLInputElement>("seedInput").value;
  const search = `?seed=${seedValue}&width=${facts.graph.width}&height=${facts.graph.height}${isRandomized ? "&options=default" : ""}`;

  navigator.clipboard
    .writeText(location.host + location.pathname + search)
    .then(() => tip("Map URL is copied to clipboard", false, "success", 3000))
    .catch(error => tip(`Could not copy URL: ${error}`, false, "error", 5000));
}

// Legacy seam: the loader refocuses after a map is loaded, options.js wires the copy button
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var focusOn: () => void;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var generateMapOnLoad: () => void;
  interface Window {
    copyMapURL: typeof copyMapURL;
  }
}
window.focusOn = focusOn;
window.generateMapOnLoad = generateMapOnLoad;
window.copyMapURL = copyMapURL;
