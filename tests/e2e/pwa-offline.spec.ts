import { expect, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

// The worker only registers itself off localhost, and only the production build carries the
// precache list, so these tests register it by hand and skip against the dev server
test.describe("PWA offline", () => {
  test.beforeEach(async ({ page, context }) => {
    const worker = await (await context.request.get("/Fantasy-Map-Generator/sw.js")).text();
    test.skip(worker.includes("self.__WB_MANIFEST"), "needs the built service worker (npm run build && npm run preview)");

    await page.goto("/");
    await waitForMap(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
  });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("opens an editor that was never opened online", async ({ page }) => {
    await page.reload();
    await waitForMap(page);

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editBiomesButton");

    await expect(page.locator("#biomesEditor")).toBeVisible();
    await expect(page.getByText("New version released")).toHaveCount(0);
  });

  test("names the real cause when a chunk fails to load offline", async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event("vite:preloadError")));

    await expect(page.locator(".ui-dialog-title", { hasText: "offline" })).toBeVisible();
    await expect(page.getByText("New version released")).toHaveCount(0);
  });
});
