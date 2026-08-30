import {test, expect, type Page} from "@playwright/test";
import fs from "fs";
import path from "path";

const BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline.json");
const GENERATED_BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline-generated.json");

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

// the burg tiers, and the label groups, that both maps render (options.burgs.groups /
// options.labels): styling is per group, so each one is its own snapshot target
const BURG_GROUPS = [
  "capital", "city", "town", "village", "hamlet", "fort", "monastery", "caravanserai", "trading_post"
];
const LABEL_GROUPS = [...BURG_GROUPS, "state", "province", "river", "route", "added"];

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
  "#texture", "#tradeAnimation", "#vignette", "#vignette-rect", "#zones",
  // every burg-icon and anchor group type the two maps carry - the style tree addresses these
  // per group, so a partial list would let a whole group class drift unnoticed
  ...BURG_GROUPS.map(group => `#burgIcons > g#${group}`),
  ...BURG_GROUPS.map(group => `#anchors > g#${group}`),
  // label groups render as <g id="labels-capital" data-group="capital">; addressed by data-group
  // because that is what the group is keyed by everywhere but its element id
  ...LABEL_GROUPS.map(group => `#labels > [data-group="${group}"]`)
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

// drawScaleBar sizes #scaleBarBack from the getBBox() of the bar's rendered tick labels, and
// derives #scaleBar's transform from that width. Both are content-derived layout rather than
// preset style, and neither is stable enough to baseline: the width tracks text metrics, which
// differ between platforms, and on a generated map it also tracks the "nice" round distance the
// bar picks for that map's scale. Excluded from both comparisons below.
function stripContentDerivedLayout(snapshot: Record<string, Record<string, string>>) {
  delete snapshot["#scaleBar"]?.transform;
  delete snapshot["#scaleBarBack"]?.width;
}

test("styled attributes match the pre-migration baseline", async ({page}) => {
  await page.goto("/");
  await page.waitForSelector("#mapToLoad", {state: "attached"});
  // demo.map was renamed to 1.112.1.map on master (commit 7d2fc33c) - this is the current
  // stand-in for the round-1 harness's "demo.map" fixture
  await page.locator("#mapToLoad").setInputFiles(path.join(__dirname, "../fixtures/1.112.1.map"));
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  // burg icon, anchor and label groups render late - under full-suite load a fixed delay races the draw
  await page.waitForSelector("#burgIcons > g", {state: "attached", timeout: 120000});
  await page.waitForSelector("#anchors > g", {state: "attached", timeout: 120000});
  await page.waitForSelector("#labels > g", {state: "attached", timeout: 120000});
  await page.waitForTimeout(500);

  const snapshot = await collectStyleSnapshot(page);
  stripContentDerivedLayout(snapshot);

  if (process.env.UPDATE_STYLE_BASELINE) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  // the per-selector loop below iterates baseline keys, so on its own it cannot see a selector
  // that appeared or vanished. Compare the key sets first: an added group is a change too.
  expect(Object.keys(snapshot).sort()).toEqual(Object.keys(baseline).sort());
  // per-selector comparison => a failure names the exact layer and attribute
  for (const sel of Object.keys(baseline)) {
    expect.soft(snapshot[sel], sel).toEqual(baseline[sel]);
  }
});

// the spec above only exercises the load-a-saved-map path (load.ts replaces the whole #map SVG
// wholesale, bypassing applyStylePreset's DOM writes entirely). This covers the other path:
// applyStylePreset() applying a system preset to a freshly generated map. Style attributes are
// preset-driven, not seed-driven, so this is stable across random maps.
test("styled attributes on a freshly generated map match the preset-apply baseline", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForSelector("#burgIcons > g", {state: "attached", timeout: 120000});
  await page.waitForSelector("#anchors > g", {state: "attached", timeout: 120000});
  await page.waitForSelector("#labels > g", {state: "attached", timeout: 120000});
  await page.waitForTimeout(500);

  const snapshot = await collectStyleSnapshot(page);
  stripContentDerivedLayout(snapshot);

  if (process.env.UPDATE_STYLE_BASELINE) {
    fs.writeFileSync(GENERATED_BASELINE_PATH, JSON.stringify(snapshot, null, 2));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(GENERATED_BASELINE_PATH, "utf8"));
  expect(Object.keys(snapshot).sort()).toEqual(Object.keys(baseline).sort());
  for (const sel of Object.keys(baseline)) {
    expect.soft(snapshot[sel], sel).toEqual(baseline[sel]);
  }
});
