import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/generators/styles", () => ({ Styles: { writeAttr: vi.fn(), write: vi.fn() } }));
vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/zoom", () => ({ invokeActiveZooming: vi.fn() }));
vi.mock("@/renderers/draw-ocean", () => ({ applyOceanPattern: vi.fn() }));
vi.mock("@/renderers/draw-vignette", () => ({ applyVignetteOptions: vi.fn() }));

import { Layers } from "@/components/layers";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import { applyOceanPattern } from "@/renderers/draw-ocean";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import { effectFor, type Selection } from "./effects";

const relief = { changeSet: vi.fn(), changeSize: vi.fn(), generate: vi.fn() };
vi.stubGlobal("Relief", relief);

const store = () => ({
  map: { attrs: { filter: null as string | null }, options: { dataFilter: null } },
  rulers: { attrs: { "stroke-dasharray": null as string | null } },
  states: { statesHalo: { attrs: { "stroke-width": 0 }, options: { width: 0 } } },
  military: { options: { fontSize: 0, boxSize: 0 } },
  labels: { groups: { state: { attrs: { "stroke-width": 0, "letter-spacing": 0 } } } }
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("styles", store());
  options.map.labels.groups = [
    { name: "state", type: "state" },
    { name: "city", type: "burg" }
  ] as typeof options.map.labels.groups;
});

const run = (path: string, value: unknown = 1, previous: unknown = 1, sel: Partial<Selection> = {}) => {
  const [element] = path.split(".");
  const selection = { element, layer: element === "map" ? undefined : element, ...sel } as Selection;
  effectFor(path.split("."))(selection, value, previous, path.split("."));
};

describe("effectFor", () => {
  test("an attr writes its one attribute, no redraw", () => {
    run("rivers.attrs.fill", "#123456");
    expect(Styles.writeAttr).toHaveBeenCalledWith(["rivers", "attrs", "fill"]);
    expect(Layers.draw).not.toHaveBeenCalled();
  });

  test("an option redraws the selection's layer, no write", () => {
    run("texture.options.x", 5);
    expect(Layers.draw).toHaveBeenCalledWith("texture");
    expect(Styles.writeAttr).not.toHaveBeenCalled();
  });

  test("grid, rulers and ocean waves bake their stroke: write and draw", () => {
    run("grid.attrs.stroke-width", 2);
    expect(Styles.writeAttr).toHaveBeenCalledWith(["grid", "attrs", "stroke-width"]);
    expect(Layers.draw).toHaveBeenCalledWith("grid");
    run("ocean.oceanWaves.attrs.stroke", "#000000");
    expect(Layers.draw).toHaveBeenCalledWith("ocean");
  });

  test("a cleared ruler dash means solid, not the default pattern", () => {
    run("rulers.attrs.stroke-dasharray", null);
    expect(styles.rulers.attrs["stroke-dasharray"]).toBe("none");
    expect(Layers.draw).toHaveBeenCalledWith("rulers");
  });

  test("relief options reach the generator", () => {
    run("relief.options.set", "gray");
    expect(relief.changeSet).toHaveBeenCalledWith("gray");
    run("relief.options.size", 2, 1);
    expect(relief.changeSize).toHaveBeenCalledWith(2);
    run("relief.options.density", 0.5);
    expect(relief.generate).toHaveBeenCalled();
    expect(Layers.draw).toHaveBeenCalledTimes(3);
    expect(Layers.draw).toHaveBeenCalledWith("relief");
  });

  test("markers rescale re-runs the zoom, the defs resources their appliers", () => {
    run("markers.options.rescale", 0);
    expect(invokeActiveZooming).toHaveBeenCalled();
    run("ocean.options.patternOpacity", 0.5);
    expect(applyOceanPattern).toHaveBeenCalled();
    run("vignette.options.rx", "5%");
    expect(applyVignetteOptions).toHaveBeenCalled();
    expect(Layers.draw).not.toHaveBeenCalled();
  });

  test("the map filter mirrors the option onto the hidden attr", () => {
    run("map.options.dataFilter", "sepia");
    expect(styles.map.attrs.filter).toBe("url(#filter-sepia)");
    expect(Styles.writeAttr).toHaveBeenCalledWith(["map", "attrs", "filter"]);
    run("map.options.dataFilter", null);
    expect(styles.map.attrs.filter).toBeNull();
  });

  test("label typography refits state labels only", () => {
    run("labels.groups.state.attrs.font-family", "Arial", "Georgia", { group: "state" });
    expect(Styles.writeAttr).toHaveBeenCalledWith(["labels", "groups", "state", "attrs", "font-family"]);
    expect(Layers.draw).toHaveBeenCalledWith("labels");
    vi.clearAllMocks();
    run("labels.groups.city.attrs.font-family", "Arial", "Georgia", { group: "city" });
    expect(Layers.draw).not.toHaveBeenCalled();
    run("labels.groups.city.attrs.fill", "#000000", null, { group: "city" });
    expect(Layers.draw).not.toHaveBeenCalled();
  });

  test("the halo width and the military box size keep their mirrored fields in step", () => {
    run("states.statesHalo.options.width", 5);
    expect(styles.states.statesHalo.attrs["stroke-width"]).toBe(5);
    expect(Styles.writeAttr).toHaveBeenCalledWith(["states", "statesHalo", "attrs", "stroke-width"]);
    run("military.options.boxSize", 4);
    expect(styles.military.options.fontSize).toBe(8);
    expect(Layers.draw).toHaveBeenCalledWith("military");
  });

  test("scale bar, legend font and emblem sizes redraw", () => {
    run("scaleBar.back.attrs.fill", "#ffffff");
    expect(Styles.writeAttr).toHaveBeenCalledWith(["scaleBar", "back", "attrs", "fill"]);
    run("scaleBar.options.barSize", 2);
    expect(Layers.draw).toHaveBeenCalledWith("scaleBar");
    run("legend.attrs.font-family", "Arial");
    expect(Layers.draw).toHaveBeenCalledWith("legend");
    run("emblems.stateEmblems.options.size", 2);
    expect(Layers.draw).toHaveBeenCalledWith("emblems");
    run("burgIcons.burgIcons.groups.town.attrs.fill", "#ffffff");
    expect(Layers.draw).toHaveBeenCalledWith("burgIcons");
  });
});
