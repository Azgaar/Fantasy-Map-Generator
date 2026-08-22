import { test, expect } from "@playwright/test";

// real wheel input on purpose: programmatic setMapZoom dispatches "end" with the frame still
// pending, so it cannot catch a reconcile that never runs after human-paced gestures
test("wheel zoom reconciles viewport layers at gesture end", async ({ page }) => {
  await page.goto("/?seed=icon-viewport&width=1280&height=720");
  await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
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
