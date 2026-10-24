// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapEntities } from "@/model/map-entities";

vi.mock("@/renderers/layers", () => ({ Layers: { isOn: vi.fn(() => false) } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), showMainTip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));
vi.mock("@/ui/map/highlight", () => ({ highlightEmblemElement: vi.fn() }));

import { Layers } from "@/renderers/layers";
import { tip } from "@/ui/tooltips";
import { showMapTooltip, showNotes } from "./map-tooltip";

beforeEach(() => {
  document.body.innerHTML = `
    <svg id="map"><g id="viewbox"><g id="markers"><g id="marker0"><g><g><path/></g></g></g></g><g id="cultures"><polygon id="cell1"/></g><g id="journeys"><g><g><path id="segment0_1"/></g></g></g><g id="labels"><g><g><text id="label1" data-label-type="state" data-id="1">Ovis</text></g></g></g></g></svg>
    <div id="notes"><div id="notesHeader"></div><div id="notesBody"></div></div>
  `;
  globalThis.pack = {
    markers: [{ i: 0, name: "Old tower", note: "<p>A beacon</p>" }],
    cells: {
      h: Uint8Array.from([0, 30]),
      culture: Uint16Array.from([0, 1]),
      state: Uint16Array.from([0, 0])
    },
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Quenian", ancestry: "Elfish" }
    ]
  } as typeof pack;
  globalThis.options = { app: { notesPinned: false }, map: {} } as typeof options;
  document.getElementById("map")!.addEventListener("mousemove", showNotes);
});

afterEach(() => {
  document.getElementById("map")!.dispatchEvent(new MouseEvent("mousemove"));
  vi.restoreAllMocks();
});

it("shows nested hover notes using shared references without computing geometry", () => {
  const points = vi.spyOn(MapEntities, "getPoints");
  document.querySelector("path")!.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  expect(document.getElementById("notesHeader")!.textContent).toBe("Old tower");
  expect(document.getElementById("notesBody")!.innerHTML).toBe("<p>A beacon</p>");
  expect(document.getElementById("notes")!.style.display).toBe("block");
  expect(points).not.toHaveBeenCalled();
});

it("shows culture tooltip with ancestry when populated", () => {
  vi.mocked(Layers.isOn).mockImplementation(layer => layer === "cultures");
  const cell = document.getElementById("cell1")!;
  const event = new MouseEvent("mousemove", { bubbles: true });
  cell.dispatchEvent(event);

  showMapTooltip([0, 0], { ...event, target: cell }, 1, 1);
  expect(tip).toHaveBeenCalledWith("Culture: Quenian (Elfish)");
});

it("shows culture tooltip without ancestry when empty", () => {
  vi.mocked(Layers.isOn).mockImplementation(layer => layer === "cultures");
  pack.cultures[1].ancestry = undefined;
  const cell = document.getElementById("cell1")!;
  const event = new MouseEvent("mousemove", { bubbles: true });
  cell.dispatchEvent(event);

  showMapTooltip([0, 0], { ...event, target: cell }, 1, 1);
  expect(tip).toHaveBeenCalledWith("Culture: Quenian");
});

it("escapes journey and segment names", () => {
  pack.journeys = [
    { i: 0, name: "<b>Quest</b>", segments: [{ i: 1, name: "<img src=x>", note: "" }] }
  ] as unknown as typeof pack.journeys;
  const segment = document.getElementById("segment0_1")!;
  const event = new MouseEvent("mousemove", { bubbles: true });
  segment.dispatchEvent(event);

  showMapTooltip([0, 0], { ...event, target: segment }, 1, 1);
  expect(tip).toHaveBeenCalledWith("&lt;b&gt;Quest&lt;/b&gt;: &lt;img src=x&gt;. Click to edit");
});

it.each([
  [false, "Ovis. Click to edit"],
  [true, "Ovis"]
])("hints a click on an editable element unless the map is view-only (%s)", (viewOnly, expected) => {
  options.map.viewOnly = viewOnly;
  const label = document.getElementById("label1")!;
  const event = new MouseEvent("mousemove", { bubbles: true });
  label.dispatchEvent(event);

  showMapTooltip([0, 0], { ...event, target: label }, 1, 1);
  expect(tip).toHaveBeenCalledWith(expected);
});
