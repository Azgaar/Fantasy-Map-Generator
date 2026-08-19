import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import { buildBorderPaths } from "../draw-borders";
import { buildCellFillBatches } from "./pixi-map-data";

export type PixiMapTheme = "states" | "biomes";

export interface PixiPrototypeSnapshot {
  batches: number;
  buildDuration: number;
  cameraScale: number;
  cells: number;
  enabled: boolean;
  reliefSprites: number;
  renderer: string | null;
  theme: PixiMapTheme;
  viewportHeight: number;
  viewportWidth: number;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PROTOTYPE_ID = "pixi-map-prototype";
const MAX_RESOLUTION = 2;

export class PixiMapPrototype {
  private app: Application | null = null;
  private rebuildSequence = 0;
  private resizeFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private surface: HTMLDivElement | null = null;
  private stats: PixiPrototypeSnapshot = {
    batches: 0,
    buildDuration: 0,
    cameraScale: 1,
    cells: 0,
    enabled: false,
    reliefSprites: 0,
    renderer: null,
    theme: "states",
    viewportHeight: 0,
    viewportWidth: 0
  };

  async enable(theme: PixiMapTheme = "states"): Promise<void> {
    this.stats.theme = theme;
    await this.ensureApplication();
    this.stats.enabled = true;
    this.positionSurface();
    await this.rebuild();
  }

  async rebuild(): Promise<void> {
    if (!this.stats.enabled || !this.app || !pack.cells?.i?.length) return;

    const sequence = ++this.rebuildSequence;
    const started = performance.now();
    this.resize();
    this.clearStage();
    if (this.surface) this.surface.style.display = "block";
    this.app.renderer.background.color = getLayerFillColor("oceanBase", "#466eab");

    const theme = this.stats.theme;
    const baseContainer = this.buildBaseContainer();
    const fillContainer = this.buildFillContainer(theme);
    let reliefSprites = 0;
    let batches = fillContainer.children.length;

    if (theme === "states") {
      const reliefContainer = await this.buildReliefContainer();
      if (sequence !== this.rebuildSequence) return;
      reliefSprites = reliefContainer.children.length;
      const borderContainer = this.buildBordersContainer();
      batches += borderContainer.children.length;
      this.app.stage.addChild(baseContainer, reliefContainer, fillContainer, borderContainer);
    } else {
      this.app.stage.addChild(baseContainer, fillContainer);
    }

    this.syncVisibility();
    this.app.render();

    const buildDuration = performance.now() - started;
    this.stats = {
      ...this.stats,
      batches,
      buildDuration,
      cells: pack.cells.i.length,
      enabled: true,
      reliefSprites,
      renderer: this.app.renderer.constructor.name,
      theme
    };
    window.MapPerformance?.record("pixi:rebuild", buildDuration);
  }

  queueRebuild(): void {
    if (!this.stats.enabled) return;
    const sequence = ++this.rebuildSequence;
    requestAnimationFrame(() => {
      if (sequence !== this.rebuildSequence) return;
      void this.rebuild();
    });
  }

  syncVisibility(): void {
    if (!this.app || !this.stats.enabled) return;
    const [, reliefOrFills, fillsOrUndefined, borders] = this.app.stage.children;
    if (this.stats.theme === "states") {
      const relief = reliefOrFills;
      const fills = fillsOrUndefined;
      if (relief) relief.visible = layerIsOn("toggleRelief");
      if (fills) fills.visible = layerIsOn("toggleStates");
      if (borders) borders.visible = layerIsOn("toggleBorders");
    } else if (reliefOrFills) reliefOrFills.visible = layerIsOn("toggleBiomes");
    this.app.render();
  }

  syncCamera(): void {
    if (!this.app || !this.stats.enabled) return;
    const started = performance.now();
    this.app.stage.position.set(viewX, viewY);
    this.app.stage.scale.set(scale);
    this.stats.cameraScale = scale;
    this.app.render();
    window.MapPerformance?.record("pixi:camera", performance.now() - started);
  }

  clear(): void {
    this.rebuildSequence++;
    this.clearStage();
    this.app?.render();
    if (this.surface) this.surface.style.display = "none";
  }

  disable(): void {
    this.rebuildSequence++;
    document.getElementById("map")?.classList.remove("pixi-prototype-states", "pixi-prototype-biomes");
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId);
    this.resizeFrameId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearStage();
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.surface?.remove();
    this.surface = null;
    this.stats = { ...this.stats, batches: 0, enabled: false, reliefSprites: 0, renderer: null };
  }

  getSnapshot(): PixiPrototypeSnapshot {
    return { ...this.stats };
  }

  private async ensureApplication(): Promise<void> {
    if (this.app) return;

    const map = document.getElementById("map");
    if (!map) throw new Error("Cannot mount the Pixi renderer without #map");
    const surface = document.createElement("div");
    surface.id = PROTOTYPE_ID;
    surface.style.pointerEvents = "none";
    map.before(surface);
    this.surface = surface;

    const viewport = getViewportSize(map);
    this.app = new Application();
    await this.app.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 1,
      backgroundColor: getLayerFillColor("oceanBase", "#466eab"),
      clearBeforeRender: true,
      culler: { updateTransform: false },
      height: viewport.height,
      preference: "webgl",
      resolution: Math.min(devicePixelRatio, MAX_RESOLUTION),
      width: viewport.width
    });
    this.app.stage.eventMode = "none";
    surface.appendChild(this.app.canvas);
    this.resizeObserver = new ResizeObserver(() => this.queueResize());
    this.resizeObserver.observe(map);
    this.resize();
  }

  private resize(): void {
    if (!this.app || !this.surface) return;
    const map = document.getElementById("map");
    if (!map) return;
    const viewport = getViewportSize(map);
    const bounds = map.getBoundingClientRect();
    const resolution = Math.min(devicePixelRatio, MAX_RESOLUTION);
    this.app.renderer.resize(viewport.width, viewport.height, resolution);
    this.surface.style.height = `${viewport.height}px`;
    this.surface.style.left = `${bounds.left + window.scrollX}px`;
    this.surface.style.top = `${bounds.top + window.scrollY}px`;
    this.surface.style.width = `${viewport.width}px`;
    this.app.canvas.style.display = "block";
    this.app.canvas.style.height = `${viewport.height}px`;
    this.app.canvas.style.width = `${viewport.width}px`;
    this.stats.viewportHeight = viewport.height;
    this.stats.viewportWidth = viewport.width;
    this.syncCamera();
  }

  private queueResize(): void {
    if (this.resizeFrameId !== null) return;
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null;
      this.resize();
    });
  }

  private positionSurface(): void {
    if (!this.surface) return;
    const map = document.getElementById("map");
    if (map && this.surface.nextElementSibling !== map) map.before(this.surface);
    map?.classList.toggle("pixi-prototype-states", this.stats.theme === "states");
    map?.classList.toggle("pixi-prototype-biomes", this.stats.theme === "biomes");
    this.surface.style.display = "block";
    this.resize();
  }

  private buildFillContainer(theme: PixiMapTheme): Container {
    const groups = theme === "states" ? pack.cells.state : pack.cells.biome;
    const colors = theme === "states" ? pack.states : pack.biomes;
    const batches = buildCellFillBatches({
      cellIds: pack.cells.i,
      cellVertices: pack.cells.v,
      colors,
      groups,
      heights: pack.cells.h,
      vertexPoints: pack.vertices.p
    });

    const container = new Container();
    container.label = `${theme}-fills`;
    container.alpha = getLayerOpacity(theme === "states" ? "regions" : "biomes");
    for (const batch of batches) {
      const context = new GraphicsContext();
      for (const polygon of batch.polygons) context.poly(polygon);
      context.fill({ color: batch.color });
      const graphic = new Graphics(context);
      graphic.label = `${theme}-${batch.groupId}`;
      graphic.cullable = true;
      container.addChild(graphic);
    }
    return container;
  }

  private buildBaseContainer(): Container {
    const container = new Container();
    container.label = "land-base";

    const landGroups = new Uint8Array(pack.cells.h.length);
    landGroups.fill(1);
    const [landBatch] = buildCellFillBatches({
      cellIds: pack.cells.i,
      cellVertices: pack.cells.v,
      colors: [{}, { color: getLayerFillColor("landmass", "#eef6fb") }],
      groups: landGroups,
      heights: pack.cells.h,
      vertexPoints: pack.vertices.p
    });
    if (!landBatch) return container;

    const context = new GraphicsContext();
    for (const polygon of landBatch.polygons) context.poly(polygon);
    context.fill({ color: landBatch.color });
    const graphic = new Graphics(context);
    graphic.label = "land-base-fill";
    container.addChild(graphic);
    return container;
  }

  private buildBordersContainer(): Container {
    const container = new Container();
    container.label = "borders";
    const paths = buildBorderPaths(pack);
    for (const [groupId, data] of [
      ["stateBorders", paths.state],
      ["provinceBorders", paths.province]
    ] as const) {
      const group = document.getElementById(groupId);
      if (!group || !data) continue;

      const computed = getComputedStyle(group);
      const stroke = computed.stroke && computed.stroke !== "none" ? computed.stroke : "#555555";
      const width = Number.parseFloat(computed.strokeWidth) || 1;
      const opacity = Number.parseFloat(computed.opacity) || 1;
      const dash = computed.strokeDasharray === "none" ? "" : ` stroke-dasharray="${computed.strokeDasharray}"`;
      const cap = computed.strokeLinecap || "butt";
      const graphic = new Graphics().svg(
        `<svg xmlns="${SVG_NAMESPACE}"><path d="${data}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="${cap}" opacity="${opacity}"${dash}/></svg>`
      );
      graphic.label = groupId;
      container.addChild(graphic);
    }
    return container;
  }

  private async buildReliefContainer(): Promise<Container> {
    const container = new Container();
    container.label = "relief";
    container.alpha = getLayerOpacity("terrain");
    if (!pack.relief?.length) Relief.generate();
    if (!pack.relief?.length) return container;

    const icons = new Set(pack.relief.map(({ icon }) => icon));
    const textures = new Map<string, Texture>();
    await Promise.all(
      [...icons].map(async icon => {
        const source = getReliefSvgDataUri(icon);
        if (source) textures.set(icon, await Assets.load<Texture>(source));
      })
    );

    for (const { icon, x, y, s } of pack.relief) {
      const texture = textures.get(icon);
      if (!texture) continue;
      const sprite = new Sprite({ height: s, position: { x, y }, texture, width: s });
      sprite.cullable = true;
      sprite.eventMode = "none";
      container.addChild(sprite);
    }
    return container;
  }

  private clearStage(): void {
    if (!this.app) return;
    for (const child of this.app.stage.removeChildren()) child.destroy({ children: true });
  }
}

function getViewportSize(map: HTMLElement): { height: number; width: number } {
  const bounds = map.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height || svgHeight)),
    width: Math.max(1, Math.round(bounds.width || svgWidth))
  };
}

function getLayerOpacity(id: string): number {
  const element = document.getElementById(id);
  if (!element) return 1;
  const computed = getComputedStyle(element);
  return parseOpacity(computed.opacity) * parseOpacity(computed.fillOpacity);
}

function getLayerFillColor(id: string, fallback: string): string {
  const element = document.getElementById(id);
  if (!element) return fallback;
  const fill = getComputedStyle(element).fill;
  return fill && fill !== "none" ? fill : fallback;
}

function parseOpacity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function getReliefSvgDataUri(icon: string): string | null {
  const symbol = document.getElementById(icon);
  if (!(symbol instanceof SVGSymbolElement)) return null;
  const viewBox = symbol.getAttribute("viewBox") || "0 0 100 100";
  const svg = `<svg xmlns="${SVG_NAMESPACE}" viewBox="${viewBox}">${symbol.innerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
