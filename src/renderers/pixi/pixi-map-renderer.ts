import { Application, Assets, Container, Graphics, GraphicsContext, Sprite, type Texture } from "pixi.js";
import type { PackedGraph } from "@/types/PackedGraph";
import { camerasEqual, DEFAULT_MAP_CAMERA, type MapCamera, normalizeCamera, type ViewportSize } from "../core/camera";
import type { RenderInvalidation, RenderInvalidationBatch } from "../core/invalidation";
import { MAP_LAYER_REGISTRY, type MapLayerId } from "../core/layer-registry";
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
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import { buildBorderScene } from "../scene/layers/border-paths";
import { buildCellOutlineScene } from "../scene/layers/cell-outline-scene";
import { buildReliefSpriteScene } from "../scene/layers/relief-sprite-scene";
import { type RetainedCellTopology, RetainedCellTopologyCache } from "../scene/layers/retained-cell-topology";
import { buildZoneScene } from "../scene/layers/zone-scene";
import type { LinePathPrimitive, PolygonPathPrimitive } from "../scene/primitives";
import {
  DEFAULT_PIXI_MAP_STYLE,
  type MapStyle,
  type SemanticAreaStyle,
  type SemanticFillStyle,
  type SemanticLineStyle
} from "../scene/styles";
import { WorldSceneRevisionTracker } from "../scene/world-scene";
import { monitorWebGlContext } from "./context-recovery";
import { RetainedCellMesh } from "./layers/retained-cell-mesh";

export interface PixiRendererSnapshot {
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
  viewportHeight: number;
  viewportWidth: number;
}

type CellFillLayer = "biomes" | "cultures" | "provinces" | "religions" | "states";

const CELL_FILL_LAYERS: readonly CellFillLayer[] = ["biomes", "religions", "cultures", "states", "provinces"];

export interface PixiMapRendererOptions {
  deviceMemoryGb?: number;
  getDevicePixelRatio?: () => number;
  recordPerformance?: (name: string, duration: number) => void;
  resolutionPolicy?: RendererResolutionPolicy;
  resolveReliefIcon?: (icon: string) => string | null;
  textureBudgetBytes?: number;
}

export class PixiMapRenderer implements MapRenderer {
  private app: Application | null = null;
  private camera: MapCamera = { ...DEFAULT_MAP_CAMERA };
  private contextRecoveryRelease: (() => void) | null = null;
  private diagnostics = new RenderDiagnostics();
  private cellMeshes = new Map<CellFillLayer, { container: Container; retained: RetainedCellMesh }>();
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
  private topologyCache = new RetainedCellTopologyCache();
  private topologyInputs: { cellVertices: number[][]; vertexPoints: [number, number][] } | null = null;
  private topologyRevision = 0;
  private textureCache: RendererResourceCache<Texture>;
  private world: PackedGraph | null = null;
  private stats: PixiRendererSnapshot = {
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
    const geography = this.buildGeographyContainers();
    const biomeContainer = this.buildFillContainer("biomes");
    const cellsContainer = this.buildCellsContainer();
    const reliefContainer = await this.buildReliefContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const religionContainer = this.buildFillContainer("religions");
    const cultureContainer = this.buildFillContainer("cultures");
    const stateContainer = this.buildFillContainer("states");
    const provinceContainer = this.buildFillContainer("provinces");
    const zoneContainer = this.buildZonesContainer();
    const borderContainer = this.buildBordersContainer();
    this.app.stage.addChild(
      geography.ocean,
      geography.landmass,
      geography.lakes,
      biomeContainer,
      cellsContainer,
      reliefContainer,
      religionContainer,
      cultureContainer,
      stateContainer,
      provinceContainer,
      zoneContainer,
      borderContainer,
      geography.coastline
    );
    const reliefSprites = reliefContainer.children.length;
    const batches = this.app.stage.children.reduce((total, child) => total + Math.max(1, child.children.length), 0);

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
      renderer: this.app.renderer.constructor.name
    };
    this.recordPerformance("pixi:rebuild", buildDuration);
  }

  setLayerVisibility(layer: MapLayerId, visible: boolean): void {
    this.layerVisibility.set(layer, visible);
    this.applyVisibility();
  }

  private applyVisibility(render = true): void {
    if (!this.app || !this.stats.enabled) return;
    for (const child of this.app.stage.children) {
      if (isMapLayerId(child.label)) child.visible = this.layerVisibility.get(child.label) ?? true;
    }
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
    // The editor already coalesces zoom events into an animation frame. Render here so the canvas and SVG overlay
    // commit the same camera in the same frame instead of introducing a second-frame delay through the scheduler.
    if (this.stats.enabled) this.applyCamera();
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

  getSnapshot(): PixiRendererSnapshot {
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

  getCanvas(): CanvasImageSource | null {
    return (this.app?.canvas as unknown as CanvasImageSource | undefined) ?? null;
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

  private buildFillContainer(layer: CellFillLayer): Container {
    const style = this.semanticStyle[layer];
    const retained = new RetainedCellMesh(
      this.getCellTopology(),
      {
        ...this.getCellFillSource(layer),
        fallbackColor: style.fallbackColor,
        heights: this.getWorld().cells.h
      },
      layer,
      this.resources
    );

    const container = new Container();
    container.label = layer;
    container.alpha = style.opacity;
    retained.mesh.label = `${layer}-retained-cells`;
    this.retainedCellMeshes.add(retained);
    container.addChild(retained.mesh);
    this.cellMeshes.set(layer, { container, retained });
    return container;
  }

  private buildGeographyContainers(): {
    coastline: Container;
    lakes: Container;
    landmass: Container;
    ocean: Container;
  } {
    const world = this.getWorld();
    const bounds = getWorldBounds(world);
    const scene = buildBaseGeographyScene(world, bounds, this.sceneRevisions.getLayerRevision("landmass"));
    return {
      coastline: this.buildLineContainer(
        "coastline",
        scene.coastline.paths,
        role => this.semanticStyle.coastline.roles[role] ?? this.semanticStyle.coastline.default
      ),
      lakes: this.buildPolygonContainer(
        "lakes",
        scene.lakes.polygons,
        role => this.semanticStyle.lakes.roles[role] ?? this.semanticStyle.lakes.default
      ),
      landmass: this.buildPolygonContainer("landmass", scene.landmass.polygons, () => ({
        fill: this.semanticStyle.landmass,
        stroke: { cap: "butt", color: this.semanticStyle.landmass.color, dash: "", opacity: 0, width: 0 }
      })),
      ocean: this.buildRectangleContainer("ocean", scene.ocean.positions, this.semanticStyle.ocean)
    };
  }

  private buildRectangleContainer(layer: "ocean", positions: Float32Array, style: SemanticFillStyle): Container {
    const container = new Container();
    container.label = layer;
    if (positions.length < 8) return container;
    const context = new GraphicsContext()
      .poly(Array.from(positions), true)
      .fill({ alpha: style.opacity, color: style.color });
    container.addChild(new Graphics(context));
    return container;
  }

  private buildPolygonContainer(
    layer: "lakes" | "landmass",
    polygons: readonly PolygonPathPrimitive[],
    getStyle: (role: string) => SemanticAreaStyle
  ): Container {
    const container = new Container();
    container.label = layer;
    const byRole = groupByRole(polygons);
    for (const [role, rolePolygons] of byRole) {
      const graphic = createPolygonGraphic(rolePolygons, getStyle(role));
      graphic.label = `${layer}:${role}`;
      container.addChild(graphic);
    }
    return container;
  }

  private buildLineContainer(
    layer: "cells" | "coastline",
    paths: readonly LinePathPrimitive[],
    getStyle: (role: string) => SemanticLineStyle
  ): Container {
    const container = new Container();
    container.label = layer;
    const byRole = groupByRole(paths);
    for (const [role, rolePaths] of byRole) {
      const graphic = createLineGraphic(rolePaths, getStyle(role));
      graphic.label = `${layer}:${role}`;
      container.addChild(graphic);
    }
    return container;
  }

  private buildCellsContainer(): Container {
    const scene = buildCellOutlineScene(this.getWorld(), this.sceneRevisions.getLayerRevision("cells"));
    return this.buildLineContainer("cells", scene.paths, () => this.semanticStyle.cells);
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
      if (!batch.paths.length) continue;
      const graphic = createLineGraphic(batch.paths, style);
      graphic.label = groupId;
      container.addChild(graphic);
    }
    return container;
  }

  private buildZonesContainer(): Container {
    const container = new Container();
    container.label = "zones";
    container.alpha = this.semanticStyle.zones.opacity;
    const scene = buildZoneScene(this.getWorld(), this.sceneRevisions.getLayerRevision("zones"), {
      filterType: this.semanticStyle.zones.filterType
    });
    for (const zone of scene.zones) {
      const graphic = createPolygonGraphic(zone.polygons, {
        fill: { color: getRenderableColor(zone.color, this.semanticStyle.zones.fallbackColor), opacity: 1 },
        stroke: this.semanticStyle.zones.stroke
      });
      graphic.label = `zone:${zone.zoneId}`;
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
    this.cellMeshes.clear();
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
        invalidation.kind === "assignment" && CELL_FILL_LAYERS.includes(invalidation.layer as CellFillLayer)
    );
    if (assignments.length && assignments.length === batch.invalidations.length && this.updateCellMeshes(assignments)) {
      return;
    }
    if (batch.requiresSceneBuild) {
      await this.rebuild();
      return;
    }
    if (batch.invalidations.some(invalidation => invalidation.kind === "camera")) this.applyCamera();
  }

  private updateCellMeshes(assignments: readonly Extract<RenderInvalidation, { kind: "assignment" }>[]): boolean {
    if (!this.app) return false;
    const world = this.getWorld();
    for (const layer of new Set(assignments.map(invalidation => invalidation.layer as CellFillLayer))) {
      const target = this.cellMeshes.get(layer);
      if (!target) return false;
      const style = this.semanticStyle[layer];
      const layerInvalidations = assignments.filter(invalidation => invalidation.layer === layer);
      target.retained.update(
        {
          ...this.getCellFillSource(layer),
          fallbackColor: style.fallbackColor,
          heights: world.cells.h
        },
        layerInvalidations.some(invalidation => !invalidation.cellIds)
          ? world.cells.i
          : layerInvalidations.flatMap(invalidation => invalidation.cellIds ?? [])
      );
      target.container.alpha = style.opacity;
    }
    this.app.render();
    return true;
  }

  private getCellFillSource(layer: CellFillLayer): {
    assignments: ArrayLike<number>;
    colors: readonly { color?: string }[];
  } {
    const world = this.getWorld();
    switch (layer) {
      case "biomes":
        return { assignments: world.cells.biome, colors: world.biomes };
      case "cultures":
        return { assignments: world.cells.culture, colors: world.cultures };
      case "provinces":
        return { assignments: world.cells.province, colors: world.provinces };
      case "religions":
        return { assignments: world.cells.religion, colors: world.religions };
      case "states":
        return { assignments: world.cells.state, colors: world.states };
    }
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

const MAP_LAYER_IDS = new Set(MAP_LAYER_REGISTRY.map(layer => layer.id));

function isMapLayerId(label: unknown): label is MapLayerId {
  return typeof label === "string" && MAP_LAYER_IDS.has(label as MapLayerId);
}

function groupByRole<T extends { role?: string }>(items: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const role = item.role ?? "default";
    const group = groups.get(role);
    if (group) group.push(item);
    else groups.set(role, [item]);
  }
  return groups;
}

function createPolygonGraphic(polygons: readonly PolygonPathPrimitive[], style: SemanticAreaStyle): Graphics {
  const context = new GraphicsContext();
  for (const polygon of polygons) context.poly(polygon.points.flat(), true);
  context.fill({ alpha: style.fill.opacity, color: style.fill.color });
  if (style.stroke.width > 0 && style.stroke.opacity > 0) {
    context.stroke({
      alpha: style.stroke.opacity,
      cap: style.stroke.cap,
      color: style.stroke.color,
      width: style.stroke.width
    });
  }
  return new Graphics(context);
}

function createLineGraphic(paths: readonly LinePathPrimitive[], style: SemanticLineStyle): Graphics {
  const context = new GraphicsContext();
  for (const path of paths) {
    const [first, ...rest] = path.points;
    if (!first) continue;
    context.moveTo(first[0], first[1]);
    for (const point of rest) context.lineTo(point[0], point[1]);
    if (path.closed) context.closePath();
  }
  if (style.width > 0 && style.opacity > 0) {
    context.stroke({ alpha: style.opacity, cap: style.cap, color: style.color, width: style.width });
  }
  return new Graphics(context);
}

function getRenderableColor(color: string, fallbackColor: string): string {
  return color.startsWith("url(") ? fallbackColor : color;
}

function getWorldBounds(world: Pick<PackedGraph, "vertices">): { height: number; width: number } {
  let width = 0;
  let height = 0;
  for (const [x, y] of world.vertices.p) {
    if (Number.isFinite(x)) width = Math.max(width, x);
    if (Number.isFinite(y)) height = Math.max(height, y);
  }
  return { height: Math.max(1, height), width: Math.max(1, width) };
}

function getViewportSize(surface: HTMLElement, fallback: ViewportSize): ViewportSize {
  const bounds = surface.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height || fallback.height)),
    width: Math.max(1, Math.round(bounds.width || fallback.width))
  };
}
