import { Layers } from "@/components/layers";
import type { Route } from "@/generators/routes-generator";
import { applyRouteLineStyle, routeTypeStyle } from "@/renderers/route-styles";
import {
  boundsIntersect,
  Scene,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";

interface RouteShape {
  id: string;
  group: string;
  type: string;
  path: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const scene = new Scene<RouteShape>();
const layer = ViewportLayers.register({ id: "routes", render: reconcileRoutes });
const rendered = new WeakMap<Element, RouteShape>();

let editedRouteId: string | null = null; // edited route is rendered even when off-screen
let tempRoute: RouteShape | null = null; // route being drawn in the Route Creator

// Group line style is the style store's (Styles.write("routes") sets it on the group). The fork
// splits each group by route type into a sub-group so trunk roads, market roads and footpaths
// keep their own width and dash; types have no place in the store, so they use the built-in table.
function applyRouteTypeStyle(el: Element, type: string): void {
  applyRouteLineStyle(el, routeTypeStyle(type), undefined);
}

export function drawRoutes(): void {
  TIME && console.time("drawRoutes");
  const shapes: RouteShape[] = [];
  for (const route of pack.routes) {
    const shape = buildShape(route);
    if (shape) shapes.push(shape);
  }
  scene.replace(shapes);
  layer.render();
  TIME && console.timeEnd("drawRoutes");
}

/** drop the paths, keeping the route groups: they are user data carrying the group styles */
export function removeRoutes(): void {
  scene.invalidate();
  for (const path of Array.from(document.querySelectorAll("#routes path"))) path.remove();
  for (const group of Array.from(document.querySelectorAll("#routes > g > g"))) group.remove();
}

/** Re-render a single edited route, keeping its element (and its editor handlers) in place */
export function redrawRoute(route: Route): void {
  const shape = buildShape(route);
  if (!shape || !scene.valid) return;
  scene.set(shape);
  layer.render();
}

/** Draw a route added after the layer was drawn (burgs generator, route editor) */
export function drawRoute(route: Route): void {
  redrawRoute(route);
}

/** Bounding box of the rendered route, available whether or not the route is currently materialized */
export function getRouteBox(routeId: number): DOMRect | null {
  const shape = scene.get(`route${routeId}`);
  return shape ? new DOMRect(shape.x0, shape.y0, shape.x1 - shape.x0, shape.y1 - shape.y0) : null;
}

export function setEditedRoute(routeId: number | null): void {
  editedRouteId = routeId === null ? null : `route${routeId}`;
  layer.render();
}

const TEMP_ID = "routeTemp";
export function setTempRoute(route: { group: string; points: number[][] } | null): void {
  tempRoute = route && route.points.length > 1 ? buildShape({ ...route, i: -1 } as Route, TEMP_ID) : null;
  layer.render();
}

function buildShape(route: Route, id = `route${route.i}`): RouteShape | null {
  const { group, points } = route;
  if (!points || points.length < 2) return null;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }

  const type = route.type || "";
  const padding = Math.max(
    styles.routes.groups[group]?.attrs["stroke-width"] ?? 1,
    routeTypeStyle(type)?.["stroke-width"] ?? 0
  );
  return {
    id,
    group,
    type,
    path: Routes.getPath(route),
    x0: x0 - padding,
    y0: y0 - padding,
    x1: x1 + padding,
    y1: y1 + padding
  };
}

function reconcileRoutes({ root, bounds }: ViewportRenderContext): void {
  if (!scene.valid || !Layers.isOn("routes")) return;
  const container = root.querySelector<SVGGElement>("#routes");
  if (!container) return;
  container.setAttribute("fill", "none");

  const visibleByGroup = new Map<string, RouteShape[]>();
  const show = (shape: RouteShape) => {
    const shapes = visibleByGroup.get(shape.group);
    if (shapes) shapes.push(shape);
    else visibleByGroup.set(shape.group, [shape]);
  };

  for (const shape of scene.values()) {
    if (shape.id === editedRouteId || boundsIntersect(shape, bounds)) show(shape);
  }
  if (tempRoute && root === document) show(tempRoute);

  for (const group of Array.from(container.querySelectorAll<SVGGElement>(":scope > g"))) {
    // custom groups from loaded maps miss the data-group the layer registry stamps on declared ones
    group.dataset.group = group.id;

    // untyped routes are direct children; each route type gets its own styled sub-group
    const byType = new Map<string, RouteShape[]>();
    for (const shape of visibleByGroup.get(group.id) ?? []) {
      const shapes = byType.get(shape.type);
      if (shapes) shapes.push(shape);
      else byType.set(shape.type, [shape]);
    }

    for (const subGroup of Array.from(group.querySelectorAll<SVGGElement>(":scope > g"))) {
      if (!byType.has(subGroup.id)) subGroup.remove();
    }

    reconcilePaths(group, byType.get("") ?? []);
    for (const [type, shapes] of byType) {
      if (!type) continue;
      let subGroup = group.querySelector<SVGGElement>(`:scope > g#${CSS.escape(type)}`);
      if (!subGroup) {
        subGroup = container.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
        subGroup.id = type;
        applyRouteTypeStyle(subGroup, type);
        group.appendChild(subGroup);
      }
      reconcilePaths(subGroup, shapes);
    }
  }
}

function reconcilePaths(parent: SVGGElement, shapes: RouteShape[]): void {
  const shapeIds = new Set(shapes.map(shape => shape.id));

  const elements = new Map<string, Element>();
  for (const child of Array.from(parent.querySelectorAll<SVGPathElement>(":scope > path"))) {
    if (shapeIds.has(child.id)) elements.set(child.id, child);
    else child.remove();
  }

  for (const shape of shapes) {
    let element = elements.get(shape.id);
    if (!element) {
      element = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
      element.id = shape.id;
      parent.appendChild(element);
    }
    if (rendered.get(element) !== shape) {
      element.setAttribute("d", shape.path);
      rendered.set(element, shape);
    }
  }
}
