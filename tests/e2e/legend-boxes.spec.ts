import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

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
    await waitForMap(page);
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
    // the item and title texts are siblings of the background rect and paint over it, so clicking
    // the rect's centre can land on a glyph and fail the hit-target check; the group owns them all
    await page.locator('#legend > g[data-legend="Cultures"]').click();
    await expect(page.locator("#legend > g[data-legend]")).toHaveCount(1);
    await expect(page.locator('#legend > g[data-legend="States"]')).toBeAttached();
  });

  test("toggling a legend with nothing to list reports it instead of drawing an empty box", async ({ page }) => {
    await openEditor(page, "ZonesEditor");

    // hide every zone through the editor, so the legend has nothing to list
    const hide = page.locator("#zonesBodySection .zoneHide");
    const count = await hide.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await hide.nth(i).click();

    await page.locator("#zonesLegend").click();

    await expect(page.locator("#tooltip")).toHaveText("No zones to show");
    await expect(page.locator("#legend > g[data-legend]")).toHaveCount(0);
  });
});
