import { test, expect, type Page } from "@playwright/test";

declare const options: any;
declare const regeneratePrompt: (config?: { seed?: string }) => void;

// Real-control regression for the two zoom-family editor handlers: the styleRescaleMarkers change
// handler and the styleStatesHaloWidth input handler (public/modules/ui/style.js).
// Both now read/write the store (src/styles/styles.ts) instead of DOM attributes on #markers /
// #statesHalo, and invokeActiveZooming() re-derives the rendered value from the store on every
// zoom settle. Each case drives the actual control with a real DOM event and checks: (1) the
// immediate effect, (2) the typed store value, (3) survival across invokeActiveZooming() at a
// changed zoom, (4) the retired attribute is gone from the element.

const waitForMap = (page: Page) => page.waitForFunction(() => (window as any).mapId !== undefined, { timeout: 60000 });

const rn = (v: number, d = 0): number => Math.round(v * 10 ** d) / 10 ** d;

async function openStyleElement(
  page: Page,
  element:
    | "markers"
    | "regions"
    | "coordinates"
    | "ruler"
    | "legend"
    | "emblems"
    | "goodsIcons"
    | "goodsBurgs"
    | "markets"
    | "terrs"
    | "armies"
    | "gridOverlay"
    | "texture"
    | "ocean"
    | "scaleBar"
    | "labels"
    | "lakes"
    | "rivers"
    | "compass"
    | "burgIcons"
    | "anchors"
    | "vignette"
): Promise<void> {
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
        i,
        type: "custom",
        icon: "♨",
        x: 200,
        y: 200,
        dx: 50,
        dy: 50,
        px: 12,
        size: 30,
        pin: "bubble",
        fill: "#fff",
        stroke: "#000",
        cell: 0
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
    await page.locator("#styleGoodsSize").dispatchEvent("input");

    await openStyleElement(page, "goodsBurgs");
    await page.locator("#styleGoodsBurgsSize input[type=number]").fill("7");
    await page.locator("#styleGoodsBurgsSize").dispatchEvent("input");

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
    await page.locator("#styleMarketsSize").dispatchEvent("input");

    const stored = await page.evaluate(() => (window as any).styles.markets.options.size);
    expect(stored).toBe(6);
    expect(typeof stored).toBe("number");

    // the whole markets option family is off the DOM now
    for (const attr of ["data-size", "font-size", "data-icon"]) {
      expect(await page.locator("#markets").getAttribute(attr), attr).toBeNull();
    }
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

    await expect(page.locator("#pattern_pointyHex")).toHaveAttribute("patternTransform", "scale(2) translate(10 5)");

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

  test("markets icon size and goods circle write the store and drive the renderer", async ({ page }) => {
    await page.evaluate(() => {
      (window as any).Layers.show("goods");
      (window as any).Layers.show("markets");
    });

    await openStyleElement(page, "markets");
    await page.locator("#styleMarketsIconSize input[type=number]").fill("11");
    await page.locator("#styleMarketsIconSize").dispatchEvent("input");

    expect(await page.evaluate(() => (window as any).styles.markets.options.fontSize)).toBe(11);
    // drawn glyphs derive from the store base plus the zoom term (baseFont + 1/scale)
    const scale = await currentScale(page);
    const expectedFont = `${rn(11 + 1 / scale, 2)}px`;
    await expect(page.locator("#markets text").first()).toHaveAttribute("font-size", expectedFont);
    for (const attr of ["font-size", "data-icon", "data-size"]) {
      expect(await page.locator("#markets").getAttribute(attr), attr).toBeNull();
    }

    await openStyleElement(page, "goodsIcons");
    const before = await page.evaluate(() => (window as any).styles.goods.goodsIcons.options.circle);
    await page.locator('label[for="styleGoodsCircle"]').click();
    expect(await page.evaluate(() => (window as any).styles.goods.goodsIcons.options.circle)).toBe(!before);
    expect(typeof (await page.evaluate(() => (window as any).styles.goods.goodsIcons.options.circle))).toBe("boolean");
    expect(await page.locator("#goodsIcons").getAttribute("data-circle")).toBeNull();
  });

  test("texture controls write the store and the renderer rebuilds the image", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("texture"));
    await openStyleElement(page, "texture");

    await page.locator("#styleTextureShiftX").fill("40");
    await page.locator("#styleTextureShiftX").dispatchEvent("input");

    const stored = await page.evaluate(() => (window as any).styles.texture.options);
    expect(stored.x).toBe(40);
    expect(typeof stored.href).toBe("string");

    await expect(page.locator("#texture image")).toHaveAttribute("x", "40");
    for (const attr of ["data-href", "data-x", "data-y"]) {
      expect(await page.locator("#texture").getAttribute(attr), attr).toBeNull();
    }
  });

  test("ocean outline select writes the store and redraws the layers", async ({ page }) => {
    await openStyleElement(page, "ocean");

    await page.locator("#outlineLayers").selectOption("-6,-4,-2");

    expect(await page.evaluate(() => (window as any).styles.ocean.oceanLayers.options.outline)).toBe("-6,-4,-2");
    expect(await page.locator("#oceanLayers").getAttribute("layers")).toBeNull();
    expect(await page.evaluate(() => document.querySelectorAll("#oceanLayers > path").length)).toBe(3);
  });

  test("scale bar controls write the store and the renderer derives from them", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("scaleBar"));
    await openStyleElement(page, "scaleBar");

    for (const [input, value] of [
      ["#styleScaleBarSize", "2.5"],
      ["#styleScaleBarPositionX", "50"],
      ["#styleScaleBarBackgroundPaddingTop", "12"]
    ] as const) {
      await page.locator(input).fill(value);
      await page.locator(input).dispatchEvent("input");
    }
    await page.locator("#styleScaleBarLabel").fill("here be dragons");
    await page.locator("#styleScaleBarLabel").dispatchEvent("input");

    const stored = await page.evaluate(() => ({
      barSize: (window as any).styles.scaleBar.options.barSize,
      x: (window as any).styles.scaleBar.options.x,
      label: (window as any).styles.scaleBar.options.label,
      top: (window as any).styles.scaleBar.back.options.top
    }));
    expect(stored).toEqual({ barSize: 2.5, x: 50, label: "here be dragons", top: 12 });

    // renderer derives from the store: bar line stroke-width equals barSize, label text drawn
    await expect(page.locator("#scaleBarContent line").first()).toHaveAttribute("stroke-width", "2.5");
    await expect(page.locator("#scaleBarContent text").last()).toHaveText("here be dragons");
    await expect(page.locator("#scaleBarBack")).toHaveAttribute("y", "-12");

    for (const attr of ["data-bar-size", "data-x", "data-y", "data-label"]) {
      expect(await page.locator("#scaleBar").getAttribute(attr), attr).toBeNull();
    }
    for (const attr of ["data-top", "data-right", "data-bottom", "data-left"]) {
      expect(await page.locator("#scaleBarBack").getAttribute(attr), attr).toBeNull();
    }
  });

  // regression: these five were DOM-only writes, so the store kept the preset's values and
  // Styles.write restored them over the edit on the next load
  test("scale bar background paint writes the store and survives a store write", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("scaleBar"));
    await openStyleElement(page, "scaleBar");

    await page.locator("#styleScaleBarBackgroundOpacity input[type=number]").fill("0.65");
    await page.locator("#styleScaleBarBackgroundOpacity input[type=number]").dispatchEvent("input");
    await page.locator("#styleScaleBarBackgroundStrokeWidth").fill("2.5");
    await page.locator("#styleScaleBarBackgroundStrokeWidth").dispatchEvent("input");
    for (const [input, value] of [
      ["#styleScaleBarBackgroundFill", "#123456"],
      ["#styleScaleBarBackgroundStroke", "#654321"]
    ] as const) {
      await page.locator(input).fill(value);
      await page.locator(input).dispatchEvent("input");
    }

    const expected = { opacity: 0.65, fill: "#123456", stroke: "#654321", "stroke-width": 2.5 };
    expect(await page.evaluate(() => (window as any).styles.scaleBar.back.attrs)).toMatchObject(expected);

    // what load does after restoring the svg: the edit must be what the store writes back
    await page.evaluate(() => (window as any).Styles.write("scaleBar"));
    const back = page.locator("#scaleBarBack");
    await expect(back).toHaveAttribute("opacity", "0.65");
    await expect(back).toHaveAttribute("fill", "#123456");
    await expect(back).toHaveAttribute("stroke", "#654321");
    await expect(back).toHaveAttribute("stroke-width", "2.5");
  });

  test("label shift inputs write the store and apply the em transform", async ({ page }) => {
    await openStyleElement(page, "labels");
    const group = await page.evaluate(() => (window as any).styleGroupSelect.value);

    await page.locator("#styleFontShiftX").fill("1.5");
    await page.locator("#styleFontShiftX").dispatchEvent("input");
    await page.locator("#styleFontShiftY").fill("-0.5");
    await page.locator("#styleFontShiftY").dispatchEvent("input");

    const stored = await page.evaluate(g => (window as any).styles.labels.groups[g].attrs.style, group);
    expect(stored).toContain("transform: translate(1.5em, -0.5em)");

    const el = page.locator(`#labels > [data-group="${group}"]`);
    expect(await el.evaluate(node => (node as SVGElement).style.transform)).toBe("translate(1.5em, -0.5em)");
    expect(await el.getAttribute("data-dx")).toBeNull();
    expect(await el.getAttribute("data-dy")).toBeNull();
  });

  test("legend column input writes the store", async ({ page }) => {
    await openStyleElement(page, "legend");
    await page.locator("#styleLegendColItems input[type=number]").fill("3");
    await page.locator("#styleLegendColItems").dispatchEvent("input");

    expect(await page.evaluate(() => (window as any).styles.legend.options.columns)).toBe(3);
    expect(await page.locator("#legend").getAttribute("data-columns")).toBeNull();
  });

  test("generic attr controls write the store for any selection", async ({ page }) => {
    // nested group selection: lakes > freshwater
    await openStyleElement(page, "lakes");
    await page.locator("#styleGroupSelect").selectOption("freshwater");
    await page.locator("#styleFillInput").fill("#123456");
    await page.locator("#styleFillInput").dispatchEvent("input");
    await page.locator("#styleStrokeWidthInput input[type=number]").fill("3");

    // flat element selection: rivers
    await openStyleElement(page, "rivers");
    await page.locator("#styleOpacityInput input[type=number]").fill("0.4");

    const stored = await page.evaluate(() => ({
      lakeFill: (window as any).styles.lakes.freshwater.attrs.fill,
      lakeStrokeWidth: (window as any).styles.lakes.freshwater.attrs["stroke-width"],
      riversOpacity: (window as any).styles.rivers.attrs.opacity
    }));
    expect(stored).toEqual({ lakeFill: "#123456", lakeStrokeWidth: 3, riversOpacity: 0.4 });
    expect(typeof stored.lakeStrokeWidth).toBe("number");
    expect(typeof stored.riversOpacity).toBe("number");

    // the DOM presentation is written identically
    await expect(page.locator('#lakes [data-group="freshwater"], #freshwater').first()).toHaveAttribute(
      "fill",
      "#123456"
    );
    await expect(page.locator("#rivers")).toHaveAttribute("opacity", "0.4");
  });

  test("label group dropdown counts come from the label data, not the culled DOM", async ({ page }) => {
    // zoom in so some label tiers are culled from the DOM while their data still exists
    await page.evaluate(() => (window as any).setMapZoom(6));
    await page.waitForTimeout(200);
    await openStyleElement(page, "labels");

    const { optionCounts, dataCounts } = await page.evaluate(() => {
      const dataCounts: Record<string, number> = {};
      for (const label of (window as any).getLabelsData()) {
        dataCounts[label.group] = (dataCounts[label.group] || 0) + 1;
      }
      const optionCounts: Record<string, number> = {};
      for (const option of (document.getElementById("styleGroupSelect") as HTMLSelectElement).options) {
        const match = option.text.match(/^(.*) \((\d+)\)$/);
        if (match) optionCounts[match[1]] = Number(match[2]);
      }
      return { optionCounts, dataCounts };
    });

    expect(Object.keys(optionCounts).length).toBeGreaterThan(0);
    for (const [group, count] of Object.entries(optionCounts)) {
      expect(count, `dropdown count for ${group}`).toBe(dataCounts[group] || 0);
    }
    // at least one group must have labels in data at all, or the test proves nothing
    expect(Object.values(dataCounts).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  test("editing one label group leaves sibling groups' derived DOM values untouched", async ({ page }) => {
    await openStyleElement(page, "labels");
    const groups = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#labels > [data-group]")).map(el => (el as HTMLElement).dataset.group)
    );
    const target = groups[0]!;
    const sibling = groups.find(g => g !== target)!;
    expect(sibling).toBeTruthy();

    // simulate a zoom-derived sibling value living only on the DOM
    await page.evaluate(g => {
      document.querySelector(`#labels > [data-group="${g}"]`)!.setAttribute("stroke-width", "7.77");
    }, sibling);

    await page.locator("#styleGroupSelect").selectOption(target);
    await page.locator("#styleStrokeWidthInput input[type=number]").fill("2.5");

    const after = await page.evaluate(
      ([t, s]) => ({
        target: document.querySelector(`#labels > [data-group="${t}"]`)!.getAttribute("stroke-width"),
        sibling: document.querySelector(`#labels > [data-group="${s}"]`)!.getAttribute("stroke-width"),
        stored: (window as any).styles.labels.groups[t as string].attrs["stroke-width"]
      }),
      [target, sibling]
    );
    expect(after.stored).toBe(2.5);
    expect(after.target).toBe("2.5");
    expect(after.sibling, "sibling derived DOM value must survive").toBe("7.77");
  });

  test("burg icon controls write the store and the redraw derives from it", async ({ page }) => {
    await openStyleElement(page, "burgIcons");
    const group = await page.evaluate(() => (window as any).styleGroupSelect.value);

    await page.locator("#styleBurgIconsIconSize input[type=number]").fill("2.5");
    await page.locator("#styleBurgIconsFillOpacity input[type=number]").fill("0.6");
    await page.locator("#styleBurgIconsStrokeLinejoin").selectOption("round");

    const stored = await page.evaluate(
      g => ({
        size: (window as any).styles.burgIcons.burgIcons.groups[g].options.size,
        fillOpacity: (window as any).styles.burgIcons.burgIcons.groups[g].attrs["fill-opacity"],
        linejoin: (window as any).styles.burgIcons.burgIcons.groups[g].attrs["stroke-linejoin"]
      }),
      group
    );
    expect(stored).toEqual({ size: 2.5, fillOpacity: 0.6, linejoin: "round" });

    // the live group carries the presentation; a full redraw keeps the store values
    await page.evaluate(() => (window as any).Layers.draw("burgIcons"));
    const el = page.locator(`#burgIcons > g#${group}`);
    await expect(el).toHaveAttribute("font-size", "2.5");
    await expect(el).toHaveAttribute("fill-opacity", "0.6");

    // anchors size writes its own store node without minting data-size
    await openStyleElement(page, "anchors");
    const anchorGroup = await page.evaluate(() => (window as any).styleGroupSelect.value);
    await page.locator("#styleFontSize").fill("1.8");
    await page.locator("#styleFontSize").dispatchEvent("change");
    const anchorStored = await page.evaluate(
      g => (window as any).styles.burgIcons.anchors.groups[g].options.size,
      anchorGroup
    );
    expect(anchorStored).toBe(1.8);
    expect(await page.locator(`#anchors > g#${anchorGroup}`).getAttribute("data-size")).toBeNull();
  });

  test("a new map resets migrated group registries to saved-or-default groups", async ({ page }) => {
    // simulate what loading an old map's migration leaves behind in the session registries
    await page.evaluate(() => {
      options.burgs.groups = [{ name: "cities", isDefault: true, active: true, features: {}, preview: "" }];
      options.labels.groups = [{ name: "cities", type: "burg", zoom: { min: 1, max: 25 } }];
    });

    const before = await page.evaluate(() => (window as any).mapId);
    await page.evaluate(() => regeneratePrompt({ seed: "registry-reset-test" }));
    await page.waitForFunction(prev => (window as any).mapId !== prev, before, { timeout: 120000 });
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      burgGroupNames: options.burgs.groups.map((g: any) => g.name),
      labelGroupNames: options.labels.groups.map((g: any) => g.name),
      burgsInLegacyGroup: (window as any).pack.burgs.filter((b: any) => b?.i && b.group === "cities").length
    }));
    expect(after.burgGroupNames).not.toContain("cities");
    expect(after.burgGroupNames).toContain("town");
    expect(after.labelGroupNames).not.toContain("cities");
    expect(after.labelGroupNames).toContain("river");
    expect(after.burgsInLegacyGroup).toBe(0);
  });

  test("ocean pattern controls write the store and the applier derives from it", async ({ page }) => {
    await openStyleElement(page, "ocean");

    await page.locator("#styleOceanPattern").selectOption({ index: 2 });
    const chosen = await page.locator("#styleOceanPattern").inputValue();
    await page.locator("#styleOceanPatternOpacity input[type=number]").fill("0.55");
    await page.locator("#styleOceanPatternOpacity").dispatchEvent("input");

    const stored = await page.evaluate(() => ({
      pattern: (window as any).styles.ocean.options.pattern,
      opacity: (window as any).styles.ocean.options.patternOpacity
    }));
    expect(stored).toEqual({ pattern: chosen, opacity: 0.55 });

    // the applier restores the store values over a stale element on redraw
    await page.evaluate(() => {
      document.getElementById("oceanicPattern")!.setAttribute("opacity", "0.11");
      (window as any).Layers.draw("ocean");
    });
    await expect(page.locator("#oceanicPattern")).toHaveAttribute("opacity", "0.55");
    await expect(page.locator("#oceanicPattern")).toHaveAttribute("href", chosen);
  });

  test("vignette controls write the store and shape the mask rect", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("vignette"));
    await openStyleElement(page, "vignette");

    await page.locator("#styleVignetteX").fill("7");
    await page.locator("#styleVignetteX").dispatchEvent("input");
    await page.locator("#styleVignetteBlur input[type=number]").fill("12");
    await page.locator("#styleVignetteBlur").dispatchEvent("input");

    const stored = await page.evaluate(() => (window as any).styles.vignette.options);
    expect(stored.x).toBe("7%");
    expect(stored.filter).toBe("blur(12px)");
    await expect(page.locator("#vignette-rect")).toHaveAttribute("x", "7%");

    // a vignette preset moves both the display attrs and the mask geometry through the store
    await page.locator("#styleVignettePreset").selectOption("spotlight");
    const preset = await page.evaluate(() => ({
      fill: (window as any).styles.vignette.attrs.fill,
      rx: (window as any).styles.vignette.options.rx
    }));
    expect(preset).toEqual({ fill: "#000000", rx: "50%" });
    await expect(page.locator("#vignette-rect")).toHaveAttribute("rx", "50%");
  });

  test("a preset switch keeps the zoom-derived label container size", async ({ page }) => {
    await page.evaluate(() => (window as any).setMapZoom(4));
    await page.waitForTimeout(300);
    const zoomed = await page.locator("#labels").getAttribute("font-size");
    expect(zoomed).not.toBe("100px");

    await page.evaluate(async () => {
      sessionStorage.setItem("styleChangeConfirmed", "true");
      await (window as any).changeStyle("pale");
    });
    await page.waitForTimeout(200);

    // the store base (100px) must not stick - the container re-derives for the current zoom
    await expect(page.locator("#labels")).toHaveAttribute("font-size", zoomed!);
  });

  test("compass shift writes the rose transform through the store", async ({ page }) => {
    await page.evaluate(() => (window as any).Layers.show("compass"));
    await openStyleElement(page, "compass");

    await page.locator("#styleCompassShiftX").fill("30");
    await page.locator("#styleCompassShiftX").dispatchEvent("input");

    const stored = await page.evaluate(() => (window as any).styles.compass.compassRose.attrs.transform);
    expect(stored).toContain("translate(30");
    await expect(page.locator("#compass use")).toHaveAttribute("transform", stored);
  });
});
