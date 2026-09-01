import fs from "fs";
import path from "path";
import { expect, test, type Page } from "@playwright/test";

// Step 4 of the style-migration doc: styles.ts is now its own record (data[48]) in the map file.
// These tests pin the round trips the doc promises: a store-format save/reload survives a preset
// switch and a DOM-only editor write, an old, record-less map gets harvested into the store on
// load and then produces a store-format record of its own on the next save, a preset-nulled attr
// stays absent rather than getting backfilled from Styles.defaults, and a DOM-only #terrain write
// survives because the relief overlay no longer clobbers it.

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

  test("a DOM-only style write does not survive a save and load: the store is the authority", async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-editor&width=1280&height=720");
    await waitForMap(page);

    // pre-step-7 saves harvested the DOM, so this exact staleness class used to persist;
    // now the save serializes the store and the reload applies it back over the rogue value
    const storeFill = await page.evaluate(() => styles.rivers.attrs.fill);
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

    expect(after.store).toBe(storeFill);
    expect(after.dom).toBe(storeFill);
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

  test("record-less burg and anchor groups: the map's own styling reaches the store and the record", async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // a pre-1.9x-dialect map: same-named groups under #burgIcons and #anchors (by design, not
    // duplicates), styled via the bare `size` attr. The 1.145 dedupe migration must keep both,
    // and the record-less harvest must carry them into the store instead of the boot defaults.
    const fixture = fs.readFileSync(path.join(__dirname, "../fixtures/1.112.1.map"));
    const lines = fixture.toString("utf8").split("\r\n");
    lines[5] = lines[5]
      .replace('<g id="burgIcons"/>', '<g id="burgIcons"><g id="cities" fill="#ee2222" size="0.9"><use></use></g></g>')
      .replace('<g id="anchors"/>', '<g id="anchors"><g id="cities" fill="#22ee22" size="2.2"><use></use></g></g>');
    expect(lines[5], "burg group injection must match the serialized svg").toContain('fill="#ee2222"');
    expect(lines[5], "anchor group injection must match the serialized svg").toContain('fill="#22ee22"');

    await waitForMap(page);
    await reload(page, Buffer.from(lines.join("\r\n"), "utf8"), "recordless-burg-groups");
    await page.waitForTimeout(1000);

    const harvested = await page.evaluate(() => ({
      iconFill: styles.burgIcons.burgIcons.groups.cities?.attrs?.fill ?? null,
      iconSize: styles.burgIcons.burgIcons.groups.cities?.options?.size ?? null,
      anchorFill: styles.burgIcons.anchors.groups.cities?.attrs?.fill ?? null,
      anchorSize: styles.burgIcons.anchors.groups.cities?.options?.size ?? null
    }));

    // this fixture postdates the 1.109 size-doubling migration, so the sizes harvest as written
    expect(harvested.iconFill).toBe("#ee2222");
    expect(harvested.iconSize).toBe(0.9);
    expect(harvested.anchorFill).toBe("#22ee22");
    expect(harvested.anchorSize).toBe(2.2);

    const savedAgain = await saveAsDownload(page);
    const record = JSON.parse(savedAgain.toString("utf8").split("\r\n")[48]);
    expect(record.burgIcons.burgIcons.groups.cities.options.size).toBe(0.9);
    expect(record.burgIcons.anchors.groups.cities.options.size).toBe(2.2);
  });

  test("preset-nulled attr stays absent: a preset switch survives a save and load with no backfill", async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-null-preset&width=1280&height=720");
    await waitForMap(page);

    await page.evaluate(() => sessionStorage.setItem("styleChangeConfirmed", "true"));
    await page.evaluate(() => changeStyle("clean"));

    expect(await page.locator("#statesHalo").getAttribute("filter")).toBeNull();

    const buffer = await saveAsDownload(page);
    await reload(page, buffer, "style-persistence-null-preset-reloaded");

    const after = await page.evaluate(() => ({
      store: styles.states.statesHalo.attrs.filter,
      dom: document.getElementById("statesHalo")?.getAttribute("filter")
    }));

    expect(after.store).toBeNull();
    expect(after.dom).toBeNull();
  });

  test("step-4-era map: a store record beside the retired attrs strips them on load and every save after", async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-step4-era&width=1280&height=720");
    await waitForMap(page);

    // a real save already produces a store record (data[48]) with no rescale/data-width attrs on
    // the DOM. Mirror a step-4-era build's save by re-injecting both retired attrs into the
    // serialized #markers/#statesHalo groups (data[5]) beside that record, with values that
    // diverge from the store's own so a clobber is unambiguous.
    const buffer = await saveAsDownload(page);
    const lines = buffer.toString("utf8").split("\r\n");
    // Mark the serialized map as pre-v1.150 so the legacy migration path is exercised. A current
    // version with manually injected retired attrs is not an old-map compatibility scenario.
    lines[0] = lines[0].replace(/^[^|]+/, "1.149.0");
    lines[5] = lines[5]
      .replace('<g id="markers"', '<g id="markers" rescale="0"')
      .replace('<g id="statesHalo"', '<g id="statesHalo" data-width="7"')
      .replace('<g id="coordinates"', '<g id="coordinates" data-size="55"')
      .replace('<g id="ruler"', '<g id="ruler" data-size="44" font-size="44"')
      .replace('<g id="legend"', '<g id="legend" data-size="33"')
      .replace('<g id="stateEmblems"', '<g id="stateEmblems" data-size="4"')
      .replace('<g id="goodsIcons"', '<g id="goodsIcons" data-size="66"')
      .replace('<g id="goodsBurgs"', '<g id="goodsBurgs" data-size="66"')
      .replace('<g id="markets"', '<g id="markets" data-size="66"')
      .replace(
        '<g id="landHeights"',
        '<g id="landHeights" scheme="olive" terracing="2" skip="1" relax="1" curve="curveLinear"'
      )
      .replace(
        '<g id="oceanHeights"',
        '<g id="oceanHeights" scheme="bright" terracing="0" skip="0" relax="0" curve="curveBasisClosed" data-render="1"'
      )
      .replace('<g id="armies"', '<g id="armies" box-size="9"')
      .replace('<g id="gridOverlay"', '<g id="gridOverlay" type="square" scale="9" dx="9" dy="9"')
      .replace('<g id="sea_island"', '<g id="sea_island" auto-filter="0"')
      .replace('<g id="markets"', '<g id="markets" font-size="66" data-icon="Z"')
      .replace('<g id="goodsIcons"', '<g id="goodsIcons" data-circle="0"')
      .replace('<g id="texture"', '<g id="texture" data-href="./z.jpg" data-x="66" data-y="66"')
      .replace('<g id="oceanLayers"', '<g id="oceanLayers" layers="-6"')
      .replace('<g id="scaleBar"', '<g id="scaleBar" data-bar-size="4" data-x="40" data-y="40" data-label="stale"')
      .replace(
        '<rect id="scaleBarBack"',
        '<rect id="scaleBarBack" data-top="66" data-right="66" data-bottom="66" data-left="66"'
      )
      .replace('<g id="legend"', '<g id="legend" data-x="11" data-y="11" data-columns="2"');
    expect(lines[5], "scaleBar injection must match the serialized svg").toContain('data-bar-size="4"');
    expect(lines[5], "legend injection must match the serialized svg").toContain('data-columns="2"');
    const staleBuffer = Buffer.from(lines.join("\r\n"), "utf8");

    await reload(page, staleBuffer, "style-persistence-step4-era-reloaded");

    const afterLoad = await page.evaluate(() => ({
      markersRescaleAttr: document.getElementById("markers")?.getAttribute("rescale"),
      statesHaloWidthAttr: document.getElementById("statesHalo")?.getAttribute("data-width"),
      coordinatesSizeAttr: document.getElementById("coordinates")?.getAttribute("data-size"),
      rulerSizeAttr: document.getElementById("ruler")?.getAttribute("data-size"),
      legendSizeAttr: document.getElementById("legend")?.getAttribute("data-size"),
      familySizeAttrs: ["stateEmblems", "goodsIcons", "goodsBurgs", "markets"].map(id =>
        document.getElementById(id)?.getAttribute("data-size")
      ),
      marketsSize: styles.markets.options.size,
      landHeightsAttrs: ["scheme", "terracing", "skip", "relax", "curve"].map(a =>
        document.getElementById("landHeights")?.getAttribute(a)
      ),
      oceanRenderAttr: document.getElementById("oceanHeights")?.getAttribute("data-render"),
      landScheme: styles.heightmap.landHeights.options.scheme,
      smallFamilyAttrs: [
        document.getElementById("armies")?.getAttribute("box-size"),
        document.getElementById("gridOverlay")?.getAttribute("type"),
        document.getElementById("gridOverlay")?.getAttribute("scale"),
        document.getElementById("sea_island")?.getAttribute("auto-filter")
      ],
      gridScale: styles.grid.options.scale,
      contentAttrs: [
        document.getElementById("markets")?.getAttribute("font-size"),
        document.getElementById("markets")?.getAttribute("data-icon"),
        document.getElementById("goodsIcons")?.getAttribute("data-circle"),
        document.getElementById("texture")?.getAttribute("data-href"),
        document.getElementById("oceanLayers")?.getAttribute("layers")
      ],
      oceanOutline: styles.ocean.oceanLayers.options.outline,
      geometryAttrs: [
        document.getElementById("scaleBar")?.getAttribute("data-bar-size"),
        document.getElementById("scaleBarBack")?.getAttribute("data-top"),
        document.getElementById("legend")?.getAttribute("data-x"),
        document.getElementById("legend")?.getAttribute("data-columns")
      ],
      scaleBarSize: styles.scaleBar.options.barSize,
      rescale: styles.markers.options.rescale,
      haloWidth: styles.states.statesHalo.options.width,
      coordinatesSize: styles.coordinates.options.fontSize
    }));

    // The retired attrs are gone immediately. Legacy migration harvests their values into the
    // store before stripping them, so the migrated record reflects the serialized legacy values.
    expect(afterLoad.markersRescaleAttr).toBeNull();
    expect(afterLoad.statesHaloWidthAttr).toBeNull();
    expect(afterLoad.coordinatesSizeAttr).toBeNull();
    expect(afterLoad.rulerSizeAttr).toBeNull();
    expect(afterLoad.legendSizeAttr).toBeNull();
    expect(afterLoad.familySizeAttrs).toEqual([null, null, null, null]);
    expect(afterLoad.marketsSize).toBe(66);
    expect(afterLoad.landHeightsAttrs).toEqual([null, null, null, null, null]);
    expect(afterLoad.oceanRenderAttr).toBeNull();
    expect(afterLoad.landScheme).toBe("olive");
    expect(afterLoad.smallFamilyAttrs).toEqual([null, null, null, null]);
    expect(afterLoad.gridScale).toBe(9);
    expect(afterLoad.contentAttrs).toEqual([null, null, null, null, null]);
    expect(afterLoad.oceanOutline).toBe("-6");
    expect(afterLoad.geometryAttrs).toEqual([null, null, null, null]);
    expect(afterLoad.scaleBarSize).toBe(4);
    expect(afterLoad.rescale).toBe(0);
    expect(afterLoad.haloWidth).toBe(7);
    expect(afterLoad.coordinatesSize).toBe(55);

    // flip values through the store the way the real editor handlers do, then run a REAL save:
    // since step 7 the record serializes the store directly, no harvest in between
    await page.evaluate(() => {
      styles.markers.options.rescale = 0;
      styles.states.statesHalo.options.width = 3;
      styles.coordinates.options.fontSize = 21;
    });

    const savedAgain = await saveAsDownload(page);
    const record = JSON.parse(savedAgain.toString("utf8").split("\r\n")[48]);
    expect(record.markers.options.rescale).toBe(0);
    expect(record.states.statesHalo.options.width).toBe(3);
    expect(record.coordinates.options.fontSize).toBe(21);
  });

  test("save serializes the store: a rogue DOM-only attr does not leak into the record", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/?seed=store-authoritative-save&width=1280&height=720");
    await waitForMap(page);

    // diverge DOM and store: the store is the authority, the DOM write is rogue
    await page.evaluate(() => {
      styles.rivers.attrs.fill = "#0000aa";
      document.querySelector('[data-layer="rivers"]')!.setAttribute("fill", "#aa0000");
    });

    const buffer = await saveAsDownload(page);
    const lines = buffer.toString("utf8").split("\r\n");
    const record = JSON.parse(lines[48]);
    expect(record.rivers.attrs.fill).toBe("#0000aa");
  });

  test("relief attrs persistence: a store write survives a save and load", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/?seed=style-persistence-relief&width=1280&height=720");
    await waitForMap(page);

    // since step 7 the store is the only persistence path: the editor writes it, and a
    // DOM-only write is presentation that does not outlive the session
    await page.evaluate(() => {
      styles.relief.attrs.opacity = 0.42;
      d3.select("#terrain").attr("opacity", "0.42");
    });

    const buffer = await saveAsDownload(page);
    await reload(page, buffer, "style-persistence-relief-reloaded");

    const after = await page.evaluate(() => ({
      store: styles.relief.attrs.opacity,
      dom: document.getElementById("terrain")?.getAttribute("opacity")
    }));

    expect(after.store).toBe(0.42);
    expect(after.dom).toBe("0.42");
  });
});
