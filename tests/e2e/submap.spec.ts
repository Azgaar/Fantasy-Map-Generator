import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { countMaps, waitForMap, waitForNextMap } from "./wait-for-map";

type Rect = { x: number; y: number; width: number; height: number };

/** Names of the burgs inside a rectangle of the current map */
function burgsIn(page: Page, rect: Rect) {
  return page.evaluate(
    ({ x, y, width, height }) =>
      (window as any).pack.burgs
        .filter((b: any) => b.i && !b.removed && b.x >= x && b.x <= x + width && b.y >= y && b.y <= y + height)
        .map((b: any) => b.name as string),
    rect
  );
}

// 1.154.0.map is built on an 8430x4000 canvas, far larger than the window it is opened in
test("a submap of a map larger than the window is the area on screen", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 850 });
  await page.goto("/?seed=submap-large-canvas");
  await waitForMap(page);

  const loaded = await countMaps(page);
  await page.locator("#mapToLoad").setInputFiles(path.join(__dirname, "../fixtures/1.154.0.map"));
  await waitForNextMap(page, loaded);
  await page.waitForTimeout(500);

  const canvas = await page.evaluate(() => {
    const w = window as any;
    const capital = w.pack.burgs[w.pack.states.filter((s: any) => s.i && !s.removed)[0].capital];
    w.zoomTo(capital.x, capital.y, 2, 0);
    return { ...w.options.map.graph };
  });
  await page.waitForTimeout(500);

  const visible = await page.evaluate(() => {
    const transform = document.getElementById("viewbox")!.getAttribute("transform")!;
    const [, x, y, scale] = /translate\((-?[\d.]+)[ ,]+(-?[\d.]+)\) scale\(([\d.]+)\)/.exec(transform)!.map(Number);
    return { x: -x / scale, y: -y / scale, width: innerWidth / scale, height: innerHeight / scale };
  });
  const onScreen = await burgsIn(page, visible);
  expect(onScreen.length).toBeGreaterThan(0);

  // the screen is narrower than the canvas, so the submap widens it to the canvas proportions
  const width = (visible.height * canvas.width) / canvas.height;
  const region = { ...visible, x: visible.x - (width - visible.width) / 2, width };
  const inRegion = await burgsIn(page, region);

  const submapped = await countMaps(page);
  await page.evaluate(() => (window as any).Controllers.SubmapTool.open());
  await page.locator(".ui-dialog-buttonset button", { hasText: "Submap" }).click();
  await waitForNextMap(page, submapped);

  const submap = await page.evaluate(() => {
    const w = window as any;
    return {
      graph: { ...w.options.map.graph },
      geography: { ...w.options.map.geography },
      burgs: w.pack.burgs.filter((b: any) => b.i && !b.removed).map((b: any) => b.name as string)
    };
  });

  expect(submap.graph.width).toBe(canvas.width);
  expect(submap.graph.height).toBe(canvas.height);
  for (const shift of [submap.geography.latitude, submap.geography.longitude]) {
    expect(shift).toBeGreaterThanOrEqual(0);
    expect(shift).toBeLessThanOrEqual(100);
  }
  for (const name of onScreen) expect(submap.burgs).toContain(name);
  for (const name of submap.burgs) expect(inRegion).toContain(name);
});
