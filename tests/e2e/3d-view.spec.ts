import { test, expect } from "@playwright/test";

// software WebGL (SwiftShader) requires an explicit opt-in in recent Chromium
test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

test.describe("3D view with eroded terrain", () => {
  // map generation + 3D view + software-WebGL bake can be slow under full-suite load
  test.setTimeout(180_000);

  test("bakes erosion detail and renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto("/");
    // mapId is set at the very end of map generation in showStatistics()
    await page.waitForFunction(() => (window as any).mapId !== undefined, {
      timeout: 120000,
    });

    const hasWebGL = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    });
    test.skip(!hasWebGL, "WebGL is not available in this environment");

    // enter the 3D mesh view through the same entry point the UI menu uses
    await page.evaluate(() => (window as any).Controllers.View3d.open("viewMesh"));
    await page.waitForSelector("#canvas3d", { state: "attached", timeout: 60000 });
    await page.waitForFunction(async () => (await (window as any).Controllers.View3d.isOn()) === true, {
      timeout: 60000,
    });

    // enable eroded terrain via the settings checkbox (dialog opens with the view)
    await page.waitForSelector("#options3dErosion", { state: "attached" });
    await page.evaluate(() => (document.getElementById("options3dErosion") as HTMLInputElement).click());

    // the bake must complete and cache the dense height field
    await page.waitForFunction(async () => await (window as any).Controllers.View3d.isCached(), {
      timeout: 60000,
    });

    // labels and icons sample the baked field: heights must be finite numbers
    const centerHeight = await page.evaluate(() => {
      const w = (window as any).graphWidth;
      const h = (window as any).graphHeight;
      return (window as any).Controllers.View3d.heightAt(w / 2, h / 2, 50);
    });
    expect(Number.isFinite(centerHeight)).toBe(true);

    // no page errors during view creation, bake, or re-render
    expect(errors).toEqual([]);
  });
});
