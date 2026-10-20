import { createEl } from "@/utils/nodeUtils";
import { type Box, ViewportLayers, type ViewportRenderContext } from "./viewport/viewport-renderer";

interface RasterRegion extends Box {
  scale: number;
  width: number;
  height: number;
}

interface OceanCache {
  group: SVGGElement;
  source: SVGGElement;
  definitions: string[];
  region?: RasterRegion;
  url?: string;
  pending: boolean;
  revision: number;
}

const caches = new Map<string, OceanCache>();
const PADDING = 512;
const MAX_PIXELS = 16_000_000;
let observer: MutationObserver | undefined;
let registered = false;

/** Keep the editable vectors in defs; only the on-screen projection is rasterized. */
export function cacheOceanLayer(group: SVGGElement, definitions: string[]): void {
  clearOceanCache(group.id);
  if (!group.childElementCount) return;
  const source = createEl("g", `${group.id}-source`) as SVGGElement;
  const mask = group.getAttribute("mask");
  if (mask) {
    source.setAttribute("mask", mask);
    group.removeAttribute("mask");
  }
  source.append(...Array.from(group.childNodes));
  const defs = createEl("defs", "", { "data-ocean-cache": "" });
  defs.append(source);
  group.append(defs);
  const cache: OceanCache = { group, source, definitions, pending: false, revision: 0 };
  caches.set(group.id, cache);
  showVectors(cache);

  if (!registered) {
    ViewportLayers.register({ id: "ocean-cache", render });
    registered = true;
  }
  observer ??= new MutationObserver(invalidate);
  observer.disconnect();
  const features = document.getElementById("featurePaths");
  if (features) observer.observe(features, { subtree: true, childList: true, attributes: true });
  const viewbox = document.getElementById("viewbox");
  if (viewbox) observer.observe(viewbox, { attributes: true, attributeFilter: ["shape-rendering"] });
  render(ViewportLayers.getContext());
}

export function clearOceanCache(id: string): void {
  const cache = caches.get(id);
  if (cache?.url) URL.revokeObjectURL(cache.url);
  caches.delete(id);
  if (!caches.size) observer?.disconnect();
}

/** Saving and every export use the original paths and masks, never the viewport bitmap. */
export function restoreOceanVectors(root: ParentNode): void {
  for (const defs of root.querySelectorAll("defs[data-ocean-cache]")) {
    const group = defs.parentElement!;
    const source = defs.firstElementChild!;
    const mask = source.getAttribute("mask");
    if (mask) group.setAttribute("mask", mask);
    group.replaceChildren(...Array.from(source.childNodes));
  }
}

function invalidate(): void {
  for (const cache of caches.values()) {
    cache.revision++;
    cache.region = undefined;
    showVectors(cache);
  }
  render(ViewportLayers.getContext());
}

function showVectors(cache: OceanCache): void {
  if (cache.url) URL.revokeObjectURL(cache.url);
  cache.url = undefined;
  for (const child of Array.from(cache.group.children)) {
    if (child.localName !== "defs") child.remove();
  }
  cache.group.append(createEl("use", "", { href: `#${cache.source.id}` }));
}

function render({ root, bounds }: ViewportRenderContext): void {
  if (root !== document) {
    restoreOceanVectors(root);
    return;
  }
  for (const cache of caches.values()) {
    if (!cache.group.isConnected || cache.source.parentNode?.parentNode !== cache.group) {
      clearOceanCache(cache.group.id);
      continue;
    }
    const region = getRasterRegion(bounds, options.map.graph.width, options.map.graph.height, window.devicePixelRatio);
    if (!region || covers(cache.region, region, bounds)) continue;
    if (cache.region && !contains(cache.region, ViewportLayers.getVisibleBounds())) {
      cache.region = undefined;
      showVectors(cache);
    }
    if (cache.pending) continue;
    void rasterize(cache, region);
  }
}

export function getRasterRegion(
  bounds: Box & { scale: number },
  width: number,
  height: number,
  dpr: number
): RasterRegion | undefined {
  const padding = PADDING / bounds.scale;
  let x0 = Math.max(0, bounds.x0 - padding);
  let y0 = Math.max(0, bounds.y0 - padding);
  let x1 = Math.min(width, bounds.x1 + padding);
  let y1 = Math.min(height, bounds.y1 + padding);
  if (!(x1 > x0 && y1 > y0 && bounds.scale > 0)) return;
  const scale = Math.min(bounds.scale * dpr, Math.sqrt(MAX_PIXELS / ((x1 - x0) * (y1 - y0))));
  x0 = Math.floor(x0 * scale) / scale;
  y0 = Math.floor(y0 * scale) / scale;
  const pixelsX = Math.ceil((x1 - x0) * scale);
  const pixelsY = Math.ceil((y1 - y0) * scale);
  x1 = x0 + pixelsX / scale;
  y1 = y0 + pixelsY / scale;
  return { x0, y0, x1, y1, scale, width: pixelsX, height: pixelsY };
}

function covers(cached: RasterRegion | undefined, region: RasterRegion, bounds: Box): boolean {
  return Boolean(cached && Math.abs(cached.scale - region.scale) < 0.01 && contains(cached, bounds));
}

function contains(cached: Box, bounds: Box): boolean {
  return (
    cached.x0 <= Math.max(0, bounds.x0) &&
    cached.y0 <= Math.max(0, bounds.y0) &&
    cached.x1 >= Math.min(options.map.graph.width, bounds.x1) &&
    cached.y1 >= Math.min(options.map.graph.height, bounds.y1)
  );
}

function snapshot(cache: OceanCache, region: RasterRegion): string {
  const { x0, y0, x1, y1, width, height } = region;
  const svg = createEl("svg", "", {
    width: String(width),
    height: String(height),
    viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`,
    "shape-rendering": options.app.performance.shapeRendering
  });
  const defs = createEl("defs", "");
  for (const id of cache.definitions) {
    const definition = document.getElementById(id);
    if (definition) defs.append(definition.cloneNode(true));
  }
  const features = document.getElementById("featurePaths");
  if (features) defs.append(features.cloneNode(true));
  svg.append(defs, cache.source.cloneNode(true));
  return new XMLSerializer().serializeToString(svg);
}

function isCurrent(cache: OceanCache): boolean {
  return (
    caches.get(cache.group.id) === cache &&
    cache.group.isConnected &&
    cache.source.parentNode?.parentNode === cache.group
  );
}

async function rasterize(cache: OceanCache, region: RasterRegion): Promise<void> {
  cache.pending = true;
  const revision = cache.revision;
  let url: string | undefined;
  let completed = false;
  try {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot(cache, region))}`;
    await image.decode();
    if (!isCurrent(cache) || revision !== cache.revision) return;
    const canvas = document.createElement("canvas");
    canvas.width = region.width;
    canvas.height = region.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
    if (!blob || !isCurrent(cache) || revision !== cache.revision) return;
    url = URL.createObjectURL(blob);
    image.src = url;
    await image.decode();
    if (!isCurrent(cache) || revision !== cache.revision) return;
    const raster = createEl("image", "", {
      x: String(region.x0),
      y: String(region.y0),
      width: String(region.x1 - region.x0),
      height: String(region.y1 - region.y0),
      preserveAspectRatio: "none",
      href: url
    });
    for (const child of Array.from(cache.group.children)) if (child.localName !== "defs") child.remove();
    cache.group.append(raster);
    if (cache.url) URL.revokeObjectURL(cache.url);
    cache.url = url;
    cache.region = region;
    completed = true;
    url = undefined;
  } catch {
    if (isCurrent(cache)) {
      cache.region = undefined;
      showVectors(cache);
    }
  } finally {
    if (url) URL.revokeObjectURL(url);
    cache.pending = false;
    if (isCurrent(cache) && (completed || revision !== cache.revision)) {
      render(ViewportLayers.getContext());
    }
  }
}
