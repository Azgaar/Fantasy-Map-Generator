// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { RouteEditor, RegimentEditor, BurgEditor } = vi.hoisted(() => ({
  RouteEditor: { open: vi.fn() },
  RegimentEditor: { open: vi.fn() },
  BurgEditor: { open: vi.fn() }
}));

vi.mock("@/controllers", () => ({ Controllers: { RouteEditor, RegimentEditor, BurgEditor } }));
vi.mock("@/renderers/draw-legend", () => ({ dragLegendBox: vi.fn() }));
vi.mock("./map-placement", () => ({ isMapPlacementActive: () => false }));
vi.mock("./map-tooltip", () => ({ handleMouseMove: vi.fn() }));
vi.mock("./zoom", () => ({ applyZoomBehavior: vi.fn() }));

import { applyDefaultViewboxEvents } from "./viewbox-events";

const click = (id: string) => document.getElementById(id)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { customization: 0 });
  document.body.innerHTML = /* html */ `
    <svg id="map">
      <g id="viewbox">
        <g id="routes">
          <g id="trails"><g id="footpath"><path id="route7"/></g></g>
          <g id="traderoutes"><path id="route9"/></g>
        </g>
        <g id="armies"><g id="army3"><g id="regiment3-1"><rect id="regimentBox"/></g></g></g>
      </g>
      <g id="legend"></g>
    </svg>
  `;
  applyDefaultViewboxEvents();
});

describe("map click dispatch", () => {
  it("opens the route editor for a route nested in a type sub-group", () => {
    click("route7");
    expect(RouteEditor.open).toHaveBeenCalledWith("route7");
  });

  it("opens the route editor for a route sitting directly in its group", () => {
    click("route9");
    expect(RouteEditor.open).toHaveBeenCalledWith("route9");
  });

  it("passes the immediate parent to openers that need it", () => {
    click("regimentBox");
    expect(RegimentEditor.open).toHaveBeenCalledWith("#regiment3-1");
  });
});
