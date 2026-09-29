// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

vi.mock("@/components/icons", () => ({
  Icons: { paint: () => ({ fill: "#000000", stroke: "#000000" }), html: () => "" }
}));
vi.mock("@/renderers/draw-markers", () => ({ drawMarkers: vi.fn(), setEditedMarker: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/components/dialog/dialog-helpers", async importActual => ({
  noteButton: (await importActual<typeof import("@/components/dialog/dialog-helpers")>()).noteButton,
  closeDialogs: vi.fn(),
  confirmationDialog: vi.fn(),
  destroyDialog: vi.fn(),
  refreshEditors: vi.fn()
}));

import { MarkersEditor } from "./markers-editor";

it("renames through Markers.rename, the same method the Assistant proposes", () => {
  document.body.innerHTML = '<div id="dialogs"></div><svg><svg id="marker4"></svg></svg>';
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("pack", { markers: [{ i: 4, name: "Old Well" }] });
  vi.stubGlobal("$", () => ({ dialog: vi.fn() }));
  const rename = vi.fn();
  vi.stubGlobal("Markers", { rename });
  MarkersEditor.open(4);
  const input = document.getElementById("markerName") as HTMLInputElement;
  input.value = "Wishing Well";
  input.dispatchEvent(new Event("change"));
  expect(rename).toHaveBeenCalledWith(4, "Wishing Well");
});
