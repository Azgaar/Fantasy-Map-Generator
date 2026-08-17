import { select } from "d3";
import type { Route } from "@/generators/routes-generator";
import { ensureEl } from "@/utils";

export function drawRoutes(): void {
  TIME && console.time("drawRoutes");
  const routePaths: Record<string, string[]> = {};

  for (const route of pack.routes) {
    const { i, group, points } = route;
    if (!points || points.length < 2) continue;
    if (!routePaths[group]) routePaths[group] = [];
    routePaths[group].push(/* html */ `<path id="route${i}" d="${Routes.getPath(route)}"/>`);
  }

  const routes = select(ensureEl<SVGGElement>("routes"));
  routes.attr("fill", "none").selectAll("path").remove();
  for (const group in routePaths) {
    routes.select(`#${group}`).html(routePaths[group].join(""));
  }

  TIME && console.timeEnd("drawRoutes");
}

/** drop the paths, keeping the route groups: they are user data carrying the group styles */
export function removeRoutes(): void {
  for (const path of Array.from(document.querySelectorAll("#routes path"))) path.remove();
}

export function drawRoute(route: Route): void {
  select(ensureEl<SVGGElement>("routes"))
    .select(`#${route.group}`)
    .append("path")
    .attr("d", Routes.getPath(route))
    .attr("id", `route${route.i}`);
}
