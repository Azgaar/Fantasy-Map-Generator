import {expect, test} from "@playwright/test";

test.describe("controller launchers", () => {
  test.beforeEach(async ({page}) => {
    await page.goto("/?seed=test-controller-launchers&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
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
});
