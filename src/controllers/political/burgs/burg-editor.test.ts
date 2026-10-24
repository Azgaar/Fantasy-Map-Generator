// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/renderers/layers", () => ({ Layers: { show: vi.fn() } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn(), loadingTip: { start: vi.fn(), end: vi.fn() } }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/renderers/draw-emblems", () => ({ removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/ui/dialog/dialog-helpers", async importActual => ({
  noteButton: (await importActual<typeof import("@/ui/dialog/dialog-helpers")>()).noteButton
}));

import { Production } from "@/model/economy/production-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Dialog } from "@/ui/dialog/dialog";
import { BurgEditor } from "./burg-editor";

const preview = "https://watabou.github.io/city-generator/?seed=1&size=55&preview=1";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("does not reparent a loaded preview when opening or closing the dialog", () => {
  document.body.innerHTML = '<div id="dialogs"></div><svg id="labels"></svg><svg id="burgIcons"></svg>';
  options.app.mode = null;
  vi.stubGlobal("grid", { cells: { temp: [20] } });
  vi.stubGlobal("pack", {
    burgs: [null, { i: 1, cell: 0, state: 0, name: "Polmabas", group: "city", population: 10 }],
    cells: { province: [0], g: [0], h: [30] },
    states: [{ name: "Neutrals" }],
    cultures: []
  });
  Object.assign(Burgs, { getPreview: () => ({ link: preview, preview }) });
  Object.assign(Production, { getBurgProduction: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

  const reparentedPreviews: string[] = [];
  const append = HTMLElement.prototype.append;
  vi.spyOn(HTMLElement.prototype, "append").mockImplementation(function (this: HTMLElement, ...nodes) {
    for (const node of nodes) {
      if (node instanceof HTMLElement && node.id === "burgEditor")
        reparentedPreviews.push(...Array.from(node.querySelectorAll("iframe"), frame => frame.src));
    }
    return append.apply(this, nodes);
  });

  BurgEditor.open(1);

  expect(reparentedPreviews).toEqual([]);
  expect(Dialog.isOpen("burgEditor")).toBe(true);
  expect(document.querySelector<HTMLInputElement>("#burgName")!.value).toBe("Polmabas");
  const frames = document.querySelectorAll<HTMLIFrameElement>(".dialog-window #burgPreviewObject iframe");
  expect(frames).toHaveLength(1);
  expect(frames[0].src).toBe(preview);

  Dialog.close("burgEditor");

  expect(reparentedPreviews).toEqual([]);
  expect(document.getElementById("burgEditor")).toBeNull();
});
