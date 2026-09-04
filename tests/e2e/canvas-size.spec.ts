import { expect, test } from "@playwright/test";
import { countMaps, waitForMap, waitForNextMap } from "./wait-for-map";

// The canvas size is the extent the Voronoi graph was built on, so it is fixed for the life of a map.
// A window resize re-fits the viewport onto it; only the next map adopts the new window size.
test.describe("canvas size", () => {
  test("a generated map keeps its extent when the window resizes", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?seed=canvas-size-stable");
    await waitForMap(page);

    const generated = await page.evaluate(() => ({ ...(window as any).facts.graph }));
    expect(generated.width).toBe(1000);

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(500);

    const afterResize = await page.evaluate(() => ({
      width: (window as any).facts.graph.width,
      height: (window as any).facts.graph.height,
      svgWidth: Number(document.getElementById("map")!.getAttribute("width"))
    }));

    expect(afterResize.width).toBe(generated.width);
    expect(afterResize.height).toBe(generated.height);
    expect(afterResize.svgWidth).toBe(1000); // the viewport is re-fitted: min(extent, window)
  });

  test("the next map is generated at the new window size", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?seed=canvas-size-adopted");
    await waitForMap(page);

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(500);

    const previous = await countMaps(page);
    await page.evaluate(() => (window as any).regenerateMap("resized window"));
    await waitForNextMap(page, previous);

    const regenerated = await page.evaluate(() => ({ ...(window as any).facts.graph }));
    expect(regenerated.width).toBe(1400);
    expect(regenerated.height).toBe(800);
  });

  test("a pinned canvas size survives both the resize and the next map", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?seed=canvas-size-pinned&width=900&height=600");
    await waitForMap(page);

    await page.evaluate(() => {
      (window as any).lock("mapWidth");
      (window as any).lock("mapHeight");
    });

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(500);

    const previous = await countMaps(page);
    await page.evaluate(() => (window as any).regenerateMap("pinned size"));
    await waitForNextMap(page, previous);

    const regenerated = await page.evaluate(() => ({ ...(window as any).facts.graph }));
    expect(regenerated.width).toBe(900);
    expect(regenerated.height).toBe(600);
  });
});
