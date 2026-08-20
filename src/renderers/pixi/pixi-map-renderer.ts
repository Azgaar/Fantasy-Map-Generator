import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import type { PackedGraph } from "@/types/PackedGraph";
import { camerasEqual, DEFAULT_MAP_CAMERA, type MapCamera, normalizeCamera, type ViewportSize } from "../core/camera";
import type { RenderInvalidation, RenderInvalidationBatch } from "../core/invalidation";
import type { MapLayerId } from "../core/layer-registry";
import type { MapHit, MapRenderer, ScreenPoint } from "../core/map-renderer";
import { RenderDiagnostics, type RenderDiagnosticsSnapshot } from "../core/render-diagnostics";
import { RenderScheduler } from "../core/render-scheduler";
import {
  DEFAULT_RENDERER_RESOLUTION_POLICY,
  type RendererResolutionPolicy,
  selectRendererResolution
} from "../core/resolution";
import { DEFAULT_RENDERER_RESOURCE_BUDGET, RendererResourceTracker } from "../core/resource-budget";
import { RendererResourceCache, type RendererResourceHandle } from "../core/resource-cache";
import { buildBorderScene } from "../scene/layers/border-paths";
import { buildReliefSpriteScene } from "../scene/layers/relief-sprite-scene";
import { type RetainedCellTopology, RetainedCellTopologyCache } from "../scene/layers/retained-cell-topology";
import { DEFAULT_PIXI_MAP_STYLE, type MapStyle } from "../scene/styles";
import { WorldSceneRevisionTracker } from "../scene/world-scene";
import { monitorWebGlContext } from "./context-recovery";
import { RetainedCellMesh } from "./layers/retained-cell-mesh";
import { buildCellFillBatches } from "./pixi-map-data";

export type PixiMapTheme = "states" | "biomes";

export interface PixiPrototypeSnapshot {
  batches: number;
  buildDuration: number;
  cameraScale: number;
  cells: number;
  contextLost: boolean;
  diagnostics: RenderDiagnosticsSnapshot;
  enabled: boolean;
  reliefSprites: number;
  resolution: number;
  resourceBytes: number;
  resourceCount: number;
  renderer: string | null;
  textureCacheEntries: number;
  theme: PixiMapTheme;
  viewportHeight: number;
  viewportWidth: number;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export interface PixiMapRendererOptions {
  deviceMemoryGb?: number;
  getDevicePixelRatio?: () => number;
  recordPerformance?: (name: string, duration: number) => void;
  resolutionPolicy?: RendererResolutionPolicy;
  resolveReliefIcon?: (icon: string) => string | null;
  textureBudgetBytes?: number;
}

export class PixiMapRenderer implements MapRenderer {
  private activeCellMesh: RetainedCellMesh | null = null;
  private app: Application | null = null;
  private camera: MapCamera = { ...DEFAULT_MAP_CAMERA };
  private contextRecoveryRelease: (() => void) | null = null;
  private diagnostics = new RenderDiagnostics();
  private layerVisibility = new Map<MapLayerId, boolean>();
  private rebuildSequence = 0;
  private retainedCellMeshes = new Set<RetainedCellMesh>();
  private reliefTextureHandles = new Set<RendererResourceHandle<Texture>>();
  private resizeFrameId: number | null = null;
  private resources = new RendererResourceTracker();
  private resizeObserver: ResizeObserver | null = null;
  private scheduler: RenderScheduler | null = null;
  private semanticStyle: MapStyle = structuredClone(DEFAULT_PIXI_MAP_STYLE);
  private sceneRevisions = new WorldSceneRevisionTracker();
  private surface: HTMLElement | null = null;
  private fillContainer: Container | null = null;
  private topologyCache = new RetainedCellTopologyCache();
  private topologyInputs: { cellVertices: number[][]; vertexPoints: [number, number][] } | null = null;
  private topologyRevision = 0;
  private textureCache: RendererResourceCache<Texture>;
  private world: PackedGraph | null = null;
  private stats: PixiPrototypeSnapshot = {
    batches: 0,
    buildDuration: 0,
    cameraScale: 1,
    cells: 0,
    contextLost: false,
    diagnostics: {},
    enabled: false,
    reliefSprites: 0,
    resolution: 1,
    resourceBytes: 0,
    resourceCount: 0,
    renderer: null,
    textureCacheEntries: 0,
    theme: "states",
    viewportHeight: 0,
    viewportWidth: 0
  };

  constructor(private readonly rendererOptions: PixiMapRendererOptions = {}) {
    this.textureCache = new RendererResourceCache<Texture>({
      budgetBytes: rendererOptions.textureBudgetBytes ?? DEFAULT_RENDERER_RESOURCE_BUDGET.texture,
      destroy: (texture, source) => {
        void Assets.unload(source).catch(() => texture.destroy(true));
      },
      estimateBytes: texture => Math.ceil(texture.width * texture.height * 4),
      kind: "texture",
      tracker: this.resources
    });
  }

  setTheme(theme: PixiMapTheme): void {
    this.stats.theme = theme;
  }

  async mount(surface: HTMLElement): Promise<void> {
    if (this.app) {
      if (surface !== this.surface) throw new Error("Pixi renderer is already mounted on another surface");
      return;
    }
    this.surface = surface;
    await this.initializeApplication();
    this.stats.enabled = true;
  }

  async render(world: PackedGraph, style: MapStyle, invalidation: RenderInvalidationBatch): Promise<void> {
    this.world = world;
    this.semanticStyle = structuredClone(style);
    await this.renderInvalidations(invalidation);
  }

  queueRender(world: PackedGraph, style: MapStyle, invalidation: RenderInvalidation): void {
    this.world = world;
    this.semanticStyle = structuredClone(style);
    this.scheduler?.invalidate(invalidation);
  }

  async rebuild(): Promise<void> {
    const world = this.world;
    if (!this.stats.enabled || !this.app || !world?.cells.i.length) return;

    const sequence = ++this.rebuildSequence;
    const started = performance.now();
    this.resize({ height: this.camera.height, width: this.camera.width });
    this.clearStage();
    if (this.surface) this.surface.style.display = "block";
    this.app.renderer.background.color = this.semanticStyle.ocean.color;

    const theme = this.stats.theme;
    const baseContainer = this.buildBaseContainer();
    const fillContainer = this.buildFillContainer(theme);
    let reliefSprites = 0;
    let batches = fillContainer.children.length;

    if (theme === "states") {
      const reliefContainer = await this.buildReliefContainer(sequence);
      if (sequence !== this.rebuildSequence) return;
      reliefSprites = reliefContainer.children.length;
      const borderContainer = this.buildBordersContainer();
      batches += borderContainer.children.length;
      this.app.stage.addChild(baseContainer, reliefContainer, fillContainer, borderContainer);
    } else {
      this.app.stage.addChild(baseContainer, fillContainer);
    }

    this.recordPerformance("pixi:scene-build", performance.now() - started);

    this.applyVisibility(false);
    const gpuSubmitStarted = performance.now();
    this.app.render();
    this.recordPerformance("pixi:gpu-submit", performance.now() - gpuSubmitStarted);

    const buildDuration = performance.now() - started;
    this.stats = {
      ...this.stats,
      batches,
      buildDuration,
      cells: world.cells.i.length,
      enabled: true,
      reliefSprites,
      renderer: this.app.renderer.constructor.name,
      theme
    };
    this.recordPerformance("pixi:rebuild", buildDuration);
  }

  setLayerVisibility(layer: MapLayerId, visible: boolean): void {
    this.layerVisibility.set(layer, visible);
    this.applyVisibility();
  }

  private applyVisibility(render = true): void {
    if (!this.app || !this.stats.enabled) return;
    const [, reliefOrFills, fillsOrUndefined, borders] = this.app.stage.children;
    if (this.stats.theme === "states") {
      const relief = reliefOrFills;
      const fills = fillsOrUndefined;
      if (relief) relief.visible = this.layerVisibility.get("relief") ?? true;
      if (fills) fills.visible = this.layerVisibility.get("states") ?? true;
      if (borders) borders.visible = this.layerVisibility.get("borders") ?? true;
    } else if (reliefOrFills) reliefOrFills.visible = this.layerVisibility.get("biomes") ?? true;
    if (render) this.app.render();
  }

  pick(_point: ScreenPoint): MapHit | null {
    return null;
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

  private applyCamera(): void {
    if (!this.app) return;
    const started = performance.now();
    this.app.stage.position.set(this.camera.x, this.camera.y);
    this.app.stage.scale.set(this.camera.scale);
    this.app.render();
    this.recordPerformance("pixi:camera", performance.now() - started);
  }

  clear(): void {
    this.rebuildSequence++;
    this.scheduler?.clear();
    this.clearStage();
    this.textureCache.clear();
    this.app?.render();
    if (this.surface) this.surface.style.display = "none";
  }

  destroy(): void {
    this.rebuildSequence++;
    if (this.resizeFrameId !== null) cancelAnimationFrame(this.resizeFrameId);
    this.resizeFrameId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.contextRecoveryRelease?.();
    this.contextRecoveryRelease = null;
    this.scheduler?.destroy();
    this.scheduler = null;
    this.clearStage();
    this.textureCache.clear();
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.surface = null;
    this.topologyCache.clear();
    this.topologyInputs = null;
    this.sceneRevisions.reset();
    this.diagnostics.clear();
    this.stats = { ...this.stats, batches: 0, enabled: false, reliefSprites: 0, renderer: null };
  }

  getSnapshot(): PixiPrototypeSnapshot {
    const resources = this.resources.getSnapshot();
    const textures = this.textureCache.getSnapshot();
    return {
      ...this.stats,
      diagnostics: this.diagnostics.getSnapshot(),
      resourceBytes: resources.totalBytes,
      resourceCount: resources.totalCount,
      textureCacheEntries: textures.entries
    };
  }

  private async initializeApplication(): Promise<void> {
    if (this.app) return;
    if (!this.surface) throw new Error("Cannot initialize an unmounted Pixi renderer");

    const viewport = getViewportSize(this.surface, this.camera);
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
      resolution: this.getResolution(viewport),
      width: viewport.width
    });
    this.app.stage.eventMode = "none";
    this.contextRecoveryRelease = monitorWebGlContext(this.app.canvas, {
      lost: () => {
        this.stats.contextLost = true;
      },
      restored: () => {
        this.stats.contextLost = false;
        this.scheduler?.invalidate({ kind: "topology" });
      }
    });
    this.surface.appendChild(this.app.canvas);
    this.resizeObserver = new ResizeObserver(() => this.queueResize());
    this.resizeObserver.observe(this.surface);
    this.scheduler = this.createScheduler();
    this.resize(viewport);
  }

  resize(viewport: ViewportSize): void {
    if (!this.app || !this.surface) return;
    const resolution = this.getResolution(viewport);
    this.app.renderer.resize(viewport.width, viewport.height, resolution);
    this.surface.style.height = `${viewport.height}px`;
    this.surface.style.width = `${viewport.width}px`;
    this.app.canvas.style.display = "block";
    this.app.canvas.style.height = `${viewport.height}px`;
    this.app.canvas.style.width = `${viewport.width}px`;
    this.stats.viewportHeight = viewport.height;
    this.stats.viewportWidth = viewport.width;
    this.stats.resolution = resolution;
    this.camera = { ...this.camera, height: viewport.height, width: viewport.width };
    this.applyCamera();
  }

  private queueResize(): void {
    if (this.resizeFrameId !== null) return;
    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null;
      if (this.surface) this.resize(getViewportSize(this.surface, this.camera));
    });
  }

  private buildFillContainer(theme: PixiMapTheme): Container {
    const world = this.getWorld();
    const groups = theme === "states" ? world.cells.state : world.cells.biome;
    const colors = theme === "states" ? world.states : world.biomes;
    const style = this.semanticStyle[theme];
    const retained = new RetainedCellMesh(
      this.getCellTopology(),
      {
        assignments: groups,
        colors,
        fallbackColor: style.fallbackColor,
        heights: world.cells.h
      },
      theme,
      this.resources
    );

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
    const world = this.getWorld();
    const container = new Container();
    container.label = "land-base";

    const landGroups = new Uint8Array(world.cells.h.length);
    landGroups.fill(1);
    const [landBatch] = buildCellFillBatches({
      cellIds: world.cells.i,
      cellVertices: world.cells.v,
      colors: [{}, { color: this.semanticStyle.landmass.color }],
      groups: landGroups,
      heights: world.cells.h,
      vertexPoints: world.vertices.p
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
    const world = this.getWorld();
    const container = new Container();
    container.label = "borders";
    const scene = buildBorderScene(world, this.sceneRevisions.getLayerRevision("borders"));
    for (const [groupId, batch, style] of [
      ["stateBorders", scene.state, this.semanticStyle.borders.state],
      ["provinceBorders", scene.province, this.semanticStyle.borders.province]
    ] as const) {
      const data = batch.paths.map(path => `M${path.points.join(" ")}`).join(" ");
      if (!data) continue;
      const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
      const graphic = new Graphics().svg(
        `<svg xmlns="${SVG_NAMESPACE}"><path d="${data}" fill="none" stroke="${style.color}" stroke-width="${style.width}" stroke-linecap="${style.cap}" opacity="${style.opacity}"${dash}/></svg>`
      );
      graphic.label = groupId;
      container.addChild(graphic);
    }
    return container;
  }

  private async buildReliefContainer(sequence: number): Promise<Container> {
    const world = this.getWorld();
    const container = new Container();
    container.label = "relief";
    container.alpha = this.semanticStyle.relief.opacity;
    const scene = buildReliefSpriteScene(world.relief ?? [], this.sceneRevisions.getLayerRevision("relief"));
    if (!scene.instances.length) return container;

    const icons = new Set(scene.instances.map(({ icon }) => icon));
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    try {
      await Promise.all(
        [...icons].map(async icon => {
          const source = this.rendererOptions.resolveReliefIcon?.(icon);
          if (source) textures.set(icon, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        })
      );
    } catch (error) {
      for (const handle of textures.values()) handle.release();
      if (sequence !== this.rebuildSequence) return container;
      throw error;
    }

    if (sequence !== this.rebuildSequence) {
      for (const handle of textures.values()) handle.release();
      return container;
    }

    for (const { height, icon, width, x, y } of scene.instances) {
      const handle = textures.get(icon);
      if (!handle) continue;
      const sprite = new Sprite({ height, position: { x, y }, texture: handle.value, width });
      sprite.cullable = true;
      sprite.eventMode = "none";
      container.addChild(sprite);
    }
    for (const handle of textures.values()) this.reliefTextureHandles.add(handle);
    return container;
  }

  private clearStage(): void {
    if (!this.app) return;
    for (const retained of this.retainedCellMeshes) retained.destroy();
    this.retainedCellMeshes.clear();
    this.activeCellMesh = null;
    this.fillContainer = null;
    for (const child of this.app.stage.removeChildren()) child.destroy({ children: true });
    for (const handle of this.reliefTextureHandles) handle.release();
    this.reliefTextureHandles.clear();
  }

  private getCellTopology(): RetainedCellTopology {
    const world = this.getWorld();
    const inputs = { cellVertices: world.cells.v, vertexPoints: world.vertices.p };
    if (
      this.topologyInputs?.cellVertices !== inputs.cellVertices ||
      this.topologyInputs.vertexPoints !== inputs.vertexPoints
    ) {
      this.topologyInputs = inputs;
      this.topologyRevision++;
    }
    return this.topologyCache.get({
      cellIds: world.cells.i,
      cellVertices: inputs.cellVertices,
      revision: `${this.sceneRevisions.getTopologyRevision()}:source:${this.topologyRevision}`,
      vertexPoints: inputs.vertexPoints
    });
  }

  private createScheduler(): RenderScheduler {
    return new RenderScheduler(batch => this.renderInvalidations(batch), {
      onDiagnostic: diagnostic => this.recordPerformance("pixi:scheduled", diagnostic.duration)
    });
  }

  private async renderInvalidations(batch: RenderInvalidationBatch): Promise<void> {
    this.sceneRevisions.apply(batch.invalidations);
    const assignments = batch.invalidations.filter(
      (invalidation): invalidation is Extract<RenderInvalidation, { kind: "assignment" }> =>
        invalidation.kind === "assignment" && invalidation.layer === this.stats.theme
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

  private updateActiveCellMesh(assignments: readonly Extract<RenderInvalidation, { kind: "assignment" }>[]): boolean {
    if (!this.activeCellMesh || !this.fillContainer || !this.app) return false;
    const world = this.getWorld();
    const theme = this.stats.theme;
    const style = this.semanticStyle[theme];
    this.activeCellMesh.update(
      {
        assignments: theme === "states" ? world.cells.state : world.cells.biome,
        colors: theme === "states" ? world.states : world.biomes,
        fallbackColor: style.fallbackColor,
        heights: world.cells.h
      },
      assignments.some(invalidation => !invalidation.cellIds)
        ? world.cells.i
        : assignments.flatMap(invalidation => invalidation.cellIds ?? [])
    );
    this.fillContainer.alpha = style.opacity;
    this.app.render();
    return true;
  }

  private getWorld(): PackedGraph {
    if (!this.world) throw new Error("Cannot render before world data is provided");
    return this.world;
  }

  private recordPerformance(name: string, duration: number): void {
    this.diagnostics.record(name, duration);
    this.rendererOptions.recordPerformance?.(name, duration);
  }

  private getResolution(viewport: ViewportSize): number {
    return selectRendererResolution(
      {
        ...viewport,
        deviceMemoryGb: this.rendererOptions.deviceMemoryGb,
        devicePixelRatio: this.rendererOptions.getDevicePixelRatio?.() ?? globalThis.devicePixelRatio ?? 1
      },
      this.rendererOptions.resolutionPolicy ?? { ...DEFAULT_RENDERER_RESOLUTION_POLICY }
    );
  }
}

function getViewportSize(surface: HTMLElement, fallback: ViewportSize): ViewportSize {
  const bounds = surface.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height || fallback.height)),
    width: Math.max(1, Math.round(bounds.width || fallback.width))
  };
}
