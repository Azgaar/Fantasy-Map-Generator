import path from "path";
import { expect, test } from "@playwright/test";

async function collectCriticalErrors(page: import("@playwright/test").Page, action: () => Promise<void>) {
  const errors: string[] = [];

  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  await action();

  return errors.filter(
    error =>
      !error.includes("fonts.googleapis.com") &&
      !error.includes("google-analytics") &&
      !error.includes("googletagmanager") &&
      !error.includes("Failed to load resource"),
  );
}

test.describe("scene bootstrap", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("creates runtime hosts on fresh load", async ({ page }) => {
    const criticalErrors = await collectCriticalErrors(page, async () => {
      await page.goto("/?seed=test-scene-bootstrap&width=1280&height=720");
      await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
    });

    const runtimeHosts = await page.evaluate(() => {
      const mapContainer = document.getElementById("map-container");
      const sceneContainer = document.getElementById("map-scene");
      const defsHost = document.getElementById("runtime-defs-host");
      const map = document.getElementById("map");
      const canvas = document.getElementById("webgl-canvas");

      return {
        hasMapContainer: !!mapContainer,
        hasSceneContainer: !!sceneContainer,
        hasDefsHost: !!defsHost,
        mapInsideScene: !!sceneContainer?.contains(map),
        canvasInsideScene: !!sceneContainer?.contains(canvas),
        defsOutsideScene: !!defsHost && !!sceneContainer && !sceneContainer.contains(defsHost),
      };
    });

    expect(runtimeHosts.hasMapContainer).toBe(true);
    expect(runtimeHosts.hasSceneContainer).toBe(true);
    expect(runtimeHosts.hasDefsHost).toBe(true);
    expect(runtimeHosts.mapInsideScene).toBe(true);
    expect(runtimeHosts.canvasInsideScene).toBe(true);
    expect(runtimeHosts.defsOutsideScene).toBe(true);
    expect(criticalErrors).toEqual([]);
  });

  test("reuses runtime hosts after loading a saved map", async ({ page }) => {
    const criticalErrors = await collectCriticalErrors(page, async () => {
      await page.goto("/");
      await page.waitForSelector("#mapToLoad", {state: "attached"});
      const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
      await page.locator("#mapToLoad").setInputFiles(mapFilePath);
      await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
    });

    const runtimeHosts = await page.evaluate(() => {
      const sceneContainer = document.getElementById("map-scene");
      const defsHost = document.getElementById("runtime-defs-host");
      const map = document.getElementById("map");
      const viewbox = document.getElementById("viewbox");
      const deftemp = document.getElementById("deftemp");
      const canvas = document.getElementById("webgl-canvas");

      return {
        hasSceneContainer: !!sceneContainer,
        hasDefsHost: !!defsHost,
        mapInsideScene: !!sceneContainer?.contains(map),
        canvasInsideScene: !!sceneContainer?.contains(canvas),
        rebuiltMapSelections: !!viewbox && !!deftemp,
      };
    });

    expect(runtimeHosts.hasSceneContainer).toBe(true);
    expect(runtimeHosts.hasDefsHost).toBe(true);
    expect(runtimeHosts.mapInsideScene).toBe(true);
    expect(runtimeHosts.canvasInsideScene).toBe(true);
    expect(runtimeHosts.rebuiltMapSelections).toBe(true);
    expect(criticalErrors).toEqual([]);
  });
});