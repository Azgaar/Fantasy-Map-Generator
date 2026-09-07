import { expect, test } from "@playwright/test";

// The legend can hold one box per source at a time: turning on a second box must not drop the first,
// and each box is toggled, positioned and hidden on its own.
test.describe("legend boxes", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });
    await page.waitForTimeout(500);
  });

  const openEditor = async (page: any, controller: string) => {
    await page.evaluate((name: string) => (window as any).Controllers[name].open(), controller);
  };

  test("states and zones legends are shown side by side and hidden one at a time", async ({ page }) => {
    const boxes = page.locator("#legend > g[data-legend]");

    await openEditor(page, "StatesEditor");
    await page.locator("#statesLegend").click();
    await expect(boxes).toHaveCount(1);
    await expect(page.locator('#legend > g[data-legend="States"]')).toBeAttached();

    await openEditor(page, "ZonesEditor");
    await page.locator("#zonesLegend").click();
    await expect(boxes).toHaveCount(2);
    await expect(page.locator('#legend > g[data-legend="Zones"]')).toBeAttached();

    // the second box is stacked above the first one rather than drawn over it
    const tops = await boxes.evaluateAll(nodes =>
      nodes.map(node => Number(/translate\(\s*[\d.-]+\s*,\s*([\d.-]+)/.exec(node.getAttribute("transform") || "")?.[1]))
    );
    expect(new Set(tops).size).toBe(2);

    // hiding one box keeps the other
    await page.locator("#zonesLegend").click();
    await expect(boxes).toHaveCount(1);
    await expect(page.locator('#legend > g[data-legend="States"]')).toBeAttached();
  });

  test("clicking a box on the map hides that box alone", async ({ page }) => {
    await openEditor(page, "StatesEditor");
    await page.locator("#statesLegend").click();
    await openEditor(page, "CulturesEditor");
    await page.locator("#culturesLegend").click();
    await expect(page.locator("#legend > g[data-legend]")).toHaveCount(2);

    await page.evaluate(() => (window as any).closeDialogs());
    await page.locator('#legend > g[data-legend="Cultures"] .legendBox').click();
    await expect(page.locator("#legend > g[data-legend]")).toHaveCount(1);
    await expect(page.locator('#legend > g[data-legend="States"]')).toBeAttached();
  });
});
