// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import defaults from "@/generators/default-styles.json";
import { drawOcean } from "./draw-ocean";

beforeEach(() => {
  document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">
    <defs id="deftemp"><path id="feature_1" d="M50,20H150V80H50Z" /></defs>
    <g id="oceanPattern"></g><g id="oceanLayers"></g><g id="oceanWaves"></g><g id="oceanBands"></g>
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

describe("coastal band rendering", () => {
  test("keeps the ocean pattern intact and uses transparent shading between the outlines", () => {
    styles.ocean.options.bands.render = true;
    drawOcean();
    expect(document.querySelector("#oceanPattern rect")?.getAttribute("fill")).toBe("url(#oceanic)");
    const shade = document.querySelector('#oceanBands rect[data-band="shade"]');
    expect(shade).not.toBeNull();
    expect(Number(shade?.getAttribute("fill-opacity"))).toBeGreaterThan(0);
    expect(Number(shade?.getAttribute("fill-opacity"))).toBeLessThan(1);
  });

  test.each(["waves", "lines"] as const)("keeps %s outside the bands plus the configured gap", type => {
    styles.ocean.options.bands.render = true;
    styles.ocean.oceanWaves.options.type = type;
    drawOcean();
    const halo = Number(document.querySelector('#waves-mask use[fill="black"]')?.getAttribute("stroke-width"));
    expect(halo).toBeCloseTo(2 * (8.8 + styles.ocean.oceanWaves.options.halo * grid.spacing));
    styles.ocean.options.bands.render = false;
    drawOcean();
    expect(Number(document.querySelector('#waves-mask use[fill="black"]')?.getAttribute("stroke-width"))).toBe(
      2 * styles.ocean.oceanWaves.options.halo * grid.spacing
    );
  });

  test("merges neighboring islands by painting all coasts at each width, excluding lakes", () => {
    styles.ocean.options.bands.render = true;
    pack.features.push({ ...pack.features[1], i: 3, subtype: "lake_island" });
    pack.features.push({ ...pack.features[1], i: 4, subtype: "island" });
    drawOcean();
    const strokes = Array.from(document.querySelectorAll("#coastal-bands-lines > g > g"));
    expect(strokes).toHaveLength(styles.ocean.options.bands.count * 2);
    for (const stroke of strokes) {
      expect(Array.from(stroke.children, use => use.getAttribute("href"))).toEqual(["#feature_1", "#feature_4"]);
    }
    const widths = strokes.map(stroke => Number(stroke.getAttribute("stroke-width")));
    expect(widths.every((width, i) => !i || width < widths[i - 1])).toBe(true);
    expect(document.querySelectorAll("#coastal-bands-mask use")).toHaveLength(3);
    expect(document.querySelector('#coastal-bands-mask use[href="#feature_2"]')).toBeNull();
    expect(document.querySelector("#oceanBands")?.getAttribute("mask")).toBe("url(#coastal-bands-mask)");
  });

  test("redraws deterministically and removes bands and their mask when disabled", () => {
    styles.ocean.options.bands.render = true;
    drawOcean();
    const first = document.querySelector("#oceanBands")!.innerHTML;
    drawOcean();
    expect(document.querySelector("#oceanBands")!.innerHTML).toBe(first);
    expect(document.querySelectorAll("#coastal-bands-mask")).toHaveLength(1);
    expect(document.querySelectorAll("#coastal-bands-lines, #coastal-bands-shade")).toHaveLength(2);
    styles.ocean.options.bands.render = false;
    drawOcean();
    expect(document.querySelector("#oceanBands")!.childElementCount).toBe(0);
    expect(document.getElementById("coastal-bands-mask")).toBeNull();
    expect(document.querySelectorAll("#coastal-bands-lines, #coastal-bands-shade")).toHaveLength(0);
    expect(document.querySelector("#oceanWaves path")).not.toBeNull();
  });

  test("changing the ocean updates the background without baking its color into the bands", () => {
    styles.ocean.options.bands.render = true;
    drawOcean();
    const bands = document.querySelector("#oceanBands")!.innerHTML;
    styles.ocean.base.attrs.fill = "#77705e";
    drawOcean();
    expect(document.querySelector("#oceanBase")?.getAttribute("fill")).toBe("#77705e");
    expect(document.querySelector("#oceanBands")!.innerHTML).toBe(bands);
  });

  test("supports outlines only and restores coastal waves when bands are invisible", () => {
    styles.ocean.options.bands.render = true;
    styles.ocean.options.bands.shade = 0;
    drawOcean();
    expect(document.querySelector('#oceanBands rect[data-band="shade"]')?.getAttribute("fill-opacity")).toBe("0");
    expect(document.querySelector('#oceanBands rect[mask="url(#coastal-bands-lines)"]')).not.toBeNull();
    styles.ocean.options.bands.opacity = 0;
    drawOcean();
    expect(Number(document.querySelector('#waves-mask use[fill="black"]')?.getAttribute("stroke-width"))).toBe(
      2 * styles.ocean.oceanWaves.options.halo * grid.spacing
    );
  });
});

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
