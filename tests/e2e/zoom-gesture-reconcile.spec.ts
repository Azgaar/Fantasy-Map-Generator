import { waitForMap } from "./wait-for-map";
import { test, expect } from "@playwright/test";

// Viewport layers reconcile once per gesture, at its end. A real wheel gesture ends on d3's
// idle timeout, long after the last zoom frame was painted - unlike programmatic setMapZoom,
// where "end" fires while the frame is still pending. Guarding the end-of-gesture render on a
// pending frame therefore froze labels and icons for every human-paced gesture.
test("wheel zoom reconciles viewport layers at gesture end", async ({ page }) => {
  await page.goto("/?seed=icon-viewport&width=1280&height=720");
  await waitForMap(page);
  await page.waitForTimeout(500);

  const materialized = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#burgIcons use, #labels [data-label-type]")].map(el => el.id).join(",")
    );

  const before = await materialized();
  await page.mouse.move(640, 360);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
  await page.waitForTimeout(800);

  expect(await materialized()).not.toBe(before);
});
