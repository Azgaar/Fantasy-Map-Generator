import { select } from "d3";
import type { Route } from "@/generators/routes-generator";
import { applyRouteLineStyle, routeTypeStyle } from "@/renderers/route-styles";
import { ensureEl } from "@/utils";

// Group line style is the style store's (Styles.write("routes") sets it on the group). The fork
// splits each group by route type into a sub-group so trunk roads, market roads and footpaths
// keep their own width and dash, styled from styles.routes.types; the built-in table only covers
// a type no preset knows.
function applyRouteTypeStyle(el: Element, type: string): void {
  el.setAttribute("data-type", type);
  applyRouteLineStyle(el, routeTypeStyle(type), styles.routes.types[type]?.attrs);
}

function removeTypeGroups(): void {
  for (const group of Array.from(document.querySelectorAll("#routes > g > g"))) group.remove();
}

export function drawRoutes(): void {
  TIME && console.time("drawRoutes");
  const typedPaths: Record<string, { group: string; type: string; paths: string[] }> = {};

  for (const route of pack.routes) {
    const { i, group, points } = route;
    if (!points || points.length < 2) continue;
    const type = route.type || "";
    const key = type ? `${group}/${type}` : group;
    if (!typedPaths[key]) typedPaths[key] = { group, type, paths: [] };
    typedPaths[key].paths.push(/* html */ `<path id="route${i}" d="${Routes.getPath(route)}"/>`);
  }

  const routes = select(ensureEl<SVGGElement>("routes"));
  routes.attr("fill", "none").selectAll("path").remove();
  removeTypeGroups();

  for (const key in typedPaths) {
    const { group, type, paths } = typedPaths[key];
    const groupEl = routes.select<SVGGElement>(`#${group}`);
    if (groupEl.empty()) continue;
    // custom groups from loaded maps miss the data-group the layer registry stamps on declared ones
    groupEl.attr("data-group", group);

    if (type) {
      const subGroup = groupEl.append("g").attr("id", type);
      applyRouteTypeStyle(subGroup.node()!, type);
      subGroup.html(paths.join(""));
    } else {
      groupEl.html(groupEl.html() + paths.join(""));
    }
  }

  TIME && console.timeEnd("drawRoutes");
}

/** drop the paths, keeping the route groups: they are user data carrying the group styles */
export function removeRoutes(): void {
  for (const path of Array.from(document.querySelectorAll("#routes path"))) path.remove();
  removeTypeGroups();
}

export function drawRoute(route: Route): void {
  const groupEl = select(ensureEl<SVGGElement>("routes")).select<SVGGElement>(`#${route.group}`);
  if (groupEl.empty()) return;

  const type = route.type || "";
  if (!type) {
    groupEl.append("path").attr("d", Routes.getPath(route)).attr("id", `route${route.i}`);
    return;
  }

  let subGroup = groupEl.select<SVGGElement>(`#${type}`);
  if (subGroup.empty()) {
    subGroup = groupEl.append("g").attr("id", type);
    applyRouteTypeStyle(subGroup.node()!, type);
  }
  subGroup.append("path").attr("d", Routes.getPath(route)).attr("id", `route${route.i}`);
}
