import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/generators/styles", () => ({ Styles: { writeAttr: vi.fn(), write: vi.fn() } }));
vi.mock("@/components/layers", () => ({ Layers: { draw: vi.fn() } }));
vi.mock("@/components/zoom", () => ({ invokeActiveZooming: vi.fn() }));

import { Layers } from "@/components/layers";
import { invokeActiveZooming } from "@/components/zoom";
import { Styles } from "@/generators/styles";
import type { StyleSelection } from "@/types/styles";
import { effectAt, runEffect } from "./effects";

const relief = { generate: vi.fn() };
vi.stubGlobal("Relief", relief);

const store = () => ({
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

const run = (path: string, value: unknown = 1, previous: unknown = 1, sel: Partial<StyleSelection> = {}) => {
  const [element] = path.split(".");
  const selection = { element, layer: element === "map" ? undefined : element, ...sel } as StyleSelection;
  runEffect({ sel: selection, path: path.split("."), value, previous });
};

const at = (path: string) => effectAt(path.split("."));

describe("effectAt", () => {
  test("the store convention: attrs write, options draw", () => {
    expect(at("rivers.attrs.fill")).toBe("write");
    expect(at("texture.options.x")).toBe("draw");
    expect(at("lakes.groups.freshwater.attrs.fill")).toBe("write");
    expect(at("emblems.groups.stateEmblems.options.size")).toBe("draw");
  });

  test("a declared effect: on the field, or on the nearest node above it", () => {
    expect(at("relief.options.size")).toBe("draw");
    expect(at("grid.attrs.stroke-width")).toBe("draw");
    expect(at("rulers.attrs.stroke-dasharray")).toBe("draw");
    expect(at("rulers.attrs.font-size")).toBe("draw");
    expect(at("states.groups.statesHalo.attrs.stroke-width")).toBe("zoom");
    expect(at("map.attrs.filter")).toBe("write");
    expect(at("ocean.groups.pattern.attrs.href")).toBe("write");
    expect(at("coordinates.attrs.font-size")).toBe("draw");
    expect(at("burgIcons.groups.town.groups.anchors.attrs.fill")).toBe("write");
    expect(at("burgIcons.groups.town.groups.anchors.options.icon")).toBe("draw");
    expect(at("scaleBar.groups.back.attrs.fill")).toBe("draw");
    expect(at("labels.groups.state.attrs.font-family")).toBe("draw");
    expect(at("labels.groups.state.attrs.fill")).toBe("write");
    expect(at("legend.attrs.font-family")).toBe("draw");
    expect(at("legend.attrs.stroke")).toBe("write");
    expect(at("legend.groups.box.attrs.fill")).toBe("draw"); // every shown box is redrawn from the store
    expect(at("vignette.options.rx")).toBe("draw");
  });
});

describe("runEffect", () => {
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
    run("ocean.groups.oceanWaves.attrs.stroke", "#000000");
    expect(Layers.draw).toHaveBeenCalledWith("ocean");
  });

  test("relief options reach the generator", () => {
    run("relief.options.set", "gray");
    run("relief.options.size", 2, 1); // a pure redraw: the size is a render multiplier, not data
    run("relief.options.density", 0.5);
    expect(relief.generate).toHaveBeenCalled();
    expect(Layers.draw).toHaveBeenCalledTimes(3);
    expect(Layers.draw).toHaveBeenCalledWith("relief");
  });

  test("a zoom-derived attr is written, then the zoom re-run; a vignette option redraws its layer", () => {
    run("states.groups.statesHalo.attrs.stroke-width", 12);
    expect(Styles.writeAttr).toHaveBeenCalledWith(["states", "groups", "statesHalo", "attrs", "stroke-width"]);
    expect(invokeActiveZooming).toHaveBeenCalled();
    run("vignette.options.rx", "5%");
    expect(Layers.draw).toHaveBeenCalledWith("vignette"); // the renderer's applier reshapes the defs mask
  });

  test("label typography is written, then the labels are laid out again; a paint attr only writes", () => {
    run("labels.groups.state.attrs.font-family", "Arial", "Georgia", { group: "state" });
    expect(Styles.writeAttr).toHaveBeenCalledWith(["labels", "groups", "state", "attrs", "font-family"]);
    expect(Layers.draw).toHaveBeenCalledWith("labels");
    vi.clearAllMocks();
    run("labels.groups.city.attrs.fill", "#000000", null, { group: "city" });
    expect(Styles.writeAttr).toHaveBeenCalledWith(["labels", "groups", "city", "attrs", "fill"]);
    expect(Layers.draw).not.toHaveBeenCalled();
  });

  test("scale bar and legend font redraw; a burg icon attr goes onto its group", () => {
    run("scaleBar.groups.back.attrs.fill", "#ffffff");
    expect(Styles.writeAttr).toHaveBeenCalledWith(["scaleBar", "groups", "back", "attrs", "fill"]);
    expect(Layers.draw).toHaveBeenCalledWith("scaleBar");
    run("legend.attrs.font-family", "Arial");
    expect(Layers.draw).toHaveBeenCalledWith("legend");
    vi.clearAllMocks();
    run("burgIcons.groups.town.groups.icons.attrs.fill", "#ffffff");
    expect(Styles.writeAttr).toHaveBeenCalledWith(["burgIcons", "groups", "town", "groups", "icons", "attrs", "fill"]);
    expect(Layers.draw).not.toHaveBeenCalled();
  });
});
