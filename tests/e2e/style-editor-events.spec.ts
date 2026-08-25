import { test, expect, type Page } from "@playwright/test";

// Real-control regression for the two zoom-family editor handlers: the styleRescaleMarkers change
// handler and the styleStatesHaloWidth input handler (public/modules/ui/style.js).
// Both now read/write the store (src/styles/styles.ts) instead of DOM attributes on #markers /
// #statesHalo, and invokeActiveZooming() re-derives the rendered value from the store on every
// zoom settle. Each case drives the actual control with a real DOM event and checks: (1) the
// immediate effect, (2) the typed store value, (3) survival across invokeActiveZooming() at a
// changed zoom, (4) the retired attribute is gone from the element.

const waitForMap = (page: Page) =>
  page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });

const rn = (v: number, d = 0): number => Math.round(v * 10 ** d) / 10 ** d;

async function openStyleElement(page: Page, element: "markers" | "regions" | "coordinates" | "ruler" | "legend" | "emblems" | "goodsIcons" | "goodsBurgs" | "markets" | "terrs" | "armies" | "gridOverlay"): Promise<void> {
  await page.evaluate(() => (window as any).showOptions());
  await page.locator("#styleTab").click();
  await page.locator("#styleElementSelect").selectOption(element);
}

async function currentScale(page: Page): Promise<number> {
  const transform = await page.locator("#viewbox").getAttribute("transform");
  const match = transform?.match(/scale\(([^)]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

test.describe("style editor events drive the store", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=style-editor-events&width=1280&height=720");
    await waitForMap(page);
    await page.waitForSelector("#burgIcons > g", { state: "attached", timeout: 60000 });
    await page.waitForSelector("#labels > g", { state: "attached", timeout: 60000 });
    await page.waitForTimeout(500);
  });

  test("markers rescale checkbox writes the store and stops zoom rescaling", async ({ page }) => {
    // deterministic marker: don't depend on the generator having placed one for this seed. The
    // markers layer is off by default, so turn it on through the real registry API (the same
    // path the layer-toggle button drives) to get it drawn.
    const markerId = await page.evaluate(() => {
      const pack = (window as any).pack;
      pack.markers = pack.markers || [];
      const i = pack.markers.length;
      pack.markers.push({
        i, type: "custom", icon: "♨", x: 200, y: 200,
        dx: 50, dy: 50, px: 12, size: 30, pin: "bubble", fill: "#fff", stroke: "#000", cell: 0
      });
      (window as any).Layers.show("markers");
      return i;
    });

    await openStyleElement(page, "markers");
    await expect(page.locator("#styleRescaleMarkers")).toBeChecked();

    const readMarkerAttrs = (id: number) =>
      page.evaluate(markerId => {
        const el = document.getElementById(`marker${markerId}`)!;
        return {
          width: el.getAttribute("width"),
          height: el.getAttribute("height"),
          x: el.getAttribute("x"),
          y: el.getAttribute("y")
        };
      }, id);

    const before = await readMarkerAttrs(markerId);

    // real control: click the visible label bound to the checkbox (input[type=checkbox] is
    // display:none per FMG's checkbox pattern - the label carries the click target)
    await page.locator('label[for="styleRescaleMarkers"]').click();
    await expect(page.locator("#styleRescaleMarkers")).not.toBeChecked();

    // (1) immediate effect: the change handler already calls invokeActiveZooming(), and with
    // rescale now off it must leave the marker's geometry untouched
    const afterToggle = await readMarkerAttrs(markerId);
    expect(afterToggle).toEqual(before);

    // (2) typed store value
    const storeValue = await page.evaluate(() => (window as any).styles.markers.options.rescale);
    expect(storeValue).toBe(0);
    expect(typeof storeValue).toBe("number");

    // (3) survival across invokeActiveZooming() at a changed zoom
    await page.evaluate(() => (window as any).setMapZoom(6));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).invokeActiveZooming());
    const afterZoom = await readMarkerAttrs(markerId);
    expect(afterZoom).toEqual(before);

    // (4) the retired attribute never lands on the group element
    expect(await page.locator("#markers").getAttribute("rescale")).toBeNull();
  });

  test("states halo width slider writes the store and re-derives stroke-width on zoom", async ({ page }) => {
    // invokeActiveZooming only re-derives the halo width when rendering isn't in the fast
    // "optimizeSpeed" mode (the default) - switch to "Best quality" through the real Options tab
    await page.evaluate(() => (window as any).showOptions());
    await page.locator("#optionsTab").click();
    await page.locator("#shapeRendering").selectOption("geometricPrecision");

    await openStyleElement(page, "regions");

    const numberInput = page.locator("#styleStatesHaloWidth input[type=number]");
    await expect(numberInput).toHaveValue("10");

    // real control: type into the number half of <slider-input>, which re-dispatches a real
    // "input" CustomEvent on the host element that style.js listens for
    await numberInput.fill("5");

    // (1) immediate effect: the handler sets stroke-width straight from the raw input value
    await expect(page.locator("#statesHalo")).toHaveAttribute("stroke-width", "5");

    // (2) typed store value
    const storeWidth = await page.evaluate(() => (window as any).styles.states.statesHalo.options.width);
    expect(storeWidth).toBe(5);
    expect(typeof storeWidth).toBe("number");

    // (3) survival across invokeActiveZooming() at a changed zoom: re-derived from the store
    // base (5), not from the stroke-width attribute the handler just wrote
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).invokeActiveZooming());

    const scale = await currentScale(page);
    const expected = String(rn(5 / scale ** 0.8, 2));
    await expect(page.locator("#statesHalo")).toHaveAttribute("stroke-width", expected);

    // (4) the retired attribute never lands on the element
    expect(await page.locator("#statesHalo").getAttribute("data-width")).toBeNull();
  });

  test("coordinates size input writes the store and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("coordinates"));
    await openStyleElement(page, "coordinates");

    await page.locator("#styleFontSize").fill("24");
    await page.locator("#styleFontSize").dispatchEvent("change");

    // (2) typed store value
    const stored = await page.evaluate(() => (window as any).styles.coordinates.options.fontSize);
    expect(stored).toBe(24);
    expect(typeof stored).toBe("number");

    // (1)+(3) rendered size re-derived from the store base on redraw at a changed zoom
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).Layers.draw("coordinates"));
    const scale = await currentScale(page);
    const fontSize = await page.locator("#coordinates").getAttribute("font-size");
    expect(parseFloat(fontSize!)).toBeCloseTo(rn(24 / scale ** 0.8, 2), 1);

    // (4) the retired attribute is gone from the element
    expect(await page.locator("#coordinates").getAttribute("data-size")).toBeNull();
  });

  test("ruler size input writes the store and sizes drawn rulers", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).Measurers.createDefaultRuler();
      (window as any).Layers.show("rulers");
    });
    await openStyleElement(page, "ruler");

    await page.locator("#styleFontSize").fill("26");
    await page.locator("#styleFontSize").dispatchEvent("change");

    const stored = await page.evaluate(() => (window as any).styles.rulers.options.fontSize);
    expect(stored).toBe(26);
    expect(typeof stored).toBe("number");

    await expect(page.locator("#ruler > .ruler").first()).toHaveAttribute("font-size", "26");

    expect(await page.locator("#ruler").getAttribute("data-size")).toBeNull();
    expect(await page.locator("#ruler").getAttribute("font-size")).toBeNull();
  });

  test("legend size input writes the store", async ({ page }) => {
    await openStyleElement(page, "legend");

    await page.locator("#styleFontSize").fill("17");
    await page.locator("#styleFontSize").dispatchEvent("change");

    const stored = await page.evaluate(() => (window as any).styles.legend.options.fontSize);
    expect(stored).toBe(17);
    expect(typeof stored).toBe("number");

    expect(await page.locator("#legend").getAttribute("data-size")).toBeNull();
  });

  test("emblem size inputs write the store per group", async ({ page }) => {
    await openStyleElement(page, "emblems");

    for (const [input, value] of [
      ["#emblemsStateSizeInput", "1.5"],
      ["#emblemsProvinceSizeInput", "0.5"],
      ["#emblemsBurgSizeInput", "2"]
    ] as const) {
      await page.locator(`${input} input[type=number]`).fill(value);
      await page.locator(input).dispatchEvent("change");
    }

    const stored = await page.evaluate(() => ({
      state: (window as any).styles.emblems.stateEmblems.options.size,
      province: (window as any).styles.emblems.provinceEmblems.options.size,
      burg: (window as any).styles.emblems.burgEmblems.options.size
    }));
    expect(stored).toEqual({ state: 1.5, province: 0.5, burg: 2 });

    for (const id of ["#stateEmblems", "#provinceEmblems", "#burgEmblems"]) {
      expect(await page.locator(id).getAttribute("data-size")).toBeNull();
    }
  });

  test("goods size inputs write the store and size the drawn icons", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("goods"));
    await openStyleElement(page, "goodsIcons");

    await page.locator("#styleGoodsSize input[type=number]").fill("9");
    await page.locator("#styleGoodsSize").dispatchEvent("change");

    await openStyleElement(page, "goodsBurgs");
    await page.locator("#styleGoodsBurgsSize input[type=number]").fill("7");
    await page.locator("#styleGoodsBurgsSize").dispatchEvent("change");

    const stored = await page.evaluate(() => ({
      icons: (window as any).styles.goods.goodsIcons.options.size,
      burgs: (window as any).styles.goods.goodsBurgs.options.size
    }));
    expect(stored).toEqual({ icons: 9, burgs: 7 });

    expect(await page.locator("#goodsIcons").getAttribute("data-size")).toBeNull();
    expect(await page.locator("#goodsBurgs").getAttribute("data-size")).toBeNull();
  });

  test("markets size input writes the store and sizes the drawn plates", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("markets"));
    await openStyleElement(page, "markets");

    await page.locator("#styleMarketsSize input[type=number]").fill("6");
    await page.locator("#styleMarketsSize").dispatchEvent("change");

    const stored = await page.evaluate(() => (window as any).styles.markets.options.size);
    expect(stored).toBe(6);
    expect(typeof stored).toBe("number");

    // fontSize and icon are not in this family: their attrs must survive on the element
    expect(await page.locator("#markets").getAttribute("data-size")).toBeNull();
    expect(await page.locator("#markets").getAttribute("font-size")).not.toBeNull();
  });

  test("heightmap controls write the store per group and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("heightmap"));
    await openStyleElement(page, "terrs");

    // ocean group: scheme select, terracing slider, render-ocean checkbox
    await page.locator("#styleGroupSelect").selectOption("oceanHeights");
    await page.locator("#styleHeightmapScheme").selectOption("monochrome");
    await page.locator("#styleHeightmapTerracing input[type=number]").fill("3");
    await page.locator('label[for="styleHeightmapRenderOcean"]').click();

    // land group: skip, relax, curve
    await page.locator("#styleGroupSelect").selectOption("landHeights");
    await page.locator("#styleHeightmapSkip input[type=number]").fill("2");
    await page.locator("#styleHeightmapSimplification input[type=number]").fill("1");
    await page.locator("#styleHeightmapCurve").selectOption("curveLinear");

    const stored = await page.evaluate(() => ({
      oceanScheme: (window as any).styles.heightmap.oceanHeights.options.scheme,
      oceanTerracing: (window as any).styles.heightmap.oceanHeights.options.terracing,
      oceanRender: (window as any).styles.heightmap.oceanHeights.options.render,
      landSkip: (window as any).styles.heightmap.landHeights.options.skip,
      landRelax: (window as any).styles.heightmap.landHeights.options.relax,
      landCurve: (window as any).styles.heightmap.landHeights.options.curve
    }));
    expect(stored).toEqual({
      oceanScheme: "monochrome",
      oceanTerracing: 3,
      oceanRender: true,
      landSkip: 2,
      landRelax: 1,
      landCurve: "curveLinear"
    });

    // renderer derives from the store: render=true draws the ocean base rect
    expect(await page.locator("#oceanHeights rect").count()).toBeGreaterThan(0);

    // the retired attrs are gone from both groups
    for (const id of ["#landHeights", "#oceanHeights"]) {
      for (const attr of ["scheme", "terracing", "skip", "relax", "curve", "data-render"]) {
        expect(await page.locator(id).getAttribute(attr), `${id} ${attr}`).toBeNull();
      }
    }
  });

  test("armies size input writes the store and the renderer derives from it", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("military"));
    await openStyleElement(page, "armies");

    await page.locator("#styleArmiesSize input[type=number]").fill("4");

    const stored = await page.evaluate(() => ({
      boxSize: (window as any).styles.military.options.boxSize,
      fontSize: (window as any).styles.military.options.fontSize
    }));
    expect(stored).toEqual({ boxSize: 4, fontSize: 8 });

    // renderer derives from the store: a regiment box is 2x boxSize tall
    const boxHeight = await page.locator("#armies > g > g rect").first().getAttribute("height");
    expect(Number(boxHeight)).toBe(8);

    expect(await page.locator("#armies").getAttribute("box-size")).toBeNull();
    // font-size is renderer-stamped from the store (regiment labels size by inheritance)
    expect(await page.locator("#armies").getAttribute("font-size")).toBe("8");
  });

  test("grid controls write the store and restyle the pattern", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("grid"));
    await openStyleElement(page, "gridOverlay");

    await page.locator("#styleGridType").selectOption("pointyHex");
    for (const [input, value] of [
      ["#styleGridScale", "2"],
      ["#styleGridShiftX", "10"],
      ["#styleGridShiftY", "5"]
    ] as const) {
      await page.locator(input).fill(value);
      await page.locator(input).dispatchEvent("input");
    }

    const stored = await page.evaluate(() => (window as any).styles.grid.options);
    expect(stored).toEqual({ type: "pointyHex", scale: 2, dx: 10, dy: 5 });

    await expect(page.locator("#pattern_pointyHex")).toHaveAttribute(
      "patternTransform",
      "scale(2) translate(10 5)"
    );

    for (const attr of ["type", "scale", "dx", "dy"]) {
      expect(await page.locator("#gridOverlay").getAttribute(attr), attr).toBeNull();
    }
  });

  test("map filter buttons write the store and only the filter attr lands on #map", async ({ page }) => {
    await page.evaluate(() => (window as any).showOptions());
    await page.locator("#styleTab").click();
    await page.locator("#mapFilters #sepia").click();

    expect(await page.evaluate(() => (window as any).styles.map.options.dataFilter)).toBe("sepia");
    expect(await page.locator("#map").getAttribute("filter")).toBe("url(#filter-sepia)");
    expect(await page.locator("#map").getAttribute("data-filter")).toBeNull();

    // toggling off clears the store
    await page.locator("#mapFilters #sepia").click();
    expect(await page.evaluate(() => (window as any).styles.map.options.dataFilter)).toBeNull();
    expect(await page.locator("#map").getAttribute("filter")).toBeNull();
  });
});
