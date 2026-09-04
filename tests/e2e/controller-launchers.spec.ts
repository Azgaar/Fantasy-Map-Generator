import {expect, test} from "@playwright/test";
import { waitForMap } from "./wait-for-map";

test.describe("controller launchers", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/?seed=test-controller-launchers&width=1280&height=720");
    await waitForMap(page);
  });

  test("opens Markers generation settings from Markers Overview", async ({page}) => {
    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#overviewMarkersButton");
    await expect(page.locator("#markersOverview")).toBeVisible();
    await expect(page.locator("#chat-widget-container")).toBeVisible();

    await page.click("#markersGenerationConfig");

    await expect(page.locator("#markersSettings")).toBeVisible();
  });

  test("opens Goods Editor when some goods have no production", async ({page}) => {
    await page.evaluate(() => {
      const {Goods, pack} = window as any;
      const good = structuredClone(pack.goods[0]);
      good.i = Math.max(...pack.goods.map(({i}: {i: number}) => i)) + 1;
      good.name = "No Production";
      good.visible = false;
      delete good.distribution;
      delete good.recipes;
      pack.goods.push(good);
      Goods.sync();
    });

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editGoods");

    await expect(page.locator("#goodsEditor")).toBeVisible();
    await expect(page.locator("#goodsBody .goodName", {hasText: "No Production"})).toBeVisible();
  });

  test("opens Relief Editor by clicking a relief icon", async ({page}) => {
    await page.click("#optionsTrigger");
    await page.click("#layersTab");
    const reliefToggle = page.locator("#mapLayers > li[data-layer='relief']");
    if (await reliefToggle.evaluate(element => element.classList.contains("buttonoff"))) {
      await reliefToggle.click();
    }

    const reliefIconIndex = await page.locator("#terrain > use").evaluateAll(elements =>
      elements.findIndex(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 3 && rect.height > 3 && rect.x > 350 && rect.y > 30 && rect.right < 1100 && rect.bottom < 650;
      })
    );
    expect(reliefIconIndex).toBeGreaterThanOrEqual(0);
    const reliefIcon = page.locator("#terrain > use").nth(reliefIconIndex);
    await expect(reliefIcon).toBeAttached();
    // Chromium does not reliably hit-test sparse SVG <use> instances by coordinates in headless mode.
    // Dispatching the bubbling click exercises the same delegated #viewbox launcher path.
    await reliefIcon.dispatchEvent("click");

    await expect(page.locator("#reliefEditor")).toBeVisible();
  });

  test("builds the Units Editor from the facts object on open", async ({page}) => {
    // a unit the user named themselves is not among the select's options until the editor puts it back
    await page.evaluate(() => {
      (window as any).Facts.set((facts: any) => {
        facts.units.distance.unit = "leagues";
        facts.units.distance.scale = 7;
      });
    });

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editUnitsButton");

    await expect(page.locator("#unitsEditor")).toBeVisible();
    await expect(page.locator("#distanceUnitInput")).toHaveValue("leagues");
    await expect(page.locator("#distanceScaleInput input[type=number]")).toHaveValue("7");

    // and the controls write back: the scale bar and the facts object follow the editor
    await page.locator("#distanceScaleInput input[type=number]").fill("5");
    await page.locator("#distanceScaleInput input[type=number]").dispatchEvent("change");
    expect(await page.evaluate(() => (window as any).facts.units.distance.scale)).toBe(5);
  });
});
