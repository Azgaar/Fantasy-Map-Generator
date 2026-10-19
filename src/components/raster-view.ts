// Raster map rendering: the map is shown from bitmaps on a canvas under the SVG, which stays invisible for hit
// testing. A whole-map overview covers any view at once; 512px tiles sharpen the view, rasterized off the main
// thread from one SVG snapshot per zoom level, nearest the centre first. Once shown, the screen is always raster
import { type LayerId, Layers } from "@/components/layers";
import { viewport } from "@/components/viewport";
import { suspendOceanCache } from "@/renderers/ocean-cache";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { ensureEl } from "@/utils/nodeUtils";

const LIVE_LAYERS: readonly LayerId[] = ["coordinates", "trade", "journeys", "rulers", "debug"]; // animated, per frame or transient
const TILE = 512; // device pixels
const MAX_TILES = 160; // 1 MB each
const MAX_SOURCES = 3;
const MAX_OVERVIEW_PIXELS = 16_000_000; // iOS Safari's canvas area limit
const MAX_OVERVIEW_DENSITY = 8; // bitmap pixels per map unit
const CONCURRENCY = 2;
const IDLE_DELAY = 150; // after a gesture or an edit, before new work starts

/** The map exported as SVG with labels sized for one zoom level, decoded once and cut into tiles */
interface Source {
  level: number;
  version: number;
  image: HTMLImageElement;
}

interface Tile {
  level: number;
  density: number; // device pixel ratio it was cut for
  col: number;
  row: number;
  version: number;
  bitmap: ImageBitmap;
  used: number;
}

class RasterViewModule {
  private canvas: HTMLCanvasElement | null = null;
  private observer: MutationObserver | null = null;
  private overview: { bitmap: ImageBitmap; version: number } | null = null;
  private tiles = new Map<string, Tile>();
  private pending = new Set<string>(); // tiles and the overview being rasterized
  private sources: Source[] = [];
  private version = 0; // bumped by every edit
  private session = 0; // bumped when turned off: work started before is dropped
  private building = false; // a source being exported, the only step that blocks
  private failedVersion = -1;
  private moving = false;
  private timer = 0;

  setEnabled(on: boolean): void {
    if (on === Boolean(this.canvas)) return;
    if (on) this.enable();
    else this.disable();
  }

  /** Every camera frame: move the bitmaps with the camera. False before the first bitmap, when the SVG shows */
  follow(): boolean {
    if (!this.canvas) return false;
    this.moving = true;
    window.clearTimeout(this.timer);
    this.present();
    this.canvas.toggleAttribute("data-moving", !this.canvas.hidden);
    return !this.canvas.hidden;
  }

  /** Gesture end: fill the view with tiles for its zoom */
  settle(): void {
    if (!this.canvas) return;
    this.moving = false;
    this.observer?.takeRecords(); // the SVG catching up with the camera is not an edit
    this.canvas.removeAttribute("data-moving");
    this.present();
    this.schedule();
  }

  private enable(): void {
    const map = ensureEl("map");
    this.injectStyle();
    this.canvas = document.createElement("canvas");
    this.canvas.id = "rasterView";
    this.canvas.hidden = true;
    this.canvas.style.backgroundColor = getComputedStyle(map).backgroundColor;
    map.before(this.canvas);
    suspendOceanCache(true); // the bitmaps do its job; its async swaps would read as edits

    // any change inside the camera is an edit, except in live layers or the camera transform itself
    const viewbox = ensureEl("viewbox");
    const live = this.liveSelector();
    const isEdit = ({ target, type }: MutationRecord) => {
      if (target === viewbox) return type === "childList";
      const element = target instanceof Element ? target : target.parentElement;
      return !element?.closest(live);
    };
    this.observer = new MutationObserver(records => {
      if (records.some(isEdit)) this.invalidate();
    });
    this.observer.observe(viewbox, { subtree: true, childList: true, attributes: true, characterData: true });
    this.invalidate();
  }

  private disable(): void {
    this.session++;
    window.clearTimeout(this.timer);
    this.observer?.disconnect();
    this.observer = null;
    suspendOceanCache(false);
    this.overview?.bitmap.close();
    this.overview = null;
    for (const tile of this.tiles.values()) tile.bitmap.close();
    this.tiles.clear();
    this.pending.clear();
    this.sources = [];
    this.building = false;
    this.canvas?.remove();
    this.canvas = null;
  }

  private injectStyle(): void {
    if (document.getElementById("rasterViewStyle")) return;
    const live = this.liveSelector();
    const style = document.createElement("style");
    style.id = "rasterViewStyle";
    // painted hits what a visible map would hit, ignoring visibility; during a gesture the SVG is left behind
    style.textContent = `
      #rasterView { position: absolute; z-index: -1; pointer-events: none; }
      #rasterView:not([hidden]) + #map { background-color: transparent; }
      #rasterView:not([hidden]) + #map #viewbox { visibility: hidden; pointer-events: painted; }
      #rasterView:not([hidden]) + #map :is(${live}) { visibility: visible; }
      #rasterView[data-moving]:not([hidden]) + #map #viewbox { display: none; }`;
    document.head.append(style);
  }

  private liveSelector(): string {
    return LIVE_LAYERS.map(id => `#${Layers.get(id).elementId}`).join(", ");
  }

  /** A layer the bitmaps hold: inside the camera and not live */
  private isBaked(id: LayerId): boolean {
    return Layers.get(id).parent === "viewbox" && !LIVE_LAYERS.includes(id);
  }

  /** The bitmaps on screen stay until their replacements are ready */
  private invalidate(): void {
    this.version++;
    this.sources = [];
    this.schedule();
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.pump(), IDLE_DELAY);
  }

  /** Start the next jobs: the overview first, then the view's missing tiles, nearest the centre first */
  private pump(): void {
    if (!this.canvas || this.moving) return;
    while (this.pending.size < CONCURRENCY) {
      if (this.overview?.version !== this.version && !this.pending.has("overview")) {
        const source = this.getSource(1);
        if (!source) return;
        void this.run("overview", () => this.renderOverview(source));
        continue;
      }
      const level = getLevel();
      const [missing] = this.getMissingTiles(level);
      if (!missing) return;
      const source = this.getSource(level);
      if (!source) return;
      void this.run(missing.key, () => this.renderTile(source, missing.col, missing.row));
    }
  }

  private async run(key: string, job: () => Promise<void>): Promise<void> {
    const { session } = this;
    this.pending.add(key);
    try {
      await job();
    } catch (error) {
      ERROR && console.error("Raster view: cannot draw the map", error);
    } finally {
      if (session === this.session) {
        this.pending.delete(key);
        this.present();
        this.pump();
      }
    }
  }

  /** The current snapshot for a zoom level; exports one if missing, so the caller waits for the next pump */
  private getSource(level: number): Source | undefined {
    const source = this.sources.find(source => source.level === level && source.version === this.version);
    if (!source && !this.building && this.failedVersion !== this.version) void this.buildSource(level);
    return source;
  }

  private async buildSource(level: number): Promise<void> {
    const { session, version } = this;
    this.building = true;
    try {
      const { width, height } = options.map.graph;
      const region = { x0: 0, y0: 0, x1: width, y1: height, width: width * level, height: height * level };
      const exclude = Layers.all.filter(layer => !this.isBaked(layer.id)).map(layer => layer.elementId);
      const { ExportMap } = await import("@/services/io/export");
      const url = await ExportMap.getMapURL("png", { region, exclude });
      const image = new Image();
      image.src = url;
      await image.decode();
      if (session !== this.session || version !== this.version) return;
      this.sources = [{ level, version, image }, ...this.sources].slice(0, MAX_SOURCES);
    } catch (error) {
      this.failedVersion = version; // no retry until the next edit
      ERROR && console.error("Raster view: cannot export the map", error);
    } finally {
      if (session === this.session) {
        this.building = false;
        this.pump();
      }
    }
  }

  private async renderOverview(source: Source): Promise<void> {
    const { width, height } = options.map.graph;
    const density = Math.min(MAX_OVERVIEW_DENSITY, Math.sqrt(MAX_OVERVIEW_PIXELS / (width * height)));
    const size = [Math.floor(width * density), Math.floor(height * density)] as const;
    const bitmap = await rasterize(source.image, [0, 0, width, height], size);
    if (!this.canvas || (this.overview && this.overview.version > source.version)) return bitmap.close();
    this.overview?.bitmap.close();
    this.overview = { bitmap, version: source.version };
  }

  private async renderTile(source: Source, col: number, row: number): Promise<void> {
    const density = window.devicePixelRatio;
    const side = TILE / density; // source pixels: the source is drawn at the level's scale
    const bitmap = await rasterize(source.image, [col * side, row * side, side, side], [TILE, TILE]);
    const key = tileKey(source.level, density, col, row);
    const old = this.tiles.get(key);
    if (!this.canvas || (old && old.version > source.version)) return bitmap.close();
    old?.bitmap.close();
    this.tiles.set(key, { level: source.level, density, col, row, version: source.version, bitmap, used: 0 });
    this.evict();
  }

  /** The view's tiles plus a one-tile margin that are missing or outdated, nearest the centre first */
  private getMissingTiles(level: number): ViewTile[] {
    if (!this.needsTiles(level)) return [];
    return getViewTiles(level)
      .filter(({ key }) => !this.pending.has(key) && this.tiles.get(key)?.version !== this.version)
      .sort((a, b) => a.distance - b.distance);
  }

  /** Over the budget, drop the tiles drawn least recently; the view's own tiles are never dropped */
  private evict(): void {
    if (this.tiles.size <= MAX_TILES) return;
    const kept = new Set(getViewTiles(getLevel()).map(({ key }) => key));
    const candidates = [...this.tiles.entries()].filter(([key]) => !kept.has(key));
    candidates.sort((a, b) => a[1].used - b[1].used);
    for (const [key, tile] of candidates.slice(0, this.tiles.size - MAX_TILES)) {
      tile.bitmap.close();
      this.tiles.delete(key);
    }
  }

  /** The canvas shows from the first overview on; the SVG shows only before it */
  private present(): void {
    const { canvas } = this;
    if (!canvas) return;
    const shown = Boolean(this.overview);
    if (shown) this.draw(canvas);
    canvas.hidden = !shown;
  }

  private draw(canvas: HTMLCanvasElement): void {
    const rect = ensureEl("map").getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      Object.assign(canvas.style, {
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    }

    const context = canvas.getContext("2d")!;
    const { scale, x, y } = viewport;
    const map = options.map.graph;
    context.clearRect(0, 0, width, height);
    if (this.overview) {
      context.drawImage(this.overview.bitmap, x * dpr, y * dpr, map.width * scale * dpr, map.height * scale * dpr);
    }

    // tiles only where the overview is too coarse: coarse levels first, the current level last, and within a
    // level outdated tiles under fresh ones
    const level = getLevel();
    if (!this.needsTiles(level)) return;
    const { x0, y0, x1, y1 } = ViewportLayers.getVisibleBounds();
    const order = (tile: Tile) =>
      (tile.level === level ? 1e6 : tile.level) * 2 + (tile.version === this.version ? 1 : 0);
    const visible = [...this.tiles.values()].filter(tile => {
      const side = TILE / (tile.level * tile.density);
      const [left, top] = [tile.col * side, tile.row * side];
      return left < x1 && top < y1 && left + side > x0 && top + side > y0;
    });
    const now = performance.now();
    for (const tile of visible.sort((a, b) => order(a) - order(b))) {
      const side = TILE / (tile.level * tile.density);
      const toScreen = (offset: number, unit: number) => Math.round((offset + unit * side * scale) * dpr); // no seams
      const [left, top] = [toScreen(x, tile.col), toScreen(y, tile.row)];
      const [right, bottom] = [toScreen(x, tile.col + 1), toScreen(y, tile.row + 1)];
      context.drawImage(tile.bitmap, left, top, right - left, bottom - top);
      tile.used = now;
    }
  }

  /** Tiles are cut only once the zoom outgrows the overview's density, so they wait for the overview */
  private needsTiles(level: number): boolean {
    return Boolean(this.overview) && overviewDensity(this.overview!.bitmap) < level * window.devicePixelRatio;
  }
}

interface ViewTile {
  key: string;
  col: number;
  row: number;
  distance: number; // from the view centre, in map units
}

/** The tiles of a level that cover the view, plus a one-tile margin */
function getViewTiles(level: number): ViewTile[] {
  const density = window.devicePixelRatio;
  const { x0, y0, x1, y1 } = ViewportLayers.getVisibleBounds();
  const { width, height } = options.map.graph;
  const side = TILE / (level * density); // map units
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const cols = [
    Math.max(0, Math.floor(x0 / side) - 1),
    Math.min(Math.ceil(width / side) - 1, Math.floor(x1 / side) + 1)
  ];
  const rows = [
    Math.max(0, Math.floor(y0 / side) - 1),
    Math.min(Math.ceil(height / side) - 1, Math.floor(y1 / side) + 1)
  ];

  const tiles: ViewTile[] = [];
  for (let col = cols[0]; col <= cols[1]; col++) {
    for (let row = rows[0]; row <= rows[1]; row++) {
      const distance = Math.hypot((col + 0.5) * side - cx, (row + 0.5) * side - cy);
      tiles.push({ key: tileKey(level, density, col, row), col, row, distance });
    }
  }
  return tiles;
}

const tileKey = (level: number, density: number, col: number, row: number) => `${level}/${density}/${col}/${row}`;
const overviewDensity = (bitmap: ImageBitmap): number => bitmap.width / options.map.graph.width;

/** The zoom level whose labels the view shows: a power of 2 */
const getLevel = (): number => 2 ** Math.max(0, Math.round(Math.log2(viewport.scale)));

/** Cut a box of the image into a bitmap of the given size, off the main thread where the browser can */
async function rasterize(
  image: HTMLImageElement,
  [sx, sy, sw, sh]: readonly number[],
  [width, height]: readonly number[]
): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(image, sx, sy, sw, sh, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high"
    });
  } catch {
    const canvas = new OffscreenCanvas(width, height); // a browser that cannot bitmap an SVG image
    canvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return canvas.transferToImageBitmap();
  }
}

export const RasterView = new RasterViewModule();
