// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import defaults from "@/generators/default-styles.json";
import { drawOcean } from "./draw-ocean";

beforeEach(() => {
  document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">
    <defs id="deftemp"><path id="feature_1" d="M50,20H150V80H50Z" /></defs>
    <g id="oceanPattern"></g><g id="oceanLayers"></g><g id="oceanWaves"></g>
  </svg>`;
  const styles = structuredClone(defaults);
  styles.ocean.oceanLayers.options.outline = "none";
  styles.ocean.oceanWaves.options.render = true;
  vi.stubGlobal("styles", styles);
  vi.stubGlobal("options", { map: { graph: { width: 200, height: 100 }, seed: "coast" } });
  const cellsX = 25;
  const cellsY = 13;
  const h = Array.from({ length: cellsX * cellsY }, (_, i) => {
    const x = (i % cellsX) * 8 + 4;
    const y = Math.floor(i / cellsX) * 8 + 4;
    return x >= 50 && x <= 150 && y >= 20 && y <= 80 ? 30 : 10;
  });
  const c = h.map((_, i) =>
    [i - cellsX, i + cellsX, ...(i % cellsX ? [i - 1] : []), ...(i % cellsX < cellsX - 1 ? [i + 1] : [])].filter(
      next => next >= 0 && next < h.length
    )
  );
  vi.stubGlobal("grid", {
    spacing: 8,
    cellsX,
    cellsY,
    cells: { h, c, f: h.map(() => 0) },
    features: [{ type: "ocean" }]
  });
  vi.stubGlobal("pack", {
    features: [
      { i: 0, type: "ocean", land: false },
      { i: 1, type: "island", land: true },
      { i: 2, type: "lake", land: false }
    ]
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("coastal wave rendering", () => {
  test("clips sparse strokes to water without expensive SVG filters", () => {
    drawOcean();
    const mask = document.querySelector("#waves-mask")!;
    expect(mask.getAttribute("maskUnits")).toBe("userSpaceOnUse");
    expect(mask.querySelectorAll('use[href="#feature_2"]')).toHaveLength(0);
    expect(mask.querySelector('use[fill="black"]')?.getAttribute("href")).toBe("#feature_1");
    expect(document.querySelectorAll("#waves-fade, #waves-mask filter")).toHaveLength(0);
    expect(document.querySelectorAll("#oceanWaves path")).toHaveLength(1);
    expect(document.querySelector("#oceanWaves path")?.getAttribute("stroke-dasharray")).toBeNull();
  });

  test("redraws without duplicate resources and cleans up when disabled", () => {
    drawOcean();
    const first = document.querySelector("#oceanWaves")!.innerHTML;
    drawOcean();
    expect(document.querySelector("#oceanWaves")!.innerHTML).toBe(first);
    expect(document.querySelectorAll("#waves-mask")).toHaveLength(1);
    expect(document.querySelectorAll("#waves-fade")).toHaveLength(0);
    styles.ocean.oceanWaves.options.render = false;
    drawOcean();
    expect(document.querySelector("#oceanWaves")!.childElementCount).toBe(0);
    expect(document.querySelectorAll("#waves-mask, #waves-fade")).toHaveLength(0);
    expect(document.querySelector("#oceanBase")).not.toBeNull();
  });

  test("reach changes the dashes and coastal gap changes only the clipping mask", () => {
    drawOcean();
    const first = document.querySelector("#oceanWaves")!.innerHTML;
    styles.ocean.oceanWaves.options.reach = 8;
    drawOcean();
    const wider = document.querySelector("#oceanWaves")!.innerHTML;
    expect(wider).not.toBe(first);
    styles.ocean.oceanWaves.options.halo = 0.5;
    drawOcean();
    expect(document.querySelector("#oceanWaves")!.innerHTML).toBe(wider);
    expect(document.querySelector('#waves-mask use[fill="black"]')?.getAttribute("stroke-width")).toBe("8");
  });

  test("passes a configured dash pattern to the embellishment stroke", () => {
    styles.ocean.oceanWaves.attrs["stroke-dasharray"] = "3 2";
    styles.ocean.oceanWaves.attrs["stroke-width"] = 1.25;
    drawOcean();
    expect(document.querySelector("#oceanWaves path")?.getAttribute("stroke-dasharray")).toBe("3 2");
    expect(document.querySelector("#oceanWaves path")?.getAttribute("stroke-width")).toBe("1.25");
  });
});
