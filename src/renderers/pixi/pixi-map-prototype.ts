import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import { buildCellFillBatches } from "./pixi-map-data";

export type PixiMapTheme = "states" | "biomes";

export interface PixiPrototypeSnapshot {
  batches: number;
  buildDuration: number;
  cells: number;
  enabled: boolean;
  reliefSprites: number;
  renderer: string | null;
  theme: PixiMapTheme;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PROTOTYPE_ID = "pixi-map-prototype";
const MAX_RESOLUTION = 2;

export class PixiMapPrototype {
  private app: Application | null = null;
  private foreignObject: SVGForeignObjectElement | null = null;
  private rebuildSequence = 0;
  private stats: PixiPrototypeSnapshot = {
    batches: 0,
    buildDuration: 0,
    cells: 0,
    enabled: false,
    reliefSprites: 0,
    renderer: null,
    theme: "states"
  };

  async enable(theme: PixiMapTheme = "states"): Promise<void> {
    this.stats.theme = theme;
    await this.ensureApplication();
    this.stats.enabled = true;
    this.positionCanvas();
    await this.rebuild();
  }

  async rebuild(): Promise<void> {
    if (!this.stats.enabled || !this.app || !pack.cells?.i?.length) return;

    const sequence = ++this.rebuildSequence;
    const started = performance.now();
    this.resize();
    this.clearStage();
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

  clear(): void {
    this.rebuildSequence++;
    this.clearStage();
    this.app?.render();
  }

  disable(): void {
    this.rebuildSequence++;
    document.getElementById("map")?.classList.remove("pixi-prototype-states", "pixi-prototype-biomes");
    this.clearStage();
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.foreignObject?.remove();
    this.foreignObject = null;
    this.stats = { ...this.stats, batches: 0, enabled: false, reliefSprites: 0, renderer: null };
  }

  getSnapshot(): PixiPrototypeSnapshot {
    return { ...this.stats };
  }

  private async ensureApplication(): Promise<void> {
    if (this.app) return;

    this.app = new Application();
    await this.app.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 1,
      backgroundColor: getLayerFillColor("oceanBase", "#466eab"),
      clearBeforeRender: true,
      height: graphHeight,
      preference: "webgl",
      resolution: Math.min(devicePixelRatio, MAX_RESOLUTION),
      width: graphWidth
    });
    this.app.stage.eventMode = "none";

    const foreignObject = document.createElementNS(SVG_NAMESPACE, "foreignObject");
    foreignObject.id = PROTOTYPE_ID;
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    foreignObject.style.pointerEvents = "none";
    foreignObject.appendChild(this.app.canvas);
    this.foreignObject = foreignObject;
    this.resize();
  }

  private resize(): void {
    if (!this.app || !this.foreignObject) return;
    const resolution = Math.min(devicePixelRatio, MAX_RESOLUTION);
    this.app.renderer.resize(graphWidth, graphHeight, resolution);
    this.foreignObject.setAttribute("width", String(graphWidth));
    this.foreignObject.setAttribute("height", String(graphHeight));
    this.app.canvas.style.display = "block";
    this.app.canvas.style.height = `${graphHeight}px`;
    this.app.canvas.style.width = `${graphWidth}px`;
  }

  private positionCanvas(): void {
    if (!this.foreignObject) return;
    const map = document.getElementById("map");
    const anchorId = this.stats.theme === "states" ? "regions" : "biomes";
    document.getElementById(anchorId)?.before(this.foreignObject);
    map?.classList.toggle("pixi-prototype-states", this.stats.theme === "states");
    map?.classList.toggle("pixi-prototype-biomes", this.stats.theme === "biomes");
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
    for (const groupId of ["stateBorders", "provinceBorders"]) {
      const group = document.getElementById(groupId);
      const path = group?.querySelector("path");
      const data = path?.getAttribute("d");
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
