// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/renderers/layers", () => ({ Layers: { show: vi.fn() } }));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/renderers/draw-emblems", () => ({ removeEmblem: vi.fn() }));
vi.mock("@/renderers/emblems/renderer", () => ({ EmblemRenderer: { trigger: vi.fn() } }));
vi.mock("@/ui/dialog/dialog-helpers", async importActual => ({
  noteButton: (await importActual<typeof import("@/ui/dialog/dialog-helpers")>()).noteButton,
  closeDialogs: vi.fn(),
  confirmationDialog: vi.fn(),
  destroyDialog: vi.fn()
}));

import { BurgEditor } from "./burg-editor";

const preview = "https://watabou.github.io/city-generator/?seed=1&size=55&preview=1";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

it("does not reparent a loaded preview when opening or closing the dialog", () => {
  document.body.innerHTML = '<div id="dialogs"></div><svg id="labels"></svg><svg id="burgIcons"></svg>';
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("grid", { cells: { temp: [20] } });
  vi.stubGlobal("pack", {
    burgs: [null, { i: 1, cell: 0, state: 0, name: "Polmabas", group: "city", population: 10 }],
    cells: { province: [0], g: [0], h: [30] },
    states: [{ name: "Neutrals" }],
    cultures: []
  });
  vi.stubGlobal("Burgs", { getPreview: () => ({ link: preview, preview }) });
  vi.stubGlobal("Production", { getBurgProduction: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

  const reparentedPreviews: string[] = [];
  let visible = false;
  let close: (() => void) | undefined;
  const dialog = vi.fn((argument: { autoOpen?: boolean; close: () => void } | "open" | "destroy") => {
    const editor = document.getElementById("burgEditor")!;
    if (argument === "open") {
      visible = true;
      expect(editor.querySelector<HTMLInputElement>("#burgName")!.value).toBe("Polmabas");
    } else if (argument === "destroy") {
      reparentedPreviews.push(...Array.from(editor.querySelectorAll("iframe"), frame => frame.src));
      document.body.append(editor);
    } else {
      close = argument.close;
      reparentedPreviews.push(...Array.from(editor.querySelectorAll("iframe"), frame => frame.src));
      const wrapper = document.createElement("div");
      wrapper.className = "ui-dialog";
      document.body.append(wrapper);
      wrapper.append(editor);
      visible = argument.autoOpen !== false;
    }
  });
  vi.stubGlobal("$", () => ({ dialog }));

  BurgEditor.open(1);

  expect(reparentedPreviews).toEqual([]);
  expect(visible).toBe(true);
  const frames = document.querySelectorAll<HTMLIFrameElement>(".ui-dialog #burgPreviewObject iframe");
  expect(frames).toHaveLength(1);
  expect(frames[0].src).toBe(preview);

  close!();

  expect(reparentedPreviews).toEqual([]);
  expect(document.getElementById("burgEditor")).toBeNull();
});
