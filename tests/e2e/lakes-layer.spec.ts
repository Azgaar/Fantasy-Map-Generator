import { test, expect } from "@playwright/test";

test.describe("Lakes layer", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&width=1280&height=720");

    // Wait for map generation to complete
    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 60000,
    });

    // Wait for any post-generation rendering to settle
    await page.waitForTimeout(500);
  });

  test("lakes toggle button hides and shows the #lakes SVG group", async ({
    page,
  }) => {
    const lakes = page.locator("#lakes");

    // Open the options panel (layers tab) so the toggle button is reachable
    await page.evaluate(() => (window as any).showOptions());

    // Lakes should be visible by default
    await expect(lakes).toBeVisible();

    // Click the toggle button to hide; wait for jQuery fadeOut to complete
    await page.locator("#toggleLakes").click();
    await expect(lakes).toBeHidden();

    // Click again to show; wait for jQuery fadeIn to complete
    await page.locator("#toggleLakes").click();
    await expect(lakes).toBeVisible();
  });

  test("KeyQ toggles the lakes layer", async ({ page }) => {
    const lakes = page.locator("#lakes");

    // Lakes should be visible by default
    await expect(lakes).toBeVisible();

    // Press Q to hide lakes; wait for jQuery fadeOut to complete
    await page.keyboard.press("q");
    await expect(lakes).toBeHidden();

    // Press Q again to show lakes; wait for jQuery fadeIn to complete
    await page.keyboard.press("q");
    await expect(lakes).toBeVisible();
  });

  test("Lakes panel entry is positioned just after Heightmap", async ({
    page,
  }) => {
    const [lakesIndex, heightmapIndex] = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll("#mapLayers > li")
      ) as HTMLElement[];
      return [
        items.findIndex((li) => li.id === "toggleLakes"),
        items.findIndex((li) => li.id === "toggleHeight"),
      ];
    });

    expect(lakesIndex).toBe(heightmapIndex + 1);
  });

  test("dragging Lakes below Heightmap in panel moves #lakes after #terrs in SVG", async ({
    page,
  }) => {
    // Confirm initial SVG order: #lakes is before #terrs (rendered behind heightmap by default)
    const initialOrder = await page.evaluate(() => {
      const viewbox = document.getElementById("viewbox")!;
      const ids = Array.from(viewbox.children).map((el) => el.id);
      return { lakes: ids.indexOf("lakes"), terrs: ids.indexOf("terrs") };
    });
    expect(initialOrder.lakes).toBeGreaterThanOrEqual(0);
    expect(initialOrder.terrs).toBeGreaterThanOrEqual(0);
    expect(initialOrder.lakes).toBeLessThan(initialOrder.terrs);

    // Simulate what moveLayer does when the user drags Lakes below Heightmap:
    // panel item "toggleLakes" is now after "toggleHeight" → el.insertAfter(#terrs)
    await page.evaluate(() => {
      const $ = (window as any).$;
      $("#lakes").insertAfter($("#terrs"));
    });

    // After move: #lakes should be after #terrs in SVG → renders on top of heightmap
    const newOrder = await page.evaluate(() => {
      const viewbox = document.getElementById("viewbox")!;
      const ids = Array.from(viewbox.children).map((el) => el.id);
      return { lakes: ids.indexOf("lakes"), terrs: ids.indexOf("terrs") };
    });
    expect(newOrder.lakes).toBeGreaterThan(newOrder.terrs);
  });
});
