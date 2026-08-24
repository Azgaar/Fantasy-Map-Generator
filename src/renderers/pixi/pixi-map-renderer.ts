import { color } from "d3-color";
import { interpolateSpectral } from "d3-scale-chromatic";
import {
  Application,
  Assets,
  BitmapFontManager,
  BitmapText,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  GraphicsContext,
  VERSION as PIXI_VERSION,
  Rectangle,
  Sprite,
  Text,
  type Texture,
  TilingSprite
} from "pixi.js";
import type { Emblem } from "@/generators/emblems/generator";
import {
  camerasEqual,
  DEFAULT_MAP_CAMERA,
  type MapCamera,
  normalizeCamera,
  screenToWorld,
  type ViewportSize
} from "../core/camera";
import type { RenderInvalidation, RenderInvalidationBatch } from "../core/invalidation";
import { MAP_LAYER_REGISTRY, type MapLayerId, normalizeMapLayerOrder } from "../core/layer-registry";
import type { MapHit, MapRenderer, ScreenPoint } from "../core/map-renderer";
import { RenderDiagnostics, type RenderDiagnosticsSnapshot } from "../core/render-diagnostics";
import { RenderScheduler } from "../core/render-scheduler";
import {
  DEFAULT_RENDERER_RESOLUTION_POLICY,
  type RendererResolutionPolicy,
  selectRendererResolution
} from "../core/resolution";
import { RendererResourceTracker, selectRendererResourceBudget } from "../core/resource-budget";
import { RendererResourceCache, type RendererResourceHandle } from "../core/resource-cache";
import {
  clear as clearTradeAnimation,
  subscribeTradeAnimation,
  type TradeAnimationMarker,
  type TradeAnimationSnapshot,
  type TradeMarkerType
} from "../draw-trade-animation";
import { buildAssignmentBoundaryScene } from "../scene/layers/assignment-boundary-scene";
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import { buildBorderScene } from "../scene/layers/border-paths";
import { buildCellOutlineScene } from "../scene/layers/cell-outline-scene";
import { buildPrecipitationScene, buildTemperatureScene } from "../scene/layers/climate-scene";
import { buildCoastalAssignmentScene } from "../scene/layers/coastal-assignment-scene";
import {
  buildCoordinateScene,
  type CoordinateSceneLabel,
  selectCoordinateStep
} from "../scene/layers/coordinate-scene";
import {
  buildGoodsScene,
  buildIceScene,
  buildMarketScene,
  type GoodsBurgSceneItem
} from "../scene/layers/economic-ice-scene";
import { buildEmblemScene } from "../scene/layers/emblem-scene";
import { buildGridScene } from "../scene/layers/grid-scene";
import { buildHeightContourScene } from "../scene/layers/height-contour-scene";
import { buildLabelScene, type LabelSceneGroup, type ResolvedLabelGroupStyle } from "../scene/layers/label-scene";
import { buildOceanDepthScene } from "../scene/layers/ocean-depth-scene";
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
  type CoordinateLayerStyle,
  DEFAULT_PIXI_MAP_STYLE,
  type GoodsLayerStyle,
  type MapStyle,
  type MilitaryLayerStyle,
  type SemanticAreaStyle,
  type SemanticFillStyle,
  type SemanticLineStyle
} from "../scene/styles";
import { WorldSceneRevisionTracker } from "../scene/world-scene";
import { ensureFontFamiliesReady } from "../text/font-readiness";
import { monitorWebGlContext } from "./context-recovery";
import {
  GlyphAtlasCache,
  type GlyphAtlasDescriptor,
  type GlyphAtlasHandle,
  selectLabelAtlasResolution
} from "./glyph-atlas-cache";
import { RetainedCellMesh } from "./layers/retained-cell-mesh";
import { MapPickingIndex } from "./map-picking-index";

export interface PixiRendererSnapshot {
  batches: number;
  buildDuration: number;
  cameraScale: number;
  cells: number;
  commitSequence: number;
  contextLost: boolean;
  diagnostics: RenderDiagnosticsSnapshot;
  enabled: boolean;
  burgSymbols: number;
  coordinateLabels: number;
  coordinateLines: number;
  emblemSymbols: number;
  glyphAtlasBytes: number;
  glyphAtlasEntries: number;
  labelGlyphs: number;
  missingCoordinateFonts: readonly string[];
  missingEmblemAssets: readonly string[];
  missingLabelFonts: readonly string[];
  missingTextureAssets: readonly string[];
  markerSymbols: number;
  pickingEntries: number;
  reliefSprites: number;
  resolution: number;
  resourceBytes: number;
  resourceCount: number;
  renderer: string | null;
  rendererVersion: string;
  textureCacheEntries: number;
  unsupportedCoordinateEffects: readonly string[];
  unsupportedHeightEffects: readonly string[];
  unsupportedOceanEffects: readonly string[];
  unsupportedLabelEffects: readonly string[];
  unsupportedEmblemEffects: readonly string[];
  unsupportedTextureEffects: readonly string[];
  viewportHeight: number;
  viewportWidth: number;
}

export type PixiSceneChangeKind = "animation" | "content";

type CellFillLayer = "biomes" | "cultures" | "provinces" | "religions" | "states";

interface CellFillGeography {
  bounds: { height: number; width: number };
  coastlineOverdrawWidth: number;
  lakePolygons: readonly PolygonPathPrimitive[];
  landPolygons: readonly PolygonPathPrimitive[];
}

interface CellMeshDisplay {
  coastalFill: Container;
  container: Container;
  halo?: RetainedCellMesh;
  retained: RetainedCellMesh;
}

interface LabelDisplay {
  anchorX: number;
  anchorY: number;
  container: Container;
  groupFontSize: number;
  offsetXEm: number;
  offsetYEm: number;
  rescale: boolean;
  textDisplays: readonly BitmapText[];
}

interface LabelAtlasDisplay {
  container: Container;
  group: LabelSceneGroup;
  handle: GlyphAtlasHandle;
  resolution: number;
  resolvedFontFamily: string;
  textDisplays: readonly BitmapText[];
}

interface LabelGroupDisplay {
  active: boolean;
  container: Container;
  dependency: MapLayerId | null;
  maxScale: number | null;
  minScale: number | null;
  showAll: boolean;
}

interface EmblemGroupDisplay {
  automaticVisibility: boolean;
  baseSize: number;
  container: Container;
}

interface CoordinateGroupDisplay {
  container: Container;
  step: number;
}

interface CoordinateLabelDisplay {
  axis: CoordinateSceneLabel["axis"];
  display: BitmapText;
  x: number;
  y: number;
}

const CELL_FILL_LAYERS: readonly CellFillLayer[] = ["biomes", "religions", "cultures", "states", "provinces"];
const INCREMENTAL_LAYERS = new Set<MapLayerId>([
  ...CELL_FILL_LAYERS,
  "borders",
  "cells",
  "grid",
  "ice",
  "markets",
  "population",
  "precipitation",
  "rivers",
  "routes",
  "temperature",
  "zones"
]);
const LABEL_ATLAS_REFRESH_DELAY_MS = 100;

export interface PixiMapRendererOptions {
  deviceMemoryGb?: number;
  getDevicePixelRatio?: () => number;
  onSceneChange?: (kind: PixiSceneChangeKind) => void;
  pickTolerancePixels?: number;
  preference?: "webgl" | "webgpu";
  recordPerformance?: (name: string, duration: number) => void;
  resolutionPolicy?: RendererResolutionPolicy;
  resolveReliefIcon?: (icon: string) => string | null;
  resolveSymbolIcon?: (icon: string, presentation?: SvgSymbolPresentation) => string | null;
  resolveTradeMarker?: (type: TradeMarkerType) => string | null;
  resolveCompassIcon?: () => string | null;
  resolveEmblemIcon?: (id: string, coa: Emblem, strokeWidth: number) => Promise<string | null> | string | null;
  strictAssets?: boolean;
  glyphBudgetBytes?: number;
  textureBudgetBytes?: number;
}

export interface SvgSymbolPresentation {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  viewBox?: string;
}

export interface PixiRasterCapabilities {
  maxTextureSize: number;
}

export interface PixiRasterFrameRequest {
  frame: { height: number; width: number; x: number; y: number };
  fullMap: { height: number; width: number };
  hiddenLayers?: readonly MapLayerId[];
  resolution: number;
  transparentBackground?: boolean;
}

export class PixiMapRenderer implements MapRenderer {
  private app: Application | null = null;
  private backgroundTextureHandles = new Set<RendererResourceHandle<Texture>>();
  private camera: MapCamera = { ...DEFAULT_MAP_CAMERA };
  private contextRecoveryRelease: (() => void) | null = null;
  private diagnostics = new RenderDiagnostics();
  private cellFillGeography: CellFillGeography | null = null;
  private cellMeshes = new Map<CellFillLayer, CellMeshDisplay>();
  private coordinateGroupDisplays: CoordinateGroupDisplay[] = [];
  private coordinateLabelDisplays: CoordinateLabelDisplay[] = [];
  private coordinateLongitudeSpan = 0;
  private layerOrder = MAP_LAYER_REGISTRY.map(layer => layer.id);
  private layerContainers = new Map<MapLayerId, Container>();
  private layerVisibility = new Map<MapLayerId, boolean>();
  private dirtyLayers = new Set<MapLayerId>();
  private hiddenLayerCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private labelAtlasDisplays: LabelAtlasDisplay[] = [];
  private labelAtlasQueuedResolution = 0;
  private labelAtlasRefreshSequence = 0;
  private labelAtlasRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private labelDisplays: LabelDisplay[] = [];
  private labelGroupDisplays: LabelGroupDisplay[] = [];
  private labelResizeOnZoom = true;
  private emblemGroupDisplays: EmblemGroupDisplay[] = [];
  private emblemSourceCache = new Map<string, Promise<string | null>>();
  private emblemTextureHandles = new Set<RendererResourceHandle<Texture>>();
  private glyphAtlasCache: GlyphAtlasCache;
  private glyphBudgetBytes: number;
  private glyphAtlasHandles = new Set<RendererResourceHandle<GlyphAtlasDescriptor>>();
  private markerDisplays = new Map<number, { container: Container; baseSize: number; rescale: boolean }>();
  private pointTextureHandles = new Set<RendererResourceHandle<Texture>>();
  private pickingIndex = new MapPickingIndex();
  private rebuildSequence = 0;
  private retainedCellMeshes = new Set<RetainedCellMesh>();
  private reliefTextureHandles = new Set<RendererResourceHandle<Texture>>();
  private rendererFilters = new Set<{ destroy(): void }>();
  private resizeFrameId: number | null = null;
  private resources: RendererResourceTracker;
  private resizeObserver: ResizeObserver | null = null;
  private scheduler: RenderScheduler | null = null;
  private semanticStyle: MapStyle = structuredClone(DEFAULT_PIXI_MAP_STYLE);
  private queuedStyle: MapStyle | null = null;
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
  private commitWaiters = new Set<{ after: number; resolve: (sequence: number) => void }>();
  private stats: PixiRendererSnapshot = {
    batches: 0,
    buildDuration: 0,
    cameraScale: 1,
    cells: 0,
    commitSequence: 0,
    contextLost: false,
    diagnostics: {},
    enabled: false,
    burgSymbols: 0,
    coordinateLabels: 0,
    coordinateLines: 0,
    emblemSymbols: 0,
    glyphAtlasBytes: 0,
    glyphAtlasEntries: 0,
    labelGlyphs: 0,
    missingCoordinateFonts: [],
    missingEmblemAssets: [],
    missingLabelFonts: [],
    missingTextureAssets: [],
    markerSymbols: 0,
    pickingEntries: 0,
    reliefSprites: 0,
    resolution: 1,
    resourceBytes: 0,
    resourceCount: 0,
    renderer: null,
    rendererVersion: PIXI_VERSION,
    textureCacheEntries: 0,
    unsupportedCoordinateEffects: [],
    unsupportedHeightEffects: [],
    unsupportedOceanEffects: [],
    unsupportedLabelEffects: [],
    unsupportedEmblemEffects: [],
    unsupportedTextureEffects: [],
    viewportHeight: 0,
    viewportWidth: 0
  };

  constructor(private readonly rendererOptions: PixiMapRendererOptions = {}) {
    const budget = selectRendererResourceBudget(rendererOptions.deviceMemoryGb);
    this.resources = new RendererResourceTracker(budget);
    this.glyphBudgetBytes = rendererOptions.glyphBudgetBytes ?? budget.glyph;
    this.glyphAtlasCache = new GlyphAtlasCache({
      budgetBytes: this.glyphBudgetBytes,
      installer: BitmapFontManager,
      tracker: this.resources
    });
    this.textureCache = new RendererResourceCache<Texture>({
      budgetBytes: rendererOptions.textureBudgetBytes ?? budget.texture,
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
    this.queuedStyle = style;
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
    await this.decorateOceanContainer(sequence, geography.ocean, geography.bounds);
    if (sequence !== this.rebuildSequence) return;
    const textureContainer = await this.buildVisibleLayerAsync("texture", () =>
      this.buildTextureContainer(sequence, geography.landPolygons, geography.lakePolygons, geography.bounds)
    );
    if (sequence !== this.rebuildSequence) return;
    const heightContainer = this.buildVisibleLayer("height", () =>
      this.buildHeightContainer(geography.landPolygons, geography.bounds)
    );
    const biomeContainer = this.buildVisibleLayer("biomes", () => this.buildFillContainer("biomes"));
    const cellsContainer = this.buildVisibleLayer("cells", () => this.buildCellsContainer());
    const gridContainer = this.buildVisibleLayer("grid", () => this.buildGridContainer());
    const coordinatesContainer = await this.buildVisibleLayerAsync("coordinates", () =>
      this.buildCoordinatesContainer(sequence)
    );
    if (sequence !== this.rebuildSequence) return;
    const compassContainer = await this.buildVisibleLayerAsync("compass", () => this.buildCompassContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const riverContainer = this.buildVisibleLayer("rivers", () => this.buildRiversContainer());
    const reliefContainer = await this.buildVisibleLayerAsync("relief", () => this.buildReliefContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const religionContainer = this.buildVisibleLayer("religions", () => this.buildFillContainer("religions"));
    const cultureContainer = this.buildVisibleLayer("cultures", () => this.buildFillContainer("cultures"));
    const stateContainer = this.buildVisibleLayer("states", () => this.buildFillContainer("states"));
    const provinceContainer = this.buildVisibleLayer("provinces", () => this.buildFillContainer("provinces"));
    const tradeContainer = await this.buildVisibleLayerAsync("trade", () => this.buildTradeContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const zoneContainer = this.buildVisibleLayer("zones", () => this.buildZonesContainer());
    const borderContainer = this.buildVisibleLayer("borders", () => this.buildBordersContainer());
    const routeContainer = this.buildVisibleLayer("routes", () => this.buildRoutesContainer());
    const temperatureContainer = this.buildVisibleLayer("temperature", () => this.buildTemperatureContainer());
    const iceContainer = this.buildVisibleLayer("ice", () => this.buildIceContainer());
    const goodsContainer = await this.buildVisibleLayerAsync("goods", () => this.buildGoodsContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const marketsContainer = this.buildVisibleLayer("markets", () => this.buildMarketsContainer());
    const precipitationContainer = this.buildVisibleLayer("precipitation", () => this.buildPrecipitationContainer());
    const populationContainer = this.buildVisibleLayer("population", () => this.buildPopulationContainer());
    const emblemsContainer = await this.buildVisibleLayerAsync("emblems", () => this.buildEmblemsContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const labelsContainer = await this.buildVisibleLayerAsync("labels", () => this.buildLabelsContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const burgContainer = await this.buildVisibleLayerAsync("burgIcons", () => this.buildBurgIconsContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    const militaryContainer = await this.buildVisibleLayerAsync("military", () =>
      this.buildMilitaryContainer(sequence)
    );
    if (sequence !== this.rebuildSequence) return;
    const markerContainer = await this.buildVisibleLayerAsync("markers", () => this.buildMarkersContainer(sequence));
    if (sequence !== this.rebuildSequence) return;
    this.app.stage.addChild(
      geography.ocean,
      geography.landmass,
      textureContainer,
      heightContainer,
      geography.lakes,
      biomeContainer,
      cellsContainer,
      gridContainer,
      coordinatesContainer,
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
      emblemsContainer,
      labelsContainer,
      burgContainer,
      militaryContainer,
      markerContainer
    );
    this.layerContainers = new Map(
      this.app.stage.children
        .filter(child => isMapLayerId(child.label))
        .map(child => [child.label as MapLayerId, child])
    );
    if (this.semanticStyle.filter) this.applyPhysicalFilter(this.app.stage, this.semanticStyle.filter);
    this.applyLayerOrder();
    const burgSymbols = this.getWorld().burgs.filter(burg => burg.i && !burg.removed && burg.group).length;
    const markerSymbols = markerContainer.children.length;
    const reliefSprites = reliefContainer.children.length;
    const batches = this.app.stage.children.reduce((total, child) => total + Math.max(1, child.children.length), 0);
    this.pickingIndex.replace(world, this.semanticStyle, this.getVisibleLayers());

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
      emblemSymbols: emblemsContainer.children.reduce((total, group) => total + group.children.length, 0),
      enabled: true,
      labelGlyphs: this.labelDisplays.reduce((total, display) => total + display.textDisplays.length, 0),
      markerSymbols,
      pickingEntries: this.pickingIndex.getSize(),
      reliefSprites,
      renderer: this.app.renderer.constructor.name
    };
    this.commitSceneChange("content");
    this.recordPerformance("pixi:rebuild", buildDuration);
  }

  setLayerVisibility(layer: MapLayerId, visible: boolean): void {
    if (this.layerVisibility.get(layer) === visible) return;
    this.layerVisibility.set(layer, visible);
    let awaitingMaterialization = false;
    let materializedImmediately = false;
    if (layer === "trade" && !visible) clearTradeAnimation();
    if (!visible) {
      this.dirtyLayers.add(layer);
      if (INCREMENTAL_LAYERS.has(layer)) this.replaceLayerContainer(layer, this.createLayerPlaceholder(layer));
      else this.scheduleHiddenLayerCleanup();
    } else if (this.dirtyLayers.has(layer)) {
      if (INCREMENTAL_LAYERS.has(layer) && this.world) {
        this.rebuildLayers(new Set([layer]));
        materializedImmediately = true;
      } else {
        awaitingMaterialization = true;
        this.scheduler?.invalidate({ kind: "geometry", layer });
      }
    }
    this.applyVisibility(!awaitingMaterialization && !materializedImmediately);
  }

  setLayerOrder(order: readonly MapLayerId[]): void {
    this.layerOrder = normalizeMapLayerOrder(order);
    this.pickingIndex.setLayerOrder(this.layerOrder);
    this.applyLayerOrder();
    if (this.stats.enabled) {
      this.app?.render();
      this.commitSceneChange("content");
    }
  }

  private applyLayerOrder(): void {
    const requested = new Map(this.layerOrder.map((layer, index) => [layer, index]));
    for (const child of this.app?.stage.children ?? []) {
      if (!isMapLayerId(child.label)) continue;
      child.zIndex = requested.get(child.label) ?? Number.MAX_SAFE_INTEGER;
    }
    this.app?.stage.sortChildren();
  }

  private applyVisibility(render = true): void {
    if (!this.app || !this.stats.enabled) return;
    for (const child of this.app.stage.children) {
      if (isMapLayerId(child.label)) child.visible = this.layerVisibility.get(child.label) ?? true;
    }
    this.updateLabelGroupVisibility();
    this.scheduleLabelAtlasRefresh();
    if (render) {
      this.app.render();
      this.commitSceneChange("content");
    }
  }

  pick(point: ScreenPoint): MapHit | null {
    if (!this.stats.enabled || !this.world) return null;
    const mapPoint = screenToWorld(point, this.camera);
    const hit = this.pickingIndex.pick(mapPoint, {
      cameraScale: this.camera.scale,
      isLayerVisible: layer => this.layerVisibility.get(layer) ?? true,
      tolerance: (this.rendererOptions.pickTolerancePixels ?? 8) / this.camera.scale
    });
    return hit ? { ...hit, screenPoint: { ...point } } : null;
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
    if (this.stats.enabled) {
      this.applyCamera();
      this.scheduleLabelAtlasRefresh();
    }
  }

  private applyCamera(): void {
    if (!this.app) return;
    const started = performance.now();
    this.app.stage.position.set(this.camera.x, this.camera.y);
    this.app.stage.scale.set(this.camera.scale);
    this.updateMarkerScales();
    this.updateEmblemGroupVisibility();
    this.updateCoordinateDisplays();
    this.updateLabelDisplays();
    this.updateLabelGroupVisibility();
    this.app.render();
    this.recordPerformance("pixi:camera", performance.now() - started);
  }

  clear(): void {
    this.rebuildSequence++;
    this.scheduler?.clear();
    this.clearStage();
    this.emblemSourceCache.clear();
    this.glyphAtlasCache.clear();
    this.pickingIndex.clear();
    this.textureCache.clear();
    this.app?.render();
    this.commitSceneChange("content");
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
    this.emblemSourceCache.clear();
    this.glyphAtlasCache.clear();
    this.pickingIndex.clear();
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
      emblemSymbols: 0,
      enabled: false,
      markerSymbols: 0,
      pickingEntries: 0,
      reliefSprites: 0,
      renderer: null
    };
  }

  getSnapshot(): PixiRendererSnapshot {
    const resources = this.resources.getSnapshot();
    const glyphAtlases = this.glyphAtlasCache.getSnapshot();
    const textures = this.textureCache.getSnapshot();
    return {
      ...this.stats,
      diagnostics: this.diagnostics.getSnapshot(),
      glyphAtlasBytes: glyphAtlases.bytes,
      glyphAtlasEntries: glyphAtlases.entries,
      resourceBytes: resources.totalBytes,
      resourceCount: resources.totalCount,
      textureCacheEntries: textures.entries
    };
  }

  whenCommitted(after = this.stats.commitSequence): Promise<number> {
    if (this.stats.commitSequence > after) return Promise.resolve(this.stats.commitSequence);
    return new Promise(resolve => this.commitWaiters.add({ after, resolve }));
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

  getRasterCapabilities(): PixiRasterCapabilities {
    const renderer = this.app?.renderer as unknown as { gl?: WebGLRenderingContext | WebGL2RenderingContext };
    const gl = renderer?.gl;
    const detected = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0;
    return { maxTextureSize: Number.isFinite(detected) && detected > 0 ? detected : 4096 };
  }

  renderRasterFrame(request: PixiRasterFrameRequest): HTMLCanvasElement {
    if (!this.app || !this.world) throw new Error("Pixi renderer is not ready for raster export");
    const { frame, fullMap } = request;
    const resolution = Number.isFinite(request.resolution) && request.resolution > 0 ? request.resolution : 1;
    if (frame.width <= 0 || frame.height <= 0 || fullMap.width <= 0 || fullMap.height <= 0) {
      throw new Error("Raster export frame dimensions must be positive");
    }
    const { maxTextureSize } = this.getRasterCapabilities();
    const outputWidth = Math.ceil(frame.width * resolution);
    const outputHeight = Math.ceil(frame.height * resolution);
    if (outputWidth > maxTextureSize || outputHeight > maxTextureSize) {
      throw new Error(
        `Raster export frame ${outputWidth}×${outputHeight} exceeds the device texture limit of ${maxTextureSize}px`
      );
    }

    const previousCamera = { ...this.camera };
    const hiddenLayers = new Set(request.hiddenLayers ?? []);
    const visibilityOverrides: Array<{ display: { visible: boolean }; visible: boolean }> = [];
    const hide = (display: { visible: boolean }): void => {
      visibilityOverrides.push({ display, visible: display.visible });
      display.visible = false;
    };

    for (const child of this.app.stage.children) {
      if (isMapLayerId(child.label) && hiddenLayers.has(child.label)) hide(child);
      if (child.label !== "height" || !hiddenLayers.has("ocean") || !(child instanceof Container)) continue;
      for (const heightGroup of child.children) {
        if (heightGroup.label === "height:ocean") hide(heightGroup);
      }
    }

    this.camera = { height: fullMap.height, scale: 1, width: fullMap.width, x: 0, y: 0 };
    this.app.stage.position.set(0, 0);
    this.app.stage.scale.set(1);
    this.updateMarkerScales();
    this.updateEmblemGroupVisibility();
    this.updateCoordinateDisplays();
    this.updateLabelDisplays();
    this.updateLabelGroupVisibility();

    try {
      return this.app.renderer.extract.canvas({
        clearColor: request.transparentBackground ? "transparent" : this.semanticStyle.ocean.color,
        frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
        resolution,
        target: this.app.stage
      }) as HTMLCanvasElement;
    } finally {
      for (const { display, visible } of visibilityOverrides) display.visible = visible;
      this.camera = previousCamera;
      this.app.stage.position.set(previousCamera.x, previousCamera.y);
      this.app.stage.scale.set(previousCamera.scale);
      this.updateMarkerScales();
      this.updateEmblemGroupVisibility();
      this.updateCoordinateDisplays();
      this.updateLabelDisplays();
      this.updateLabelGroupVisibility();
      this.app.render();
    }
  }

  private async initializeApplication(): Promise<void> {
    if (this.app) return;
    if (!this.surface) throw new Error("Cannot initialize an unmounted Pixi renderer");

    const viewport = getViewportSize(this.surface, this.camera);
    this.app = new Application();
    await this.app.init({
      antialias: true,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 1,
      backgroundColor: this.semanticStyle.ocean.color,
      clearBeforeRender: true,
      // Camera renders are one-shot, so culling must use the new stage transform in the same frame.
      culler: { updateTransform: true },
      height: viewport.height,
      preference: this.rendererOptions.preference ?? "webgl",
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
    const fillSource = {
      ...this.getCellFillSource(layer),
      fallbackColor: style.fallbackColor,
      heights: this.getWorld().cells.h
    };
    const retained = new RetainedCellMesh(this.getCellTopology(), fillSource, layer, this.resources);

    const container = new Container();
    container.label = layer;
    let halo: RetainedCellMesh | undefined;
    const stateStyle = layer === "states" ? this.semanticStyle.states : null;
    if (stateStyle && stateStyle.halo.opacity > 0 && stateStyle.halo.width > 0) {
      halo = new RetainedCellMesh(this.getCellTopology(), fillSource, layer, this.resources);
      const haloContainer = new Container();
      const haloFilter = new BlurFilter({
        quality: 3,
        strength: stateStyle.halo.blur + stateStyle.halo.width / 2
      });
      haloContainer.label = "statesHalo";
      haloContainer.alpha = stateStyle.halo.opacity;
      haloContainer.filters = [haloFilter];
      halo.mesh.label = "states-halo-retained-cells";
      haloContainer.addChild(halo.mesh);
      container.addChild(haloContainer);
      this.rendererFilters.add(haloFilter);
      this.retainedCellMeshes.add(halo);
    }
    const clippedFill = new Container();
    clippedFill.label = `${layer}:coast-clipped-fill`;
    const coastalFill = new Container();
    coastalFill.label = `${layer}:coastal-overdraw`;
    this.populateCoastalFillContainer(coastalFill, layer, fillSource);
    clippedFill.addChild(coastalFill);
    retained.mesh.alpha = style.opacity;
    retained.mesh.label = `${layer}-retained-cells`;
    this.retainedCellMeshes.add(retained);
    clippedFill.addChild(retained.mesh);
    if (style.stroke.width > 0 && style.stroke.opacity > 0) {
      const boundaries = buildAssignmentBoundaryScene(
        this.getWorld(),
        fillSource.assignments,
        layer,
        this.sceneRevisions.getLayerRevision(layer)
      );
      const outlines = createLineGraphic(boundaries.paths, style.stroke);
      outlines.alpha = style.opacity;
      outlines.label = `${layer}-boundaries`;
      clippedFill.addChild(outlines);
    }
    if (this.cellFillGeography?.landPolygons.length) {
      applyGeographyMask(
        clippedFill,
        "land",
        this.cellFillGeography.landPolygons,
        this.cellFillGeography.lakePolygons,
        this.cellFillGeography.bounds
      );
    }
    container.addChild(clippedFill);
    if (style.filter) this.applyPhysicalFilter(container, style.filter);
    this.cellMeshes.set(layer, { coastalFill, container, halo, retained });
    return container;
  }

  private populateCoastalFillContainer(
    container: Container,
    layer: CellFillLayer,
    source: { assignments: ArrayLike<number>; colors: readonly { color?: string }[]; fallbackColor: string }
  ): void {
    for (const child of container.removeChildren()) child.destroy();
    const geography = this.cellFillGeography;
    if (!geography || geography.coastlineOverdrawWidth <= 0) return;

    const scene = buildCoastalAssignmentScene(
      this.getWorld(),
      source.assignments,
      layer,
      this.sceneRevisions.getLayerRevision(layer)
    );
    for (const [role, paths] of groupByRole(scene.paths)) {
      const assignment = Number(role);
      const graphic = createLineGraphic(paths, {
        cap: "round",
        color: getRenderableColor(source.colors[assignment]?.color ?? source.fallbackColor, source.fallbackColor),
        dash: "",
        join: "round",
        opacity: this.semanticStyle[layer].opacity,
        width: geography.coastlineOverdrawWidth
      });
      graphic.label = `${layer}:coastal-overdraw:${role}`;
      container.addChild(graphic);
    }
  }

  private buildVisibleLayer(layer: MapLayerId, build: () => Container): Container {
    if (!(this.layerVisibility.get(layer) ?? true)) {
      this.dirtyLayers.add(layer);
      return this.createLayerPlaceholder(layer);
    }
    this.dirtyLayers.delete(layer);
    return build();
  }

  private async buildVisibleLayerAsync(layer: MapLayerId, build: () => Promise<Container>): Promise<Container> {
    if (!(this.layerVisibility.get(layer) ?? true)) {
      this.dirtyLayers.add(layer);
      return this.createLayerPlaceholder(layer);
    }
    this.dirtyLayers.delete(layer);
    return build();
  }

  private createLayerPlaceholder(layer: MapLayerId): Container {
    const container = new Container();
    container.label = layer;
    container.visible = false;
    return container;
  }

  private getVisibleLayers(): Set<MapLayerId> {
    return new Set(
      MAP_LAYER_REGISTRY.filter(layer => this.layerVisibility.get(layer.id) ?? true).map(layer => layer.id)
    );
  }

  private buildGeographyContainers(): {
    bounds: { height: number; width: number };
    coastline: Container;
    lakePolygons: readonly PolygonPathPrimitive[];
    lakes: Container;
    landPolygons: readonly PolygonPathPrimitive[];
    landmass: Container;
    ocean: Container;
  } {
    const world = this.getWorld();
    const bounds = getWorldBounds(world);
    const scene = buildBaseGeographyScene(world, bounds, this.sceneRevisions.getLayerRevision("landmass"));
    this.cellFillGeography = {
      bounds,
      coastlineOverdrawWidth: scene.coastlineOverdrawWidth,
      lakePolygons: scene.lakes.polygons,
      landPolygons: scene.landmass.polygons
    };
    return {
      bounds,
      coastline: this.buildLineContainer(
        "coastline",
        scene.coastline.paths,
        role => this.semanticStyle.coastline.roles[role] ?? this.semanticStyle.coastline.default
      ),
      lakes: this.buildVisibleLayer("lakes", () =>
        this.buildPolygonContainer(
          "lakes",
          scene.lakes.polygons,
          role => this.semanticStyle.lakes.roles[role] ?? this.semanticStyle.lakes.default
        )
      ),
      lakePolygons: scene.lakes.polygons,
      landPolygons: scene.landmass.polygons,
      landmass: this.buildPolygonContainer("landmass", scene.landmass.polygons, () => ({
        fill: this.semanticStyle.landmass,
        stroke: { cap: "butt", color: this.semanticStyle.landmass.color, dash: "", opacity: 0, width: 0 }
      })),
      ocean: this.buildRectangleContainer("ocean", scene.ocean.positions, this.semanticStyle.ocean)
    };
  }

  private buildHeightContainer(
    landPolygons: readonly PolygonPathPrimitive[],
    bounds: { height: number; width: number }
  ): Container {
    const container = new Container();
    container.label = "height";
    const climate = this.getWorld().climate;
    if (!climate) return container;
    const scene = buildHeightContourScene(
      climate,
      bounds,
      this.semanticStyle.height,
      this.sceneRevisions.getLayerRevision("height")
    );
    this.stats.unsupportedHeightEffects = [];

    for (const group of scene.groups) {
      const groupContainer = new Container();
      groupContainer.label = `height:${group.scope}`;
      groupContainer.alpha = group.opacity;
      let svg = "";
      if (group.baseColor) {
        svg += `<rect x="0" y="0" width="${bounds.width}" height="${bounds.height}" fill="${group.baseColor}"/>`;
      }
      for (const band of group.bands) {
        if (band.terraceColor) {
          svg += `<path d="${band.path}" transform="translate(.7 1.4)" fill="${band.terraceColor}"/>`;
        }
        svg += `<path d="${band.path}" fill="${band.color}"/>`;
      }
      if (svg) groupContainer.addChild(new Graphics().svg(wrapSvgFragment(svg)));
      if (group.filter && !this.applyPhysicalFilter(groupContainer, group.filter)) {
        this.stats.unsupportedHeightEffects = [
          ...this.stats.unsupportedHeightEffects,
          `${group.scope}:filter:${group.filter}`
        ];
      }
      if (group.scope === "land") applyGeographyMask(groupContainer, "land", landPolygons, [], bounds);
      container.addChild(groupContainer);
    }
    return container;
  }

  private async decorateOceanContainer(
    sequence: number,
    container: Container,
    bounds: { height: number; width: number }
  ): Promise<void> {
    const climate = this.getWorld().climate;
    if (climate) {
      const scene = buildOceanDepthScene(
        climate,
        bounds,
        this.semanticStyle.ocean,
        this.sceneRevisions.getLayerRevision("ocean")
      );
      this.stats.unsupportedOceanEffects = [];
      if (scene.bands.length) {
        const bands = scene.bands
          .map(band => `<path d="${band.path}" fill="${band.color}" fill-opacity="${band.opacity}"/>`)
          .join("");
        const graphic = new Graphics().svg(wrapSvgFragment(bands));
        graphic.label = "ocean:depth-bands";
        if (
          this.semanticStyle.ocean.bands.filter &&
          !this.applyPhysicalFilter(graphic, this.semanticStyle.ocean.bands.filter)
        ) {
          this.stats.unsupportedOceanEffects = [`bands:filter:${this.semanticStyle.ocean.bands.filter}`];
        }
        container.addChild(graphic);
      }
    }

    const pattern = this.semanticStyle.ocean.pattern;
    if (!pattern.href || pattern.opacity <= 0) return;
    let handle: RendererResourceHandle<Texture> | null = null;
    try {
      handle = await this.textureCache.acquire(pattern.href, () => Assets.load<Texture>(pattern.href!));
    } catch {
      this.assertAssetAvailable("ocean texture", pattern.href);
      this.stats.missingTextureAssets = [...new Set([...this.stats.missingTextureAssets, pattern.href])];
      return;
    }
    if (sequence !== this.rebuildSequence) {
      handle.release();
      return;
    }

    const tileWidth = Math.max(1, handle.value.width);
    const tileHeight = Math.max(1, handle.value.height);
    const tileSize = Math.max(1, pattern.tileSize);
    const display = new TilingSprite({
      height: bounds.height,
      texture: handle.value,
      tileScale: { x: tileSize / tileWidth, y: tileSize / tileHeight },
      width: bounds.width
    });
    display.alpha = pattern.opacity;
    display.label = "ocean:pattern";
    container.addChild(display);
    this.backgroundTextureHandles.add(handle);
  }

  private async buildTextureContainer(
    sequence: number,
    landPolygons: readonly PolygonPathPrimitive[],
    lakePolygons: readonly PolygonPathPrimitive[],
    bounds: { height: number; width: number }
  ): Promise<Container> {
    const container = new Container();
    container.label = "texture";
    const style = this.semanticStyle.texture;
    container.alpha = style.opacity;
    this.stats.unsupportedTextureEffects = style.filter ? [`filter:${style.filter}`] : [];
    if (style.filter && this.applyPhysicalFilter(container, style.filter)) this.stats.unsupportedTextureEffects = [];
    if (!style.href) return container;

    let handle: RendererResourceHandle<Texture> | null = null;
    try {
      handle = await this.textureCache.acquire(style.href, () => Assets.load<Texture>(style.href!));
    } catch {
      this.assertAssetAvailable("map texture", style.href);
      this.stats.missingTextureAssets = [...new Set([...this.stats.missingTextureAssets, style.href])];
      return container;
    }
    if (sequence !== this.rebuildSequence) {
      handle.release();
      return container;
    }

    const x = Number.isFinite(style.x) ? style.x : 0;
    const y = Number.isFinite(style.y) ? style.y : 0;
    const sprite = new Sprite({
      height: Math.max(0, bounds.height - y),
      position: { x, y },
      texture: handle.value,
      width: Math.max(0, bounds.width - x)
    });
    sprite.label = "texture:image";
    container.addChild(sprite);
    if (style.mask !== "none") applyGeographyMask(container, style.mask, landPolygons, lakePolygons, bounds);
    this.backgroundTextureHandles.add(handle);
    return container;
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

  private async buildCoordinatesContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "coordinates";
    const state = this.getWorld().coordinateRenderState;
    if (!state) return container;

    const scene = buildCoordinateScene(state, this.sceneRevisions.getLayerRevision("coordinates"));
    this.coordinateLongitudeSpan = Number(state.extent.lonT) || 0;
    this.stats.coordinateLines = scene.groups.reduce((total, group) => total + group.paths.length, 0);
    this.stats.coordinateLabels = scene.groups.reduce((total, group) => total + group.labels.length, 0);
    this.stats.unsupportedCoordinateEffects = this.semanticStyle.coordinates.filter
      ? [`filter:${this.semanticStyle.coordinates.filter}`]
      : [];
    if (!scene.valid) return container;

    const [fontResult] = await ensureFontFamiliesReady([this.semanticStyle.coordinates.fontFamily]);
    if (sequence !== this.rebuildSequence) return container;
    this.stats.missingCoordinateFonts = fontResult?.ready ? [] : [this.semanticStyle.coordinates.fontFamily];
    if (!fontResult?.ready) this.assertAssetAvailable("font", this.semanticStyle.coordinates.fontFamily);
    const atlas = await this.glyphAtlasCache.acquireCharacters(
      collectCoordinateCharacters(scene.groups.flatMap(group => group.labels)),
      coordinateAtlasStyle(this.semanticStyle.coordinates),
      this.stats.resolution,
      fontResult?.ready ? this.semanticStyle.coordinates.fontFamily : "Arial"
    );
    if (sequence !== this.rebuildSequence) {
      atlas.release();
      return container;
    }
    this.glyphAtlasHandles.add(atlas);

    for (const group of scene.groups) {
      const groupContainer = new Container();
      groupContainer.label = `coordinates:${group.step}`;
      groupContainer.alpha = this.semanticStyle.coordinates.opacity;
      const lines = createLineGraphic(group.paths, this.semanticStyle.coordinates.stroke, true);
      lines.label = `coordinates:${group.step}:grid`;
      groupContainer.addChild(lines);
      for (const label of group.labels) {
        const display = new BitmapText({
          style: {
            align: "center",
            fill: this.semanticStyle.coordinates.fontColor,
            fontFamily: atlas.value.name,
            fontSize: this.semanticStyle.coordinates.fontSize
          },
          text: label.text
        });
        display.anchor.set(0.5);
        display.label = label.domainId;
        groupContainer.addChild(display);
        this.coordinateLabelDisplays.push({ axis: label.axis, display, x: label.x, y: label.y });
      }
      this.coordinateGroupDisplays.push({ container: groupContainer, step: group.step });
      container.addChild(groupContainer);
    }
    this.updateCoordinateDisplays();
    return container;
  }

  private async buildEmblemsContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "emblems";
    const scene = buildEmblemScene(
      this.getWorld(),
      getWorldBounds(this.getWorld()),
      this.semanticStyle.emblems,
      this.sceneRevisions.getLayerRevision("emblems")
    );
    container.alpha = scene.opacity;
    this.stats.unsupportedEmblemEffects = [...scene.unsupportedEffects];
    const activeTextureKeys = new Set(scene.groups.flatMap(group => group.items.map(item => item.textureKey)));
    for (const key of this.emblemSourceCache.keys()) {
      if (!activeTextureKeys.has(key)) this.emblemSourceCache.delete(key);
    }

    const missingAssets: string[] = [];
    for (const group of scene.groups) {
      const groupContainer = new Container();
      groupContainer.label = `emblems:${group.type}`;
      this.emblemGroupDisplays.push({
        automaticVisibility: scene.automaticVisibility,
        baseSize: group.baseSize,
        container: groupContainer
      });
      const displays = await Promise.all(
        group.items.map(async item => {
          let handle: RendererResourceHandle<Texture> | null = null;
          try {
            const source = await this.getEmblemSource(item.textureKey, item.svgId, item.coa);
            if (source) handle = await this.textureCache.acquire(source, () => Assets.load<Texture>(source));
          } catch {
            this.assertAssetAvailable("emblem", item.domainId);
          }
          if (!handle) {
            this.assertAssetAvailable("emblem", item.domainId);
            missingAssets.push(item.domainId);
          }
          return { handle, item };
        })
      );
      if (sequence !== this.rebuildSequence) {
        for (const { handle } of displays) handle?.release();
        return container;
      }
      for (const { handle, item } of displays) {
        const display = handle
          ? new Sprite({ height: item.size, texture: handle.value, width: item.size })
          : createMissingEmblemGraphic(item.size);
        display.cullable = true;
        display.eventMode = "none";
        display.label = `emblem:${item.domainId}`;
        display.position.set(item.x, item.y);
        if (display instanceof Sprite) display.anchor.set(0.5);
        groupContainer.addChild(display);
        if (handle) this.emblemTextureHandles.add(handle);
      }
      container.addChild(groupContainer);
    }
    this.stats.missingEmblemAssets = missingAssets;
    this.updateEmblemGroupVisibility();
    return container;
  }

  private getEmblemSource(textureKey: string, svgId: string, coa: Emblem): Promise<string | null> {
    const cached = this.emblemSourceCache.get(textureKey);
    if (cached) return cached;
    const source = Promise.resolve(
      this.rendererOptions.resolveEmblemIcon?.(svgId, coa, this.semanticStyle.emblems.strokeWidth) ?? null
    ).catch(() => null);
    this.emblemSourceCache.set(textureKey, source);
    return source;
  }

  private async buildLabelsContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "labels";
    const state = this.getWorld().labelRenderState;
    if (!state) return container;

    const scene = buildLabelScene(state, this.sceneRevisions.getLayerRevision("labels"));
    this.labelResizeOnZoom = scene.resizeOnZoom;
    const fontResults = await ensureFontFamiliesReady(scene.groups.map(group => group.style.fontFamily));
    if (sequence !== this.rebuildSequence) return container;
    this.stats.missingLabelFonts = fontResults.filter(result => !result.ready).map(result => result.family);
    for (const family of this.stats.missingLabelFonts) this.assertAssetAvailable("font", family);
    this.stats.unsupportedLabelEffects = [...scene.unsupportedEffects];

    const fontReadiness = new Map(fontResults.map(result => [result.family, result.ready]));
    const resolvedFontFamilies = scene.groups.map(group =>
      fontReadiness.get(group.style.fontFamily) ? group.style.fontFamily : "Arial"
    );
    const atlasResolution = this.stats.resolution;
    const atlases = await Promise.all(
      scene.groups.map((group, index) =>
        group.labels.length ? this.glyphAtlasCache.acquire(group, atlasResolution, resolvedFontFamilies[index]) : null
      )
    );
    if (sequence !== this.rebuildSequence) {
      for (const atlas of atlases) atlas?.release();
      return container;
    }

    for (let index = 0; index < scene.groups.length; index++) {
      const atlas = atlases[index];
      container.addChild(
        this.buildLabelGroup(scene.groups[index], scene.resizeOnZoom, scene.showAll, atlas, resolvedFontFamilies[index])
      );
    }
    this.updateLabelDisplays();
    this.updateLabelGroupVisibility();
    return container;
  }

  private buildLabelGroup(
    group: LabelSceneGroup,
    resizeOnZoom: boolean,
    showAll: boolean,
    atlas: GlyphAtlasHandle | null,
    resolvedFontFamily: string
  ): Container {
    const container = new Container();
    const atlasFontFamily = atlas?.value.name ?? resolvedFontFamily;
    const groupTextDisplays: BitmapText[] = [];
    container.label = `labels:${group.name}`;
    container.alpha = group.style.opacity;
    this.labelGroupDisplays.push({
      active: group.active,
      container,
      dependency: group.dependency,
      maxScale: group.maxScale,
      minScale: group.minScale,
      showAll
    });

    for (const label of group.labels) {
      const labelContainer = new Container();
      labelContainer.cullable = true;
      labelContainer.label = label.domainId;
      const textDisplays: BitmapText[] = [];
      if (label.curvedGlyphs) {
        for (const glyph of label.curvedGlyphs) {
          const text = createLabelText(
            glyph.character,
            label.fontSize,
            label.letterSpacing,
            group.style,
            atlasFontFamily
          );
          text.anchor.set(0.5);
          text.position.set(glyph.x - label.anchorX, glyph.y - label.anchorY);
          text.rotation = glyph.angle;
          labelContainer.addChild(text);
          textDisplays.push(text);
          groupTextDisplays.push(text);
        }
      } else {
        const text = createLabelText(label.text, label.fontSize, label.letterSpacing, group.style, atlasFontFamily);
        text.anchor.set(0.5, label.type === "burg" ? 1 : 0.5);
        labelContainer.addChild(text);
        textDisplays.push(text);
        groupTextDisplays.push(text);
      }
      container.addChild(labelContainer);
      this.labelDisplays.push({
        anchorX: label.anchorX,
        anchorY: label.anchorY,
        container: labelContainer,
        groupFontSize: group.style.fontSize,
        offsetXEm: group.style.offsetXEm,
        offsetYEm: group.style.offsetYEm,
        rescale: resizeOnZoom,
        textDisplays
      });
    }
    if (atlas) {
      this.glyphAtlasHandles.add(atlas);
      this.labelAtlasDisplays.push({
        container,
        group,
        handle: atlas,
        resolution: atlas.value.installOptions.resolution ?? 1,
        resolvedFontFamily,
        textDisplays: groupTextDisplays
      });
    }
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
      this.assertAssetAvailable("compass", source);
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
    if (this.rendererOptions.resolveTradeMarker && !this.getWorld().deals?.length && !this.tradeSnapshot.markers.length)
      return container;
    const sources = new Map<TradeMarkerType, string>();
    for (const [type, fallback] of [
      ["land", "./images/markers/wagon.svg"],
      ["water", "./images/markers/ship.svg"]
    ] as const) {
      const source = this.rendererOptions.resolveTradeMarker ? this.rendererOptions.resolveTradeMarker(type) : fallback;
      if (source) sources.set(type, source);
      else this.assertAssetAvailable("trade", type);
    }
    const handles = new Map<TradeMarkerType, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...sources].map(async ([type, source]) => {
        try {
          handles.set(type, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          this.assertAssetAvailable("trade", type);
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
      else this.assertAssetAvailable("symbol", icon);
    }
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    await Promise.all(
      [...iconSources].map(async ([icon, source]) => {
        try {
          textures.set(icon, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          this.assertAssetAvailable("symbol", icon);
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
          this.assertAssetAvailable("military", source);
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
          if (!source) {
            this.assertAssetAvailable("relief", icon);
            return;
          }
          try {
            textures.set(icon, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
          } catch {
            this.assertAssetAvailable("relief", icon);
          }
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

  private async buildBurgIconsContainer(sequence: number): Promise<Container> {
    const container = new Container();
    container.label = "burgIcons";
    container.alpha = this.semanticStyle.burgIcons.opacity;
    const scene = buildBurgPointSymbolScene(
      this.getWorld().burgs,
      this.semanticStyle.burgIcons,
      this.sceneRevisions.getLayerRevision("burgIcons")
    );
    const allInstances = [...scene.icons.instances, ...scene.anchors.instances];
    const customSymbols = new Map(
      allInstances
        .filter(symbol => !isNativeBurgSymbol(symbol.shape))
        .map(symbol => [getBurgSymbolTextureKey(symbol), symbol])
    );
    const textures = new Map<string, RendererResourceHandle<Texture>>();
    try {
      for (const [key, symbol] of customSymbols) {
        const icon = symbol.icon ?? `icon-${symbol.shape}`;
        const source = this.rendererOptions.resolveSymbolIcon?.(icon, {
          fill: symbol.fill,
          fillOpacity: symbol.fillOpacity,
          stroke: symbol.stroke,
          strokeWidth: symbol.strokeWidth,
          viewBox: symbol.shape.startsWith("watabou-") ? undefined : "-5 -5 10 10"
        });
        if (!source) {
          this.assertAssetAvailable("burg symbol", icon);
          continue;
        }
        try {
          textures.set(key, await this.textureCache.acquire(source, () => Assets.load<Texture>(source)));
        } catch {
          this.assertAssetAvailable("burg symbol", icon);
        }
      }
    } catch (error) {
      for (const handle of textures.values()) handle.release();
      if (sequence !== this.rebuildSequence) return container;
      throw error;
    }
    if (sequence !== this.rebuildSequence) {
      for (const handle of textures.values()) handle.release();
      return container;
    }

    for (const [kind, instances] of [
      ["icons", scene.icons.instances],
      ["anchors", scene.anchors.instances]
    ] as const) {
      const native = instances.filter(symbol => isNativeBurgSymbol(symbol.shape));
      for (const symbols of groupPointSymbols(native).values()) {
        const graphic = createBurgSymbolGraphic(symbols);
        graphic.label = `burgIcons:${kind}:${symbols[0]?.role ?? "default"}`;
        container.addChild(graphic);
      }
      for (const symbol of instances.filter(symbol => !isNativeBurgSymbol(symbol.shape))) {
        const handle = textures.get(getBurgSymbolTextureKey(symbol));
        const display = handle ? createBurgSymbolSprite(symbol, handle.value) : createBurgSymbolGraphic([symbol]);
        display.label = `burgIcons:${kind}:${symbol.role ?? "default"}:${symbol.domainId}`;
        container.addChild(display);
      }
    }
    for (const handle of textures.values()) this.pointTextureHandles.add(handle);
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
          this.assertAssetAvailable("marker", source);
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
    if (this.hiddenLayerCleanupTimer !== null) clearTimeout(this.hiddenLayerCleanupTimer);
    this.hiddenLayerCleanupTimer = null;
    this.queuedStyle = null;
    this.layerContainers.clear();
    this.dirtyLayers.clear();
    for (const retained of this.retainedCellMeshes) retained.destroy();
    this.retainedCellMeshes.clear();
    this.cellMeshes.clear();
    this.cellFillGeography = null;
    this.coordinateGroupDisplays = [];
    this.coordinateLabelDisplays = [];
    this.coordinateLongitudeSpan = 0;
    if (this.labelAtlasRefreshTimeoutId !== null) clearTimeout(this.labelAtlasRefreshTimeoutId);
    this.labelAtlasRefreshTimeoutId = null;
    this.labelAtlasRefreshSequence++;
    this.labelAtlasDisplays = [];
    this.labelAtlasQueuedResolution = 0;
    this.labelDisplays = [];
    this.labelGroupDisplays = [];
    this.emblemGroupDisplays = [];
    this.stats.coordinateLabels = 0;
    this.stats.coordinateLines = 0;
    this.stats.emblemSymbols = 0;
    this.stats.labelGlyphs = 0;
    this.stats.missingCoordinateFonts = [];
    this.stats.missingEmblemAssets = [];
    this.stats.missingLabelFonts = [];
    this.stats.missingTextureAssets = [];
    this.stats.pickingEntries = 0;
    this.stats.unsupportedCoordinateEffects = [];
    this.stats.unsupportedHeightEffects = [];
    this.stats.unsupportedOceanEffects = [];
    this.stats.unsupportedEmblemEffects = [];
    this.stats.unsupportedLabelEffects = [];
    this.stats.unsupportedTextureEffects = [];
    this.markerDisplays.clear();
    this.tradeContainer = null;
    this.tradeDisplays.clear();
    this.tradeTextures.clear();
    for (const child of this.app.stage.removeChildren()) child.destroy({ children: true });
    this.app.stage.filters = null;
    for (const filter of this.rendererFilters) filter.destroy();
    this.rendererFilters.clear();
    for (const handle of this.glyphAtlasHandles) handle.release();
    this.glyphAtlasHandles.clear();
    for (const handle of this.backgroundTextureHandles) handle.release();
    this.backgroundTextureHandles.clear();
    for (const handle of this.reliefTextureHandles) handle.release();
    this.reliefTextureHandles.clear();
    for (const handle of this.emblemTextureHandles) handle.release();
    this.emblemTextureHandles.clear();
    for (const handle of this.pointTextureHandles) handle.release();
    this.pointTextureHandles.clear();
  }

  private renderTradeSnapshot(snapshot: TradeAnimationSnapshot): void {
    this.tradeSnapshot = snapshot;
    if (!this.app || !this.tradeContainer || !this.stats.enabled) return;
    this.syncTradeDisplays(snapshot);
    if (this.layerVisibility.get("trade") ?? true) {
      this.app.render();
      this.commitSceneChange("animation");
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

  private updateLabelDisplays(): void {
    const resizeScale = Math.max((1 + 1 / this.camera.scale) / 2, 0.01);
    for (const display of this.labelDisplays) {
      const textScale = display.rescale ? resizeScale : 1;
      display.container.position.set(
        display.anchorX + display.offsetXEm * display.groupFontSize * textScale,
        display.anchorY + display.offsetYEm * display.groupFontSize * textScale
      );
      for (const text of display.textDisplays) text.scale.set(textScale);
    }
  }

  private scheduleLabelAtlasRefresh(): void {
    if (!(this.layerVisibility.get("labels") ?? true)) return;
    const displays = this.labelAtlasDisplays.filter(display => display.container.visible);
    if (!displays.length) return;
    const resolution = this.getLabelAtlasResolution(displays);
    if (displays.every(display => display.resolution >= resolution) || resolution <= this.labelAtlasQueuedResolution)
      return;

    this.labelAtlasQueuedResolution = resolution;
    if (this.labelAtlasRefreshTimeoutId !== null) clearTimeout(this.labelAtlasRefreshTimeoutId);
    this.labelAtlasRefreshTimeoutId = setTimeout(() => {
      this.labelAtlasRefreshTimeoutId = null;
      void this.refreshLabelAtlases(resolution);
    }, LABEL_ATLAS_REFRESH_DELAY_MS);
  }

  private async refreshLabelAtlases(resolution: number): Promise<void> {
    const started = performance.now();
    const requestSequence = ++this.labelAtlasRefreshSequence;
    const rebuildSequence = this.rebuildSequence;
    const displays = this.labelAtlasDisplays.filter(
      display => display.container.visible && display.resolution < resolution
    );
    if (!displays.length) {
      if (this.labelAtlasQueuedResolution <= resolution) this.labelAtlasQueuedResolution = 0;
      return;
    }
    const results = await Promise.allSettled(
      displays.map(display => this.glyphAtlasCache.acquire(display.group, resolution, display.resolvedFontFamily))
    );
    const handles = results.flatMap(result => (result.status === "fulfilled" ? [result.value] : []));
    const isStale = requestSequence !== this.labelAtlasRefreshSequence || rebuildSequence !== this.rebuildSequence;
    if (isStale || results.some(result => result.status === "rejected")) {
      for (const handle of handles) handle.release();
      if (!isStale && this.labelAtlasQueuedResolution <= resolution) this.labelAtlasQueuedResolution = 0;
      return;
    }

    const previousHandles = displays.map(display => display.handle);
    const replacements = new Map<LabelAtlasDisplay, GlyphAtlasHandle>();
    displays.forEach((display, index) => {
      const handle = handles[index];
      for (const text of display.textDisplays) text.style.fontFamily = handle.value.name;
      this.glyphAtlasHandles.add(handle);
      replacements.set(display, handle);
    });
    this.labelAtlasDisplays = this.labelAtlasDisplays.map(display => {
      const handle = replacements.get(display);
      return handle ? { ...display, handle, resolution } : display;
    });
    for (const handle of previousHandles) {
      this.glyphAtlasHandles.delete(handle);
      handle.release();
    }
    if (this.labelAtlasQueuedResolution <= resolution) this.labelAtlasQueuedResolution = 0;
    this.app?.render();
    this.commitSceneChange("content");
    this.recordPerformance("pixi:label-atlas", performance.now() - started);
  }

  private updateCoordinateDisplays(): void {
    if (!this.coordinateLongitudeSpan) return;
    const selectedStep = selectCoordinateStep(this.coordinateLongitudeSpan, this.camera.scale);
    for (const group of this.coordinateGroupDisplays) group.container.visible = group.step === selectedStep;

    const style = this.semanticStyle.coordinates;
    const scale = Math.max(this.camera.scale, 0.01);
    const labelScale = Math.max(1 / scale ** 0.8, 0.1 / Math.max(style.fontSize, 0.1));
    const pinnedX = (style.fontSize + 3 - this.camera.x) / scale;
    const pinnedY = (style.fontSize / 2 + 1 - this.camera.y) / scale;
    for (const label of this.coordinateLabelDisplays) {
      label.display.position.set(
        label.axis === "latitude" ? pinnedX : label.x,
        label.axis === "longitude" ? pinnedY : label.y
      );
      label.display.scale.set(labelScale);
    }
  }

  private updateEmblemGroupVisibility(): void {
    for (const group of this.emblemGroupDisplays) {
      const renderedSize = group.baseSize * this.camera.scale;
      group.container.visible = !group.automaticVisibility || (renderedSize >= 25 && renderedSize <= 300);
    }
  }

  private updateLabelGroupVisibility(): void {
    for (const group of this.labelGroupDisplays) {
      const dependencyVisible = !group.dependency || (this.layerVisibility.get(group.dependency) ?? true);
      const zoomVisible =
        group.showAll ||
        ((group.minScale === null || this.camera.scale >= group.minScale) &&
          (group.maxScale === null || this.camera.scale <= group.maxScale));
      group.container.visible = group.active && dependencyVisible && zoomVisible;
    }
  }

  private createScheduler(): RenderScheduler {
    return new RenderScheduler(batch => this.renderInvalidations(batch), {
      onDiagnostic: diagnostic => this.recordPerformance("pixi:scheduled", diagnostic.duration)
    });
  }

  private async renderInvalidations(batch: RenderInvalidationBatch): Promise<void> {
    if (this.queuedStyle) {
      this.semanticStyle = structuredClone(this.queuedStyle);
      this.queuedStyle = null;
    }
    this.sceneRevisions.apply(batch.invalidations);
    const assignments = batch.invalidations.filter(
      (invalidation): invalidation is Extract<RenderInvalidation, { kind: "assignment" }> =>
        invalidation.kind === "assignment" && CELL_FILL_LAYERS.includes(invalidation.layer as CellFillLayer)
    );
    if (assignments.length && assignments.length === batch.invalidations.length && this.updateCellMeshes(assignments)) {
      return;
    }
    const requiresFullBuild = batch.invalidations.some(
      invalidation =>
        invalidation.kind === "topology" ||
        invalidation.kind === "world" ||
        ("layer" in invalidation && !INCREMENTAL_LAYERS.has(invalidation.layer))
    );
    if (requiresFullBuild) {
      await this.rebuild();
      return;
    }
    const layers = new Set(
      batch.invalidations.flatMap(invalidation => ("layer" in invalidation ? [invalidation.layer] : []))
    );
    if (layers.size) {
      this.rebuildLayers(layers);
      return;
    }
    if (batch.invalidations.some(invalidation => invalidation.kind === "camera")) this.applyCamera();
  }

  private rebuildLayers(layers: ReadonlySet<MapLayerId>): void {
    if (!this.app || !this.world) return;
    const started = performance.now();
    for (const layer of layers) {
      if (!(this.layerVisibility.get(layer) ?? true)) {
        this.dirtyLayers.add(layer);
        continue;
      }
      const container = this.buildIncrementalLayer(layer);
      if (!container) continue;
      this.replaceLayerContainer(layer, container);
      this.dirtyLayers.delete(layer);
    }
    this.pickingIndex.updateLayers(this.world, this.semanticStyle, layers, this.getVisibleLayers());
    this.applyLayerOrder();
    this.applyVisibility(false);
    this.app.render();
    const duration = performance.now() - started;
    this.stats.buildDuration = duration;
    this.stats.pickingEntries = this.pickingIndex.getSize();
    this.stats.batches = this.app.stage.children.reduce(
      (total, child) => total + Math.max(1, child.children.length),
      0
    );
    this.recordPerformance("pixi:layer-build", duration);
    this.commitSceneChange("content");
  }

  private buildIncrementalLayer(layer: MapLayerId): Container | null {
    if (CELL_FILL_LAYERS.includes(layer as CellFillLayer)) return this.buildFillContainer(layer as CellFillLayer);
    if (layer === "borders") return this.buildBordersContainer();
    if (layer === "cells") return this.buildCellsContainer();
    if (layer === "grid") return this.buildGridContainer();
    if (layer === "ice") return this.buildIceContainer();
    if (layer === "markets") return this.buildMarketsContainer();
    if (layer === "population") return this.buildPopulationContainer();
    if (layer === "precipitation") return this.buildPrecipitationContainer();
    if (layer === "rivers") return this.buildRiversContainer();
    if (layer === "routes") return this.buildRoutesContainer();
    if (layer === "temperature") return this.buildTemperatureContainer();
    if (layer === "zones") return this.buildZonesContainer();
    return null;
  }

  private replaceLayerContainer(layer: MapLayerId, container: Container): void {
    const app = this.app;
    if (!app) return;
    const previous = this.layerContainers.get(layer);
    if (previous === container) return;
    if (previous) this.destroyLayerContainer(layer, previous);
    app.stage.addChild(container);
    this.layerContainers.set(layer, container);
  }

  private destroyLayerContainer(layer: MapLayerId, container: Container): void {
    if (CELL_FILL_LAYERS.includes(layer as CellFillLayer)) {
      const meshes = this.cellMeshes.get(layer as CellFillLayer);
      if (meshes) {
        meshes.retained.destroy();
        this.retainedCellMeshes.delete(meshes.retained);
        if (meshes.halo) {
          meshes.halo.destroy();
          this.retainedCellMeshes.delete(meshes.halo);
        }
        this.cellMeshes.delete(layer as CellFillLayer);
      }
    }
    this.destroyContainerFilters(container);
    container.removeFromParent();
    const staleIndex = this.app?.stage.children.indexOf(container) ?? -1;
    if (staleIndex !== -1) this.app?.stage.children.splice(staleIndex, 1);
    container.destroy({ children: true });
    this.layerContainers.delete(layer);
  }

  private destroyContainerFilters(container: Container): void {
    const visit = (display: Container) => {
      for (const filter of display.filters ?? []) {
        if (!this.rendererFilters.delete(filter)) continue;
        filter.destroy();
      }
      for (const child of display.children) if (child instanceof Container) visit(child);
    };
    visit(container);
  }

  private scheduleHiddenLayerCleanup(): void {
    if (this.hiddenLayerCleanupTimer !== null) return;
    this.hiddenLayerCleanupTimer = setTimeout(() => {
      this.hiddenLayerCleanupTimer = null;
      if ([...this.dirtyLayers].some(layer => !INCREMENTAL_LAYERS.has(layer))) {
        this.scheduler?.invalidate({ kind: "world" });
      }
    }, 15_000);
  }

  private updateCellMeshes(assignments: readonly Extract<RenderInvalidation, { kind: "assignment" }>[]): boolean {
    if (!this.app) return false;
    const world = this.getWorld();
    const layers = new Set(assignments.map(invalidation => invalidation.layer as CellFillLayer));
    for (const layer of layers) {
      const target = this.cellMeshes.get(layer);
      if (!target) return false;
      const style = this.semanticStyle[layer];
      if (style.stroke.width > 0) return false;
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
      target.retained.mesh.alpha = style.opacity;
      this.populateCoastalFillContainer(target.coastalFill, layer, {
        ...this.getCellFillSource(layer),
        fallbackColor: style.fallbackColor
      });
      target.halo?.update(
        {
          ...this.getCellFillSource(layer),
          fallbackColor: style.fallbackColor,
          heights: world.cells.h
        },
        layerInvalidations.some(invalidation => !invalidation.cellIds)
          ? world.cells.i
          : layerInvalidations.flatMap(invalidation => invalidation.cellIds ?? [])
      );
    }
    this.pickingIndex.updateLayers(world, this.semanticStyle, layers, this.getVisibleLayers());
    this.stats.pickingEntries = this.pickingIndex.getSize();
    this.app.render();
    this.commitSceneChange("content");
    return true;
  }

  private commitSceneChange(kind: PixiSceneChangeKind): void {
    if (kind === "content") {
      const sequence = ++this.stats.commitSequence;
      for (const waiter of this.commitWaiters) {
        if (sequence <= waiter.after) continue;
        this.commitWaiters.delete(waiter);
        waiter.resolve(sequence);
      }
    }
    this.rendererOptions.onSceneChange?.(kind);
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

  private assertAssetAvailable(kind: string, id: string): void {
    if (this.rendererOptions.strictAssets) throw new Error(`Required renderer ${kind} asset is unavailable: ${id}`);
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

  private getLabelAtlasResolution(displays: readonly LabelAtlasDisplay[]): number {
    const replacementHandles = new Set(displays.map(display => display.handle));
    const retainedKeys = new Set(
      [...this.glyphAtlasHandles].filter(handle => !replacementHandles.has(handle)).map(handle => handle.value.key)
    );
    const heldAtlases = new Map(
      [...this.glyphAtlasHandles].map(handle => [handle.value.key, handle.value.bytes] as const)
    );
    const replaceableAtlases = new Map(
      [...replacementHandles]
        .filter(handle => !retainedKeys.has(handle.value.key))
        .map(handle => [handle.value.key, handle.value.bytes] as const)
    );
    const replaceableBytes = [...replaceableAtlases.values()].reduce((total, bytes) => total + bytes, 0);
    const heldBytes = [...heldAtlases.values()].reduce((total, bytes) => total + bytes, 0);
    const totalBudget = this.glyphBudgetBytes;
    return selectLabelAtlasResolution({
      budgetBytes: Math.max(0, totalBudget - heldBytes + replaceableBytes),
      cameraScale: this.camera.scale,
      groups: displays.map(display => display.group),
      rendererResolution: this.stats.resolution,
      resizeOnZoom: this.labelResizeOnZoom
    });
  }

  private applyPhysicalFilter(target: Container, value: string): boolean {
    const filter = new ColorMatrixFilter();
    if (value.includes("filter-sepia")) filter.sepia(false);
    else if (value.includes("filter-grayscale")) filter.grayscale(1, false);
    else {
      filter.destroy();
      return false;
    }
    target.filters = [filter];
    this.rendererFilters.add(filter);
    return true;
  }
}

const MAP_LAYER_IDS = new Set(MAP_LAYER_REGISTRY.map(layer => layer.id));

function wrapSvgFragment(fragment: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`;
}

function isMapLayerId(label: unknown): label is MapLayerId {
  return typeof label === "string" && MAP_LAYER_IDS.has(label as MapLayerId);
}

function collectCoordinateCharacters(labels: readonly CoordinateSceneLabel[]): string {
  const characters = new Set<string>([" ", "?"]);
  for (const label of labels) for (const character of label.text) characters.add(character);
  return [...characters].sort((left, right) => (left.codePointAt(0) ?? 0) - (right.codePointAt(0) ?? 0)).join("");
}

function coordinateAtlasStyle(style: CoordinateLayerStyle): ResolvedLabelGroupStyle {
  return {
    fill: style.fontColor,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    letterSpacing: 0,
    offsetXEm: 0,
    offsetYEm: 0,
    opacity: style.opacity,
    shadow:
      style.shadowBlur > 0
        ? { blur: style.shadowBlur, color: style.shadowColor, distance: 0, offsetX: 0, offsetY: 0 }
        : null,
    stroke: style.fontColor,
    strokeWidth: 0
  };
}

function createLabelText(
  text: string,
  fontSize: number,
  letterSpacing: number,
  style: ResolvedLabelGroupStyle,
  atlasFontFamily: string
): BitmapText {
  return new BitmapText({
    style: {
      align: "center",
      fill: style.fill,
      fontFamily: atlasFontFamily,
      fontSize,
      letterSpacing
    },
    text
  });
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
      join: style.stroke.join ?? "round",
      width: style.stroke.width
    });
  }
  return new Graphics(context);
}

function applyGeographyMask(
  target: Container,
  maskType: "land" | "water",
  landPolygons: readonly PolygonPathPrimitive[],
  lakePolygons: readonly PolygonPathPrimitive[],
  bounds: { height: number; width: number }
): void {
  const context = new GraphicsContext();
  const seaIslands = landPolygons.filter(polygon => polygon.role !== "lake_island");
  const lakeIslands = landPolygons.filter(polygon => polygon.role === "lake_island");
  if (maskType === "water") {
    context.rect(0, 0, bounds.width, bounds.height).fill({ color: "#ffffff" });
    for (const polygon of seaIslands) context.poly(polygon.points.flat(), true);
    if (seaIslands.length) context.cut();
    for (const polygon of lakePolygons) context.poly(polygon.points.flat(), true).fill({ color: "#ffffff" });
    for (const polygon of lakeIslands) context.poly(polygon.points.flat(), true);
    if (lakeIslands.length) context.cut();
  } else {
    for (const polygon of seaIslands) context.poly(polygon.points.flat(), true).fill({ color: "#ffffff" });
    for (const polygon of lakePolygons) context.poly(polygon.points.flat(), true);
    if (lakePolygons.length) context.cut();
    for (const polygon of lakeIslands) context.poly(polygon.points.flat(), true).fill({ color: "#ffffff" });
  }
  const mask = new Graphics(context);
  mask.label = `${target.label}:mask:${maskType}`;
  target.addChild(mask);
  target.mask = mask;
}

function createLineGraphic(paths: readonly LinePathPrimitive[], style: SemanticLineStyle, pixelLine = false): Graphics {
  const context = new GraphicsContext();
  for (const path of paths) traceLinePath(context, path, style.dash);
  if (style.width > 0 && style.opacity > 0) {
    context.stroke({
      alpha: style.opacity,
      cap: style.cap,
      color: style.color,
      join: style.join ?? "round",
      pixelLine,
      width: style.width
    });
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

function createMissingEmblemGraphic(size: number): Graphics {
  const radius = size / 2;
  return new Graphics(
    new GraphicsContext()
      .poly(
        [
          0,
          -radius,
          radius * 0.82,
          -radius * 0.45,
          radius * 0.68,
          radius * 0.5,
          0,
          radius,
          -radius * 0.68,
          radius * 0.5,
          -radius * 0.82,
          -radius * 0.45
        ],
        true
      )
      .fill({ alpha: 0.65, color: "#eeeeee" })
      .stroke({ color: "#c13119", width: Math.max(0.4, size / 24) })
      .moveTo(-radius * 0.4, -radius * 0.35)
      .lineTo(radius * 0.4, radius * 0.45)
      .moveTo(radius * 0.4, -radius * 0.35)
      .lineTo(-radius * 0.4, radius * 0.45)
      .stroke({ color: "#c13119", width: Math.max(0.4, size / 24) })
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

const NATIVE_BURG_SYMBOLS = new Set(["anchor", "circle", "cross", "square", "star", "triangle"]);

function isNativeBurgSymbol(shape: string): boolean {
  return NATIVE_BURG_SYMBOLS.has(shape);
}

function getBurgSymbolTextureKey(symbol: PointSymbolInstancePrimitive): string {
  return [symbol.icon, symbol.fill, symbol.fillOpacity, symbol.stroke, symbol.strokeWidth].join(":");
}

function createBurgSymbolSprite(symbol: PointSymbolInstancePrimitive, texture: Texture): Sprite {
  const sprite = new Sprite({ height: symbol.size, texture, width: symbol.size });
  sprite.alpha = symbol.opacity;
  sprite.anchor.set(0.5);
  sprite.cullable = true;
  sprite.eventMode = "none";
  sprite.position.set(symbol.x, symbol.y);
  return sprite;
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
  if (shape === "circle") return void context.circle(x, y, radius);
  if (shape === "square") return void context.rect(x - radius, y - radius, size, size);
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
  if (shape === "star") {
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
