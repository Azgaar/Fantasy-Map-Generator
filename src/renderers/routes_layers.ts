import type { Route } from "../generators/routes-generator";
import { type Bounds, registerLayer, unregisterLayer } from "./layer_registry";

const svgNamespace = "http://www.w3.org/2000/svg";
const forcedRoutes = new Set<number>();
const forcedRouteGroups = new Map<number, string>();
const registeredGroups = new Set<string>();

export function syncRouteLayers(): void {
  const root = document.getElementById("routes");
  if (!(root instanceof SVGGElement)) return;
  root.setAttribute("fill", "none");

  const activeGroups = new Set([
    ...Array.from(root.children)
      .filter((child): child is SVGGElement => child instanceof SVGGElement)
      .map(group => group.id)
      .filter(Boolean),
    ...(pack.routes || []).map(route => route.group).filter(Boolean)
  ]);

  for (const groupName of activeGroups) registerRouteGroup(groupName);

  for (const groupName of registeredGroups) {
    if (activeGroups.has(groupName)) continue;
    unregisterLayer(`routes.${groupName}`);
    registeredGroups.delete(groupName);
  }
}

export function forceRoute(routeId: number): void {
  const route = pack.routes?.find(route => route.i === routeId);
  if (!route) return;

  const previousGroup = forcedRouteGroups.get(routeId);
  forcedRoutes.add(routeId);
  forcedRouteGroups.set(routeId, route.group);
  if (previousGroup && previousGroup !== route.group) registerRouteGroup(previousGroup);
  registerRouteGroup(route.group);
}

export function releaseRoute(routeId: number): void {
  const groupName = forcedRouteGroups.get(routeId);
  forcedRoutes.delete(routeId);
  forcedRouteGroups.delete(routeId);
  if (groupName) registerRouteGroup(groupName);
}

function registerRouteGroup(groupName: string): void {
  registeredGroups.add(groupName);
  const defaultScaleMin = getScaleMin(groupName);
  const hasForcedRoute = Array.from(forcedRouteGroups.values()).includes(groupName);

  registerLayer<Route>({
    id: `routes.${groupName}`,
    rootId: "routes",
    groupId: groupName,
    enabled: () => layerIsOn("toggleRoutes"),
    scaleMin: hasForcedRoute ? 1 : defaultScaleMin,
    getItems: getRoutes,
    filter: route => route.group === groupName,
    inViewport: (route, bounds) => isRouteInViewport(route, bounds, defaultScaleMin),
    render: renderRoutes
  });
}

function getRoutes(): Route[] {
  return (pack.routes || []).filter(route => route.points?.length >= 2);
}

function isRouteInViewport(route: Route, bounds: Bounds, defaultScaleMin: number): boolean {
  if (forcedRoutes.has(route.i)) return true;
  if (bounds.scale < defaultScaleMin) return false;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of route.points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }

  return x1 >= bounds.x0 && x0 <= bounds.x1 && y1 >= bounds.y0 && y0 <= bounds.y1;
}

function getScaleMin(groupName: string): number {
  return groupName === "trails" ? 3 : 1;
}

function renderRoutes(group: SVGGElement, routeList: Route[]): void {
  group.replaceChildren(
    ...routeList.map(route => {
      const existingPath = forcedRoutes.has(route.i) ? group.querySelector<SVGPathElement>(`#route${route.i}`) : null;
      const path = existingPath || document.createElementNS(svgNamespace, "path");
      path.id = `route${route.i}`;
      path.setAttribute("d", Routes.getPath(route));
      return path;
    })
  );
}

window.syncRouteLayers = syncRouteLayers;
window.forceViewportRoute = forceRoute;
window.releaseViewportRoute = releaseRoute;
