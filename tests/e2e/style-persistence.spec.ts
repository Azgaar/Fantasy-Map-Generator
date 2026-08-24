import fs from "fs";
import path from "path";
import { expect, test, type Page } from "@playwright/test";

// Step 4 of the style-migration doc: styles.ts is now its own record (data[48]) in the map file.
// These three tests pin the round trips the doc promises: a store-format save/reload survives a
// preset switch and a DOM-only editor write, and an old, record-less map gets harvested into the
// store on load and then produces a store-format record of its own on the next save.

declare const changeStyle: (preset: string) => Promise<void>;
declare const d3: { select: (selector: string) => { attr: (name: string, value: string) => unknown } };
declare const Services: {
  Save: { saveMap: (method: string) => Promise<void>; prepareMapData: () => string | Promise<string> };
};
declare const styles: any;

const waitForMap = (page: Page) => page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });

function readPreset(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(__dirname, `../../public/styles/${name}.json`), "utf8"));
}

async function saveAsDownload(page: Page): Promise<Buffer> {
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => Services.Save.saveMap("machine"));
  const download = await downloadPromise;
  return fs.readFileSync(await download.path());
}

// reload the generator from scratch (a fresh seed finishes generating and applying the default
// preset first), then load the given buffer back through the real upload path
async function reload(page: Page, buffer: Buffer, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}&width=1280&height=720`);
  await waitForMap(page);
  await page.locator("#mapToLoad").setInputFiles({ name: "round-trip.map", mimeType: "text/plain", buffer });
  await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });
}

test.describe("style persistence round trips", () => {
  test("new-map record: a preset switch survives a save and load", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-preset&width=1280&height=720");
    await waitForMap(page);

    await page.evaluate(() => sessionStorage.setItem("styleChangeConfirmed", "true"));
    await page.evaluate(() => changeStyle("ancient"));

    const expectedFill = readPreset("ancient").ocean.base.attrs.fill;
    const beforeFill = await page.locator("#oceanBase").getAttribute("fill");
    expect(beforeFill).toBe(expectedFill);

    const buffer = await saveAsDownload(page);
    await reload(page, buffer, "style-persistence-preset-reloaded");

    const after = await page.evaluate(() => ({
      store: styles.ocean.base.attrs.fill,
      dom: document.getElementById("oceanBase")?.getAttribute("fill")
    }));

    expect(after.store).toBe(expectedFill);
    expect(after.dom).toBe(expectedFill);
  });

  test("editor-edit persistence: a DOM-only style write survives a save and load", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-editor&width=1280&height=720");
    await waitForMap(page);

    // the style editor writes the DOM directly until step 6; this is that exact staleness class
    await page.evaluate(() => {
      d3.select("#rivers").attr("fill", "#ff0000");
    });
    expect(await page.locator("#rivers").getAttribute("fill")).toBe("#ff0000");

    const buffer = await saveAsDownload(page);
    await reload(page, buffer, "style-persistence-editor-reloaded");

    const after = await page.evaluate(() => ({
      store: styles.rivers.attrs.fill,
      dom: document.getElementById("rivers")?.getAttribute("fill")
    }));

    expect(after.store).toBe("#ff0000");
    expect(after.dom).toBe("#ff0000");
  });

  test("old-map harvest: a record-less map is harvested into the store and re-saves as store-format", async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // page.goto("/") kicks off an async auto-generated map (main.js's unawaited
    // generateMapOnLoad()) that can still be in flight here. Its own later showStatistics()
    // also sets window.mapId and re-applies styles, which can race with - and overwrite - the
    // uploaded fixture's harvested store right after this test observes it. Wait for the initial
    // generation to settle first, then require a fresh, different mapId after the upload so the
    // read below is provably this load's own harvest (same technique as e3ea5938).
    await page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 120000 });
    const initialMapId = await page.evaluate(() => (window as any).mapId);

    await page.waitForSelector("#mapToLoad", { state: "attached" });
    const mapFilePath = path.join(__dirname, "../fixtures/1.112.1.map");
    await page.locator("#mapToLoad").setInputFiles(mapFilePath);
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120000 });
    await page.waitForFunction(
      id => (window as any).mapId !== undefined && (window as any).mapId !== id,
      initialMapId,
      { timeout: 120000 }
    );

    // fixture carries fill="#6738bc" on #rivers and data-width="13" on #statesHalo - pin both
    // against those known embedded values, not just against each other, so the assertion actually
    // proves the harvest ran rather than comparing two reads of the same post-load state
    const harvested = await page.evaluate(() => ({
      riversStore: styles.rivers.attrs.fill,
      riversDom: document.getElementById("rivers")?.getAttribute("fill"),
      statesHaloWidth: styles.states.statesHalo.options.width
    }));

    expect(harvested.riversDom).toBe("#6738bc");
    expect(harvested.riversStore).toBe(harvested.riversDom);
    expect(harvested.statesHaloWidth).toBe(13);

    const record48 = await page.evaluate(async () => {
      const mapData = await Services.Save.prepareMapData();
      return mapData.split("\r\n")[48];
    });
    const parsed = JSON.parse(record48);
    expect(parsed).toHaveProperty("map");
  });
});
