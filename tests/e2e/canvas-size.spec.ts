import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { countMaps, waitForMap, waitForNextMap } from "./wait-for-map";

// The canvas size is the extent the Voronoi graph was built on, so it is fixed for the life of a map.
// The viewport always fills the window, and the zoom floor is derived from the two: a map larger than
// the window zooms out below 1 until it fits, a smaller one is scaled up until it covers the window.
// Only the next map adopts the new window size as its extent.

/** What the map looks like on screen right now: the extent, the svg window and the applied zoom */
function readView(page: Page) {
  return page.evaluate(() => {
    const transform = document.getElementById("viewbox")!.getAttribute("transform") ?? "";
    return {
      extent: { ...(window as any).options.map.graph },
      svgWidth: Number(document.getElementById("map")!.getAttribute("width")),
      svgHeight: Number(document.getElementById("map")!.getAttribute("height")),
      zoomMin: (window as any).options.app.zoomExtent.min as number,
      scale: Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1)
    };
  });
}

/** Open a fixture the way the user does, and wait for the map it produces */
async function openFixture(page: Page, fixture: string) {
  const previous = await countMaps(page);
  await page.locator("#mapToLoad").setInputFiles(path.join(__dirname, "../fixtures", fixture));
  await waitForNextMap(page, previous);
  await page.waitForTimeout(500);
}

test.describe("canvas size", () => {
  test("a generated map keeps its extent when the window resizes", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?seed=canvas-size-stable");
    await waitForMap(page);

    const generated = await page.evaluate(() => ({ ...(window as any).options.map.graph }));
    expect(generated.width).toBe(1000);

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(500);

    const afterResize = await readView(page);

    expect(afterResize.extent.width).toBe(generated.width);
    expect(afterResize.extent.height).toBe(generated.height);
    expect(afterResize.svgWidth).toBe(1400); // the viewport follows the window
    expect(afterResize.svgHeight).toBe(800);
    expect(afterResize.scale).toBeGreaterThanOrEqual(1400 / generated.width); // and the map covers it
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

    const regenerated = await page.evaluate(() => ({ ...(window as any).options.map.graph }));
    expect(regenerated.width).toBe(1400);
    expect(regenerated.height).toBe(800);
  });

  // 1.139.4.map was saved on a 1512x828 canvas, so this window is wider than the map it opens
  test("a map opened on a bigger screen is scaled up to fill it", async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto("/?seed=canvas-size-loaded");
    await waitForMap(page);

    await openFixture(page, "1.139.4.map");
    const loaded = await readView(page);

    expect(loaded.extent.width).toBe(1512); // the opened map keeps the extent it was built on
    expect(loaded.svgWidth).toBe(1700); // but the window it is shown in is the whole screen
    expect(loaded.svgHeight).toBe(1000);
    expect(loaded.zoomMin).toBeGreaterThanOrEqual(1700 / loaded.extent.width); // scaled up to cover it
    expect(loaded.scale).toBe(loaded.zoomMin); // and it opens at that floor: the fitted view
  });

  // the other direction: a window smaller than the map, where the floor has to fall below 1
  test("a map opened on a smaller screen is fitted into it", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.goto("/?seed=canvas-size-fitted");
    await waitForMap(page);

    await openFixture(page, "1.139.4.map");
    const loaded = await readView(page);

    expect(loaded.extent.width).toBe(1512);
    expect(loaded.svgWidth).toBe(1000);
    expect(loaded.zoomMin).toBeLessThan(1); // the floor follows the map down, as it did before 1.152
    expect(loaded.zoomMin).toBeGreaterThanOrEqual(600 / loaded.extent.height); // never past covering
    expect(loaded.scale).toBe(loaded.zoomMin);
  });

  test("a pinned canvas size survives both the resize and the next map", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.goto("/?seed=canvas-size-pinned&width=900&height=600");
    await waitForMap(page);

    // pin the current extent the way the lock icons do: through the pin store
    await page.evaluate(() => {
      const { width, height } = (window as any).options.map.graph;
      localStorage.setItem("fmg-locks", JSON.stringify({ mapWidth: width, mapHeight: height }));
    });

    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(500);

    const previous = await countMaps(page);
    await page.evaluate(() => (window as any).regenerateMap("pinned size"));
    await waitForNextMap(page, previous);

    const regenerated = await page.evaluate(() => ({ ...(window as any).options.map.graph }));
    expect(regenerated.width).toBe(900);
    expect(regenerated.height).toBe(600);
  });
});
