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
  "#burgIcons > g#capital", "#burgIcons > g#city", "#burgIcons > g#town",
  "#anchors > g#capital", "#anchors > g#city"
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

// drawScaleBar/fitScaleBar compute #scaleBar's transform and #scaleBarBack's width from the
// generated map's real-world distance-per-pixel scale, which varies map to map (a "nice" round
// distance for the bar) - content-derived layout, not a preset style attribute, so it's excluded
// from this generated-map comparison. The loaded-map spec above is unaffected: it snapshots a
// fixed saved file, where these values are already deterministic.
function stripContentDerivedLayout(snapshot: Record<string, Record<string, string>>) {
  delete snapshot["#scaleBar"]?.transform;
  delete snapshot["#scaleBarBack"]?.width;
}

// the spec above only exercises the load-a-saved-map path (load.ts replaces the whole #map SVG
// wholesale, bypassing applyStylePreset's DOM writes entirely). This covers the other path:
// applyStylePreset() applying a system preset to a freshly generated map. Style attributes are
// preset-driven, not seed-driven, so this is stable across random maps.
test("styled attributes on a freshly generated map match the preset-apply baseline", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const snapshot = await collectStyleSnapshot(page);
  stripContentDerivedLayout(snapshot);

  if (process.env.UPDATE_STYLE_BASELINE) {
    fs.writeFileSync(GENERATED_BASELINE_PATH, JSON.stringify(snapshot, null, 2));
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(GENERATED_BASELINE_PATH, "utf8"));
  for (const sel of Object.keys(baseline)) {
    expect.soft(snapshot[sel], sel).toEqual(baseline[sel]);
  }
});

// pins the style editor's write path contract (Task 8): setPresentation must land in both
// style.layers and the real DOM, for a plain layer, a routes child, and a labels group (which
// only exists as id="labels-<name>" data-group="<name>" - the data-group fallback in applyLayerStyle)
test("editor bridge writes reach style.layers, the DOM, and the labels legacy mirror", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    // `style`/`options` are script-scoped globals, not window properties - read them off the
    // lexical global rather than off window (same gotcha as getReliefState in load-map.spec.ts)
    const w = window as any;

    w.setPresentation({layerId: "rivers"}, "fill", "#123456");
    const riversStore = style.layers.rivers.presentation.fill;
    const riversDom = document.getElementById("rivers")?.getAttribute("fill");

    w.setPresentation({layerId: "routes", childIds: ["roads"]}, "stroke-width", "3.5");
    const roadsStore = style.layers.routes.children.roads.presentation["stroke-width"];
    const roadsDom = document.querySelector("#routes > g#roads")?.getAttribute("stroke-width");

    const groupName = options.labels.groups[0].name;
    w.setPresentation({layerId: "labels", childIds: [groupName]}, "opacity", "0.42");
    const labelsStore = style.layers.labels.children[groupName].presentation.opacity;
    const labelsDom = document.querySelector(`#labels [data-group="${groupName}"]`)?.getAttribute("opacity");
    w.projectLegacyStyleMirrors();
    const labelsMirror = style.labels.groups[groupName]?.opacity;

    return {riversStore, riversDom, roadsStore, roadsDom, labelsStore, labelsDom, labelsMirror};
  });

  expect(result.riversStore).toBe("#123456");
  expect(result.riversDom).toBe("#123456");
  expect(result.roadsStore).toBe("3.5");
  expect(result.roadsDom).toBe("3.5");
  expect(result.labelsStore).toBe("0.42");
  expect(result.labelsDom).toBe("0.42");
  expect(result.labelsMirror).toBe("0.42");
});
