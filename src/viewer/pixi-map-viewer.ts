import type { MapCamera, ViewportSize } from "../renderers/core/camera";
import { screenToWorld } from "../renderers/core/camera";
import { coalesceInvalidations, type RenderInvalidation } from "../renderers/core/invalidation";
import type { MapLayerId } from "../renderers/core/layer-registry";
import type { MapHit, MapRenderer, ScreenPoint } from "../renderers/core/map-renderer";
import {
  assertRenderSnapshot,
  createRenderSnapshot,
  type RenderSnapshot,
  type RenderSnapshotBounds
} from "../renderers/scene/render-snapshot";
import type { MapRenderWorld } from "../renderers/scene/render-world";
import type { MapStyle } from "../renderers/scene/styles";

export type PixiViewerRenderer = MapRenderer;
export type PixiMapViewerEventType = "camera" | "destroy" | "error" | "layers" | "load" | "pick" | "resize";
export type PixiMapViewerAssetKind = "compass" | "emblem" | "relief" | "symbol" | "texture" | "trade";

export interface PixiMapViewerAssetPolicy {
  baseUrl?: string;
  credentials?: RequestCredentials;
  resolveAsset?: (kind: PixiMapViewerAssetKind, id: string) => string | null | undefined;
}

export interface PixiMapViewerFont {
  descriptors?: FontFaceDescriptors;
  family: string;
  url: string;
}

export interface PixiMapViewerRuntimeConfiguration {
  assetBaseUrl?: string;
  credentials: RequestCredentials;
  workerUrl?: string;
}

export interface PixiMapViewerEvent {
  camera: Readonly<MapCamera>;
  error?: Error;
  hit?: MapHit | null;
  layers: Readonly<Partial<Record<MapLayerId, boolean>>>;
  snapshot: RenderSnapshot;
  type: PixiMapViewerEventType;
}

export interface PixiMapViewerOptions {
  assetPolicy?: PixiMapViewerAssetPolicy;
  camera?: MapCamera;
  createRenderer?: (
    configuration: Readonly<PixiMapViewerRuntimeConfiguration>
  ) => Promise<PixiViewerRenderer> | PixiViewerRenderer;
  data?: RenderSnapshot;
  fonts?: readonly PixiMapViewerFont[];
  interactive?: boolean;
  layerVisibility?: Readonly<Partial<Record<MapLayerId, boolean>>>;
  reducedMotion?: boolean;
  rendererPreference?: "webgl" | "webgpu";
  resolutionCap?: number;
  style?: MapStyle;
  surface: HTMLElement;
  workerUrl?: string;
  world?: MapRenderWorld;
}

export interface PixiMapViewerHandle {
  destroy: () => void;
  fitBounds: (bounds?: RenderSnapshotBounds, padding?: number) => MapCamera;
  getCamera: () => Readonly<MapCamera>;
  load: (data: RenderSnapshot | string, signal?: AbortSignal) => Promise<void>;
  pick: (point: ScreenPoint) => MapHit | null;
  render: (world: MapRenderWorld, style: MapStyle, invalidations: readonly RenderInvalidation[]) => Promise<void>;
  renderer: PixiViewerRenderer;
  resize: (viewport?: ViewportSize) => void;
  setCamera: (camera: MapCamera) => void;
  setLayerVisibility: (layer: MapLayerId, visible: boolean) => void;
  setLayers: (visibility: Readonly<Partial<Record<MapLayerId, boolean>>>) => void;
  subscribe: (listener: (event: PixiMapViewerEvent) => void) => () => void;
}

export async function mountPixiMapViewer(options: PixiMapViewerOptions): Promise<PixiMapViewerHandle> {
  let currentSnapshot = resolveSnapshotAssets(getInitialSnapshot(options), options.assetPolicy);
  let currentCamera = options.camera ? { ...options.camera } : fitSnapshot(options.surface, currentSnapshot.bounds, 0);
  const listeners = new Set<(event: PixiMapViewerEvent) => void>();
  const releaseFonts = await loadViewerFonts(options.surface, options.fonts, options.assetPolicy);
  const runtimeConfiguration = getRuntimeConfiguration(options);
  const rendererFactory = options.createRenderer ?? (() => createProductionRenderer(options));
  let renderer: PixiViewerRenderer;
  try {
    renderer = await rendererFactory(runtimeConfiguration);
  } catch (error) {
    releaseFonts();
    throw error;
  }
  const layers: Partial<Record<MapLayerId, boolean>> = {
    ...currentSnapshot.layerVisibility,
    ...options.layerVisibility
  };
  if (options.reducedMotion) layers.trade = false;

  let destroyed = false;
  const emit = (type: PixiMapViewerEventType, detail: Partial<PixiMapViewerEvent> = {}): void => {
    const event: PixiMapViewerEvent = {
      camera: { ...currentCamera },
      layers: { ...layers },
      snapshot: currentSnapshot,
      type,
      ...detail
    };
    for (const listener of listeners) listener(event);
  };
  const setCamera = (camera: MapCamera): void => {
    assertActive(destroyed);
    currentCamera = { ...camera };
    renderer.setCamera(currentCamera);
    emit("camera");
  };
  const setLayerVisibility = (layer: MapLayerId, visible: boolean): void => {
    assertActive(destroyed);
    layers[layer] = visible;
    renderer.setLayerVisibility(layer, visible);
    emit("layers");
  };

  try {
    renderer.setCamera(currentCamera);
    await renderer.mount(options.surface);
    for (const [layer, visible] of Object.entries(layers)) {
      if (visible !== undefined) renderer.setLayerVisibility(layer as MapLayerId, visible);
    }
    await renderer.render(
      currentSnapshot.world as MapRenderWorld,
      structuredClone(currentSnapshot.style) as MapStyle,
      coalesceInvalidations([{ kind: "world" }])
    );
  } catch (error) {
    renderer.destroy();
    releaseFonts();
    throw error;
  }

  let handle: PixiMapViewerHandle;
  let releaseVisibilityRestoration: () => void = () => undefined;
  const releaseInput =
    options.interactive === false
      ? () => undefined
      : bindViewerInput(options.surface, {
          getCamera: () => currentCamera,
          pick: point => handle.pick(point),
          setCamera
        });

  handle = {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      releaseInput();
      releaseVisibilityRestoration();
      renderer.destroy();
      releaseFonts();
      emit("destroy");
      listeners.clear();
    },
    fitBounds: (bounds = currentSnapshot.bounds, padding = 0) => {
      const camera = fitSnapshot(options.surface, bounds, padding);
      setCamera(camera);
      return camera;
    },
    getCamera: () => ({ ...currentCamera }),
    load: async (data, signal) => {
      assertActive(destroyed);
      try {
        const loaded = typeof data === "string" ? await loadViewerData(data, options.assetPolicy, signal) : data;
        assertRenderSnapshot(loaded);
        currentSnapshot = resolveSnapshotAssets(createRenderSnapshot(loaded), options.assetPolicy);
        Object.assign(layers, currentSnapshot.layerVisibility);
        for (const [layer, visible] of Object.entries(layers)) {
          if (visible !== undefined) renderer.setLayerVisibility(layer as MapLayerId, visible);
        }
        await renderer.render(
          currentSnapshot.world as MapRenderWorld,
          structuredClone(currentSnapshot.style) as MapStyle,
          coalesceInvalidations([{ kind: "world" }])
        );
        emit("load");
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error("Unable to load viewer data");
        emit("error", { error: normalized });
        throw normalized;
      }
    },
    pick: point => {
      assertActive(destroyed);
      const hit = renderer.pick(point);
      emit("pick", { hit });
      return hit;
    },
    render: async (world, style, invalidations) => {
      assertActive(destroyed);
      currentSnapshot = createRenderSnapshot({
        bounds: currentSnapshot.bounds,
        layerVisibility: layers,
        style,
        world
      });
      await renderer.render(
        currentSnapshot.world as MapRenderWorld,
        structuredClone(currentSnapshot.style) as MapStyle,
        coalesceInvalidations(invalidations)
      );
    },
    renderer,
    resize: viewport => {
      assertActive(destroyed);
      const size = viewport ?? readSurfaceSize(options.surface);
      currentCamera = { ...currentCamera, ...size };
      renderer.resize(size);
      renderer.setCamera(currentCamera);
      emit("resize");
    },
    setCamera,
    setLayerVisibility,
    setLayers: visibility => {
      for (const [layer, visible] of Object.entries(visibility)) {
        if (visible !== undefined) setLayerVisibility(layer as MapLayerId, visible);
      }
    },
    subscribe: listener => {
      assertActive(destroyed);
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  releaseVisibilityRestoration = bindVisibilityRestoration(options.surface, () => handle.resize());

  return handle;
}

function getInitialSnapshot(options: PixiMapViewerOptions): RenderSnapshot {
  if (options.data) {
    assertRenderSnapshot(options.data);
    return createRenderSnapshot(options.data);
  }
  if (!options.world || !options.style) throw new Error("Viewer requires a render snapshot or world and style inputs");
  return createRenderSnapshot({ layerVisibility: options.layerVisibility, style: options.style, world: options.world });
}

function getRuntimeConfiguration(options: PixiMapViewerOptions): PixiMapViewerRuntimeConfiguration {
  return {
    assetBaseUrl: options.assetPolicy?.baseUrl,
    credentials: options.assetPolicy?.credentials ?? "same-origin",
    workerUrl: options.workerUrl ? resolveUrl(options.workerUrl, options.assetPolicy?.baseUrl) : undefined
  };
}

function resolveSnapshotAssets(snapshot: RenderSnapshot, policy: PixiMapViewerAssetPolicy | undefined): RenderSnapshot {
  const style = structuredClone(snapshot.style) as MapStyle;
  style.texture.href = resolveConfiguredAsset("texture", style.texture.href, policy);
  style.ocean.pattern.href = resolveConfiguredAsset("texture", style.ocean.pattern.href, policy);
  return createRenderSnapshot({
    bounds: { ...snapshot.bounds },
    layerVisibility: snapshot.layerVisibility,
    style,
    world: snapshot.world as MapRenderWorld
  });
}

function resolveConfiguredAsset(
  kind: PixiMapViewerAssetKind,
  id: string | null,
  policy: PixiMapViewerAssetPolicy | undefined
): string | null {
  if (!id) return null;
  const custom = policy?.resolveAsset?.(kind, id);
  if (custom === null) throw new Error(`Required viewer ${kind} asset is unavailable: ${id}`);
  if (custom !== undefined) return custom;
  return resolveUrl(id, policy?.baseUrl);
}

function resolveUrl(value: string, baseUrl: string | undefined): string {
  if (!baseUrl) return value;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    throw new Error(`Invalid viewer asset URL: ${value}`);
  }
}

async function loadViewerFonts(
  surface: HTMLElement,
  fonts: readonly PixiMapViewerFont[] | undefined,
  policy: PixiMapViewerAssetPolicy | undefined
): Promise<() => void> {
  if (!fonts?.length) return () => undefined;
  const fontSet = surface.ownerDocument?.fonts;
  if (!fontSet || typeof FontFace === "undefined") {
    throw new Error("Configured viewer fonts require the FontFace API");
  }

  const loaded: FontFace[] = [];
  try {
    for (const font of fonts) {
      const url = resolveUrl(font.url, policy?.baseUrl);
      const response = await fetch(url, { credentials: policy?.credentials ?? "same-origin" });
      if (!response.ok) throw new Error(`Unable to load viewer font ${font.family}: HTTP ${response.status}`);
      const face = new FontFace(font.family, await response.arrayBuffer(), {
        ...font.descriptors,
        display: font.descriptors?.display ?? "block"
      });
      await face.load();
      fontSet.add(face);
      loaded.push(face);
    }
  } catch (error) {
    for (const face of loaded) fontSet.delete(face);
    throw error;
  }

  return () => {
    for (const face of loaded) fontSet.delete(face);
  };
}

function fitSnapshot(surface: HTMLElement, bounds: RenderSnapshotBounds, padding: number): MapCamera {
  const viewport = readSurfaceSize(surface);
  const safePadding = Math.max(0, Math.min(padding, Math.min(viewport.width, viewport.height) / 2));
  const availableWidth = Math.max(1, viewport.width - safePadding * 2);
  const availableHeight = Math.max(1, viewport.height - safePadding * 2);
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  return {
    ...viewport,
    scale,
    x: (viewport.width - bounds.width * scale) / 2,
    y: (viewport.height - bounds.height * scale) / 2
  };
}

function readSurfaceSize(surface: HTMLElement): ViewportSize {
  const bounds = surface.getBoundingClientRect();
  return { height: Math.max(1, Math.round(bounds.height)), width: Math.max(1, Math.round(bounds.width)) };
}

function bindVisibilityRestoration(surface: HTMLElement, restore: () => void): () => void {
  const ownerDocument = surface.ownerDocument;
  if (!ownerDocument?.addEventListener) return () => undefined;
  const onVisibilityChange = (): void => {
    if (ownerDocument.visibilityState === "visible") restore();
  };
  ownerDocument.addEventListener("visibilitychange", onVisibilityChange);
  return () => ownerDocument.removeEventListener("visibilitychange", onVisibilityChange);
}

async function loadViewerData(
  url: string,
  policy: PixiMapViewerAssetPolicy | undefined,
  signal: AbortSignal | undefined
): Promise<RenderSnapshot> {
  const response = await fetch(url, { credentials: policy?.credentials ?? "same-origin", signal });
  if (!response.ok) throw new Error(`Unable to load viewer data: HTTP ${response.status}`);
  return response.json() as Promise<RenderSnapshot>;
}

function bindViewerInput(
  surface: HTMLElement,
  actions: {
    getCamera: () => MapCamera;
    pick: (point: ScreenPoint) => MapHit | null;
    setCamera: (camera: MapCamera) => void;
  }
): () => void {
  const pointers = new Map<number, ScreenPoint>();
  let dragStart: { camera: MapCamera; point: ScreenPoint } | null = null;
  let pinchStart: { camera: MapCamera; distance: number; worldPoint: ScreenPoint } | null = null;

  const toPoint = (event: PointerEvent | WheelEvent): ScreenPoint => {
    const bounds = surface.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const onPointerDown = (event: PointerEvent): void => {
    const point = toPoint(event);
    pointers.set(event.pointerId, point);
    surface.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) dragStart = { camera: { ...actions.getCamera() }, point };
    else if (pointers.size === 2) pinchStart = getPinchStart([...pointers.values()], actions.getCamera());
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, toPoint(event));
    if (pointers.size >= 2 && pinchStart) {
      const [first, second] = [...pointers.values()];
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const scale = Math.max(0.05, Math.min(100, pinchStart.camera.scale * (distance / pinchStart.distance)));
      actions.setCamera({
        ...pinchStart.camera,
        scale,
        x: midpoint.x - pinchStart.worldPoint.x * scale,
        y: midpoint.y - pinchStart.worldPoint.y * scale
      });
      return;
    }
    if (dragStart) {
      const point = toPoint(event);
      actions.setCamera({
        ...dragStart.camera,
        x: dragStart.camera.x + point.x - dragStart.point.x,
        y: dragStart.camera.y + point.y - dragStart.point.y
      });
    }
  };
  const onPointerEnd = (event: PointerEvent): void => {
    const point = toPoint(event);
    const wasDrag = dragStart && Math.hypot(point.x - dragStart.point.x, point.y - dragStart.point.y) > 3;
    pointers.delete(event.pointerId);
    if (!wasDrag && !pointers.size) actions.pick(point);
    dragStart = pointers.size === 1 ? { camera: { ...actions.getCamera() }, point: [...pointers.values()][0] } : null;
    pinchStart = pointers.size >= 2 ? getPinchStart([...pointers.values()], actions.getCamera()) : null;
  };
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const point = toPoint(event);
    const camera = actions.getCamera();
    const worldPoint = screenToWorld(point, camera);
    const scale = Math.max(0.05, Math.min(100, camera.scale * Math.exp(-event.deltaY * 0.001)));
    actions.setCamera({ ...camera, scale, x: point.x - worldPoint.x * scale, y: point.y - worldPoint.y * scale });
  };

  const previousTouchAction = surface.style.touchAction;
  surface.style.touchAction = "none";
  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointermove", onPointerMove);
  surface.addEventListener("pointerup", onPointerEnd);
  surface.addEventListener("pointercancel", onPointerEnd);
  surface.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    pointers.clear();
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("pointermove", onPointerMove);
    surface.removeEventListener("pointerup", onPointerEnd);
    surface.removeEventListener("pointercancel", onPointerEnd);
    surface.removeEventListener("wheel", onWheel);
    surface.style.touchAction = previousTouchAction;
  };
}

function getPinchStart(points: ScreenPoint[], camera: MapCamera) {
  const [first, second] = points;
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  return {
    camera: { ...camera },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    worldPoint: screenToWorld(midpoint, camera)
  };
}

function assertActive(destroyed: boolean): void {
  if (destroyed) throw new Error("FantasyMapViewer has been destroyed");
}

async function createProductionRenderer(options: PixiMapViewerOptions): Promise<PixiViewerRenderer> {
  const [{ PixiMapRenderer }, { DEFAULT_RENDERER_RESOLUTION_POLICY }] = await Promise.all([
    import("../renderers/pixi/pixi-map-renderer"),
    import("../renderers/core/resolution")
  ]);
  const resolutionCap = Math.max(0.5, options.resolutionCap ?? DEFAULT_RENDERER_RESOLUTION_POLICY.maxResolution);
  const resolve = (kind: PixiMapViewerAssetKind, id: string): string | null => {
    const custom = options.assetPolicy?.resolveAsset?.(kind, id);
    if (custom !== undefined) return custom;
    if (/^(?:blob:|data:|https?:|\/|\.\/|\.\.\/)/i.test(id)) return resolveUrl(id, options.assetPolicy?.baseUrl);
    const base = options.assetPolicy?.baseUrl;
    if (!base) return null;
    const file = kind === "compass" ? "compass.svg" : kind === "texture" ? id : `${kind}/${encodeURIComponent(id)}.svg`;
    return new URL(file, base).href;
  };
  return new PixiMapRenderer({
    preference: options.rendererPreference,
    resolutionPolicy: {
      ...DEFAULT_RENDERER_RESOLUTION_POLICY,
      lowMemoryMaxResolution: Math.min(DEFAULT_RENDERER_RESOLUTION_POLICY.lowMemoryMaxResolution, resolutionCap),
      maxResolution: resolutionCap,
      mediumMemoryMaxResolution: Math.min(DEFAULT_RENDERER_RESOLUTION_POLICY.mediumMemoryMaxResolution, resolutionCap)
    },
    resolveCompassIcon: () => resolve("compass", "compass"),
    resolveEmblemIcon: id => resolve("emblem", id),
    resolveReliefIcon: icon => resolve("relief", icon),
    resolveSymbolIcon: icon => resolve("symbol", icon),
    resolveTradeMarker: type => resolve("trade", type),
    strictAssets: true
  });
}
