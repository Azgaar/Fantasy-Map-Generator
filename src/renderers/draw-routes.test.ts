// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import type { Route } from "@/generators/routes-generator";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));

import "@/generators/styles";
import { drawRoutes, getRouteBox, redrawRoute, removeRoutes, setEditedRoute, setTempRoute } from "./draw-routes";

function route(i: number, x: number, group = "roads"): Route {
  return {
    i,
    group,
    feature: 1,
    points: [
      [x, 10, 1],
      [x + 40, 50, 2]
    ]
  };
}

const getPath = vi.fn(({ points }: { points: number[][] }) => `M${points.map(([x, y]) => `${x},${y}`).join("L")}`);

beforeEach(() => {
  mocks.layerOn = true;
  document.body.innerHTML = /* html */ `<svg id="map">
      <g id="routes"><g id="roads"></g><g id="trails"></g><g id="searoutes"></g></g>
    </svg>`;
  globalThis.pack = { routes: [route(1, 0), route(2, 500), route(3, 0, "trails")] } as never;
  globalThis.Routes = { getPath } as never;
  getPath.mockClear();
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  setEditedRoute(null);
  setTempRoute(null);
});

test("routes are materialized into their own group and culled on panning", () => {
  drawRoutes();
  expect(document.querySelector("#roads > #route1")).not.toBeNull();
  expect(document.querySelector("#trails > #route3")).not.toBeNull();
  expect(document.getElementById("route2")).toBeNull();
  expect(document.getElementById("routes")!.getAttribute("fill")).toBe("none");
  expect(document.getElementById("roads")!.dataset.group).toBe("roads");

  const first = document.getElementById("route1");
  ViewportLayers.renderNow();
  expect(document.getElementById("route1")).toBe(first);
  expect(getPath).toHaveBeenCalledTimes(3); // paths are built once, not per frame

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("route1")).toBeNull();
  expect(document.querySelector("#roads > #route2")?.getAttribute("d")).toBe("M500,10L540,50");
  expect(getPath).toHaveBeenCalledTimes(3);
});

test("the edited route stays rendered off-screen and follows a group change", () => {
  drawRoutes();
  setEditedRoute(2);
  expect(document.querySelector("#roads > #route2")).not.toBeNull();

  pack.routes[1].group = "searoutes";
  redrawRoute(pack.routes[1]);
  expect(document.querySelector("#roads > #route2")).toBeNull();
  expect(document.querySelector("#searoutes > #route2")).not.toBeNull();

  setEditedRoute(null);
  ViewportLayers.renderNow();
  expect(document.getElementById("route2")).toBeNull();
});

test("editing a visible route updates its path in place", () => {
  drawRoutes();
  const edited = document.getElementById("route1");
  pack.routes[0].points = [
    [0, 10, 1],
    [30, 30, 2]
  ];
  redrawRoute(pack.routes[0]);
  expect(document.getElementById("route1")).toBe(edited);
  expect(edited?.getAttribute("d")).toBe("M0,10L30,30");
});

test("the creator's temporary route renders in the selected group and never in an export", () => {
  drawRoutes();
  setTempRoute({
    group: "trails",
    points: [
      [0, 0, 1],
      [10, 10, 2]
    ]
  });
  expect(document.querySelector("#trails > #routeTemp")?.getAttribute("d")).toBe("M0,0L10,10");

  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelector("#routeTemp")).toBeNull();
  expect(clone.querySelectorAll("#routes path")).toHaveLength(3);

  setTempRoute(null);
  expect(document.getElementById("routeTemp")).toBeNull();
});

test("redraw picks up new paths and removed routes", () => {
  drawRoutes();
  pack.routes = [pack.routes[0]];
  drawRoutes();
  expect(document.querySelectorAll("#routes path")).toHaveLength(1);
  expect(getRouteBox(3)).toBeNull();

  const box = getRouteBox(1)!;
  expect(box.x).toBe(-0.7); // the course inflated by the group stroke width
  expect(box.width).toBeCloseTo(41.4);
});

test("erasing the layer keeps the groups, which carry the user's styles", () => {
  drawRoutes();
  removeRoutes();
  expect(document.querySelectorAll("#routes path")).toHaveLength(0);
  expect(document.querySelectorAll("#routes > g")).toHaveLength(3);

  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#routes path")).toHaveLength(0); // invalidated: nothing to reconcile against
  drawRoutes();
  expect(document.querySelectorAll("#routes path")).toHaveLength(2);
});

test("viewport rendering leaves a disabled layer empty", () => {
  drawRoutes();
  mocks.layerOn = false;
  document.getElementById("roads")!.replaceChildren(); // the layer registry erases the content when hidden
  ViewportLayers.renderNow();
  expect(document.getElementById("route1")).toBeNull();

  mocks.layerOn = true;
  ViewportLayers.renderNow();
  expect(document.getElementById("route1")).not.toBeNull();
});
