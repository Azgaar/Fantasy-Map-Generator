// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Layers } from "@/components/layers";
import { healLayerStyles } from "./heal-layer-styles";

const DAMAGED = "1.146.0";

const PRESET = {
  "#cults": { opacity: 0.6, stroke: "#777777", "stroke-width": 0.5, filter: null },
  "#searoutes": { opacity: 0.9, stroke: "#ffffff", "stroke-width": 0.35, mask: null },
  "#terrain": { opacity: 0.8, set: "simple", size: 1, density: 0.4 },
  "#fogging": { opacity: 0.98, fill: "#30426f" },
  "#terrs > #landHeights": { opacity: 1, scheme: "bright", mask: "url(#land)" }
};

const viewbox = (html: string) => {
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">${html}</g></svg>`;
};

const attrs = (id: string) => {
  const el = document.getElementById(id)!;
  return Object.fromEntries(Array.from(el.attributes, a => [a.name, a.value]));
};

beforeEach(() => {
  viewbox("");
  localStorage.clear();
  (globalThis as { getStylePreset?: unknown }).getStylePreset = vi.fn(async () => ["default", PRESET]);
});

describe("healLayerStyles", () => {
  it("restores the preset style of a bare layer group", async () => {
    viewbox(/* html */ `<g id="cults" style="display: none;"></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("cults")).toMatchObject({ opacity: "0.6", stroke: "#777777", "stroke-width": "0.5" });
  });

  it("restores the preset style of a bare declared child group", async () => {
    viewbox(/* html */ `<g id="routes"><g id="searoutes"></g></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("searoutes")).toMatchObject({ opacity: "0.9", stroke: "#ffffff", "stroke-width": "0.35" });
  });

  it("resolves a child group through its parent selector", async () => {
    viewbox(/* html */ `<g id="terrs"><g id="landHeights"></g></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("landHeights")).toMatchObject({ scheme: "bright", mask: "url(#land)" });
  });

  it("skips the attributes the preset nulls out", async () => {
    viewbox(/* html */ `<g id="cults"></g>`);

    await healLayerStyles(DAMAGED);

    expect(document.getElementById("cults")!.hasAttribute("filter")).toBe(false);
  });

  it("leaves a group that still has any style attribute alone", async () => {
    viewbox(/* html */ `<g id="cults" stroke="#123456"></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("cults")).toEqual({ id: "cults", stroke: "#123456" });
  });

  it("heals a group whose only attributes are the ones the registry declares", async () => {
    viewbox(/* html */ `<g id="fogging" mask="url(#fog)"></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("fogging")).toMatchObject({ opacity: "0.98", fill: "#30426f" });
  });

  it("does not write the relief options onto the terrain group", async () => {
    viewbox(/* html */ `<g id="terrain"></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("terrain")).toEqual({ id: "terrain", opacity: "0.8" });
  });

  it("leaves a bare group the preset says nothing about alone", async () => {
    viewbox(/* html */ `<g id="debug"></g>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("debug")).toEqual({ id: "debug" });
  });

  it("ignores an element that is not a group", async () => {
    viewbox(/* html */ `<rect id="cults"></rect>`);

    await healLayerStyles(DAMAGED);

    expect(attrs("cults")).toEqual({ id: "cults" });
  });

  it("redraws the layers it healed", async () => {
    viewbox(/* html */ `<g id="fogging" mask="url(#fog)"></g>`);
    const draw = vi.spyOn(Layers, "draw").mockImplementation(() => {});

    await healLayerStyles(DAMAGED);

    expect(draw).toHaveBeenCalledWith("fogging");
    draw.mockRestore();
  });

  it("does not redraw when it healed nothing", async () => {
    viewbox(/* html */ `<g id="cults" stroke="#123456"></g>`);
    const draw = vi.spyOn(Layers, "draw").mockImplementation(() => {});

    await healLayerStyles(DAMAGED);

    expect(draw).not.toHaveBeenCalled();
    draw.mockRestore();
  });

  it("uses the preset the user last selected", async () => {
    localStorage.setItem("presetStyle", "ancient");
    viewbox(/* html */ `<g id="cults"></g>`);

    await healLayerStyles(DAMAGED);

    expect((globalThis as unknown as { getStylePreset: unknown }).getStylePreset).toHaveBeenCalledWith("ancient");
  });

  it("survives a preset that cannot be loaded", async () => {
    (globalThis as { getStylePreset?: unknown }).getStylePreset = vi.fn(async () => {
      throw new Error("Cannot fetch style preset");
    });
    viewbox(/* html */ `<g id="cults"></g>`);

    await expect(healLayerStyles(DAMAGED)).resolves.toBeUndefined();
    expect(attrs("cults")).toEqual({ id: "cults" });
  });

  describe("version gate", () => {
    it("leaves maps saved before the cleanup shipped alone", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await healLayerStyles("1.144.0");

      expect(attrs("cults")).toEqual({ id: "cults" });
    });

    it("leaves maps saved after the cleanup was fixed alone", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await healLayerStyles("1.147.0");

      expect(attrs("cults")).toEqual({ id: "cults" });
    });

    it("heals the first version that could be damaged", async () => {
      viewbox(/* html */ `<g id="cults"></g>`);

      await healLayerStyles("1.145.0");

      expect(document.getElementById("cults")!.getAttribute("stroke")).toBe("#777777");
    });
  });
});
