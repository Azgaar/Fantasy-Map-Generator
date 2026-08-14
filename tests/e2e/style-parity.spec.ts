import {test, expect, type Page} from "@playwright/test";
import fs from "fs";
import path from "path";

const BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline.json");

// attributes that are styling (not content/geometry); id/class/transform-on-viewbox excluded
const STYLE_ATTRS = [
  "opacity", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
  "stroke-opacity", "filter", "mask", "font-size", "font-family", "letter-spacing", "shape-rendering",
  "data-size", "data-width", "data-x", "data-y", "data-columns", "data-href", "data-icon", "data-circle",
  "data-bar-size", "data-label", "data-top", "data-right", "data-bottom", "data-left", "data-filter",
  "set", "size", "density", "scheme", "terracing", "skip", "relax", "curve", "layers", "rescale",
  "type", "scale", "dx", "dy", "background-color", "box-size", "transform", "href", "x", "y",
  "width", "height", "rx", "ry", "style"
];

const TARGETS = [
  "#map", "#armies", "#anchors", "#biomes", "#borders", "#stateBorders", "#provinceBorders",
  "#burgIcons", "#cells", "#coastline", "#sea_island", "#lake_island", "#compass", "#coordinates",
  "#cults", "#emblems", "#stateEmblems", "#provinceEmblems", "#burgEmblems", "#fogging",
  "#goods", "#goodsCells", "#goodsIcons", "#goodsBurgs", "#gridOverlay", "#ice", "#labels",
  "#lakes", "#freshwater", "#salt", "#sinkhole", "#frozen", "#lava", "#dry", "#landmass",
  "#legend", "#markers", "#markets", "#oceanLayers", "#oceanBase", "#oceanicPattern",
  "#population", "#rural", "#urban", "#prec", "#provs", "#regions", "#statesBody", "#statesHalo",
  "#relig", "#rivers", "#routes", "#roads", "#trails", "#searoutes", "#ruler", "#scaleBar",
  "#scaleBarBack", "#temperature", "#terrain", "#terrs", "#landHeights", "#oceanHeights",
  "#texture", "#tradeAnimation", "#vignette", "#vignette-rect", "#zones"
];

function collectStyleSnapshot(page: Page) {
  return page.evaluate(
    ([targets, attrs]) => {
      const snapshot: Record<string, Record<string, string>> = {};
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const bag: Record<string, string> = {};
        for (const attr of attrs) {
          const value = el.getAttribute(attr);
          if (value !== null) bag[attr] = value;
        }
        snapshot[sel] = bag;
      }
      return snapshot;
    },
    [TARGETS, STYLE_ATTRS] as const
  );
}

test("styled attributes match the pre-migration baseline", async ({page}) => {
  await page.goto("/");
  await page.waitForSelector("#mapToLoad", {state: "attached"});
  await page.locator("#mapToLoad").setInputFiles(path.join(__dirname, "../fixtures/demo.map"));
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const snapshot = await collectStyleSnapshot(page);

  if (process.env.UPDATE_STYLE_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  // per-selector comparison => a failure names the exact layer and attribute
  for (const sel of Object.keys(baseline)) {
    expect.soft(snapshot[sel], sel).toEqual(baseline[sel]);
  }
});
