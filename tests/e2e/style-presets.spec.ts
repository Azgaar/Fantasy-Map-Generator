import {test, expect, type Page, type ConsoleMessage} from "@playwright/test";
import fs from "fs";
import path from "path";

const PRESETS = [
  "default", "ancient", "gloom", "pale", "light", "watercolor",
  "clean", "atlas", "darkSeas", "cyberpunk", "night", "monochrome"
];

function pinnedAttrs(preset: string): {oceanFill: string; landmassFill: string} {
  const file =
    preset === "default" ? "../../src/generators/default-styles.json" : `../../public/styles/${preset}.json`;
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  return {oceanFill: json.ocean.base.attrs.fill, landmassFill: json.landmass.attrs.fill};
}

async function switchTo(page: Page, preset: string) {
  await page.evaluate(async name => {
    await (window as any).changeStyle(name);
  }, preset);
}

// Relief.changeSize (src/generators/relief-generator.ts) writes the resized value into
// pack.relief[i].s, and the viewport renderer copies that straight into the <use> width/height
// attrs (src/renderers/draw-relief-icons.ts) - so a stuck-shrunk icon is observable on a specific
// icon's width attr without forcing a full relief regeneration.
async function firstReliefIconId(page: Page) {
  return page.evaluate(() => document.querySelector("#terrain > use")?.getAttribute("data-id") ?? null);
}

async function reliefIconWidth(page: Page, id: string) {
  const width = await page.locator(`#terrain > use[data-id="${id}"]`).getAttribute("width");
  return width == null ? null : Number(width);
}

// two independently-sourced attributes (ocean vs landmass fill) so a preset apply that silently
// no-ops can't hide behind the previous preset's leftover value - see the collision check below
async function readPinnedAttrs(page: Page) {
  const oceanFill = await page.locator("#oceanBase").getAttribute("fill");
  const landmassFill = await page.locator("#landmass").getAttribute("fill");
  return {oceanFill, landmassFill};
}

// night and monochrome both ship ocean.base.attrs.fill = #000000 (and other adjacent pairs could
// coincide the same way as presets evolve) - a single pinned attribute can't tell "applied" from
// "no-op" for such a pair. Fail loudly, at spec-load time, if any adjacent switch (including the
// revert-to-default at the end) wouldn't actually change what's pinned.
const switchOrder = [...PRESETS, "default"];
for (let i = 1; i < switchOrder.length; i++) {
  const prev = pinnedAttrs(switchOrder[i - 1]);
  const curr = pinnedAttrs(switchOrder[i]);
  if (prev.oceanFill === curr.oceanFill && prev.landmassFill === curr.landmassFill) {
    throw new Error(
      `pinned attrs do not discriminate ${switchOrder[i - 1]} -> ${switchOrder[i]}: both are ${JSON.stringify(curr)}`
    );
  }
}

test("every shipped preset applies through the store with no console errors", async ({page}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    // src/index.html loads Google Tag Manager unconditionally from a static <script> tag; this
    // test sandbox has no route to it, so it always fails to load - unrelated to preset styling.
    // Scoped to the resource's own URL (not the generic ERR_CONNECTION_REFUSED text) so a real
    // connection failure from the style pipeline itself still fails the test.
    if (msg.type() === "error" && !msg.location().url.includes("googletagmanager")) {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  await page.waitForSelector("#burgIcons > g", {state: "attached", timeout: 60000});
  await page.waitForSelector("#labels > g", {state: "attached", timeout: 60000});
  await page.waitForTimeout(500);

  await page.evaluate(() => sessionStorage.setItem("styleChangeConfirmed", "true"));

  for (const preset of PRESETS) {
    await switchTo(page, preset);
    await page.waitForTimeout(100);

    const attrs = await readPinnedAttrs(page);
    expect(attrs, preset).toEqual(pinnedAttrs(preset));
  }

  await switchTo(page, "default");
  const reverted = await readPinnedAttrs(page);
  expect(reverted, "revert to default").toEqual(pinnedAttrs("default"));

  expect(consoleErrors, "console errors during preset switching").toEqual([]);
  expect(pageErrors, "page errors during preset switching").toEqual([]);
});

test("relief icon size round-trips through a preset switch and back", async ({page}) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
  await page.waitForSelector("#burgIcons > g", {state: "attached", timeout: 60000});
  await page.waitForSelector("#labels > g", {state: "attached", timeout: 60000});
  await page.waitForTimeout(500);

  await page.evaluate(() => sessionStorage.setItem("styleChangeConfirmed", "true"));

  // the "relief" layer is off in the default layers preset - turn it on so the terrain icons render
  await page.evaluate(() => (window as any).Layers.show("relief"));
  await page.waitForSelector("#terrain > use", {state: "attached", timeout: 60000});

  await switchTo(page, "default");
  await page.waitForTimeout(100);

  const id = await firstReliefIconId(page);
  expect(id, "a relief icon to measure").not.toBeNull();
  const baselineWidth = await reliefIconWidth(page, id as string);
  expect(baselineWidth, "baseline relief icon width").toBeGreaterThan(0);

  await switchTo(page, "pale");
  await page.waitForTimeout(100);
  const paleWidth = await reliefIconWidth(page, id as string);
  expect(paleWidth, "relief icon width after switching to pale (size 0.7)").toBeCloseTo(baselineWidth! * 0.7, 1);

  await switchTo(page, "default");
  await page.waitForTimeout(100);
  const revertedWidth = await reliefIconWidth(page, id as string);
  expect(revertedWidth, "relief icon width after switching back to default (size 1)").toBeCloseTo(baselineWidth!, 1);
});

test("a saved custom preset carries the retired sizes from the store", async ({page}) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

  await page.evaluate(() => {
    styles.coordinates.options.fontSize = 23;
    styles.rulers.options.fontSize = 24;
    styles.legend.options.fontSize = 25;
    styles.emblems.provinceEmblems.options.size = 1.4;
    styles.goods.goodsIcons.options.size = 9;
    styles.goods.goodsBurgs.options.size = 7;
    styles.markets.options.size = 8;
    styles.heightmap.landHeights.options.terracing = 5;
    styles.heightmap.oceanHeights.options.render = true;
    styles.military.options.boxSize = 4;
    styles.grid.options.scale = 2;
    styles.markets.options.icon = "K";
    styles.texture.options.x = 33;
    styles.ocean.oceanLayers.options.outline = "-6,-4,-2";
    styles.scaleBar.options.label = "posterity";
    styles.legend.options.columns = 5;
    (window as any).addStylePreset();
  });

  const raw = await page.locator("#styleSaverJSON").inputValue();
  const roundTripped = await page.evaluate(rawJson => {
    const json = JSON.parse(rawJson);
    // the saver emits the store format now: no legacy selector keys, parseable directly
    if ((window as any).stylesLegacy.isLegacyPreset(json)) throw new Error("saver emitted the legacy format");
    const upgraded = (window as any).Styles.parse(json);
    return {
      coordinates: upgraded.coordinates.options.fontSize,
      rulers: upgraded.rulers.options.fontSize,
      legend: upgraded.legend.options.fontSize,
      provinceEmblems: upgraded.emblems.provinceEmblems.options.size,
      goodsIcons: upgraded.goods.goodsIcons.options.size,
      goodsBurgs: upgraded.goods.goodsBurgs.options.size,
      markets: upgraded.markets.options.size,
      landTerracing: upgraded.heightmap.landHeights.options.terracing,
      oceanRender: upgraded.heightmap.oceanHeights.options.render,
      armiesBox: upgraded.military.options.boxSize,
      gridScale: upgraded.grid.options.scale,
      marketsIcon: upgraded.markets.options.icon,
      textureX: upgraded.texture.options.x,
      oceanOutline: upgraded.ocean.oceanLayers.options.outline,
      scaleBarLabel: upgraded.scaleBar.options.label,
      legendColumns: upgraded.legend.options.columns
    };
  }, raw);

  expect(roundTripped).toEqual({
    coordinates: 23,
    rulers: 24,
    legend: 25,
    provinceEmblems: 1.4,
    goodsIcons: 9,
    goodsBurgs: 7,
    markets: 8,
    landTerracing: 5,
    oceanRender: true,
    armiesBox: 4,
    gridScale: 2,
    marketsIcon: "K",
    textureX: 33,
    oceanOutline: "-6,-4,-2",
    scaleBarLabel: "posterity",
    legendColumns: 5
  });
});

test("a non-style JSON is rejected by the saver, not applied as defaults", async ({page}) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});

  const before = await page.evaluate(() => styles.rivers.attrs.fill);
  await page.evaluate(() => (window as any).addStylePreset());
  await page.evaluate(() => {
    (document.getElementById("styleSaverJSON") as HTMLTextAreaElement).value =
      JSON.stringify({road: "#D1B86E", roofType: "Gable", treeShape: "Cotton"});
    (document.getElementById("styleSaverName") as HTMLInputElement).value = "bogus";
  });
  await page.locator("#styleSaverSave").click();

  await expect(page.locator("#tooltip")).toContainText("not a style preset");
  const after = await page.evaluate(() => ({
    fill: styles.rivers.attrs.fill,
    saved: localStorage.getItem("fmgStyle_bogus")
  }));
  expect(after.fill).toBe(before);
  expect(after.saved).toBeNull();
});
