// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapEntities } from "@/components/map-entities";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => false } }));
vi.mock("@/components/tooltips", () => ({ tip: vi.fn(), showMainTip: vi.fn() }));
vi.mock("@/renderers/overlays/highlight", () => ({ highlightEmblemElement: vi.fn() }));

import { showNotes } from "./map-tooltip";

beforeEach(() => {
  document.body.innerHTML = `
    <svg id="map"><g id="viewbox"><g id="markers"><g id="marker0"><g><g><path/></g></g></g></g></g></svg>
    <div id="notes"><div id="notesHeader"></div><div id="notesBody"></div></div>
  `;
  globalThis.pack = { markers: [{ i: 0, name: "Old tower", note: "<p>A beacon</p>" }] } as typeof pack;
  globalThis.options = { app: { notesPinned: false } } as typeof options;
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
