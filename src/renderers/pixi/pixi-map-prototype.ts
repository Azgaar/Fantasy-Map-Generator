import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import { camerasEqual, DEFAULT_MAP_CAMERA, type MapCamera, normalizeCamera } from "../core/camera";
import type { RenderInvalidationBatch } from "../core/invalidation";
import type { MapLayerId } from "../core/layer-registry";
import { RenderScheduler } from "../core/render-scheduler";
import { buildBorderPaths } from "../draw-borders";
import { type RetainedCellTopology, RetainedCellTopologyCache } from "../scene/layers/retained-cell-topology";
import { DEFAULT_PIXI_MAP_STYLE, type PixiMapSemanticStyle } from "../scene/styles";
import { RetainedCellMesh } from "./layers/retained-cell-mesh";
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
  private activeCellMesh: RetainedCellMesh | null = null;
  private app: Application | null = null;
  private camera: MapCamera = { ...DEFAULT_MAP_CAMERA };
  private rebuildSequence = 0;
  private retainedCellMeshes = new Set<RetainedCellMesh>();
  private resizeFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scheduler: RenderScheduler | null = null;
  private semanticStyle: PixiMapSemanticStyle = structuredClone(DEFAULT_PIXI_MAP_STYLE);
  private surface: HTMLDivElement | null = null;
  private fillContainer: Container | null = null;
  private topologyCache = new RetainedCellTopologyCache();
  private topologyInputs: { cellVertices: number[][]; vertexPoints: [number, number][] } | null = null;
  private topologyRevision = 0;
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
    this.app.renderer.background.color = this.semanticStyle.ocean.color;

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
    this.scheduler?.invalidate({ kind: "world" });
  }

  invalidateLayer(layer: MapLayerId, cellIds?: readonly number[]): void {
    if (!this.stats.enabled) return;
    if (layer === this.stats.theme) {
      this.scheduler?.invalidate({ cellIds, kind: "assignment", layer });
      return;
    }
    this.scheduler?.invalidate({ kind: "geometry", layer });
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

  setCamera(camera: MapCamera): void {
    const normalized = normalizeCamera(camera);
    if (camerasEqual(this.camera, normalized)) return;
    this.camera = normalized;
    this.stats.cameraScale = normalized.scale;
    this.stats.viewportHeight = normalized.height;
    this.stats.viewportWidth = normalized.width;
    if (this.stats.enabled) this.scheduler?.invalidate({ kind: "camera" });
  }

  setSemanticStyle(style: PixiMapSemanticStyle): void {
    this.semanticStyle = structuredClone(style);
  }

  private applyCamera(): void {
    if (!this.app) return;
    const started = performance.now();
    this.app.stage.position.set(this.camera.x, this.camera.y);
    this.app.stage.scale.set(this.camera.scale);
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
    this.scheduler?.destroy();
    this.scheduler = null;
    this.clearStage();
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.surface?.remove();
    this.surface = null;
    this.topologyCache.clear();
    this.topologyInputs = null;
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
      backgroundColor: this.semanticStyle.ocean.color,
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
    this.scheduler = this.createScheduler();
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
    this.camera = { ...this.camera, height: viewport.height, width: viewport.width };
    this.applyCamera();
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
    const style = this.semanticStyle[theme];
    const retained = new RetainedCellMesh(this.getCellTopology(), {
      assignments: groups,
      colors,
      fallbackColor: style.fallbackColor,
      heights: pack.cells.h
    });

    const container = new Container();
    container.label = `${theme}-fills`;
    container.alpha = style.opacity;
    retained.mesh.label = `${theme}-retained-cells`;
    this.retainedCellMeshes.add(retained);
    container.addChild(retained.mesh);
    this.activeCellMesh = retained;
    this.fillContainer = container;
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
      colors: [{}, { color: this.semanticStyle.landmass.color }],
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
    container.alpha = this.semanticStyle.relief.opacity;
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
    for (const retained of this.retainedCellMeshes) retained.destroy();
    this.retainedCellMeshes.clear();
    this.activeCellMesh = null;
    this.fillContainer = null;
    for (const child of this.app.stage.removeChildren()) child.destroy({ children: true });
  }

  private getCellTopology(): RetainedCellTopology {
    const inputs = { cellVertices: pack.cells.v, vertexPoints: pack.vertices.p };
    if (
      this.topologyInputs?.cellVertices !== inputs.cellVertices ||
      this.topologyInputs.vertexPoints !== inputs.vertexPoints
    ) {
      this.topologyInputs = inputs;
      this.topologyRevision++;
    }
    return this.topologyCache.get({
      cellIds: pack.cells.i,
      cellVertices: inputs.cellVertices,
      revision: this.topologyRevision,
      vertexPoints: inputs.vertexPoints
    });
  }

  private createScheduler(): RenderScheduler {
    return new RenderScheduler(batch => this.renderInvalidations(batch), {
      onDiagnostic: diagnostic => window.MapPerformance?.record("pixi:scheduled", diagnostic.duration)
    });
  }

  private async renderInvalidations(batch: RenderInvalidationBatch): Promise<void> {
    const assignments = batch.invalidations.filter(
      invalidation => invalidation.kind === "assignment" && invalidation.layer === this.stats.theme
    );
    if (
      assignments.length &&
      assignments.length === batch.invalidations.length &&
      this.updateActiveCellMesh(assignments)
    ) {
      return;
    }
    if (batch.requiresSceneBuild) {
      await this.rebuild();
      return;
    }
    if (batch.invalidations.some(invalidation => invalidation.kind === "camera")) this.applyCamera();
  }

  private updateActiveCellMesh(
    assignments: readonly Extract<RenderInvalidationBatch["invalidations"][number], { kind: "assignment" }>[]
  ): boolean {
    if (!this.activeCellMesh || !this.fillContainer || !this.app) return false;
    const theme = this.stats.theme;
    const style = this.semanticStyle[theme];
    this.activeCellMesh.update(
      {
        assignments: theme === "states" ? pack.cells.state : pack.cells.biome,
        colors: theme === "states" ? pack.states : pack.biomes,
        fallbackColor: style.fallbackColor,
        heights: pack.cells.h
      },
      assignments.some(invalidation => !invalidation.cellIds)
        ? pack.cells.i
        : assignments.flatMap(invalidation => invalidation.cellIds ?? [])
    );
    this.fillContainer.alpha = style.opacity;
    this.app.render();
    return true;
  }
}

function getViewportSize(map: HTMLElement): { height: number; width: number } {
  const bounds = map.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height || svgHeight)),
    width: Math.max(1, Math.round(bounds.width || svgWidth))
  };
}

function getReliefSvgDataUri(icon: string): string | null {
  const symbol = document.getElementById(icon);
  if (!(symbol instanceof SVGSymbolElement)) return null;
  const viewBox = symbol.getAttribute("viewBox") || "0 0 100 100";
  const svg = `<svg xmlns="${SVG_NAMESPACE}" viewBox="${viewBox}">${symbol.innerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
