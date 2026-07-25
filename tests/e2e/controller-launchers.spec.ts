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

  test("opens Relief Editor by clicking a relief icon", async ({page}) => {
    await page.click("#optionsTrigger");
    await page.click("#layersTab");
    const reliefToggle = page.locator("#toggleRelief");
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
    await reliefIcon.click({force: true});

    await expect(page.locator("#reliefEditor")).toBeVisible();
  });
});
