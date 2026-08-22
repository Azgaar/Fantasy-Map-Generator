import { color } from "d3-color";
import { interpolateSpectral } from "d3-scale-chromatic";
import {
  Application,
  Assets,
  Container,
  Graphics,
  GraphicsContext,
  Rectangle,
  Sprite,
  Text,
  type Texture
} from "pixi.js";
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
import {
  clear as clearTradeAnimation,
  subscribeTradeAnimation,
  type TradeAnimationMarker,
  type TradeAnimationSnapshot,
  type TradeMarkerType
} from "../draw-trade-animation";
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import { buildBorderScene } from "../scene/layers/border-paths";
import { buildCellOutlineScene } from "../scene/layers/cell-outline-scene";
import { buildPrecipitationScene, buildTemperatureScene } from "../scene/layers/climate-scene";
import {
  buildGoodsScene,
  buildIceScene,
  buildMarketScene,
  type GoodsBurgSceneItem
} from "../scene/layers/economic-ice-scene";
import { buildGridScene } from "../scene/layers/grid-scene";
import { buildBurgPointSymbolScene, buildMarkerPointSymbolScene } from "../scene/layers/point-symbol-scene";
import {
  buildMilitaryScene,
  buildPopulationScene,
  type MilitarySceneItem
} from "../scene/layers/population-military-scene";
import { buildReliefSpriteScene } from "../scene/layers/relief-sprite-scene";
import { type RetainedCellTopology, RetainedCellTopologyCache } from "../scene/layers/retained-cell-topology";
import { buildRiverScene, buildRouteScene } from "../scene/layers/river-route-scene";
import { buildCompassScene } from "../scene/layers/static-overlay-scene";
import { buildZoneScene } from "../scene/layers/zone-scene";
import type { LinePathPrimitive, PointSymbolInstancePrimitive, PolygonPathPrimitive } from "../scene/primitives";
import type { MapRenderWorld } from "../scene/render-world";
import {
  DEFAULT_PIXI_MAP_STYLE,
  type GoodsLayerStyle,
  type MapStyle,
  type MilitaryLayerStyle,
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
  burgSymbols: number;
  markerSymbols: number;
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
  onSceneChange?: () => void;
  recordPerformance?: (name: string, duration: number) => void;
  resolutionPolicy?: RendererResolutionPolicy;
  resolveReliefIcon?: (icon: string) => string | null;
  resolveSymbolIcon?: (icon: string) => string | null;
  resolveCompassIcon?: () => string | null;
  textureBudgetBytes?: number;
}

export class PixiMapRenderer implements MapRenderer {
  private app: Application | null = null;
  private camera: MapCamera = { ...DEFAULT_MAP_CAMERA };
  private contextRecoveryRelease: (() => void) | null = null;
  private diagnostics = new RenderDiagnostics();
  private cellMeshes = new Map<CellFillLayer, { container: Container; retained: RetainedCellMesh }>();
  private layerVisibility = new Map<MapLayerId, boolean>();
  private markerDisplays = new Map<number, { container: Container; baseSize: number; rescale: boolean }>();
  private pointTextureHandles = new Set<RendererResourceHandle<Texture>>();
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
  private tradeContainer: Container | null = null;
  private tradeDisplays = new Map<number, Container>();
  private tradeSnapshot: TradeAnimationSnapshot = { highlight: null, markers: [] };
  private tradeTextures = new Map<TradeMarkerType, Texture>();
  private tradeSubscriptionRelease: (() => void) | null = null;
  private textureCache: RendererResourceCache<Texture>;
  private world: MapRenderWorld | null = null;
  private stats: PixiRendererSnapshot = {
    batches: 0,
    buildDuration: 0,
    cameraScale: 1,
    cells: 0,
    contextLost: false,
    diagnostics: {},
    enabled: false,
    burgSymbols: 0,
    markerSymbols: 0,
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

  async render(world: MapRenderWorld, style: MapStyle, invalidation: RenderInvalidationBatch): Promise<void> {
    this.world = world;
    this.semanticStyle = structuredClone(style);
    await this.renderInvalidations(invalidation);
  }

  queueRender(world: MapRenderWorld, style: MapStyle, invalidation: RenderInvalidation): void {
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
    const gridContainer = this.buildGridContainer();
    const compassContainer = await this.buildCompassContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const riverContainer = this.buildRiversContainer();
    const reliefContainer = await this.buildReliefContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const religionContainer = this.buildFillContainer("religions");
    const cultureContainer = this.buildFillContainer("cultures");
    const stateContainer = this.buildFillContainer("states");
    const provinceContainer = this.buildFillContainer("provinces");
    const tradeContainer = await this.buildTradeContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const zoneContainer = this.buildZonesContainer();
    const borderContainer = this.buildBordersContainer();
    const routeContainer = this.buildRoutesContainer();
    const temperatureContainer = this.buildTemperatureContainer();
    const iceContainer = this.buildIceContainer();
    const goodsContainer = await this.buildGoodsContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const marketsContainer = this.buildMarketsContainer();
    const precipitationContainer = this.buildPrecipitationContainer();
    const populationContainer = this.buildPopulationContainer();
    const burgContainer = this.buildBurgIconsContainer();
    const militaryContainer = await this.buildMilitaryContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    const markerContainer = await this.buildMarkersContainer(sequence);
    if (sequence !== this.rebuildSequence) return;
    this.app.stage.addChild(
      geography.ocean,
      geography.landmass,
      geography.lakes,
      biomeContainer,
      cellsContainer,
      gridContainer,
      compassContainer,
      riverContainer,
      reliefContainer,
      religionContainer,
      cultureContainer,
      stateContainer,
      provinceContainer,
      tradeContainer,
      zoneContainer,
      borderContainer,
      routeContainer,
      temperatureContainer,
      geography.coastline,
      iceContainer,
      goodsContainer,
      marketsContainer,
      precipitationContainer,
      populationContainer,
      burgContainer,
      militaryContainer,
      markerContainer
    );
    const burgSymbols = this.getWorld().burgs.filter(burg => burg.i && !burg.removed && burg.group).length;
    const markerSymbols = markerContainer.children.length;
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
      burgSymbols,
      cells: world.cells.i.length,
      enabled: true,
      markerSymbols,
      reliefSprites,
      renderer: this.app.renderer.constructor.name
    };
    this.rendererOptions.onSceneChange?.();
    this.recordPerformance("pixi:rebuild", buildDuration);
  }

  setLayerVisibility(layer: MapLayerId, visible: boolean): void {
    if (this.layerVisibility.get(layer) === visible) return;
    this.layerVisibility.set(layer, visible);
    if (layer === "trade" && !visible) clearTradeAnimation();
    this.applyVisibility();
  }

  private applyVisibility(render = true): void {
    if (!this.app || !this.stats.enabled) return;
    for (const child of this.app.stage.children) {
      if (isMapLayerId(child.label)) child.visible = this.layerVisibility.get(child.label) ?? true;
    }
    if (render) {
      this.app.render();
      this.rendererOptions.onSceneChange?.();
    }
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
    this.updateMarkerScales();
    this.app.render();
    this.recordPerformance("pixi:camera", performance.now() - started);
  }

  clear(): void {
    this.rebuildSequence++;
    this.scheduler?.clear();
    this.clearStage();
    this.textureCache.clear();
    this.app?.render();
    this.rendererOptions.onSceneChange?.();
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
    this.tradeSubscriptionRelease?.();
    this.tradeSubscriptionRelease = null;
    this.clearStage();
    this.textureCache.clear();
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.surface = null;
    this.topologyCache.clear();
    this.topologyInputs = null;
    this.sceneRevisions.reset();
    this.diagnostics.clear();
    this.stats = {
      ...this.stats,
      batches: 0,
      burgSymbols: 0,
      enabled: false,
      markerSymbols: 0,
      reliefSprites: 0,
      renderer: null
    };
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

  createOverview(
    maxWidth: number,
    maxHeight: number
  ): { height: number; source: CanvasImageSource; width: number } | null {
    if (!this.app || !this.world?.vertices.p.length) return null;

    const bounds = getWorldBounds(this.world);
    const resolution = Math.min(1, maxWidth / bounds.width, maxHeight / bounds.height);
    const position = { x: this.app.stage.position.x, y: this.app.stage.position.y };
    const stageScale = { x: this.app.stage.scale.x, y: this.app.stage.scale.y };

    this.app.stage.position.set(0, 0);
    this.app.stage.scale.set(1, 1);
    let source: { height: number; width: number } | null = null;
    try {
      source = this.app.renderer.extract.canvas({
        clearColor: this.semanticStyle.ocean.color,
        frame: new Rectangle(0, 0, bounds.width, bounds.height),
        resolution,
        target: this.app.stage
      });
    } finally {
      this.app.stage.position.set(position.x, position.y);
      this.app.stage.scale.set(stageScale.x, stageScale.y);
    }
    if (!source) return null;

    return { height: source.height, source: source as unknown as CanvasImageSource, width: source.width };
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
      // Camera renders are one-shot, so culling must use the new stage transform in the same frame.
      culler: { updateTransform: true },
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
    this.tradeSubscriptionRelease = subscribeTradeAnimation(snapshot => this.renderTradeSnapshot(snapshot));
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
    layer: "ice" | "lakes" | "landmass" | "rivers" | "temperature",
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
    layer: "cells" | "coastline" | "grid" | "population" | "routes",
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

  private buildGridContainer(): Container {
    const gridStyle = this.semanticStyle.grid;
    const scene = buildGridScene(
      getWorldBounds(this.getWorld()),
      gridStyle,
      this.sceneRevisions.getLayerRevision("grid")
    );
    const container = this.buildLineContainer("grid", scene.paths, () => gridStyle.stroke);
    container.alpha = gridStyle.opacity;
    return container;
  }

  private async buildCompassContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "compass";
    const scene = buildCompassScene(this.semanticStyle.compass, this.sceneRevisions.getLayerRevision("compass"));
    const source = this.rendererOptions.resolveCompassIcon?.();
    if (!source) {
      const graphic = createCompassGraphic();
      graphic.label = scene.domainId;
      graphic.position.set(scene.x, scene.y);
      graphic.scale.set(scene.scale);
      graphic.alpha = scene.opacity;
      container.addChild(graphic);
      return container;
    }
    let handle: RendererResourceHandle<Texture> | null = null;
    try {
      handle = await this.textureCache.acquire(source, () => Assets.load<Texture>(source));
    } catch {
      return container;
    }
    if (sequence !== this.rebuildSequence) {
      handle.release();
      return container;
    }
    const sprite = new Sprite({ texture: handle.value });
    sprite.anchor.set(0.5);
    sprite.label = scene.domainId;
    sprite.position.set(scene.x, scene.y);
    sprite.scale.set(scene.scale);
    sprite.alpha = scene.opacity;
    container.addChild(sprite);
    this.pointTextureHandles.add(handle);
    return container;
  }

  private async buildTradeContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "trade";
    container.alpha = this.semanticStyle.trade.opacity;
    const sources = new Map<TradeMarkerType, string>([
      ["land", "./images/markers/wagon.svg"],
      ["water", "./images/markers/ship.svg"]
    ]);
    const handles = new Map<TradeMarkerType, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...sources].map(async ([type, source]) => {
        try {
          handles.set(type, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          // Missing trade marker assets receive a deterministic placeholder.
        }
      })
    );
    if (sequence !== this.rebuildSequence) {
      for (const handle of handles.values()) handle.release();
      return container;
    }
    this.tradeContainer = container;
    this.tradeTextures = new Map([...handles].map(([type, handle]) => [type, handle.value]));
    for (const handle of handles.values()) this.pointTextureHandles.add(handle);
    this.syncTradeDisplays(this.tradeSnapshot);
    return container;
  }

  private buildRiversContainer(): Container {
    const style = this.semanticStyle.rivers;
    const scene = buildRiverScene(
      this.getWorld(),
      getWorldBounds(this.getWorld()),
      this.sceneRevisions.getLayerRevision("rivers")
    );
    const container = this.buildPolygonContainer("rivers", scene.polygons, () => ({
      fill: style.fill,
      stroke: { cap: "butt", color: style.fill.color, dash: "", opacity: 0, width: 0 }
    }));
    container.alpha = style.opacity;
    return container;
  }

  private buildRoutesContainer(): Container {
    const scene = buildRouteScene(this.getWorld(), this.sceneRevisions.getLayerRevision("routes"));
    return this.buildLineContainer(
      "routes",
      scene.paths,
      role => this.semanticStyle.routes.roles[role] ?? this.semanticStyle.routes.default
    );
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

  private buildTemperatureContainer(): Container {
    const container = new Container();
    container.label = "temperature";
    const climate = this.getWorld().climate;
    if (!climate) return container;

    const style = this.semanticStyle.temperature;
    const scene = buildTemperatureScene(
      climate,
      getWorldBounds(this.getWorld()),
      this.sceneRevisions.getLayerRevision("temperature")
    );
    const bands = this.buildPolygonContainer("temperature", scene.bands.polygons, role => {
      const isBase = role.startsWith("base:");
      const fillColor = getTemperatureColor(Number(isBase ? role.slice(5) : role));
      return {
        fill: { color: fillColor, opacity: style.bandOpacity },
        stroke: isBase
          ? { ...style.stroke, opacity: 0, width: 0 }
          : { ...style.stroke, color: color(fillColor)?.darker(0.2).toString() ?? fillColor }
      };
    });
    container.addChild(...bands.removeChildren());
    for (const label of scene.labels.labels) {
      const text = new Text({
        style: {
          fill: style.labels.color,
          fontFamily: style.labels.fontFamily,
          fontSize: style.labels.fontSize,
          fontWeight: style.labels.fontWeight
        },
        text: label.text
      });
      text.alpha = style.labels.opacity;
      text.anchor.set(0.5);
      text.label = String(label.domainId);
      text.position.set(label.anchor[0], label.anchor[1]);
      container.addChild(text);
    }
    container.alpha = style.opacity;
    return container;
  }

  private buildPrecipitationContainer(): Container {
    const container = new Container();
    container.label = "precipitation";
    const climate = this.getWorld().climate;
    if (!climate) return container;
    const scene = buildPrecipitationScene(climate, this.sceneRevisions.getLayerRevision("precipitation"));
    const context = new GraphicsContext();
    for (const circle of scene.circles) context.circle(circle.x, circle.y, circle.radius);
    const style = this.semanticStyle.precipitation;
    if (scene.circles.length && style.fill.opacity > 0) {
      context.fill({ alpha: style.fill.opacity, color: style.fill.color });
    }
    if (scene.circles.length && style.stroke.width > 0 && style.stroke.opacity > 0) {
      context.stroke({
        alpha: style.stroke.opacity,
        cap: style.stroke.cap,
        color: style.stroke.color,
        width: style.stroke.width
      });
    }
    if (scene.circles.length) container.addChild(new Graphics(context));
    container.alpha = style.opacity;
    return container;
  }

  private buildIceContainer(): Container {
    const style = this.semanticStyle.ice;
    const scene = buildIceScene(this.getWorld(), this.sceneRevisions.getLayerRevision("ice"));
    const container = this.buildPolygonContainer("ice", scene.polygons, role => style.roles[role] ?? style.default);
    container.alpha = style.opacity;
    return container;
  }

  private async buildGoodsContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "goods";
    const world = this.getWorld();
    const style = this.semanticStyle.goods;
    const scene = buildGoodsScene(world, world.goodsProduction, this.sceneRevisions.getLayerRevision("goods"));
    const iconSources = new Map<string, string>();
    for (const icon of new Set([...scene.icons, ...scene.burgs.flatMap(burg => burg.entries)].map(item => item.icon))) {
      const source = this.rendererOptions.resolveSymbolIcon?.(icon);
      if (source) iconSources.set(icon, source);
    }
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...iconSources].map(async ([icon, source]) => {
        try {
          textures.set(icon, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          // Missing goods assets receive a deterministic placeholder below.
        }
      })
    );
    if (sequence !== this.rebuildSequence) {
      for (const handle of textures.values()) handle.release();
      return container;
    }

    const cells = new GraphicsContext();
    for (const cell of scene.cells) {
      cells.poly(cell.points.flat(), true).fill({ alpha: cell.opacity, color: cell.color });
    }
    if (scene.cells.length) {
      const graphic = new Graphics(cells);
      graphic.alpha = style.cells.opacity;
      graphic.label = "goods:cells";
      container.addChild(graphic);
    }

    for (const item of scene.icons) {
      const display = new Container();
      display.cullable = true;
      display.label = `goods:cell:${item.cellId}`;
      display.position.set(item.x, item.y);
      if (style.icons.circle) {
        const background = new GraphicsContext()
          .circle(0, 0, style.icons.size / 2)
          .fill({ color: item.color })
          .stroke({ color: item.stroke, width: style.icons.strokeWidth });
        display.addChild(new Graphics(background));
      }
      display.addChild(createSymbolSprite(textures.get(item.icon)?.value, style.icons.size));
      display.alpha = style.icons.opacity;
      container.addChild(display);
    }

    for (const burg of scene.burgs) {
      const plate = createGoodsBurgPlate(burg, style.burgs, textures);
      plate.label = `goods:burg:${burg.burgId}`;
      plate.position.set(burg.x, burg.y);
      plate.cullable = true;
      container.addChild(plate);
    }
    for (const handle of textures.values()) this.pointTextureHandles.add(handle);
    container.alpha = style.opacity;
    return container;
  }

  private buildMarketsContainer(): Container {
    const container = new Container();
    container.label = "markets";
    const style = this.semanticStyle.markets;
    const scene = buildMarketScene(this.getWorld(), this.sceneRevisions.getLayerRevision("markets"));
    for (const market of scene.markets) {
      if (market.polygons.length) {
        const fill = createPolygonGraphic(market.polygons, {
          fill: { color: market.color, opacity: style.areaOpacity },
          stroke: { cap: "butt", color: market.stroke, dash: "", opacity: 0, width: 0 }
        });
        fill.label = `market:${market.marketId}:area`;
        container.addChild(fill);
      }
      if (market.borders.length) {
        const borders = createLineGraphic(market.borders, {
          cap: "butt",
          color: market.stroke,
          dash: "",
          opacity: style.borderOpacity,
          width: style.borderWidth
        });
        borders.label = `market:${market.marketId}:border`;
        container.addChild(borders);
      }
      if (market.center) {
        const center = new Container();
        center.cullable = true;
        center.label = `market:${market.marketId}:center`;
        center.position.set(market.center.x, market.center.y);
        const marker = new GraphicsContext()
          .circle(0, 0, style.radius)
          .fill({ color: market.color })
          .stroke({ color: market.stroke, width: Math.max(style.radius / 8, 0) });
        center.addChild(new Graphics(marker));
        const icon = new Text({ style: { fontSize: style.iconSize }, text: style.icon });
        icon.anchor.set(0.5);
        center.addChild(icon);
        container.addChild(center);
      }
    }
    container.alpha = style.opacity;
    return container;
  }

  private buildPopulationContainer(): Container {
    const style = this.semanticStyle.population;
    const scene = buildPopulationScene(
      this.getWorld(),
      this.getWorld().urbanization ?? 1,
      this.sceneRevisions.getLayerRevision("population")
    );
    const container = this.buildLineContainer("population", scene.paths, role =>
      role === "urban" ? style.urban : style.rural
    );
    container.alpha = style.opacity;
    return container;
  }

  private async buildMilitaryContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "military";
    const style = this.semanticStyle.military;
    const scene = buildMilitaryScene(this.getWorld(), this.sceneRevisions.getLayerRevision("military"));
    const externalSources = new Set(scene.regiments.map(({ icon }) => icon).filter(icon => isExternalImage(icon)));
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...externalSources].map(async source => {
        try {
          textures.set(source, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          // Missing or blocked regiment images receive a deterministic placeholder below.
        }
      })
    );
    if (sequence !== this.rebuildSequence) {
      for (const handle of textures.values()) handle.release();
      return container;
    }

    for (const regiment of scene.regiments) {
      const display = createRegimentDisplay(regiment, style, textures.get(regiment.icon)?.value);
      display.cullable = true;
      display.label = `regiment:${regiment.domainId}`;
      display.position.set(regiment.x, regiment.y);
      display.rotation = (regiment.angle * Math.PI) / 180;
      container.addChild(display);
    }
    for (const handle of textures.values()) this.pointTextureHandles.add(handle);
    container.alpha = style.opacity;
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

  private buildBurgIconsContainer(): Container {
    const container = new Container();
    container.label = "burgIcons";
    container.alpha = this.semanticStyle.burgIcons.opacity;
    const scene = buildBurgPointSymbolScene(
      this.getWorld().burgs,
      this.semanticStyle.burgIcons,
      this.sceneRevisions.getLayerRevision("burgIcons")
    );
    for (const [kind, instances] of [
      ["icons", scene.icons.instances],
      ["anchors", scene.anchors.instances]
    ] as const) {
      for (const symbols of groupPointSymbols(instances).values()) {
        const graphic = createBurgSymbolGraphic(symbols);
        graphic.label = `burgIcons:${kind}:${symbols[0]?.role ?? "default"}`;
        container.addChild(graphic);
      }
    }
    return container;
  }

  private async buildMarkersContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "markers";
    const world = this.getWorld();
    const scene = buildMarkerPointSymbolScene(
      world.markers ?? [],
      this.semanticStyle.markers,
      world.markerRenderState ?? { pinnedOnly: false, visibleIds: null },
      this.sceneRevisions.getLayerRevision("markers")
    );
    const externalSources = new Set(
      scene.instances.map(({ icon }) => icon).filter((icon): icon is string => Boolean(icon && isExternalImage(icon)))
    );
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...externalSources].map(async source => {
        try {
          textures.set(source, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          // A missing or CORS-blocked marker image is rendered as an explicit placeholder below.
        }
      })
    );
    if (sequence !== this.rebuildSequence) {
      for (const handle of textures.values()) handle.release();
      return container;
    }

    for (const symbol of scene.instances) {
      const marker = createMarkerDisplay(symbol, symbol.icon ? textures.get(symbol.icon)?.value : undefined);
      marker.label = `marker:${symbol.domainId}`;
      container.addChild(marker);
      this.markerDisplays.set(Number(symbol.domainId), {
        baseSize: symbol.size,
        container: marker,
        rescale: symbol.rescale
      });
    }
    for (const handle of textures.values()) this.pointTextureHandles.add(handle);
    this.updateMarkerScales();
    return container;
  }

  private updateMarkerScales(): void {
    for (const { baseSize, container, rescale } of this.markerDisplays.values()) {
      const renderedSize = rescale ? Math.max(baseSize / 5 + 24 / this.camera.scale, 1) : baseSize;
      container.scale.set(renderedSize / 30);
    }
  }

  private clearStage(): void {
    if (!this.app) return;
    for (const retained of this.retainedCellMeshes) retained.destroy();
    this.retainedCellMeshes.clear();
    this.cellMeshes.clear();
    this.markerDisplays.clear();
    this.tradeContainer = null;
    this.tradeDisplays.clear();
    this.tradeTextures.clear();
    for (const child of this.app.stage.removeChildren()) child.destroy({ children: true });
    for (const handle of this.reliefTextureHandles) handle.release();
    this.reliefTextureHandles.clear();
    for (const handle of this.pointTextureHandles) handle.release();
    this.pointTextureHandles.clear();
  }

  private renderTradeSnapshot(snapshot: TradeAnimationSnapshot): void {
    this.tradeSnapshot = snapshot;
    if (!this.app || !this.tradeContainer || !this.stats.enabled) return;
    this.syncTradeDisplays(snapshot);
    if (this.layerVisibility.get("trade") ?? true) {
      this.app.render();
      this.rendererOptions.onSceneChange?.();
    }
  }

  private syncTradeDisplays(snapshot: TradeAnimationSnapshot): void {
    const container = this.tradeContainer;
    if (!container) return;
    const activeIds = new Set(snapshot.markers.map(marker => marker.id));
    for (const [id, display] of this.tradeDisplays) {
      if (activeIds.has(id)) continue;
      display.removeFromParent();
      display.destroy({ children: true });
      this.tradeDisplays.delete(id);
    }
    for (const marker of snapshot.markers) this.syncTradeMarker(container, marker);

    const previousHighlight = container.children.find(child => child.label === "trade:highlight");
    previousHighlight?.removeFromParent();
    previousHighlight?.destroy();
    if (snapshot.highlight && snapshot.highlight.length > 1) {
      const highlight = createLineGraphic(
        [{ domainId: "trade-highlight", points: [...snapshot.highlight], role: "highlight" }],
        this.semanticStyle.trade.highlight
      );
      highlight.label = "trade:highlight";
      container.addChildAt(highlight, 0);
    }
  }

  private syncTradeMarker(container: Container, marker: TradeAnimationMarker): void {
    let display = this.tradeDisplays.get(marker.id);
    if (!display) {
      display = new Container();
      display.label = `trade:${marker.id}`;
      const size = marker.type === "land" ? marker.size / 1.6 : marker.size;
      display.addChild(createSymbolSprite(this.tradeTextures.get(marker.type), size));
      container.addChild(display);
      this.tradeDisplays.set(marker.id, display);
    }
    display.position.set(marker.x, marker.y);
    display.rotation = marker.angle;
  }

  private getCellTopology(): RetainedCellTopology {
    const world = this.getWorld();
    const inputs = { cellVertices: world.cells.v, vertexPoints: world.vertices.p };
    if (
      this.topologyInputs?.cellVertices !== inputs.cellVertices ||
      this.topologyInputs?.vertexPoints !== inputs.vertexPoints
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
    this.rendererOptions.onSceneChange?.();
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

  private getWorld(): MapRenderWorld {
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
  for (const path of paths) traceLinePath(context, path, style.dash);
  if (style.width > 0 && style.opacity > 0) {
    context.stroke({ alpha: style.opacity, cap: style.cap, color: style.color, width: style.width });
  }
  return new Graphics(context);
}

function createGoodsBurgPlate(
  burg: GoodsBurgSceneItem,
  style: GoodsLayerStyle["burgs"],
  textures: ReadonlyMap<string, RendererResourceHandle<Texture>>
): Container {
  const container = new Container();
  const fontSize = style.iconSize * (3.5 / 3);
  const gap = style.iconSize * 0.2;
  const entryGap = style.iconSize * (0.8 / 3);
  const entryWidths = burg.entries.map(entry => style.iconSize + gap + String(entry.value).length * fontSize * 0.62);
  const width =
    entryWidths.reduce((total, entryWidth) => total + entryWidth, 0) + entryGap * (burg.entries.length - 1) + 2;
  const height = style.iconSize + 1.2;
  const background = new GraphicsContext()
    .rect(-width / 2, 0, width, height)
    .fill({ alpha: style.fillOpacity, color: style.fill });
  if (style.strokeWidth > 0) background.stroke({ color: style.stroke, width: style.strokeWidth });
  container.addChild(new Graphics(background));

  let offset = -width / 2 + 1;
  for (let index = 0; index < burg.entries.length; index++) {
    const entry = burg.entries[index];
    const icon = new Container();
    icon.position.set(offset + style.iconSize / 2, 0.6 + style.iconSize / 2);
    icon.addChild(
      new Graphics(
        new GraphicsContext()
          .circle(0, 0, style.iconSize / 2)
          .fill({ color: entry.color })
          .stroke({ color: entry.stroke, width: style.strokeWidth })
      ),
      createSymbolSprite(textures.get(entry.icon)?.value, style.iconSize)
    );
    container.addChild(icon);
    const text = new Text({
      style: { fill: style.textColor, fontSize },
      text: String(entry.value)
    });
    text.anchor.set(0, 0.5);
    text.position.set(offset + style.iconSize + gap, height / 2);
    container.addChild(text);
    offset += entryWidths[index] + entryGap;
  }
  container.alpha = style.opacity;
  return container;
}

function createSymbolSprite(texture: Texture | undefined, size: number): Sprite | Graphics {
  if (texture) {
    const sprite = new Sprite({ height: size, texture, width: size });
    sprite.anchor.set(0.5);
    return sprite;
  }
  return new Graphics(
    new GraphicsContext()
      .poly([0, -size / 2, size / 2, 0, 0, size / 2, -size / 2, 0], true)
      .stroke({ color: "#c13119", width: Math.max(0.2, size / 12) })
  );
}

function createCompassGraphic(): Graphics {
  const context = new GraphicsContext()
    .circle(0, 0, 212)
    .stroke({ color: "#1b1b1b", width: 8 })
    .circle(0, 0, 164)
    .stroke({ color: "#1b1b1b", width: 2 })
    .circle(0, 0, 94)
    .stroke({ color: "#1b1b1b", width: 2 })
    .circle(0, 0, 9)
    .fill({ color: "#1b1b1b" });
  for (let index = 0; index < 8; index++) {
    const angle = (index * Math.PI) / 4;
    const side = angle + Math.PI / 2;
    const tip = [Math.cos(angle) * 202, Math.sin(angle) * 202];
    const left = [Math.cos(side) * 24, Math.sin(side) * 24];
    context
      .poly([0, 0, tip[0], tip[1], left[0], left[1]], true)
      .fill({ color: index % 2 ? "#47a3d1" : "#c2390f" })
      .stroke({ color: "#1b1b1b", width: 2 });
  }
  return new Graphics(context);
}

function createRegimentDisplay(
  regiment: MilitarySceneItem,
  style: MilitaryLayerStyle,
  texture: Texture | undefined
): Container {
  const container = new Container();
  const height = style.boxSize * 2;
  const width = style.boxSize * (regiment.naval ? 4 : 6);
  const body = new GraphicsContext()
    .rect(-width / 2, -height / 2, width, height)
    .fill({ alpha: style.fillOpacity, color: regiment.color })
    .stroke({ color: style.stroke, width: style.strokeWidth })
    .rect(-width / 2 - height, -height / 2, height, height)
    .fill({ alpha: style.fillOpacity, color: regiment.iconColor })
    .stroke({ color: style.stroke, width: style.strokeWidth });
  container.addChild(new Graphics(body));

  const total = new Text({
    style: {
      fill: style.textColor,
      fontFamily: style.fontFamily,
      fontSize: height
    },
    text: regiment.text
  });
  total.anchor.set(0.5);
  container.addChild(total);

  const iconX = -width / 2 - height / 2;
  if (isExternalImage(regiment.icon)) {
    const icon = createSymbolSprite(texture, height);
    icon.position.set(iconX, 0);
    container.addChild(icon);
  } else {
    const icon = new Text({ style: { fontSize: height * 0.8 }, text: regiment.icon });
    icon.anchor.set(0.5);
    icon.position.set(iconX, 0);
    container.addChild(icon);
  }
  return container;
}

function groupPointSymbols(
  instances: readonly PointSymbolInstancePrimitive[]
): Map<string, PointSymbolInstancePrimitive[]> {
  const groups = new Map<string, PointSymbolInstancePrimitive[]>();
  for (const symbol of instances) {
    const key = [
      symbol.role,
      symbol.shape,
      symbol.size,
      symbol.fill,
      symbol.fillOpacity,
      symbol.stroke,
      symbol.strokeWidth,
      symbol.opacity
    ].join(":");
    const group = groups.get(key);
    if (group) group.push(symbol);
    else groups.set(key, [symbol]);
  }
  return groups;
}

function createBurgSymbolGraphic(symbols: readonly PointSymbolInstancePrimitive[]): Graphics {
  const context = new GraphicsContext();
  for (const symbol of symbols) traceBurgSymbol(context, symbol);
  const first = symbols[0];
  if (first) {
    if (first.fillOpacity > 0) context.fill({ alpha: first.fillOpacity * first.opacity, color: first.fill });
    if (first.strokeWidth > 0) {
      context.stroke({ alpha: first.opacity, color: first.stroke, width: first.strokeWidth });
    }
  }
  return new Graphics(context);
}

function traceBurgSymbol(context: GraphicsContext, symbol: PointSymbolInstancePrimitive): void {
  const { shape, size, x, y } = symbol;
  const radius = size / 2;
  if (shape === "circle" || shape === "circled") return void context.circle(x, y, radius);
  if (shape === "square" || shape === "squared") return void context.rect(x - radius, y - radius, size, size);
  if (shape === "triangle") {
    context.poly([x, y - radius, x + radius, y + radius, x - radius, y + radius], true);
    return;
  }
  if (shape === "cross") {
    const arm = size * 0.15;
    context.poly(
      [
        x - arm,
        y - radius,
        x + arm,
        y - radius,
        x + arm,
        y - arm,
        x + radius,
        y - arm,
        x + radius,
        y + arm,
        x + arm,
        y + arm,
        x + arm,
        y + radius,
        x - arm,
        y + radius,
        x - arm,
        y + arm,
        x - radius,
        y + arm,
        x - radius,
        y - arm,
        x - arm,
        y - arm
      ],
      true
    );
    return;
  }
  if (shape === "anchor") {
    context.circle(x, y - radius * 0.55, radius * 0.18);
    context.moveTo(x, y - radius * 0.35).lineTo(x, y + radius * 0.7);
    context.moveTo(x - radius * 0.55, y).lineTo(x + radius * 0.55, y);
    context.arc(x, y + radius * 0.15, radius * 0.65, 0.15, Math.PI - 0.15);
    return;
  }
  if (shape.includes("star")) {
    const points: number[] = [];
    for (let index = 0; index < 10; index++) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const pointRadius = index % 2 ? radius * 0.42 : radius;
      points.push(x + Math.cos(angle) * pointRadius, y + Math.sin(angle) * pointRadius);
    }
    context.poly(points, true);
    return;
  }
  // Unknown custom symbols remain visible as a deterministic missing-asset diamond.
  context.poly([x, y - radius, x + radius, y, x, y + radius, x - radius, y], true);
  context.moveTo(x - radius * 0.45, y - radius * 0.45).lineTo(x + radius * 0.45, y + radius * 0.45);
  context.moveTo(x + radius * 0.45, y - radius * 0.45).lineTo(x - radius * 0.45, y + radius * 0.45);
}

function createMarkerDisplay(symbol: PointSymbolInstancePrimitive, texture?: Texture): Container {
  const container = new Container();
  container.position.set(symbol.x, symbol.y);
  container.pivot.set(15, 30);
  container.cullable = true;
  container.cullArea = new Rectangle(0, 0, 30, 30);
  container.eventMode = "none";

  const pin = createMarkerPinGraphic(symbol);
  pin.alpha = symbol.opacity;
  container.addChild(pin);

  const iconX = symbol.iconOffsetX * 30;
  const iconY = symbol.iconOffsetY * 30;
  if (symbol.icon && isExternalImage(symbol.icon) && texture) {
    const sprite = new Sprite({ texture });
    sprite.anchor.set(0.5);
    sprite.height = symbol.iconSize;
    sprite.width = symbol.iconSize;
    sprite.position.set(iconX, iconY);
    container.addChild(sprite);
  } else if (symbol.icon && !isExternalImage(symbol.icon)) {
    const icon = new Text({
      style: { align: "center", fontFamily: "sans-serif", fontSize: symbol.iconSize },
      text: symbol.icon
    });
    icon.anchor.set(0.5);
    icon.position.set(iconX, iconY);
    container.addChild(icon);
  } else if (symbol.icon) {
    const missing = new GraphicsContext()
      .rect(iconX - symbol.iconSize / 2, iconY - symbol.iconSize / 2, symbol.iconSize, symbol.iconSize)
      .moveTo(iconX - symbol.iconSize / 2, iconY - symbol.iconSize / 2)
      .lineTo(iconX + symbol.iconSize / 2, iconY + symbol.iconSize / 2)
      .moveTo(iconX + symbol.iconSize / 2, iconY - symbol.iconSize / 2)
      .lineTo(iconX - symbol.iconSize / 2, iconY + symbol.iconSize / 2)
      .stroke({ color: "#c13119", width: 1 });
    container.addChild(new Graphics(missing));
  }
  return container;
}

function createMarkerPinGraphic(symbol: PointSymbolInstancePrimitive): Graphics {
  const context = new GraphicsContext();
  traceMarkerPin(context, symbol.shape);
  if (symbol.shape !== "no") {
    context.fill({ alpha: symbol.fillOpacity, color: symbol.fill });
    if (symbol.strokeWidth > 0) context.stroke({ color: symbol.stroke, width: symbol.strokeWidth });
  }
  return new Graphics(context);
}

function traceMarkerPin(context: GraphicsContext, shape: string): void {
  if (shape === "no") return;
  if (shape === "bubble") {
    context.poly([6, 19, 15, 29, 24, 19], true);
    context.circle(15, 15, 10);
    return;
  }
  if (shape === "pin") {
    context
      .moveTo(15, 3)
      .bezierCurveTo(9.5, 3, 5.3, 7.09, 5.3, 12.3)
      .bezierCurveTo(5.3, 19.1, 15, 29.3, 15, 29.3)
      .bezierCurveTo(15, 29.3, 24.7, 19.1, 24.7, 12.3)
      .bezierCurveTo(24.7, 7.09, 20.5, 3, 15, 3)
      .closePath();
    return;
  }
  if (shape === "square") return void context.poly([5, 5, 25, 5, 25, 25, 20, 25, 15, 29, 10, 25, 5, 25], true);
  if (shape === "squarish") return void context.poly([5, 5, 25, 5, 25, 25, 19, 25, 15, 29, 11, 25, 5, 25], true);
  if (shape === "diamond") return void context.poly([15, 1, 28, 15, 15, 29, 2, 15], true);
  if (shape === "hex") return void context.poly([15, 3, 25.4, 9, 25.4, 21, 15, 29, 4.6, 21, 4.6, 9], true);
  if (shape === "hexy") return void context.poly([15, 4, 25, 8, 24, 21, 15, 29, 6, 21, 5, 8], true);
  if (shape === "shieldy") return void context.poly([6, 7, 15, 4, 24, 7, 24, 21, 15, 29, 6, 21], true);
  if (shape === "shield") {
    context
      .moveTo(4.6, 5.2)
      .lineTo(25, 5.2)
      .lineTo(25, 11.9)
      .bezierCurveTo(25, 20, 20, 26, 15, 29)
      .bezierCurveTo(10, 26, 4.6, 20, 4.6, 11.9)
      .closePath();
    return;
  }
  if (shape === "pentagon") return void context.poly([9, 4, 21, 4, 26, 16, 15, 29, 4, 16], true);
  if (shape === "heptagon") return void context.poly([10, 4, 20, 4, 26, 12, 24, 22, 15, 29, 6, 22, 4, 12], true);
  context.circle(15, 15, 11);
}

function isExternalImage(icon: string): boolean {
  return /^https?:\/\//.test(icon) || icon.startsWith("data:image");
}

function traceLinePath(context: GraphicsContext, path: LinePathPrimitive, dash: string): void {
  const [first] = path.points;
  if (!first) return;
  const points = path.closed ? [...path.points, first] : path.points;
  const dashPattern = parseDashPattern(dash);
  context.moveTo(first[0], first[1]);
  if (!dashPattern.length) {
    for (const point of points.slice(1)) context.lineTo(point[0], point[1]);
    if (path.closed) context.closePath();
    return;
  }

  let patternIndex = 0;
  let patternRemaining = dashPattern[0];
  let drawing = true;
  let currentX = first[0];
  let currentY = first[1];
  for (const [targetX, targetY] of points.slice(1)) {
    let remainingX = targetX - currentX;
    let remainingY = targetY - currentY;
    let remainingLength = Math.hypot(remainingX, remainingY);
    while (remainingLength > 1e-6) {
      const step = Math.min(patternRemaining, remainingLength);
      const ratio = step / remainingLength;
      const nextX = currentX + remainingX * ratio;
      const nextY = currentY + remainingY * ratio;
      if (drawing) context.lineTo(nextX, nextY);
      else context.moveTo(nextX, nextY);
      currentX = nextX;
      currentY = nextY;
      remainingX = targetX - currentX;
      remainingY = targetY - currentY;
      remainingLength = Math.hypot(remainingX, remainingY);
      patternRemaining -= step;
      if (patternRemaining <= 1e-6) {
        patternIndex = (patternIndex + 1) % dashPattern.length;
        patternRemaining = dashPattern[patternIndex];
        drawing = !drawing;
      }
    }
  }
}

function parseDashPattern(dash: string): number[] {
  const values = dash
    .split(/[ ,]+/)
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0);
  return values.length % 2 === 1 ? [...values, ...values] : values;
}

function getRenderableColor(color: string, fallbackColor: string): string {
  return color.startsWith("url(") ? fallbackColor : color;
}

function getTemperatureColor(temperature: number): string {
  return interpolateSpectral(1 - (temperature + 50) / 100);
}

function getWorldBounds(world: Pick<MapRenderWorld, "vertices">): { height: number; width: number } {
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
