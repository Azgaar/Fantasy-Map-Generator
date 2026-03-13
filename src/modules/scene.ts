const SVG_NS = "http://www.w3.org/2000/svg";
const MAP_CONTAINER_ID = "map-container";
const SCENE_CONTAINER_ID = "map-scene";
const MAP_ID = "map";
const WEBGL_CANVAS_ID = "webgl-canvas";
const RUNTIME_DEFS_HOST_ID = "runtime-defs-host";
const RUNTIME_DEFS_ID = "runtime-defs";

export interface SceneCameraState {
  scale: number;
  viewX: number;
  viewY: number;
}

export interface SceneViewportState {
  graphWidth: number;
  graphHeight: number;
  svgWidth: number;
  svgHeight: number;
}

export interface SceneCameraBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function buildCameraBounds(
  viewX: number,
  viewY: number,
  scale: number,
  graphWidth: number,
  graphHeight: number,
): SceneCameraBounds {
  const left = normalizeSceneValue(-viewX / scale);
  const top = normalizeSceneValue(-viewY / scale);
  const width = graphWidth / scale;
  const height = graphHeight / scale;

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
  };
}

export function buildViewboxTransform({
  scale,
  viewX,
  viewY,
}: SceneCameraState) {
  return `translate(${viewX} ${viewY}) scale(${scale})`;
}

function normalizeSceneValue(value: number) {
  return Object.is(value, -0) ? 0 : value;
}

export class SceneModule {
  private mapContainer: HTMLElement | null = null;
  private sceneContainer: HTMLDivElement | null = null;
  private mapSvg: SVGSVGElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private defsHost: SVGSVGElement | null = null;
  private runtimeDefs: SVGGElement | null = null;

  bootstrap() {
    const mapContainer = this.requireMapContainer();
    const sceneContainer = this.ensureSceneContainer(mapContainer);
    const defsHost = this.ensureDefsHost(mapContainer, sceneContainer);
    const runtimeDefs = this.ensureRuntimeDefs(defsHost);

    const mapSvg = document.getElementById(MAP_ID);
    if (mapSvg instanceof SVGSVGElement) {
      sceneContainer.append(mapSvg);
    }

    const canvas = document.getElementById(WEBGL_CANVAS_ID);
    if (canvas instanceof HTMLCanvasElement) {
      sceneContainer.append(canvas);
    }

    this.mapContainer = mapContainer;
    this.sceneContainer = sceneContainer;
    this.mapSvg = mapSvg instanceof SVGSVGElement ? mapSvg : null;
    this.canvas = canvas instanceof HTMLCanvasElement ? canvas : null;
    this.defsHost = defsHost;
    this.runtimeDefs = runtimeDefs;

    return this;
  }

  replaceMapSvg(markup: string) {
    this.bootstrap();

    this.mapSvg?.remove();
    this.sceneContainer?.querySelector(`#${MAP_ID}`)?.remove();
    this.getSceneContainer().insertAdjacentHTML("afterbegin", markup);

    const mapSvg = this.getSceneContainer().querySelector(`#${MAP_ID}`);
    if (!(mapSvg instanceof SVGSVGElement)) {
      throw new Error("Scene could not rebind the map SVG after reload");
    }

    this.mapSvg = mapSvg;
    if (this.canvas) {
      this.getSceneContainer().append(this.canvas);
    }

    return mapSvg;
  }

  getMapContainer() {
    this.bootstrap();
    return this.mapContainer!;
  }

  getSceneContainer() {
    this.bootstrap();
    return this.sceneContainer!;
  }

  getMapSvg() {
    this.bootstrap();
    if (!this.mapSvg) {
      throw new Error("Scene map SVG is not available");
    }

    return this.mapSvg;
  }

  getCanvas() {
    this.bootstrap();
    if (!this.canvas) {
      throw new Error("Scene WebGL canvas is not available");
    }

    return this.canvas;
  }

  getDefsHost() {
    this.bootstrap();
    return this.defsHost!;
  }

  getRuntimeDefs() {
    this.bootstrap();
    return this.runtimeDefs!;
  }

  getCamera() {
    return { scale, viewX, viewY };
  }

  getViewport() {
    return { graphWidth, graphHeight, svgWidth, svgHeight };
  }

  getCameraBounds() {
    const { scale, viewX, viewY } = this.getCamera();
    const { graphWidth, graphHeight } = this.getViewport();
    return buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight);
  }

  getViewboxTransform() {
    return buildViewboxTransform(this.getCamera());
  }

  applyViewboxTransform() {
    if (typeof viewbox === "undefined") {
      return;
    }

    viewbox.attr("transform", this.getViewboxTransform());
  }

  private requireMapContainer() {
    const mapContainer = document.getElementById(MAP_CONTAINER_ID);
    if (!(mapContainer instanceof HTMLElement)) {
      throw new Error("Scene map container is not available");
    }

    return mapContainer;
  }

  private ensureSceneContainer(mapContainer: HTMLElement) {
    const existingSceneContainer = document.getElementById(SCENE_CONTAINER_ID);
    if (existingSceneContainer instanceof HTMLDivElement) {
      return existingSceneContainer;
    }

    const sceneContainer = document.createElement("div");
    sceneContainer.id = SCENE_CONTAINER_ID;
    sceneContainer.style.position = "absolute";
    sceneContainer.style.inset = "0";
    mapContainer.prepend(sceneContainer);
    return sceneContainer;
  }

  private ensureDefsHost(
    mapContainer: HTMLElement,
    sceneContainer: HTMLDivElement,
  ) {
    const existingDefsHost = document.getElementById(RUNTIME_DEFS_HOST_ID);
    if (existingDefsHost instanceof SVGSVGElement) {
      if (sceneContainer.contains(existingDefsHost)) {
        mapContainer.append(existingDefsHost);
      }

      return existingDefsHost;
    }

    const defsHost = document.createElementNS(SVG_NS, "svg");
    defsHost.setAttribute("id", RUNTIME_DEFS_HOST_ID);
    defsHost.setAttribute("width", "0");
    defsHost.setAttribute("height", "0");
    defsHost.setAttribute("aria-hidden", "true");
    defsHost.style.position = "absolute";
    defsHost.style.width = "0";
    defsHost.style.height = "0";
    defsHost.style.overflow = "hidden";

    const defsElement = document.createElementNS(SVG_NS, "defs");
    defsHost.append(defsElement);
    mapContainer.append(defsHost);
    return defsHost;
  }

  private ensureRuntimeDefs(defsHost: SVGSVGElement) {
    const existingRuntimeDefs = defsHost.querySelector(`#${RUNTIME_DEFS_ID}`);
    if (existingRuntimeDefs instanceof SVGGElement) {
      return existingRuntimeDefs;
    }

    let defsElement = defsHost.querySelector("defs");
    if (!(defsElement instanceof SVGDefsElement)) {
      defsElement = document.createElementNS(SVG_NS, "defs");
      defsHost.append(defsElement);
    }

    const runtimeDefs = document.createElementNS(SVG_NS, "g");
    runtimeDefs.setAttribute("id", RUNTIME_DEFS_ID);
    defsElement.append(runtimeDefs);
    return runtimeDefs;
  }
}

declare global {
  var Scene: SceneModule;
}

if (typeof window !== "undefined") {
  window.Scene = new SceneModule();
}
