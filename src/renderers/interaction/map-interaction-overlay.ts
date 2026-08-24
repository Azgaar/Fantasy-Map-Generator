import { clientToViewport, type MapCamera, normalizeCamera, screenToWorld, worldToScreen } from "../core/camera";
import type { ScreenPoint } from "../core/map-renderer";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const HANDLE_RADIUS_PIXELS = 6;
export const MAP_INTERACTION_SURFACE_ID = "mapInteractionSurface";

export const MAP_INTERACTION_HANDLE_EVENT = "map:interaction-handle";

export interface MapInteractionGeometryStyle {
  fill?: string;
  fillOpacity?: number;
  opacity?: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
}

type MapInteractionGeometryShape =
  | { center: ScreenPoint; kind: "circle"; radius: number }
  | { height: number; kind: "bounds"; width: number; x: number; y: number }
  | { kind: "path"; path: string }
  | { kind: "point"; point: ScreenPoint }
  | { kind: "polygon" | "polyline"; points: readonly ScreenPoint[] };

export type MapInteractionGeometry = MapInteractionGeometryShape & { style?: MapInteractionGeometryStyle };

export interface MapInteractionBrush {
  center: ScreenPoint;
  radius: number;
}

export interface MapInteractionHandle {
  disabled?: boolean;
  id: number | string;
  label: string;
  point: ScreenPoint;
}

export interface MapInteractionOverlayState {
  brush: MapInteractionBrush | null;
  handles: readonly MapInteractionHandle[];
  highlight: readonly MapInteractionGeometry[];
  selection: readonly MapInteractionGeometry[];
}

export interface MapInteractionOverlayPatch {
  brush?: MapInteractionBrush | null;
  handles?: readonly MapInteractionHandle[];
  highlight?: readonly MapInteractionGeometry[] | null;
  selection?: readonly MapInteractionGeometry[] | null;
}

export interface MapInteractionHandleEventDetail {
  handleId: number | string;
  phase: "activate" | "cancel" | "end" | "move" | "start";
  pointerId: number | null;
  pointerType: string;
  screenPoint: ScreenPoint;
  source: "keyboard" | "pointer";
  worldPoint: ScreenPoint;
}

export interface MapInteractionOverlayLayout {
  handleRadius: number;
  height: number;
  transform: string;
  width: number;
}

interface ActiveHandle {
  element: SVGCircleElement;
  handleId: number | string;
  offset: ScreenPoint;
  pointerId: number;
  pointerType: string;
}

export function ensureMapInteractionSurface(viewbox: SVGGElement, width: number, height: number): SVGRectElement {
  let surface = viewbox.querySelector<SVGRectElement>(`#${MAP_INTERACTION_SURFACE_ID}`);
  if (!surface) {
    surface = document.createElementNS(SVG_NAMESPACE, "rect");
    viewbox.insertBefore(surface, viewbox.firstChild);
  }

  surface.id = MAP_INTERACTION_SURFACE_ID;
  surface.dataset.rendererOverlay = "input";
  surface.setAttribute("aria-hidden", "true");
  surface.setAttribute("fill", "transparent");
  surface.setAttribute("height", String(Math.max(1, height)));
  surface.setAttribute("width", String(Math.max(1, width)));
  surface.setAttribute("x", "0");
  surface.setAttribute("y", "0");
  surface.style.pointerEvents = "all";
  return surface;
}

const EMPTY_STATE: Readonly<MapInteractionOverlayState> = {
  brush: null,
  handles: [],
  highlight: [],
  selection: []
};

export class MapInteractionOverlay {
  private activeHandle: ActiveHandle | null = null;
  private camera: MapCamera = normalizeCamera({ height: 1, scale: 1, width: 1, x: 0, y: 0 });
  private root: SVGGElement | null = null;
  private state: MapInteractionOverlayState = { ...EMPTY_STATE };
  private surface: SVGSVGElement | null = null;

  mount(surface: SVGSVGElement, worldSize: { height: number; width: number }): void {
    const viewbox = surface.querySelector<SVGGElement>("#viewbox");
    if (viewbox) ensureMapInteractionSurface(viewbox, worldSize.width, worldSize.height);
    if (this.surface === surface && this.root?.isConnected) return;
    this.destroy();

    surface.querySelector("#mapInteractionOverlay")?.remove();
    const root = document.createElementNS(SVG_NAMESPACE, "g");
    root.id = "mapInteractionOverlay";
    root.dataset.rendererOverlay = "transient";
    root.setAttribute("aria-label", "Map editing controls");
    root.setAttribute("role", "group");
    root.style.pointerEvents = "none";
    root.addEventListener("keydown", this.onKeyDown);
    root.addEventListener("pointercancel", this.onPointerCancel);
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);

    surface.append(root);
    this.root = root;
    this.surface = surface;
    this.render();
  }

  setCamera(camera: MapCamera): void {
    this.camera = normalizeCamera(camera);
    this.render();
  }

  update(patch: MapInteractionOverlayPatch): void {
    if ("brush" in patch) this.state.brush = patch.brush ?? null;
    if ("handles" in patch) this.state.handles = patch.handles ? [...patch.handles] : [];
    if ("highlight" in patch) this.state.highlight = patch.highlight ? [...patch.highlight] : [];
    if ("selection" in patch) this.state.selection = patch.selection ? [...patch.selection] : [];
    this.render();
  }

  clear(): void {
    this.state = { ...EMPTY_STATE };
    this.activeHandle = null;
    this.render();
  }

  getSnapshot(): Readonly<MapInteractionOverlayState> {
    return {
      brush: this.state.brush,
      handles: [...this.state.handles],
      highlight: [...this.state.highlight],
      selection: [...this.state.selection]
    };
  }

  destroy(): void {
    this.activeHandle = null;
    this.root?.removeEventListener("keydown", this.onKeyDown);
    this.root?.removeEventListener("pointercancel", this.onPointerCancel);
    this.root?.removeEventListener("pointerdown", this.onPointerDown);
    this.root?.removeEventListener("pointermove", this.onPointerMove);
    this.root?.removeEventListener("pointerup", this.onPointerUp);
    this.root?.remove();
    this.root = null;
    this.surface = null;
  }

  private render(): void {
    const root = this.root;
    if (!root) return;
    const layout = getMapInteractionOverlayLayout(this.camera);
    root.setAttribute("data-viewport-height", String(layout.height));
    root.setAttribute("data-viewport-width", String(layout.width));
    root.setAttribute("transform", layout.transform);
    root.replaceChildren(
      this.renderGeometryChannel("selection", this.state.selection),
      this.renderGeometryChannel("highlight", this.state.highlight),
      this.renderBrush(),
      this.renderHandles(layout.handleRadius)
    );
  }

  private renderGeometryChannel(
    channel: "highlight" | "selection",
    geometries: readonly MapInteractionGeometry[]
  ): SVGGElement {
    const group = document.createElementNS(SVG_NAMESPACE, "g");
    group.classList.add(`map-interaction-${channel}`);
    group.dataset.overlayChannel = channel;
    for (const geometry of geometries) group.append(renderGeometry(geometry, this.camera.scale));
    return group;
  }

  private renderBrush(): SVGGElement {
    const group = document.createElementNS(SVG_NAMESPACE, "g");
    group.classList.add("map-interaction-brush");
    group.dataset.overlayChannel = "brush";
    const brush = this.state.brush;
    if (!brush) return group;
    const circle = document.createElementNS(SVG_NAMESPACE, "circle");
    circle.setAttribute("cx", String(brush.center.x));
    circle.setAttribute("cy", String(brush.center.y));
    circle.setAttribute("r", String(Math.max(0, brush.radius)));
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    group.append(circle);
    return group;
  }

  private renderHandles(radius: number): SVGGElement {
    const group = document.createElementNS(SVG_NAMESPACE, "g");
    group.classList.add("map-interaction-handles");
    group.dataset.overlayChannel = "handles";
    for (const handle of this.state.handles) {
      const circle = document.createElementNS(SVG_NAMESPACE, "circle");
      circle.classList.add("map-interaction-handle");
      circle.dataset.handleId = String(handle.id);
      circle.setAttribute("aria-disabled", String(Boolean(handle.disabled)));
      circle.setAttribute("aria-label", handle.label);
      circle.setAttribute("cx", String(handle.point.x));
      circle.setAttribute("cy", String(handle.point.y));
      circle.setAttribute("r", String(radius));
      circle.setAttribute("role", "button");
      circle.setAttribute("tabindex", handle.disabled ? "-1" : "0");
      circle.setAttribute("vector-effect", "non-scaling-stroke");
      circle.style.pointerEvents = handle.disabled ? "none" : "all";
      circle.style.touchAction = "none";
      group.append(circle);
    }
    return group;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary || !this.surface) return;
    const element = (event.target as Element | null)?.closest<SVGCircleElement>(".map-interaction-handle");
    const handle = element && this.getHandle(element.dataset.handleId);
    if (!element || !handle || handle.disabled) return;

    const pointer = resolveMapInteractionPointer(
      { x: event.clientX, y: event.clientY },
      this.surface.getBoundingClientRect(),
      this.camera
    );
    this.activeHandle = {
      element,
      handleId: handle.id,
      offset: { x: handle.point.x - pointer.worldPoint.x, y: handle.point.y - pointer.worldPoint.y },
      pointerId: event.pointerId,
      pointerType: event.pointerType
    };
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    this.dispatchHandleEvent("start", handle.id, handle.point, event.pointerId, event.pointerType, "pointer");
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const active = this.activeHandle;
    if (!active || event.pointerId !== active.pointerId || !this.surface) return;
    const pointer = resolveMapInteractionPointer(
      { x: event.clientX, y: event.clientY },
      this.surface.getBoundingClientRect(),
      this.camera
    );
    const point = {
      x: pointer.worldPoint.x + active.offset.x,
      y: pointer.worldPoint.y + active.offset.y
    };
    this.setHandlePoint(active.handleId, point, active.element);
    event.preventDefault();
    event.stopPropagation();
    this.dispatchHandleEvent("move", active.handleId, point, event.pointerId, active.pointerType, "pointer");
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const active = this.activeHandle;
    if (!active || event.pointerId !== active.pointerId) return;
    const point = this.getHandle(active.handleId)?.point;
    if (point) this.dispatchHandleEvent("end", active.handleId, point, event.pointerId, active.pointerType, "pointer");
    this.releaseActiveHandle();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    const active = this.activeHandle;
    if (!active || event.pointerId !== active.pointerId) return;
    const point = this.getHandle(active.handleId)?.point;
    if (point)
      this.dispatchHandleEvent("cancel", active.handleId, point, event.pointerId, active.pointerType, "pointer");
    this.releaseActiveHandle();
    event.stopPropagation();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const element = (event.target as Element | null)?.closest<SVGCircleElement>(".map-interaction-handle");
    const handle = element && this.getHandle(element.dataset.handleId);
    if (!element || !handle || handle.disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.dispatchHandleEvent("activate", handle.id, handle.point, null, "keyboard", "keyboard");
      return;
    }

    const point = nudgeMapInteractionPoint(handle.point, event.key, this.camera, {
      fine: event.altKey,
      large: event.shiftKey
    });
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    this.dispatchHandleEvent("start", handle.id, handle.point, null, "keyboard", "keyboard");
    this.setHandlePoint(handle.id, point, element);
    this.dispatchHandleEvent("move", handle.id, point, null, "keyboard", "keyboard");
    this.dispatchHandleEvent("end", handle.id, point, null, "keyboard", "keyboard");
  };

  private getHandle(serializedId: number | string | undefined): MapInteractionHandle | undefined {
    if (serializedId === undefined) return undefined;
    return this.state.handles.find(handle => String(handle.id) === String(serializedId));
  }

  private setHandlePoint(handleId: number | string, point: ScreenPoint, element: SVGCircleElement): void {
    this.state.handles = this.state.handles.map(handle =>
      String(handle.id) === String(handleId) ? { ...handle, point } : handle
    );
    element.setAttribute("cx", String(point.x));
    element.setAttribute("cy", String(point.y));
  }

  private dispatchHandleEvent(
    phase: MapInteractionHandleEventDetail["phase"],
    handleId: number | string,
    worldPoint: ScreenPoint,
    pointerId: number | null,
    pointerType: string,
    source: MapInteractionHandleEventDetail["source"]
  ): void {
    this.root?.dispatchEvent(
      new CustomEvent<MapInteractionHandleEventDetail>(MAP_INTERACTION_HANDLE_EVENT, {
        bubbles: true,
        detail: {
          handleId,
          phase,
          pointerId,
          pointerType,
          screenPoint: worldToScreen(worldPoint, this.camera),
          source,
          worldPoint
        }
      })
    );
  }

  private releaseActiveHandle(): void {
    const active = this.activeHandle;
    this.activeHandle = null;
    if (active?.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
  }
}

export function getMapInteractionOverlayLayout(camera: MapCamera): MapInteractionOverlayLayout {
  const normalized = normalizeCamera(camera);
  return {
    handleRadius: HANDLE_RADIUS_PIXELS / normalized.scale,
    height: normalized.height,
    transform: `translate(${normalized.x} ${normalized.y}) scale(${normalized.scale})`,
    width: normalized.width
  };
}

export function resolveMapInteractionPointer(
  clientPoint: ScreenPoint,
  bounds: Pick<DOMRect, "left" | "top">,
  camera: MapCamera
): { screenPoint: ScreenPoint; worldPoint: ScreenPoint } {
  const screenPoint = clientToViewport(clientPoint, bounds);
  return { screenPoint, worldPoint: screenToWorld(screenPoint, camera) };
}

export function nudgeMapInteractionPoint(
  point: ScreenPoint,
  key: string,
  camera: MapCamera,
  modifiers: { fine?: boolean; large?: boolean } = {}
): ScreenPoint | null {
  const direction = {
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1]
  }[key];
  if (!direction) return null;
  const normalized = normalizeCamera(camera);
  const pixels = modifiers.large ? 10 : modifiers.fine ? 0.25 : 1;
  const step = pixels / normalized.scale;
  return { x: point.x + direction[0] * step, y: point.y + direction[1] * step };
}

function renderGeometry(geometry: MapInteractionGeometry, scale: number): SVGElement {
  const element = createGeometryElement(geometry, scale);
  element.dataset.overlayGeometry = geometry.kind;
  element.setAttribute("vector-effect", "non-scaling-stroke");
  applyGeometryStyle(element, geometry.style);
  return element;
}

function createGeometryElement(geometry: MapInteractionGeometry, scale: number): SVGElement {
  if (geometry.kind === "circle") {
    const circle = document.createElementNS(SVG_NAMESPACE, "circle");
    circle.setAttribute("cx", String(geometry.center.x));
    circle.setAttribute("cy", String(geometry.center.y));
    circle.setAttribute("r", String(Math.max(0, geometry.radius)));
    return circle;
  }
  if (geometry.kind === "bounds") {
    const rect = document.createElementNS(SVG_NAMESPACE, "rect");
    rect.setAttribute("height", String(Math.max(0, geometry.height)));
    rect.setAttribute("width", String(Math.max(0, geometry.width)));
    rect.setAttribute("x", String(geometry.x));
    rect.setAttribute("y", String(geometry.y));
    return rect;
  }
  if (geometry.kind === "path") {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", geometry.path);
    return path;
  }
  if (geometry.kind === "point") {
    const circle = document.createElementNS(SVG_NAMESPACE, "circle");
    circle.setAttribute("cx", String(geometry.point.x));
    circle.setAttribute("cy", String(geometry.point.y));
    circle.setAttribute("r", String(4 / Math.max(scale, 0.01)));
    return circle;
  }
  const element = document.createElementNS(SVG_NAMESPACE, geometry.kind);
  element.setAttribute("points", geometry.points.map(point => `${point.x},${point.y}`).join(" "));
  return element;
}

function applyGeometryStyle(element: SVGElement, style: MapInteractionGeometryStyle | undefined): void {
  if (!style) return;
  for (const [attribute, value] of [
    ["fill", style.fill],
    ["fill-opacity", style.fillOpacity],
    ["opacity", style.opacity],
    ["stroke", style.stroke],
    ["stroke-opacity", style.strokeOpacity],
    ["stroke-width", style.strokeWidth]
  ] as const) {
    if (value !== undefined) element.style.setProperty(attribute, String(value));
  }
}
