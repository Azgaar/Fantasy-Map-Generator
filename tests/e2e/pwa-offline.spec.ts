import { expect, type Page, test } from "@playwright/test";
import { waitForMap } from "./wait-for-map";

async function prepareOffline(page: Page) {
  const ready = await page.evaluate(async () => {
    const { active } = await navigator.serviceWorker.ready;
    return new Promise<boolean>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        channel.port1.close();
        resolve(event.data.ok);
      };
      active!.postMessage({ type: "CACHE_OFFLINE" }, [channel.port2]);
    });
  });
  expect(ready).toBe(true);
}

// Register manually on localhost; only production builds include the asset manifest.
test.describe("PWA offline", () => {
  test.beforeEach(async ({ page, context }) => {
    const worker = await (await context.request.get("/Fantasy-Map-Generator/sw.js")).text();
    test.skip(
      worker.includes("self.__WB_MANIFEST"),
      "needs the built service worker (npm run build && npm run preview)"
    );

    await page.goto("/");
    await waitForMap(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
    });
  });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("does not prefetch editors in an ordinary browser tab", async ({ page }) => {
    const editorRequests: string[] = [];
    page.context().on("request", request => {
      if (request.url().includes("biomes-editor")) editorRequests.push(request.url());
    });
    await page.reload();
    await waitForMap(page);
    const precached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.includes("-precache-"));
      return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).length))).reduce(
        (total, count) => total + count,
        0
      );
    });
    expect(precached).toBe(0);
    expect(editorRequests).toEqual([]);
  });

  test("opens an editor that was never opened online", async ({ page, context }) => {
    await prepareOffline(page);
    await context.setOffline(true);
    await page.reload();
    await waitForMap(page);

    await page.click("#optionsTrigger");
    await page.click("#toolsTab");
    await page.click("#editBiomesButton");

    await expect(page.locator("#biomesEditor")).toBeVisible();
    await expect(page.getByText("New version released")).toHaveCount(0);
  });

  test("names the real cause when a chunk fails to load offline", async ({ page, context }) => {
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("vite:preloadError")));

    await expect(page.locator(".ui-dialog-title", { hasText: "offline" })).toBeVisible();
    await expect(page.getByText("New version released")).toHaveCount(0);
  });
});
