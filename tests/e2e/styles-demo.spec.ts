import { test, expect } from "@playwright/test";
import defaultStyles from "../../src/generators/default-styles.json";
import { stylesSchema } from "../../src/generators/styles-schema";

const DEFAULT_STYLES = stylesSchema.parse(defaultStyles);

// The data-layer/data-group addressing contract between src/styles and the app:
// every address the styles schema can produce must resolve in the real DOM.
// Run alone with two screenshots: npx playwright test styles-demo

// [layer] and [layer, subgroup] addresses from the default styles; dynamic
// `groups` records are checked separately (their names are per-map)
const ADDRESSES: string[][] = [];
for (const [layer, node] of Object.entries(DEFAULT_STYLES)) {
  ADDRESSES.push([layer]);
  for (const key of Object.keys(node as Record<string, unknown>)) {
    if (key === "attrs" || key === "options" || key === "groups") continue;
    ADDRESSES.push([layer, key]);
  }
}

// created on draw, not by the registry - absent until their layer renders
const LAZY = new Set(["legend/box", "scaleBar/back"]);

async function generateMap(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
  await page.waitForTimeout(500);
}

test("every styles address resolves in the generated map's DOM", async ({ page }) => {
  await generateMap(page);

  const result = await page.evaluate(addresses => {
    const resolved: string[] = [];
    const absentRoot: string[] = [];
    const missing: string[] = [];
    for (const [layer, group] of addresses) {
      const root = document.querySelector(`[data-layer="${layer}"]`);
      if (!root) {
        absentRoot.push(layer);
        continue;
      }
      if (!group) {
        resolved.push(layer);
        continue;
      }
      const key = `${layer}/${group}`;
      if (root.querySelector(`[data-group="${group}"]`)) resolved.push(key);
      else missing.push(key);
    }
    return { resolved, absentRoot, missing };
  }, ADDRESSES);

  // a schema key with no stamped element under an existing layer is a contract break
  expect(result.missing.filter(key => !LAZY.has(key))).toEqual([]);
  expect(result.resolved.length).toBeGreaterThan(50);

  // dynamic groups: renderers stamp what they create
  for (const selector of [
    '[data-layer="labels"] [data-group]',
    '[data-layer="burgIcons"] [data-group="burgIcons"] [data-group]',
    '[data-layer="burgIcons"] [data-group="anchors"] [data-group]'
  ]) {
    expect(await page.locator(selector).count(), selector).toBeGreaterThan(0);
  }
});

test("the library styles the live map through the contract", async ({ page }, testInfo) => {
  test.skip(!!process.env.CI, "imports library source - needs the vite dev server");
  await generateMap(page);
  await page.screenshot({ path: testInfo.outputPath("styles-demo-before.png") });

  const result = await page.evaluate(async () => {
    const { Styles } = await import("/Fantasy-Map-Generator/generators/styles.ts");
    const styles = globalThis.styles;
    styles.rivers.attrs.fill = "#ff00aa";
    styles.routes.groups.roads.attrs.stroke = "#00e5ff";
    styles.routes.groups.roads.attrs["stroke-width"] = 2;
    styles.lakes.freshwater.attrs.fill = "#ffe000";
    styles.states.statesHalo.attrs.filter = null; // null = remove
    Styles.apply("rivers", "routes", "lakes", "states");
    return {
      riverFill: document.querySelector('[data-layer="rivers"]')?.getAttribute("fill"),
      roadStroke: document.querySelector('[data-group="roads"]')?.getAttribute("stroke"),
      lakeFill: document.querySelector('[data-group="freshwater"]')?.getAttribute("fill"),
      haloFilterRemoved: !document.querySelector('[data-group="statesHalo"]')?.hasAttribute("filter"),
      parseRoundTrip: JSON.stringify(Styles.parse(JSON.parse(JSON.stringify(styles)))) === JSON.stringify(styles)
    };
  });

  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath("styles-demo-after.png") });

  expect(result).toEqual({
    riverFill: "#ff00aa",
    roadStroke: "#00e5ff",
    lakeFill: "#ffe000",
    haloFilterRemoved: true,
    parseRoundTrip: true
  });
});
