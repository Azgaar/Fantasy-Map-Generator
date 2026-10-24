// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

vi.mock("@/model/icons", () => ({
  Icons: { paint: () => ({ fill: "#000000", stroke: "#000000" }), html: () => "" }
}));
vi.mock("@/renderers/draw-markers", () => ({ drawMarkers: vi.fn(), setEditedMarker: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/ui/dialog/dialog-helpers", async importActual => ({
  noteButton: (await importActual<typeof import("@/ui/dialog/dialog-helpers")>()).noteButton,
  refreshEditors: vi.fn()
}));

import { Markers } from "@/model/story/markers-generator";
import { MarkersEditor } from "./markers-editor";

it("renames through Markers.rename, the same method the Assistant proposes", () => {
  document.body.innerHTML = '<div id="dialogs"></div><svg><svg id="marker4"></svg></svg>';
  options.app.mode = null;
  vi.stubGlobal("pack", { markers: [{ i: 4, name: "Old Well" }] });
  const rename = vi.fn();
  Object.assign(Markers, { rename });
  MarkersEditor.open(4);
  const input = document.getElementById("markerName") as HTMLInputElement;
  input.value = "Wishing Well";
  input.dispatchEvent(new Event("change"));
  expect(rename).toHaveBeenCalledWith(4, "Wishing Well");
});
