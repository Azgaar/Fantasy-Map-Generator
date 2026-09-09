// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pins } from "@/components/pins";
import { setMapZoom, setZoomExtent } from "@/components/zoom";
import { Emblems } from "@/generators/emblems-generator";
import { toggleAssistant } from "@/services/assistant";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/zoom", () => ({
  constrainZoom: vi.fn(),
  setMapZoom: vi.fn(),
  setTranslateExtent: vi.fn(),
  setZoomExtent: vi.fn()
}));
vi.mock("@/components/canvas", () => ({
  applyZoomExtent: vi.fn(),
  fitMapToScreen: vi.fn(),
  setViewport: vi.fn()
}));
vi.mock("@/components/options/io-panes", () => ({
  showExportPane: vi.fn(),
  showLoadPane: vi.fn(),
  showSavePane: vi.fn()
}));
vi.mock("@/components/options/view-mode", () => ({ changeViewMode: vi.fn() }));
vi.mock("@/services/url-params", () => ({ copyMapURL: vi.fn() }));
vi.mock("@/services/assistant", () => ({ toggleAssistant: vi.fn() }));

let tab: typeof import("./options-tab");
const control = (key: string): HTMLInputElement => document.querySelector(`[data-option="${key}"]`)!;
const output = (key: string): HTMLOutputElement => document.querySelector(`[data-option-output="${key}"]`)!;
const edit = (input: HTMLInputElement, value: string, event = "input") => {
  input.value = value;
  input.dispatchEvent(new Event(event, { bubbles: true }));
};

beforeAll(async () => {
  vi.useFakeTimers();
  const html = readFileSync("src/index.html", "utf8");
  document.body.innerHTML = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
  document.body.insertAdjacentHTML("beforeend", '<div id="viewMode"></div>');
  vi.stubGlobal("$", () => ({ draggable: vi.fn(), disableSelection: vi.fn() }));
  vi.stubGlobal("pack", { cells: {}, cultures: [], states: [], provinces: [], burgs: [] });
  vi.stubGlobal("styles", { labels: { groups: { capital: { attrs: {} }, states: { attrs: {} } } } });
  await import("@/components/shared/slider-input");
  await import("./customization-tab");
  tab = await import("./options-tab");
  await import("@/components/options/options-panel");

  // Exercise the actual markup and listeners without relying on any option control ID.
  for (const [index, input] of document.querySelectorAll<HTMLElement>("[data-option]").entries()) {
    input.id = `renamed-control-${index}`;
  }
});

beforeEach(() => {
  localStorage.clear();
  options = Options.getDefaultOptions();
  tab.syncOptionInputs();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("options tab bindings", () => {
  it("syncs replacement options and derived readouts after control IDs change", () => {
    options.generation.graph.density = 5;
    options.generation.burgs.limit = 123;
    options.generation.cultures.limit = 7;
    options.generation.template = "volcano";
    options.app.autosave.interval = 27;
    tab.syncOptionInputs();

    expect(control("points").value).toBe("5");
    expect(output("points").value).toBe("20K");
    expect(output("manors").value).toBe("123");
    expect(control("template").value).toBe("volcano");
    expect([...document.querySelectorAll<HTMLInputElement>('[data-option="cultures"]')].map(el => el.value)).toEqual([
      "7",
      "7"
    ]);
    expect(control("autosaveInterval").value).toBe("27");
  });

  it("pairs controls by binding without overwriting an unrelated draft", () => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-option="autosaveInterval"]');
    control("mapWidth").value = "777";
    edit(inputs[1], "23");

    expect(options.app.autosave.interval).toBe(23);
    expect(inputs[0].value).toBe("23");
    expect(control("mapWidth").value).toBe("777");
    expect(Pins.all()).toEqual({});
    inputs[1].dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(localStorage.getItem("fmg-options")!).app.autosave.interval).toBe(23);
  });

  it("writes and pins the heightmap controls outside the tab", () => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-option="resolveDepressionsSteps"]');
    edit(inputs[1], "300", "change");

    expect(options.generation.resolveDepressionsSteps).toBe(300);
    expect(inputs[0].value).toBe("300");
    expect(Pins.valueOr("resolveDepressionsSteps", 0)).toBe(300);
  });

  it("handles the slider's forwarded event once and persists its final value", () => {
    const set = vi.spyOn(Options, "set");
    const slider = control("statesNumber");
    const range = slider.querySelector<HTMLInputElement>('input[type="range"]')!;
    edit(range, "30");
    range.dispatchEvent(new Event("change", { bubbles: true }));

    expect(set).toHaveBeenCalledTimes(1);
    expect(options.generation.states.limit).toBe(30);
    expect(Pins.valueOr("statesNumber", 0)).toBe(30);
    expect(slider.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("30");
    expect(JSON.parse(localStorage.getItem("fmg-options")!).generation.states.limit).toBe(30);
  });

  it("applies select effects once, after updating the preference", () => {
    vi.mocked(toggleAssistant).mockImplementation(() => {
      expect(options.app.ui.assistant).toBe("hide");
    });
    edit(control("azgaarAssistant"), "hide");
    control("azgaarAssistant").dispatchEvent(new Event("change", { bubbles: true }));
    expect(toggleAssistant).toHaveBeenCalledExactlyOnceWith(false);
    expect(Pins.all()).toEqual({});
  });

  it("reshapes emblems once per selection", () => {
    const shape = vi.spyOn(Emblems, "setShape");
    edit(control("emblemShape"), "heater");
    control("emblemShape").dispatchEvent(new Event("change", { bubbles: true }));
    expect(shape).toHaveBeenCalledExactlyOnceWith("heater");
    expect(options.app.emblems.shape).toBe("heater");
  });

  it("keeps linked growth rates and culture limits synchronized", () => {
    edit(control("growthRate"), "1.5");
    expect(options.generation.states.growthRate).toBe(1.5);
    expect(options.generation.cultures.growthRate).toBe(1.5);
    expect(Pins.valueOr("growthRate", 0)).toBe(1.5);

    options.generation.cultures.limit = 30;
    edit(control("culturesSet"), "english");
    expect(options.generation.cultures.limit).toBe(10);
    for (const input of document.querySelectorAll<HTMLInputElement>('[data-option="cultures"]')) {
      expect(input.max).toBe("10");
      expect(input.value).toBe("10");
    }
  });

  it("preserves the automatic burg readout alongside the legacy panel listener", () => {
    edit(control("manors"), "400");
    expect(output("manors").value).toBe("400");
    edit(control("manors"), "1000");
    expect(output("manors").value).toBe("auto");
    expect(Pins.valueOr("manors", 0)).toBe(1000);
  });

  it("commits map dimensions together on change, leaving the current map intact", () => {
    const graph = { ...options.map.graph };
    edit(control("mapWidth"), "100");
    control("mapHeight").value = "600";
    expect(options.generation.graph.width).toBe(1280);
    expect(Pins.has("mapWidth")).toBe(false);

    control("mapWidth").dispatchEvent(new Event("change", { bubbles: true }));
    expect(options.generation.graph.width).toBe(240);
    expect(options.generation.graph.height).toBe(600);
    expect(Pins.valueOr("mapWidth", 0)).toBe(240);
    expect(Pins.valueOr("mapHeight", 0)).toBe(600);
    expect(options.map.graph).toEqual(graph);
  });

  it("normalizes zoom endpoints together on change", () => {
    control("zoomExtentMax").value = "10";
    edit(control("zoomExtentMin"), "15");
    expect(options.app.zoomExtent).toEqual({ min: 1, max: 20 });
    control("zoomExtentMin").dispatchEvent(new Event("change", { bubbles: true }));

    expect(options.app.zoomExtent).toEqual({ min: 10, max: 15 });
    expect(control("zoomExtentMin").value).toBe("10");
    expect(control("zoomExtentMax").value).toBe("15");
    expect(setZoomExtent).toHaveBeenCalledExactlyOnceWith(10, 15);
    expect(setMapZoom).toHaveBeenCalledExactlyOnceWith(15);
  });

  it("keeps theme controls and the displayed palette consistent", () => {
    edit(control("themeColor"), "#336699");
    edit(control("transparency"), "30");
    expect(options.app.ui.themeColor).toBe("#336699");
    expect(options.app.ui.transparency).toBe(30);
    expect(control("themeHue").value).toBe("210");
    expect(document.documentElement.style.getPropertyValue("--bg-opacity")).toBe("0.7");
  });

  it("still pairs unbound legacy controls by ID", () => {
    const input = document.getElementById("pngResolutionInput") as HTMLInputElement;
    edit(input, "3");
    expect((document.getElementById("pngResolutionOutput") as HTMLInputElement).value).toBe("3");
  });

  it("reads lock values from the binding config", () => {
    tab.restoreUi();
    options.generation.states.limit = 42;
    document.getElementById("lock_statesNumber")!.click();
    expect(Pins.valueOr("statesNumber", 0)).toBe(42);
  });
});
