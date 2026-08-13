import {test, expect} from "@playwright/test";

// page globals used inside page.evaluate
declare const toggleProvinces: () => void;
declare const toggleGoods: () => void;
declare const toggleTrade: () => void;

const getActiveLayers = () =>
  Array.from(document.querySelectorAll("#mapLayers > li:not(.buttonoff)"))
    .map(el => el.id)
    .sort();

test.describe("Layer state persistence", () => {
  test("save and load keeps toggled-off layers off", async ({page}) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
    await page.waitForTimeout(500);

    // exercise the layers reported to auto-enable on load (#1574):
    // draw each once, then turn it off again before saving
    await page.evaluate(() => {
      toggleProvinces();
      toggleGoods();
      toggleTrade();
    });
    await page.evaluate(() => {
      toggleProvinces();
      toggleGoods();
      toggleTrade();
    });

    const activeBeforeSave = await page.evaluate(getActiveLayers);
    expect(activeBeforeSave).not.toContain("toggleProvinces");
    expect(activeBeforeSave).not.toContain("toggleGoods");
    expect(activeBeforeSave).not.toContain("toggleTrade");

    const mapData: string = await page.evaluate(() => (window as any).Services.Save.prepareMapData());

    // load the just-saved map; mapId is re-exposed at the very end of loading
    await page.evaluate(() => {
      (window as any).mapId = undefined;
    });
    await page.locator("#mapToLoad").setInputFiles({
      name: "layer-state.map",
      mimeType: "text/plain",
      buffer: Buffer.from(mapData)
    });
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
    await page.waitForTimeout(500);

    const activeAfterLoad = await page.evaluate(getActiveLayers);
    expect(activeAfterLoad).toEqual(activeBeforeSave);
  });

  test("save and load keeps toggled-on layers on", async ({page}) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=test-seed&&width=1280&height=720");
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 60000});
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      toggleProvinces();
      toggleGoods();
      toggleTrade();
    });

    const activeBeforeSave = await page.evaluate(getActiveLayers);
    expect(activeBeforeSave).toEqual(expect.arrayContaining(["toggleProvinces", "toggleGoods", "toggleTrade"]));

    const mapData: string = await page.evaluate(() => (window as any).Services.Save.prepareMapData());

    await page.evaluate(() => {
      (window as any).mapId = undefined;
    });
    await page.locator("#mapToLoad").setInputFiles({
      name: "layer-state.map",
      mimeType: "text/plain",
      buffer: Buffer.from(mapData)
    });
    await page.waitForFunction(() => (window as any).mapId !== undefined, {timeout: 120000});
    await page.waitForTimeout(500);

    const activeAfterLoad = await page.evaluate(getActiveLayers);
    expect(activeAfterLoad).toEqual(activeBeforeSave);
  });
});
