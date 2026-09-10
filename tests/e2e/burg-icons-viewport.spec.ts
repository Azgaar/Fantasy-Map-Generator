import { waitForMap } from "./wait-for-map";
import { test, expect } from "@playwright/test";

// Burg icons are a viewport pass: only icons inside the (overscanned) bounds whose group passes
// its zoom gate may exist in the DOM. Materializing every burg at every zoom is what made
// 100K-burg maps unpannable, so this locks the ceiling, not exact counts.
test("burg icons materialize only in-viewport and past their zoom gates", async ({ page }) => {
  await page.goto("/?seed=icon-viewport&width=1280&height=720");
  await waitForMap(page);
  await page.waitForTimeout(500);

  const at = (zoom: number) =>
    page.evaluate(async z => {
      (window as any).setMapZoom(z);
      await new Promise(resolve => setTimeout(resolve, 600));
      return {
        icons: document.querySelectorAll("#burgIcons use").length,
        burgs: (window as any).pack.burgs.filter((b: any) => b.i && !b.removed).length
      };
    }, zoom);

  const low = await at(1.2);
  expect(low.icons).toBeGreaterThan(0); // capitals show with their labels
  expect(low.icons).toBeLessThan(low.burgs / 10); // hamlets and villages must not

  const high = await at(6);
  expect(high.icons).toBeGreaterThan(low.icons); // deeper tiers reveal on zoom
  expect(high.icons).toBeLessThan(high.burgs); // but only the viewport's share of them

  // panning reconciles at gesture end: the materialized set follows the viewport
  const panned = await page.evaluate(async () => {
    const ids = () => [...document.querySelectorAll("#burgIcons use")].map(use => use.id).join(",");
    const before = ids();
    (window as any).panMap(500, 300);
    await new Promise(resolve => setTimeout(resolve, 600));
    return { before, after: ids() };
  });
  expect(panned.after).not.toBe(panned.before);
});
