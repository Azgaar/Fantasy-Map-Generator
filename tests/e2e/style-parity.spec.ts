import {test, expect, type Page} from "@playwright/test";
import fs from "fs";
import path from "path";

const BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline.json");
const GENERATED_BASELINE_PATH = path.join(__dirname, "../fixtures/style-baseline-generated.json");
const STYLES_DIR = path.join(__dirname, "../../public/styles");

// reads the shipped preset JSON directly (node side, not the browser) so preset-switch
// assertions pin the actual value a preset carries rather than just "differs from before" -
// self-updating if a preset is retuned, and catches a wrong-preset-applied bug that "differs
// from before"-only assertions would miss
function loadPresetStyle(presetName: string) {
  return JSON.parse(fs.readFileSync(path.join(STYLES_DIR, `${presetName}.json`), "utf8"));
}

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

    w.setPresentation({layerId: "regions", childIds: ["statesHalo"]}, "opacity", "0.77");
    const statesHaloStore = style.layers.regions.children.statesHalo.presentation.opacity;
    const statesHaloDom = document.querySelector("#regions > g#statesHalo")?.getAttribute("opacity");

    return {
      riversStore, riversDom, roadsStore, roadsDom, labelsStore, labelsDom, labelsMirror,
      statesHaloStore, statesHaloDom
    };
  });

  expect(result.riversStore).toBe("#123456");
  expect(result.riversDom).toBe("#123456");
  expect(result.roadsStore).toBe("3.5");
  expect(result.roadsDom).toBe("3.5");
  expect(result.labelsStore).toBe("0.42");
  expect(result.labelsDom).toBe("0.42");
  expect(result.labelsMirror).toBe("0.42");
  expect(result.statesHaloStore).toBe("0.77");
  expect(result.statesHaloDom).toBe("0.77");
});

// Task 12: burg icon groups are no longer round-tripped through the DOM (createIconGroups used
// to harvest the live attributes before recreating the groups) - they are built from
// style.layers.burgIcons/anchors. Pins that every burg group still gets its icon and anchor
// group, in configured order, carrying the store's presentation attrs and its size option
test("burg icon and anchor groups are created from style.layers", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const expectedOrder = [...options.burgs.groups].sort((a: any, b: any) => a.order - b.order).map(g => g.name);
    const readGroups = (layerId: "burgIcons" | "anchors") => {
      const children = (style as any).layers[layerId].children;
      return Array.from(document.querySelectorAll(`#${layerId} > g`)).map(el => {
        const node = children[el.id] ?? {};
        return {
          id: el.id,
          fontSize: el.getAttribute("font-size"),
          expectedFontSize: node.options?.size === undefined ? null : String(node.options.size),
          fill: el.getAttribute("fill"),
          expectedFill: node.presentation?.fill ?? null,
          icon: el.getAttribute("data-icon"),
          expectedIcon: node.presentation?.["data-icon"] ?? null
        };
      });
    };

    return {expectedOrder, burgIcons: readGroups("burgIcons"), anchors: readGroups("anchors")};
  });

  expect(result.burgIcons.map(g => g.id)).toEqual(result.expectedOrder);
  expect(result.anchors.map(g => g.id)).toEqual(result.expectedOrder);

  for (const group of [...result.burgIcons, ...result.anchors]) {
    expect.soft(group.fontSize, `${group.id} font-size`).toBe(group.expectedFontSize);
    expect.soft(group.fill, `${group.id} fill`).toBe(group.expectedFill);
    expect.soft(group.icon, `${group.id} data-icon`).toBe(group.expectedIcon);
  }
  // the default preset styles every default burg group, so the assertions above are not vacuous
  expect(result.burgIcons.every(g => g.expectedFill && g.expectedFontSize)).toBe(true);
});

// Task 10 fix-round regression (C1): openCreateHeightmapSchemeButton's click handler read
// getEl().attr("scheme") - always null after the terrs migration stripped the DOM attribute -
// which threw inside scheme.startsWith(...) before the dialog ever rendered. Simulates the click
// with the terrs/landHeights element selected (matching how the style editor drives the handler)
// and asserts it no longer throws and seeds a real color-stop list from the stored scheme.
test("create custom heightmap scheme dialog opens without throwing", async ({page}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  // exceptions thrown inside an addEventListener handler don't propagate to element.click()'s
  // caller - they surface as an uncaught page error instead, so that's what has to be asserted
  const pageErrors: string[] = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  const result = await page.evaluate(() => {
    const w = window as any;
    const elementSelect = document.getElementById("styleElementSelect") as HTMLSelectElement;
    const groupSelect = document.getElementById("styleGroupSelect") as HTMLSelectElement;
    const button = document.getElementById("openCreateHeightmapSchemeButton") as HTMLButtonElement;

    elementSelect.value = "terrs";
    elementSelect.dispatchEvent(new Event("change"));
    groupSelect.value = "landHeights";
    groupSelect.dispatchEvent(new Event("change"));

    button.click();

    return {
      stops: button.dataset.stops,
      storedScheme: w.getLayerOptions("terrs", "landHeights").scheme
    };
  });

  expect(pageErrors).toEqual([]);
  expect(result.stops).toBeTruthy();
  expect(result.stops!.split(",").length).toBeGreaterThan(1);
  expect(result.storedScheme).toBeTruthy();
});

// proves the preset-dropdown path (not the direct editor writes above) reaches child layers.
// requestStylePresetChange -> changeStyle -> applyStyleWithUiRefresh(style) is the real call
// chain the dropdown's onchange handler drives; applyStyleWithUiRefresh itself takes a parsed
// style OBJECT, not a preset name, so changeStyle (which fetches + names it) is the right entry
// point to call from a test, not applyStyleWithUiRefresh("night") directly.
test("switching system presets restyles routes/borders/lakes/terrs/label children on store+DOM, and reverts cleanly", async ({
  page
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  // the dynamic label group name is only known in the browser; fetch it first so the node side
  // can pin the exact preset-file value to expect for that group below
  const groupName: string = await page.evaluate(() => (options as any).labels.groups[0].name);

  const nightPreset = loadPresetStyle("night");
  const defaultPreset = loadPresetStyle("default");
  const expected = {
    night: {
      roads: nightPreset.layers.routes.children.roads.presentation.stroke,
      stateBorders: nightPreset.layers.borders.children.stateBorders.presentation.stroke,
      freshwater: nightPreset.layers.lakes.children.freshwater.presentation.fill,
      landHeightsScheme: nightPreset.layers.terrs.children.landHeights.options.scheme,
      label: nightPreset.layers.labels.children[groupName]?.presentation.fill
    },
    default: {
      roads: defaultPreset.layers.routes.children.roads.presentation.stroke,
      stateBorders: defaultPreset.layers.borders.children.stateBorders.presentation.stroke,
      freshwater: defaultPreset.layers.lakes.children.freshwater.presentation.fill,
      landHeightsScheme: defaultPreset.layers.terrs.children.landHeights.options.scheme,
      label: defaultPreset.layers.labels.children[groupName]?.presentation.fill
    }
  };
  // sanity: the two presets actually specify different values for everything checked below -
  // otherwise the "differs" assertions would be vacuous regardless of what the code does
  expect(expected.night.roads).not.toBe(expected.default.roads);
  expect(expected.night.stateBorders).not.toBe(expected.default.stateBorders);
  expect(expected.night.freshwater).not.toBe(expected.default.freshwater);
  expect(expected.night.landHeightsScheme).not.toBe(expected.default.landHeightsScheme);
  expect(expected.night.label).not.toBe(expected.default.label);

  const result = await page.evaluate(async groupName => {
    const w = window as any;

    const before = {
      roadsDom: document.querySelector("#routes > g#roads")?.getAttribute("stroke"),
      stateBordersDom: document.querySelector("#borders > g#stateBorders")?.getAttribute("stroke"),
      freshwaterDom: document.querySelector("#lakes > g#freshwater")?.getAttribute("fill"),
      landHeightsScheme: style.layers.terrs.children.landHeights.options.scheme,
      labelDom: document.querySelector(`#labels [data-group="${groupName}"]`)?.getAttribute("fill")
    };

    await w.changeStyle("night");

    const night = {
      roadsStore: style.layers.routes.children.roads.presentation.stroke,
      roadsDom: document.querySelector("#routes > g#roads")?.getAttribute("stroke"),
      stateBordersStore: style.layers.borders.children.stateBorders.presentation.stroke,
      stateBordersDom: document.querySelector("#borders > g#stateBorders")?.getAttribute("stroke"),
      freshwaterStore: style.layers.lakes.children.freshwater.presentation.fill,
      freshwaterDom: document.querySelector("#lakes > g#freshwater")?.getAttribute("fill"),
      landHeightsScheme: style.layers.terrs.children.landHeights.options.scheme,
      landHeightsDomSchemeAttr: document.querySelector("#terrs > g#landHeights")?.getAttribute("scheme"),
      labelStore: style.layers.labels.children[groupName]?.presentation.fill,
      labelDom: document.querySelector(`#labels [data-group="${groupName}"]`)?.getAttribute("fill"),
      labelMirror: style.labels.groups[groupName]?.fill
    };

    await w.changeStyle("default");

    const reverted = {
      roadsDom: document.querySelector("#routes > g#roads")?.getAttribute("stroke"),
      stateBordersDom: document.querySelector("#borders > g#stateBorders")?.getAttribute("stroke"),
      freshwaterDom: document.querySelector("#lakes > g#freshwater")?.getAttribute("fill"),
      landHeightsScheme: style.layers.terrs.children.landHeights.options.scheme,
      labelDom: document.querySelector(`#labels [data-group="${groupName}"]`)?.getAttribute("fill")
    };

    return {before, night, reverted};
  }, groupName);

  // the pre-switch state is already the default preset (sanity - not the point of this test,
  // but confirms "before" is a meaningful baseline to compare against)
  expect(result.before.roadsDom).toBe(expected.default.roads);
  expect(result.before.stateBordersDom).toBe(expected.default.stateBorders);
  expect(result.before.freshwaterDom).toBe(expected.default.freshwater);
  expect(result.before.landHeightsScheme).toBe(expected.default.landHeightsScheme);
  expect(result.before.labelDom).toBe(expected.default.label);

  // preset switch reaches both the store and the DOM, and they agree
  expect(result.night.roadsStore).toBe(result.night.roadsDom);
  expect(result.night.stateBordersStore).toBe(result.night.stateBordersDom);
  expect(result.night.freshwaterStore).toBe(result.night.freshwaterDom);
  expect(result.night.labelStore).toBe(result.night.labelDom);
  expect(result.night.labelStore).toBe(result.night.labelMirror);

  // the applied preset is genuinely night.json's values, not merely "different from default" -
  // this is what catches a wrong-preset-applied bug (e.g. a name-mapping mistake loading
  // "ancient", or a stale/partially-applied preset) that a differs-from-before-only check misses
  expect(result.night.roadsDom).toBe(expected.night.roads);
  expect(result.night.stateBordersDom).toBe(expected.night.stateBorders);
  expect(result.night.freshwaterDom).toBe(expected.night.freshwater);
  expect(result.night.landHeightsScheme).toBe(expected.night.landHeightsScheme);
  expect(result.night.labelDom).toBe(expected.night.label);

  // terrs scheme is an options value, not a presentation attr - by design it never lands as a
  // DOM "scheme" attribute (Task 10/C1 removed that mirror); assert it stays absent
  expect(result.night.landHeightsDomSchemeAttr).toBeNull();

  // switching back to default fully restores default.json's actual values - no residue left by
  // night's overrides (pinned to the preset file, not just "equals what it was before")
  expect(result.reverted.roadsDom).toBe(expected.default.roads);
  expect(result.reverted.stateBordersDom).toBe(expected.default.stateBorders);
  expect(result.reverted.freshwaterDom).toBe(expected.default.freshwater);
  expect(result.reverted.landHeightsScheme).toBe(expected.default.landHeightsScheme);
  expect(result.reverted.labelDom).toBe(expected.default.label);
});

// Task 8's editor group navigation: styleElementSelect + styleGroupSelect drive
// styleTargetFromUI(), which setPresentation/setOptions consume. This pins that, for each of
// the 8 group-aware elements, selecting a real child group in the UI produces a target whose
// childIds match the DOM child's actual id/data-group verbatim (the brief flagged a risk that
// group selects carry "#"-prefixed values that would need normalizing in styleTargetFromUI).
const GROUP_AWARE_TARGETS: {element: string; childId: string; selector: string}[] = [
  {element: "anchors", childId: "capital", selector: "#anchors > g#capital"},
  {element: "borders", childId: "stateBorders", selector: "#borders > g#stateBorders"},
  {element: "burgIcons", childId: "capital", selector: "#burgIcons > g#capital"},
  {element: "coastline", childId: "sea_island", selector: "#coastline > g#sea_island"},
  {element: "lakes", childId: "freshwater", selector: "#lakes > g#freshwater"},
  {element: "routes", childId: "roads", selector: "#routes > g#roads"},
  {element: "terrs", childId: "landHeights", selector: "#terrs > g#landHeights"}
  // "labels" is handled separately below - its group values are dynamic (map-generated group
  // names), not the fixed child ids the other 7 elements use
];

test("editor group navigation targets the selected child on both object and DOM, for all 8 group-aware elements", async ({
  page
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), {timeout: 120000});
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
  await page.waitForTimeout(500);

  const results = await page.evaluate(targets => {
    const w = window as any;
    const elementSelect = document.getElementById("styleElementSelect") as HTMLSelectElement;
    const groupSelect = document.getElementById("styleGroupSelect") as HTMLSelectElement;

    const perElement = targets.map(({element, childId, selector}) => {
      elementSelect.value = element;
      elementSelect.dispatchEvent(new Event("change"));
      groupSelect.value = childId;
      groupSelect.dispatchEvent(new Event("change"));

      const target = w.styleTargetFromUI();
      const groupSelectValue = groupSelect.value;

      const value = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
      w.setPresentation(target, "stroke", value);

      const node = w.getStyleNode(target.layerId, ...(target.childIds ?? []));
      return {
        element,
        childId,
        groupSelectValue,
        targetChildIds: target.childIds,
        storeValue: node.presentation?.stroke,
        domValue: document.querySelector(selector)?.getAttribute("stroke"),
        expectedValue: value
      };
    });

    // labels: group values are dynamic group names, resolved via data-group not id
    const groupName = options.labels.groups[0].name;
    elementSelect.value = "labels";
    elementSelect.dispatchEvent(new Event("change"));
    groupSelect.value = groupName;
    groupSelect.dispatchEvent(new Event("change"));

    const labelsTarget = w.styleTargetFromUI();
    const labelsGroupSelectValue = groupSelect.value;
    // randomized (not a fixed literal) like the other 7 writes above, to rule out a no-op pass
    const labelsValue = (0.1 + Math.random() * 0.89).toFixed(4);
    w.setPresentation(labelsTarget, "opacity", labelsValue);
    const labelsNode = w.getStyleNode(labelsTarget.layerId, ...(labelsTarget.childIds ?? []));

    perElement.push({
      element: "labels",
      childId: groupName,
      groupSelectValue: labelsGroupSelectValue,
      targetChildIds: labelsTarget.childIds,
      storeValue: labelsNode.presentation?.opacity,
      domValue: document.querySelector(`#labels [data-group="${groupName}"]`)?.getAttribute("opacity"),
      expectedValue: labelsValue
    });

    return perElement;
  }, GROUP_AWARE_TARGETS);

  for (const r of results) {
    expect.soft(r.groupSelectValue, `${r.element} group select value`).toBe(r.childId);
    expect.soft(r.targetChildIds, `${r.element} styleTargetFromUI childIds`).toEqual([r.childId]);
    expect.soft(r.storeValue, `${r.element} store value`).toBe(r.expectedValue);
    expect.soft(r.domValue, `${r.element} DOM value`).toBe(r.expectedValue);
  }
});
