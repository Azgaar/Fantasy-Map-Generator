// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layers } from "@/components/layers";
import {
  applyPerformancePreset,
  applyPerformanceSettings,
  PERFORMANCE_PRESETS,
  resolvePerformancePreset,
  setPerformanceSetting
} from "./performance";

vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  options = Options.getDefaultOptions();
  vi.stubGlobal("pack", { cells: {} });
  document.body.innerHTML = /* html */ `<svg><g id="viewbox"><g id="statesHalo"></g></g></svg>`;
  vi.mocked(Layers.draw).mockClear();
});

describe("presets", () => {
  it("names the settings a fresh browser has", () => {
    expect(resolvePerformancePreset(options.app.performance)).toBe("balance");
  });

  it("is derived from the fields, so one changed field makes it custom", () => {
    setPerformanceSetting("stateHalos", true);
    expect(resolvePerformancePreset(options.app.performance)).toBe("custom");
    expect("preset" in options.app.performance).toBe(false);
  });

  it("writes every field a preset names", () => {
    applyPerformancePreset("quality");
    expect(options.app.performance).toEqual(PERFORMANCE_PRESETS.quality);
    expect(resolvePerformancePreset(options.app.performance)).toBe("quality");
  });

  it("ignores a name that is not a preset", () => {
    applyPerformancePreset("custom");
    expect(options.app.performance).toEqual(PERFORMANCE_PRESETS.balance);
  });
});

describe("applying to the map", () => {
  it("puts the shape-rendering hint on the viewbox", () => {
    setPerformanceSetting("shapeRendering", "crispEdges");
    expect(document.getElementById("viewbox")!.getAttribute("shape-rendering")).toBe("crispEdges");
  });

  it("draws the halos once they are wanted and none exist, and hides them otherwise", () => {
    const halo = document.getElementById("statesHalo")!;

    setPerformanceSetting("stateHalos", true);
    expect(halo.style.display).toBe("");
    expect(Layers.draw).toHaveBeenCalledWith("states");

    halo.innerHTML = "<path/>";
    vi.mocked(Layers.draw).mockClear();
    applyPerformanceSettings();
    expect(Layers.draw).not.toHaveBeenCalled();

    setPerformanceSetting("stateHalos", false);
    expect(halo.style.display).toBe("none");
  });
});
